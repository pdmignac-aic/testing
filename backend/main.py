"""FastAPI backend for the Manufacturer Relationship Mapper."""

import asyncio
import csv
import io
import json
import logging
import uuid
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import settings
from database import init_db, get_db, get_manufacturers_by_batch, insert_manufacturer, update_manufacturer, get_manufacturer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Manufacturer Relationship Mapper", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory progress tracking
enrichment_progress: dict[str, dict] = {}
# Track active enrichment tasks
active_tasks: dict[str, asyncio.Task] = {}


@app.on_event("startup")
async def startup():
    await init_db()
    from search import get_search_provider, MockSearchProvider
    provider = get_search_provider()
    if isinstance(provider, MockSearchProvider):
        logger.warning(
            "⚠ No search API keys configured! Enrichment will return empty results. "
            "Set GOOGLE_API_KEY + GOOGLE_CSE_ID, SERPAPI_KEY, or BRAVE_API_KEY."
        )


class BatchInfo(BaseModel):
    batch_id: str
    total: int
    preview: list[dict]


class EnrichRequest(BaseModel):
    batch_id: str
    max_concurrent: Optional[int] = None


class ProgressResponse(BaseModel):
    batch_id: str
    total: int
    completed: int
    processing: int
    failed: int
    partial: int
    pending: int
    status: str  # running, complete, idle
    errors: list[dict]


