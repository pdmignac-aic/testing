import aiosqlite
import json
import os
from config import settings

DB_PATH = settings.DB_PATH


async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db():
    db = await get_db()
    try:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS manufacturers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT NOT NULL,
                company_name TEXT NOT NULL,
                address TEXT,
                website TEXT,
                city TEXT,
                county TEXT,
                state TEXT,
                zip_code TEXT,
                status TEXT DEFAULT 'pending',
                edc_name TEXT,
                edc_contact_name TEXT,
                edc_contact_email TEXT,
                edc_contact_phone TEXT,
                edc_website TEXT,
                edc_source TEXT,
                major_customers TEXT,
                customer_source TEXT,
                trade_associations TEXT,
                error_log TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS cache (
                cache_key TEXT PRIMARY KEY,
                track TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()
    finally:
        await db.close()


async def get_manufacturer(db, manufacturer_id: int):
    cursor = await db.execute("SELECT * FROM manufacturers WHERE id = ?", (manufacturer_id,))
    return await cursor.fetchone()


async def get_manufacturers_by_batch(db, batch_id: str):
    cursor = await db.execute(
        "SELECT * FROM manufacturers WHERE batch_id = ? ORDER BY id", (batch_id,)
    )
    return await cursor.fetchall()


async def insert_manufacturer(db, batch_id: str, data: dict):
    await db.execute(
        """INSERT INTO manufacturers (batch_id, company_name, address, website, city, county, state, zip_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            batch_id,
            data.get("company_name", ""),
            data.get("address", ""),
            data.get("website", ""),
            data.get("city", ""),
            data.get("county", ""),
            data.get("state", ""),
            data.get("zip_code", ""),
        ),
    )


async def update_manufacturer(db, manufacturer_id: int, updates: dict):
    set_clauses = []
    values = []
    for key, value in updates.items():
        set_clauses.append(f"{key} = ?")
        values.append(value)
    set_clauses.append("updated_at = CURRENT_TIMESTAMP")
    values.append(manufacturer_id)
    query = f"UPDATE manufacturers SET {', '.join(set_clauses)} WHERE id = ?"
    await db.execute(query, values)
    await db.commit()


async def get_cache(db, cache_key: str, track: str):
    cursor = await db.execute(
        "SELECT data FROM cache WHERE cache_key = ? AND track = ?", (cache_key, track)
    )
    row = await cursor.fetchone()
    if row:
        return json.loads(row[0])
    return None


async def set_cache(db, cache_key: str, track: str, data: dict):
    await db.execute(
        "INSERT OR REPLACE INTO cache (cache_key, track, data) VALUES (?, ?, ?)",
        (cache_key, track, json.dumps(data)),
    )
    await db.commit()
