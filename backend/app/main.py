import asyncio
import os
import logging
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from dotenv import load_dotenv

# Load .env from backend/ and from repo root (whichever exists)
_here = os.path.dirname(__file__)
load_dotenv(os.path.join(_here, "../.env"))        # backend/.env
load_dotenv(os.path.join(_here, "../../.env"))     # repo root .env (shared Supabase keys etc.)

from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .core.database import init_db, is_db_ready

from .api.v2.endpoints import assets, candidate, jobs, recommendation, handshake, company, notifications, mentor, admin, billing, stripe, scraper, integrations
from .domains.recommendation.service import RecommendationDomainService
from .domains.identity.service import IdentityDomainService
from .domains.identity.models import User
from sqlmodel import select
from .core.database import engine
from sqlalchemy.ext.asyncio import AsyncSession
from .domains.identity import models as identity_models
from .domains.reality import models as reality_models
from .domains.ai_governance import models as ai_models
from .domains.handshake import models as handshake_models
from .domains.integrations import models as integration_models
from .domains.media import models as media_models
from .core.runtime import get_cors_origins, validate_runtime_config

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

async def background_matching_task():
    """
    Periodically runs matching for all users to trigger notifications for new jobs.
    In a real app, this would be a separate worker (Celery/Temporal).
    """
    while True:
        try:
            print("Running background matching for all users...")
            async with AsyncSession(engine) as session:
                result = await session.execute(select(User).where(User.role == "candidate"))
                users = result.scalars().all()
                for user in users:
                    await RecommendationDomainService.trigger_match_notifications(str(user.id))
            print("Background matching completed.")
        except Exception as e:
            print(f"Background matching failed: {e}")
        
        await asyncio.sleep(3600) # Run every hour

@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_runtime_config()
    # Initialize DB on startup
    await init_db()
    
    # Start background task
    task = asyncio.create_task(background_matching_task())
    
    yield
    
    # Clean up
    task.cancel()

app = FastAPI(
    title="JobShaman V2 API",
    description="Greenfield V2 Backend using Domain-Driven Design and Supabase Auth",
    version="2.0.0",
    lifespan=lifespan
)

_ALLOWED_ORIGIN_REGEX = (
    r"^https?://([a-z0-9-]+\.)?jobshaman\.(cz|com)(:\d+)?$|"
    r"^https?://jobshaman(-[a-z0-9-]+)?\.vercel\.app(:\d+)?$|"
    r"^https?://[a-z0-9-]+\.northflank\.app(:\d+)?$|"
    r"^https?://[a-z0-9-]+--[a-z0-9-]+(?:--[a-z0-9-]+)?\.code\.run(:\d+)?$"
)

# Custom exception handler middleware for better error responses
@app.middleware("http")
async def exception_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logger.error(f"Unhandled exception: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "detail": "Internal server error",
                "type": type(e).__name__
            }
        )

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_origin_regex=_ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(candidate.router, prefix="/candidate", tags=["candidate"])
app.include_router(company.router, prefix="/company", tags=["company"])
app.include_router(assets.router, prefix="/assets", tags=["assets"])
app.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
app.include_router(recommendation.router, prefix="/recommendation", tags=["recommendation"])
app.include_router(handshake.router, prefix="/handshake", tags=["handshake"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(mentor.router, prefix="/mentor", tags=["mentor"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(billing.router, prefix="/billing", tags=["billing"])
app.include_router(stripe.router, prefix="/stripe", tags=["stripe"])
app.include_router(scraper.router, prefix="/scraper", tags=["scraper"])
app.include_router(integrations.router, prefix="/integrations", tags=["integrations"])

@app.get("/csrf-token")
def get_csrf_token():
    """
    Generate CSRF token for frontend.
    """
    # For now, return a dummy token since CSRF is disabled
    return {"csrf_token": "dummy-token-for-v2"}

@app.get("/health")
def health_check():
    database_status = "ready" if is_db_ready() else "degraded"
    return {"status": "healthy" if is_db_ready() else "degraded", "version": "v2", "database": database_status}

@app.get("/ready")
def readiness_check():
    if not is_db_ready():
        raise HTTPException(status_code=503, detail={"status": "not_ready", "version": "v2", "database": "degraded"})
    return {"status": "ready", "version": "v2", "database": "ready"}

# Global exception handlers to ensure CORS headers are sent
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions with CORS headers"""
    logger.warning(f"HTTP Exception: {exc.status_code} {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "detail": exc.detail if isinstance(exc.detail, (str, dict, list)) else str(exc.detail),
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    logger.error(f"Unhandled exception in {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "detail": "Internal server error",
            "type": type(exc).__name__
        }
    )
