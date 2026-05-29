import asyncio
import os
import sys
from pathlib import Path

# Add project root to path
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR.parent / ".env")

from app.core.database import engine
from sqlalchemy import text

async def check():
    async with engine.connect() as conn:
        print("Checking jobs in jobs_nf...")
        
        # 1. Total jobs count
        result = await conn.execute(text("SELECT COUNT(*) FROM jobs_nf"))
        total = result.scalar()
        print(f"Total jobs: {total}")
        
        # 2. Count by country_code
        result = await conn.execute(text(
            """
            SELECT COALESCE(country_code, payload_json->>'country_code', payload_json->>'country', 'UNKNOWN') as country, COUNT(*) 
            FROM jobs_nf 
            GROUP BY country
            ORDER BY count DESC
            """
        ))
        print("\nJobs by country:")
        for row in result:
            print(f"  {row[0]}: {row[1]}")
            
        # 3. Find some jobs in Poland
        result = await conn.execute(text(
            """
            SELECT id, title, company, location, language_code 
            FROM jobs_nf 
            WHERE (
              LOWER(COALESCE(country_code, payload_json->>'country_code', payload_json->>'country', '')) = 'pl'
            )
            LIMIT 10
            """
        ))
        print("\nSample Poland jobs:")
        for row in result:
            print(f"  ID: {row[0]} | Title: {row[1]} | Company: {row[2]} | Location: {row[3]} | Language: {row[4]}")

if __name__ == "__main__":
    asyncio.run(check())