@app.post("/api/upload", response_model=BatchInfo)
async def upload_csv(file: UploadFile = File(...)):
    """Upload and parse a CSV file of manufacturers."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # Handle BOM
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    # Parse CSV
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file appears to be empty")

    # Normalize field names
    fieldnames = [f.strip().lower().replace(" ", "_") for f in reader.fieldnames]

    # Validate required columns
    required = {"company_name"}
    if not required.issubset(set(fieldnames)):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must contain columns: {required}. Found: {fieldnames}",
        )

    batch_id = str(uuid.uuid4())[:8]
    db = await get_db()

    rows = []
    try:
        for raw_row in reader:
            # Normalize keys
            row = {}
            for key, value in raw_row.items():
                clean_key = key.strip().lower().replace(" ", "_")
                row[clean_key] = (value or "").strip()

            if not row.get("company_name"):
                continue

            await insert_manufacturer(db, batch_id, row)
            rows.append(row)

        await db.commit()
    finally:
        await db.close()

    if not rows:
        raise HTTPException(status_code=400, detail="No valid rows found in CSV")

    preview = rows[:10]

    return BatchInfo(batch_id=batch_id, total=len(rows), preview=preview)


@app.post("/api/enrich")
async def start_enrichment(request: EnrichRequest):
    """Start enrichment for a batch."""
    batch_id = request.batch_id

    if batch_id in active_tasks and not active_tasks[batch_id].done():
        raise HTTPException(status_code=409, detail="Enrichment already in progress for this batch")

    db = await get_db()
    try:
        rows = await get_manufacturers_by_batch(db, batch_id)
    finally:
        await db.close()

    if not rows:
        raise HTTPException(status_code=404, detail="Batch not found")

    manufacturers = [dict(row) for row in rows]

    # Initialize progress
    enrichment_progress[batch_id] = {
        "total": len(manufacturers),
        "completed": 0,
        "processing": 0,
        "failed": 0,
        "partial": 0,
        "pending": len(manufacturers),
        "status": "running",
        "errors": [],
    }

    async def progress_callback(mfr_id: int, status: str):
        prog = enrichment_progress.get(batch_id)
        if prog:
            prog["processing"] = max(0, prog["processing"] - 1)
            if status == "complete":
                prog["completed"] += 1
            elif status == "failed":
                prog["failed"] += 1
            elif status == "partial":
                prog["partial"] += 1
            prog["pending"] = max(0, prog["pending"] - 1)

    async def run_enrichment():
        from enrichment.pipeline import enrich_batch
        try:
            # Update processing count as we go
            prog = enrichment_progress[batch_id]
            prog["processing"] = min(
                settings.MAX_CONCURRENT if request.max_concurrent is None else request.max_concurrent,
                prog["total"],
            )
            prog["pending"] = prog["total"] - prog["processing"]

            await enrich_batch(
                manufacturers,
                progress_callback=progress_callback,
                max_concurrent=request.max_concurrent,
            )
        except Exception as e:
            logger.error(f"Batch enrichment error: {e}")
        finally:
            prog = enrichment_progress.get(batch_id)
            if prog:
                prog["status"] = "complete"
                prog["processing"] = 0

    task = asyncio.create_task(run_enrichment())
    active_tasks[batch_id] = task

    return {"message": "Enrichment started", "batch_id": batch_id}


@app.post("/api/enrich/{manufacturer_id}")
async def enrich_single(manufacturer_id: int):
    """Enrich a single manufacturer."""
    db = await get_db()
    try:
        row = await get_manufacturer(db, manufacturer_id)
    finally:
        await db.close()

    if not row:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    mfr = dict(row)

    async def run():
        from enrichment.pipeline import enrich_single_manufacturer
        await enrich_single_manufacturer(
            manufacturer_id=mfr["id"],
            company_name=mfr["company_name"],
            address=mfr["address"] or "",
            website=mfr["website"] or "",
        )

    asyncio.create_task(run())
    return {"message": "Enrichment started", "manufacturer_id": manufacturer_id}


@app.get("/api/progress/{batch_id}", response_model=ProgressResponse)
async def get_progress(batch_id: str):
    """Get enrichment progress for a batch."""
    # If we don't have live progress, compute from DB
    if batch_id not in enrichment_progress:
        db = await get_db()
        try:
            rows = await get_manufacturers_by_batch(db, batch_id)
        finally:
            await db.close()

        if not rows:
            raise HTTPException(status_code=404, detail="Batch not found")

        status_counts = {"pending": 0, "processing": 0, "complete": 0, "failed": 0, "partial": 0}
        errors = []
        for row in rows:
            r = dict(row)
            s = r.get("status", "pending")
            status_counts[s] = status_counts.get(s, 0) + 1
            if r.get("error_log"):
                errors.append({"id": r["id"], "company": r["company_name"], "error": r["error_log"]})

        return ProgressResponse(
            batch_id=batch_id,
            total=len(rows),
            completed=status_counts.get("complete", 0),
            processing=status_counts.get("processing", 0),
            failed=status_counts.get("failed", 0),
            partial=status_counts.get("partial", 0),
            pending=status_counts.get("pending", 0),
            status="complete" if status_counts.get("processing", 0) == 0 and status_counts.get("pending", 0) == 0 else "running",
            errors=errors,
        )

    prog = enrichment_progress[batch_id]
    return ProgressResponse(batch_id=batch_id, **prog)


@app.get("/api/manufacturers/{batch_id}")
async def get_manufacturers(
    batch_id: str,
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_dir: Optional[str] = Query("asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
):
    """Get manufacturers for a batch with search, sort, and pagination."""
    db = await get_db()
    try:
        rows = await get_manufacturers_by_batch(db, batch_id)
    finally:
        await db.close()

    if not rows:
        raise HTTPException(status_code=404, detail="Batch not found")

    manufacturers = [dict(row) for row in rows]

    # Search filter
    if search:
        search_lower = search.lower()
        manufacturers = [
            m for m in manufacturers
            if search_lower in (m.get("company_name") or "").lower()
            or search_lower in (m.get("address") or "").lower()
            or search_lower in (m.get("edc_name") or "").lower()
            or search_lower in (m.get("major_customers") or "").lower()
            or search_lower in (m.get("trade_associations") or "").lower()
        ]

    # Sort
    if sort_by and sort_by in manufacturers[0] if manufacturers else False:
        reverse = sort_dir == "desc"
        manufacturers.sort(key=lambda m: (m.get(sort_by) or "").lower(), reverse=reverse)

    # Pagination
    total = len(manufacturers)
    start = (page - 1) * page_size
    end = start + page_size
    page_data = manufacturers[start:end]

    return {
        "data": page_data,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@app.get("/api/export/{batch_id}")
async def export_csv(batch_id: str):
    """Export enriched data as CSV."""
    db = await get_db()
    try:
        rows = await get_manufacturers_by_batch(db, batch_id)
    finally:
        await db.close()

    if not rows:
        raise HTTPException(status_code=404, detail="Batch not found")

    output = io.StringIO()
    fieldnames = [
        "company_name", "address", "website", "city", "state", "zip_code",
        "edc_name", "edc_contact_name", "edc_contact_email", "edc_contact_phone", "edc_website",
        "major_customers", "customer_source",
        "trade_associations",
        "status", "error_log",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()

    for row in rows:
        writer.writerow(dict(row))

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=enriched_{batch_id}.csv"},
    )


@app.get("/api/health")
async def health():
    return {"status": "ok", "search_provider": settings.SEARCH_API_PROVIDER}


@app.get("/api/config/status")
async def config_status():
    """Check if the backend is properly configured for enrichment."""
    from search import get_search_provider, MockSearchProvider
    provider = get_search_provider()
    is_mock = isinstance(provider, MockSearchProvider)
    return {
        "search_configured": not is_mock,
        "search_provider": type(provider).__name__,
        "message": (
            "No search API keys configured. Enrichment requires at least one search provider. "
            "Set GOOGLE_API_KEY + GOOGLE_CSE_ID, SERPAPI_KEY, or BRAVE_API_KEY in your environment."
            if is_mock else f"Using {type(provider).__name__}"
        ),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
