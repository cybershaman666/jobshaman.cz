import asyncio
import os
import sys
import asyncpg
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlunparse
from dotenv import load_dotenv

SCRIPT_PATH = Path(__file__).resolve()
BACKEND_ROOT = SCRIPT_PATH.parent.parent
REPO_ROOT = BACKEND_ROOT.parent

ROOT_ENV = REPO_ROOT / ".env"
BACKEND_ENV = BACKEND_ROOT / ".env"

load_dotenv(ROOT_ENV)
load_dotenv(BACKEND_ENV)

MIGRATION_LOCK_ID = 684_206_006
MIGRATION_ORDER_OVERRIDES = {
    "001_core.sql": (1, 0),
    "001_add_team_invitation_columns.sql": (1, 10),
}


def migration_sort_key(path: Path) -> tuple[int, int, str]:
    if path.name in MIGRATION_ORDER_OVERRIDES:
        major, minor = MIGRATION_ORDER_OVERRIDES[path.name]
        return (major, minor, path.name)
    prefix = path.name.split("_", 1)[0]
    major = int(prefix) if prefix.isdigit() else 999
    return (major, 5, path.name)


async def migrate():
    dsn = os.environ.get("DATABASE_URL") or os.environ.get("EXTERNAL_POSTGRES_URI")
    if not dsn:
        print("Error: DATABASE_URL / EXTERNAL_POSTGRES_URI not set")
        raise RuntimeError("DATABASE_URL / EXTERNAL_POSTGRES_URI not set")

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
        await conn.execute("SELECT pg_advisory_lock($1)", MIGRATION_LOCK_ID)

        migrations_dir = Path(__file__).resolve().parent.parent / "migrations"
        migration_paths = sorted(migrations_dir.glob("*.sql"), key=migration_sort_key)
        if not migration_paths:
            print(f"Warning: no SQL migrations found in {migrations_dir}")

        for migration_path in migration_paths:
            print(f"Applying migration: {migration_path.name}")
            await conn.execute(migration_path.read_text())
        
        print("Migrations completed successfully.")
    finally:
        try:
            await conn.execute("SELECT pg_advisory_unlock($1)", MIGRATION_LOCK_ID)
        except Exception:
            pass
        await conn.close()

if __name__ == "__main__":
    try:
        asyncio.run(migrate())
    except Exception as e:
        print(f"Migration failed: {e}", file=sys.stderr)
        sys.exit(1)
