import asyncio
import os
import sys
from urllib.parse import urlparse, parse_qs, urlunparse
import asyncpg
from dotenv import load_dotenv

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
load_dotenv(os.path.join(project_root, '.env'))

async def main():
    dsn = os.environ.get("DATABASE_URL") or os.environ.get("EXTERNAL_POSTGRES_URI") or os.environ.get("POSTGRES_URI")
    if not dsn:
        print("DATABASE_URL or EXTERNAL_POSTGRES_URI or POSTGRES_URI not set")
        sys.exit(1)

    print(f"Connecting to database: {dsn.split('@')[-1]}")
    parsed = urlparse(dsn)
    query = parse_qs(parsed.query)
    ssl_required = query.get("sslmode", [""])[0] == "require"
    if parsed.scheme == "postgresql+asyncpg":
        parsed = parsed._replace(scheme="postgresql")
    if parsed.query:
        parsed = parsed._replace(query="")

    conn = await asyncpg.connect(urlunparse(parsed), ssl="require" if ssl_required else None)
    try:
        # Search translations
        print("\n--- Searching jcfpm_item_translations in Azure Postgres ---")
        rows = await conn.fetch("""
            SELECT item_id, locale, prompt, payload_json::text
            FROM jcfpm_item_translations
            WHERE prompt ILIKE '%řetěz%' OR prompt ILIKE '%spustí%' OR prompt ILIKE '%změna%'
        """)
        print(f"Found {len(rows)} matching translations:")
        for r in rows[:15]:
            print(f"Item: {r['item_id']} | Locale: {r['locale']}")
            print(f"  Prompt: {r['prompt']}")
            print(f"  Payload: {r['payload_json'][:300]}")
            print("-" * 50)

        # Search items
        print("\n--- Searching jcfpm_items in Azure Postgres ---")
        rows_items = await conn.fetch("""
            SELECT item_id, item_type, dimension, payload_json::text
            FROM jcfpm_items
            WHERE payload_json::text ILIKE '%řetěz%' OR payload_json::text ILIKE '%spustí%'
        """)
        print(f"Found {len(rows_items)} matching items:")
        for r in rows_items[:15]:
            print(f"Item: {r['item_id']} | Type: {r['item_type']} | Dim: {r['dimension']}")
            print(f"  Payload: {r['payload_json'][:300]}")
            print("-" * 50)
            
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
