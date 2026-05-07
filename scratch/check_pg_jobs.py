import os
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv

load_dotenv()

async def check_columns():
    url = os.environ.get("DATABASE_URL") or os.environ.get("EXTERNAL_POSTGRES_URI")
    if not url:
        print("❌ No database URL.")
        return
    
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'jobs_nf'"))
            columns = [r[0] for r in res.fetchall()]
            print(f"✅ Table 'jobs_nf' columns: {columns}")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_columns())
