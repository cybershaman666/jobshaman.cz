import asyncio
import os
import asyncpg

async def check():
    dsn = os.environ.get('DATABASE_URL') or os.environ.get('EXTERNAL_POSTGRES_URI')
    if not dsn:
        print("DSN missing")
        return
    
    # Handle sslmode in DSN
    ssl_config = None
    if 'sslmode=require' in dsn:
        ssl_config = 'require'
    
    # Clean dsn for asyncpg if it has postgresql+asyncpg
    if dsn.startswith('postgresql+asyncpg://'):
        dsn = dsn.replace('postgresql+asyncpg://', 'postgresql://')
    
    conn = await asyncpg.connect(dsn, ssl=ssl_config)
    try:
        rows = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        tables = [r['table_name'] for r in rows]
        print(f"Tables: {tables}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(check())
