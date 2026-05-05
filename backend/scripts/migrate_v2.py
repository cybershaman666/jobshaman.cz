import asyncio
import os
import asyncpg
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlunparse
from dotenv import load_dotenv

ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"
BACKEND_ENV = Path(__file__).resolve().parents[3] / "backend" / ".env"

load_dotenv(ROOT_ENV)
load_dotenv(BACKEND_ENV)

async def migrate():
    dsn = os.environ.get("DATABASE_URL") or os.environ.get("EXTERNAL_POSTGRES_URI")
    if not dsn:
        print("Error: DATABASE_URL / EXTERNAL_POSTGRES_URI not set")
        return

    parsed = urlparse(dsn)
    query = parse_qs(parsed.query)
    ssl_required = query.get("sslmode", [""])[0] == "require"
    if parsed.scheme == "postgresql+asyncpg":
        parsed = parsed._replace(scheme="postgresql")
    if parsed.query:
        parsed = parsed._replace(query="")

    conn = await asyncpg.connect(urlunparse(parsed), ssl="require" if ssl_required else None)
    try:
        print("Starting V2 migrations...")

        migrations_dir = Path(__file__).resolve().parent.parent / "migrations"
        migration_paths = sorted(migrations_dir.glob("*.sql"))
        if not migration_paths:
            print(f"Warning: no SQL migrations found in {migrations_dir}")

        for migration_path in migration_paths:
            print(f"Applying migration: {migration_path.name}")
            await conn.execute(migration_path.read_text())
        
        print("Migrations completed successfully.")
    except Exception as e:
        print(f"Migration failed: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(migrate())
