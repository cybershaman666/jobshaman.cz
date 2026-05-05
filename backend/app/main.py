import asyncio
from fastapi import FastAPI, BackgroundTasks, HTTPException
import os
from dotenv import load_dotenv

# Load .env from backend/ and from repo root (whichever exists)
_here = os.path.dirname(__file__)
load_dotenv(os.path.join(_here, "../.env"))        # backend/.env
load_dotenv(os.path.join(_here, "../../.env"))     # repo root .env (shared Supabase keys etc.)

from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.database import init_db, is_db_ready

from app.api.v2.endpoints import assets, candidate, jobs, recommendation, handshake, company, notifications, mentor, admin, billing, stripe, scraper
from app.domains.recommendation.service import RecommendationDomainService
from app.domains.identity.service import IdentityDomainService
from app.domains.identity.models import User
from sqlmodel import select
from app.core.database import engine
from sqlalchemy.ext.asyncio import AsyncSession
from app.domains.identity import models as identity_models
from app.domains.reality import models as reality_models
from app.domains.ai_governance import models as ai_models
from app.domains.handshake import models as handshake_models
from app.domains.media import models as media_models
from app.core.runtime import get_cors_origins, validate_runtime_config

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(candidate.router, prefix="/api/v2/candidate", tags=["candidate"])
app.include_router(company.router, prefix="/api/v2/company", tags=["company"])
app.include_router(assets.router, prefix="/api/v2/assets", tags=["assets"])
app.include_router(jobs.router, prefix="/api/v2/jobs", tags=["jobs"])
app.include_router(recommendation.router, prefix="/api/v2/recommendation", tags=["recommendation"])
app.include_router(handshake.router, prefix="/api/v2/handshake", tags=["handshake"])
app.include_router(notifications.router, prefix="/api/v2/notifications", tags=["notifications"])
app.include_router(mentor.router, prefix="/api/v2/mentor", tags=["mentor"])
app.include_router(admin.router, prefix="/api/v2", tags=["admin"])
app.include_router(billing.router, prefix="/api/v2/billing", tags=["billing"])
app.include_router(stripe.router, prefix="/api/v2/stripe", tags=["stripe"])
app.include_router(scraper.router, prefix="/api/v2", tags=["scraper"])

@app.get("/health")
def health_check():
    database_status = "ready" if is_db_ready() else "degraded"
    return {"status": "healthy" if is_db_ready() else "degraded", "version": "v2", "database": database_status}

@app.get("/ready")
def readiness_check():
    if not is_db_ready():
        raise HTTPException(status_code=503, detail={"status": "not_ready", "version": "v2", "database": "degraded"})
    return {"status": "ready", "version": "v2", "database": "ready"}
