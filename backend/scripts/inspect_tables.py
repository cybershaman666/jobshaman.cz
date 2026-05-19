import sys
import os
import asyncio
from dotenv import load_dotenv

# Load env variables first
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
load_dotenv(os.path.join(project_root, '.env'))

# Add project root to sys.path
sys.path.append(os.path.join(os.getcwd(), '..'))

from app.core.database import engine
from sqlalchemy import text

async def inspect_postgres():
    async with engine.connect() as conn:
        print("Checking tables in PostgreSQL...")
        
        # List all tables in public schema
        result = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """))
        tables = [row[0] for row in result.fetchall()]
        print(f"All tables in public schema ({len(tables)}): {tables}")
        
        test_tables = ["jcfpm_items", "jcfpm_item_translations", "jcfpm_forms", "jcfpm_form_items"]
        for table in test_tables:
            if table in tables:
                print(f"\n--- Table '{table}' exists! ---")
                # Get columns
                cols_res = await conn.execute(text(f"""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = '{table}';
                """))
                cols = cols_res.fetchall()
                print("Columns:")
                for col in cols:
                    print(f"  {col[0]} ({col[1]})")
                
                # Get row count
                count_res = await conn.execute(text(f"SELECT COUNT(*) FROM {table};"))
                count = count_res.scalar()
                print(f"Row count: {count}")
            else:
                print(f"\nTable '{table}' does NOT exist in PostgreSQL!")

if __name__ == "__main__":
    asyncio.run(inspect_postgres())
