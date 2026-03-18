"""Main enrichment pipeline orchestrator."""

import asyncio
import hashlib
import logging
from typing import Callable

from database import get_db, update_manufacturer, get_cache, set_cache
from enrichment.address_parser import parse_address
from enrichment.edc_lookup import lookup_edc
from enrichment.customer_lookup import lookup_customers
from enrichment.trade_association_lookup import lookup_trade_associations

logger = logging.getLogger(__name__)


def make_cache_key(company_name: str, address: str) -> str:
    raw = f"{company_name.strip().lower()}|{address.strip().lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


async def enrich_single_manufacturer(
    manufacturer_id: int,
    company_name: str,
    address: str,
    website: str,
    progress_callback: Callable | None = None,
):
    """Run all three enrichment tracks for a single manufacturer."""
    db = await get_db()
    status = "failed"
    try:
        await update_manufacturer(db, manufacturer_id, {"status": "processing"})

        # Parse address
        addr = parse_address(address)
        city = addr["city"]
        state = addr["state"]
        county = addr.get("county", "")
        zip_code = addr["zip_code"]

        await update_manufacturer(db, manufacturer_id, {
            "city": city, "state": state, "county": county, "zip_code": zip_code
        })

        cache_key = make_cache_key(company_name, address)
        errors = []
        results = {}

        # Track A: EDC Lookup (1 search + 1-2 scrapes)
        try:
            cached = await get_cache(db, cache_key, "edc")
            if cached:
                edc_data = cached
            else:
                edc_data = await lookup_edc(city, state, county)
                await set_cache(db, cache_key, "edc", edc_data)
            results.update(edc_data)
        except Exception as e:
            logger.error(f"EDC lookup failed for {company_name}: {e}", exc_info=True)
            errors.append(f"EDC: {str(e)[:200]}")

        # Track B: Major Customers (1 search + 1-3 scrapes)
        try:
            cached = await get_cache(db, cache_key, "customers")
            if cached:
                customer_data = cached
            else:
                customer_data = await lookup_customers(company_name, website)
                await set_cache(db, cache_key, "customers", customer_data)
            results.update(customer_data)
        except Exception as e:
            logger.error(f"Customer lookup failed for {company_name}: {e}", exc_info=True)
            errors.append(f"Customers: {str(e)[:200]}")

        # Track C: Trade Associations (1 search + 1-3 scrapes)
        try:
            cached = await get_cache(db, cache_key, "trade_assoc")
            if cached:
                trade_data = cached
            else:
                trade_data = await lookup_trade_associations(company_name, website, city, state)
                await set_cache(db, cache_key, "trade_assoc", trade_data)
            results.update(trade_data)
        except Exception as e:
            logger.error(f"Trade association lookup failed for {company_name}: {e}", exc_info=True)
            errors.append(f"Trade Associations: {str(e)[:200]}")

        # Determine final status
        enrichment_fields = [
            "edc_name", "edc_contact_name", "edc_contact_email",
            "major_customers", "trade_associations",
        ]
        has_data = any(results.get(f) for f in enrichment_fields)

        if errors and not has_data:
            status = "failed"
        elif errors:
            status = "partial"
        elif not has_data:
            status = "partial"
        else:
            status = "complete"

        results["status"] = status
        if errors:
            results["error_log"] = "; ".join(errors)

        await update_manufacturer(db, manufacturer_id, results)
        logger.info(f"Enriched {company_name}: status={status}")
        return results

    except Exception as e:
        logger.error(f"Pipeline failed for {company_name}: {e}", exc_info=True)
        status = "failed"
        try:
            await update_manufacturer(db, manufacturer_id, {
                "status": "failed", "error_log": str(e)[:500],
            })
        except Exception:
            logger.error(f"Failed to update manufacturer {manufacturer_id} status")
        return {"status": "failed", "error_log": str(e)}
    finally:
        # Always call progress callback so frontend never gets stuck
        if progress_callback:
            try:
                await progress_callback(manufacturer_id, status)
            except Exception as e:
                logger.error(f"Progress callback failed: {e}")
        try:
            await db.close()
        except Exception:
            pass


async def enrich_batch(
    manufacturers: list[dict],
    progress_callback: Callable | None = None,
    max_concurrent: int | None = None,
):
    """Enrich a batch of manufacturers.

    Processes sequentially by default (max_concurrent=1) to avoid
    overwhelming the free DuckDuckGo search API with concurrent requests.
    """
    concurrency = max_concurrent or 1

    if concurrency <= 1:
        # Sequential processing — most reliable with DDG
        for mfr in manufacturers:
            try:
                await asyncio.wait_for(
                    enrich_single_manufacturer(
                        manufacturer_id=mfr["id"],
                        company_name=mfr["company_name"],
                        address=mfr.get("address") or "",
                        website=mfr.get("website") or "",
                        progress_callback=progress_callback,
                    ),
                    timeout=300,  # 5 min per manufacturer
                )
            except asyncio.TimeoutError:
                logger.error(f"Enrichment timed out for {mfr['company_name']}")
                if progress_callback:
                    try:
                        await progress_callback(mfr["id"], "failed")
                    except Exception:
                        pass
            except Exception as e:
                logger.error(f"Unexpected error enriching {mfr['company_name']}: {e}")
                if progress_callback:
                    try:
                        await progress_callback(mfr["id"], "failed")
                    except Exception:
                        pass
    else:
        # Concurrent processing with semaphore
        semaphore = asyncio.Semaphore(concurrency)

        async def _enrich_with_semaphore(mfr):
            try:
                async with semaphore:
                    return await asyncio.wait_for(
                        enrich_single_manufacturer(
                            manufacturer_id=mfr["id"],
                            company_name=mfr["company_name"],
                            address=mfr.get("address") or "",
                            website=mfr.get("website") or "",
                            progress_callback=progress_callback,
                        ),
                        timeout=300,
                    )
            except asyncio.TimeoutError:
                logger.error(f"Enrichment timed out for {mfr['company_name']}")
                if progress_callback:
                    try:
                        await progress_callback(mfr["id"], "failed")
                    except Exception:
                        pass
            except Exception as e:
                logger.error(f"Unexpected error enriching {mfr['company_name']}: {e}")

        tasks = [_enrich_with_semaphore(mfr) for mfr in manufacturers]
        await asyncio.gather(*tasks, return_exceptions=True)
