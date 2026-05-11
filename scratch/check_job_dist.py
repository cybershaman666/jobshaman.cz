import os
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv

load_dotenv()

async def check_job_distribution():
    url = os.environ.get("DATABASE_URL") or os.environ.get("EXTERNAL_POSTGRES_URI")
    if not url:
        print("❌ No database URL.")
        return
    
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:
            print("--- Jobs by Country ---")
            res = await conn.execute(text("SELECT country_code, count(*) FROM jobs_nf GROUP BY country_code ORDER BY count(*) DESC"))
            for r in res.fetchall():
                print(f"{r[0]}: {r[1]}")
            
            print("\n--- Jobs by City (Top 20) ---")
            res = await conn.execute(text("SELECT location, count(*) FROM jobs_nf GROUP BY location ORDER BY count(*) DESC LIMIT 20"))
            for r in res.fetchall():
                print(f"{r[0]}: {r[1]}")
                
            print("\n--- Native Jobs ---")
            res = await conn.execute(text("SELECT count(*) FROM jobs WHERE is_active = true"))
            print(f"Active native jobs: {res.scalar()}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_job_distribution())
