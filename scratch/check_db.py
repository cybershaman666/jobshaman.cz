import os
import asyncio
import logging
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

# Try to find .env
load_dotenv(".env")
load_dotenv("../.env")

async def check_db():
    url = os.environ.get("DATABASE_URL") or os.environ.get("EXTERNAL_POSTGRES_URI")
    if not url:
        print("❌ No database URL found in environment.")
        return

    print(f"🔍 Testing connection to: {url[:30]}...")
    
    # Simple normalization for asyncpg
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    # Handle sslmode
    connect_args = {}
    if "sslmode=require" in url:
        url = url.replace("sslmode=require", "")
        connect_args["ssl"] = "require"
    url = url.rstrip("?").rstrip("&")

    try:
        engine = create_async_engine(url, connect_args=connect_args)
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            print("✅ Database connection SUCCESSFUL!")
        await engine.dispose()
    except Exception as e:
        print(f"❌ Database connection FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(check_db())
