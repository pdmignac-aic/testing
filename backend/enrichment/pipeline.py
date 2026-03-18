"""Main enrichment pipeline orchestrator."""

import asyncio
import hashlib
import json
import logging
from typing import Callable

from database import get_db, update_manufacturer, get_cache, set_cache
from enrichment.address_parser import parse_address
from enrichment.edc_lookup import lookup_edc
from enrichment.customer_lookup import lookup_customers
from enrichment.trade_association_lookup import lookup_trade_associations
from config import settings

logger = logging.getLogger(__name__)


def make_cache_key(company_name: str, address: str) -> str:
    """Create content-addressable cache key."""
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
    try:
        # Update status to processing
        await update_manufacturer(db, manufacturer_id, {"status": "processing"})

        # Parse address
        addr = parse_address(address)
        city = addr["city"]
        state = addr["state"]
        county = addr.get("county", "")
        zip_code = addr["zip_code"]

        # Update parsed address fields
        await update_manufacturer(db, manufacturer_id, {
            "city": city, "state": state, "county": county, "zip_code": zip_code
        })

        cache_key = make_cache_key(company_name, address)
        errors = []
        results = {}

        # Track A: EDC Lookup
        try:
            cached = await get_cache(db, cache_key, "edc")
            if cached:
                edc_data = cached
            else:
                edc_data = await lookup_edc(city, state, county)
                await set_cache(db, cache_key, "edc", edc_data)
            results.update(edc_data)
        except Exception as e:
            logger.error(f"EDC lookup failed for {company_name}: {e}")
            errors.append(f"EDC: {str(e)}")

        # Brief delay between tracks to avoid search rate limiting
        await asyncio.sleep(2)

        # Track B: Major Customers
        try:
            cached = await get_cache(db, cache_key, "customers")
            if cached:
                customer_data = cached
            else:
                customer_data = await lookup_customers(company_name, website)
                await set_cache(db, cache_key, "customers", customer_data)
            results.update(customer_data)
        except Exception as e:
            logger.error(f"Customer lookup failed for {company_name}: {e}")
            errors.append(f"Customers: {str(e)}")

        # Brief delay between tracks to avoid search rate limiting
        await asyncio.sleep(2)

        # Track C: Trade Associations
        try:
            cached = await get_cache(db, cache_key, "trade_assoc")
            if cached:
                trade_data = cached
            else:
                trade_data = await lookup_trade_associations(company_name, website, city, state)
                await set_cache(db, cache_key, "trade_assoc", trade_data)
            results.update(trade_data)
        except Exception as e:
            logger.error(f"Trade association lookup failed for {company_name}: {e}")
            errors.append(f"Trade Associations: {str(e)}")

        # Determine final status
        # Check if we actually got any meaningful enrichment data
        enrichment_fields = [
            "edc_name", "edc_contact_name", "edc_contact_email",
            "major_customers", "trade_associations",
        ]
        has_data = any(results.get(f) for f in enrichment_fields)

        if errors and not results:
            status = "failed"
        elif errors:
            status = "partial"
        elif not has_data:
            status = "partial"
            errors.append("No enrichment data found (search API may not be configured)")
        else:
            status = "complete"

        results["status"] = status
        if errors:
            results["error_log"] = "; ".join(errors)

        await update_manufacturer(db, manufacturer_id, results)

        if progress_callback:
            await progress_callback(manufacturer_id, status)

        return results

    except Exception as e:
        logger.error(f"Pipeline failed for {company_name}: {e}")
        await update_manufacturer(db, manufacturer_id, {
            "status": "failed",
            "error_log": str(e),
        })
        raise
    finally:
        await db.close()


async def enrich_batch(
    manufacturers: list[dict],
    progress_callback: Callable | None = None,
    max_concurrent: int | None = None,
):
    """Enrich a batch of manufacturers with concurrency control."""
    semaphore = asyncio.Semaphore(max_concurrent or settings.MAX_CONCURRENT)

    async def _enrich_with_semaphore(mfr):
        async with semaphore:
            return await enrich_single_manufacturer(
                manufacturer_id=mfr["id"],
                company_name=mfr["company_name"],
                address=mfr["address"],
                website=mfr["website"],
                progress_callback=progress_callback,
            )

    tasks = [_enrich_with_semaphore(mfr) for mfr in manufacturers]
    return await asyncio.gather(*tasks, return_exceptions=True)
