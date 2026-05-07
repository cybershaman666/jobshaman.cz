import os
import asyncio
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
from typing import AsyncGenerator
from dotenv import load_dotenv
from app.core.runtime import require_database_url
from .legacy_supabase import get_legacy_supabase_client

supabase = get_legacy_supabase_client()

# Load .env from root directory
root_env = os.path.join(os.path.dirname(__file__), "../../../../.env")
backend_env = os.path.join(os.path.dirname(__file__), "../../../../backend/.env")

load_dotenv(root_env)
load_dotenv(backend_env)

def get_database_url():
    url = os.environ.get("DATABASE_URL")
    if not url:
        url = os.environ.get("EXTERNAL_POSTGRES_URI")
    
    if not url:
        if require_database_url():
            raise RuntimeError("DATABASE_URL or EXTERNAL_POSTGRES_URI is required for V2 backend startup.")
        return "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres", {}
    
    # Convert postgres:// or postgresql:// to postgresql+asyncpg://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    connect_args = {}
    if "sslmode=require" in url:
        url = url.replace("sslmode=require", "")
        connect_args["ssl"] = "require"
    
    # Clean up trailing ? or &
    url = url.rstrip("?").rstrip("&")
    
    return url, connect_args

logger = logging.getLogger(__name__)

DATABASE_URL, CONNECT_ARGS = get_database_url()
engine = create_async_engine(
    DATABASE_URL,
    connect_args=CONNECT_ARGS,
    echo=os.environ.get("SQL_ECHO") == "1",
    pool_pre_ping=True,
    pool_size=int(os.environ.get("V2_DB_POOL_SIZE", "20")),
    max_overflow=int(os.environ.get("V2_DB_MAX_OVERFLOW", "15")),
    pool_recycle=int(os.environ.get("V2_DB_POOL_RECYCLE_SECONDS", "180")),
    pool_timeout=int(os.environ.get("V2_DB_POOL_TIMEOUT", "30")),
)
db_ready = False

# Global session factory
async_session_factory = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def init_db():
    global db_ready
    required = require_database_url()
    timeout_seconds = float(os.environ.get("V2_DB_INIT_TIMEOUT_SECONDS", "15"))

    async def connect_and_prepare():
        async with engine.begin() as conn:
            # Always ensure tables are created in V2
            await conn.run_sync(SQLModel.metadata.create_all)

        # Optional performance/index prep must not poison the startup transaction.
        async with engine.connect() as conn:
            # 1. Enable pgvector (requires superuser or specific CREATE privilege)
            try:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                await conn.commit()
            except Exception as ext_err:
                await conn.rollback()
                logger.warning("Could not ensure 'vector' extension: %s. Vector search might not be available.", ext_err)

            # 2. Check if embedding column already exists to avoid privilege error on ALTER TABLE
            try:
                column_check = await conn.execute(text("""
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'jobs_nf' AND column_name = 'embedding'
                    LIMIT 1;
                """))
                column_exists = column_check.scalar() is not None
            except Exception as check_err:
                await conn.rollback()
                logger.warning("Could not inspect jobs_nf embedding column: %s", check_err)
                column_exists = True

            if not column_exists:
                try:
                    await conn.execute(text("""
                        ALTER TABLE jobs_nf 
                        ADD COLUMN embedding vector(1024);
                    """))
                    await conn.commit()
                    logger.info("Successfully added 'embedding' column to jobs_nf.")
                except Exception as alter_err:
                    await conn.rollback()
                    if "privilege" in str(alter_err).lower():
                        logger.error(
                            "\n" + "="*80 + "\n"
                            "DATABASE PRIVILEGE ERROR: The app user is NOT THE OWNER of table 'jobs_nf'.\n"
                            "To enable vector search, please run this manually as a superuser or the table owner:\n\n"
                            "ALTER TABLE jobs_nf ADD COLUMN IF NOT EXISTS embedding vector(1024);\n"
                            "CREATE INDEX IF NOT EXISTS idx_jobs_nf_embedding_hnsw ON jobs_nf USING hnsw (embedding vector_cosine_ops);\n"
                            + "="*80 + "\n"
                        )
                    else:
                        logger.warning("Could not add embedding column: %s", alter_err)

            # 3. Best-effort indexes. Each statement is isolated so one failure does not
            # abort the rest of startup or poison the connection transaction state.
            optional_statements = [
                (
                    "embedding_hnsw",
                    """
                    CREATE INDEX IF NOT EXISTS idx_jobs_nf_embedding_hnsw 
                    ON jobs_nf USING hnsw (embedding vector_cosine_ops);
                    """,
                ),
                ("lat_lng", "CREATE INDEX IF NOT EXISTS idx_jobs_nf_lat_lng ON jobs_nf (lat, lng);"),
                ("is_active_status", "CREATE INDEX IF NOT EXISTS idx_jobs_nf_is_active_status ON jobs_nf (is_active, status);"),
                ("country", "CREATE INDEX IF NOT EXISTS idx_jobs_nf_country ON jobs_nf (country_code);"),
                (
                    "recency",
                    "CREATE INDEX IF NOT EXISTS idx_jobs_nf_recency ON jobs_nf (scraped_at DESC NULLS LAST, updated_at DESC NULLS LAST);"
                ),
                (
                    "title_company",
                    "CREATE INDEX IF NOT EXISTS idx_jobs_nf_title_company ON jobs_nf (title, company);"
                ),
                (
                    "payload_gin",
                    "CREATE INDEX IF NOT EXISTS idx_jobs_nf_payload_gin ON jobs_nf USING GIN (payload_json);"
                ),
            ]

            for label, statement in optional_statements:
                try:
                    await conn.execute(text(statement))
                    await conn.commit()
                except Exception as stmt_err:
                    await conn.rollback()
                    logger.warning("Skipping optional DB optimization '%s': %s", label, stmt_err)

    try:
        await asyncio.wait_for(connect_and_prepare(), timeout=timeout_seconds)
        db_ready = True
    except BaseException as exc:
        db_ready = False
        logger.warning("V2 database startup check failed: %r", exc)
        if required:
            raise

def is_db_ready() -> bool:
    return db_ready

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
