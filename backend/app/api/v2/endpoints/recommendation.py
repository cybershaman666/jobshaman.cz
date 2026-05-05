from fastapi import APIRouter, Depends, HTTPException
from app.core.security import AccessControlService
from app.domains.identity.service import IdentityDomainService
from app.domains.ai_governance.service import AIGovernanceService
from app.domains.recommendation.service import RecommendationDomainService
from app.services.embedding_service import EmbeddingService
from typing import Dict, Any
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/feed")
async def get_recommendation_feed(
    limit: int = 60,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )

    feed = await RecommendationDomainService.build_candidate_feed(domain_user["id"], limit=limit)

    return {
        "status": "success",
        "data": feed,
    }

@router.get("/explain/{job_id}")
async def explain_recommendation(
    job_id: str, 
    current_user: dict = Depends(AccessControlService.get_current_user)
):
    """
    Explains why a job was recommended to the current user.
    Integrates with Identity (profile) and AI Governance (logs).
    """
    # 1. Ensure user exists in our V2 mirror
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"]
    )
    
    # 2. Check if we already have a log for this
    explanation = await AIGovernanceService.get_explanation(domain_user["id"], job_id)
    
    if not explanation:
        # 3. If no log, generate a "on-the-fly" mock explanation (in reality, this would call a model)
        # For V2 demonstration, we create a narrative based on "shamanic insights"
        narrative = "Tato práce ti byla doporučena, protože tvoje dovednosti v JCFPM silně rezonují s kulturou firmy. Tvůj profil naznačuje vysokou míru týmovosti, což je pro tuto roli klíčové."
        
        log_id = await AIGovernanceService.log_recommendation(
            user_id=domain_user["id"],
            job_id=job_id,
            score=0.92,
            signals=["high_teamwork_match", "culture_resonance"],
            narrative=narrative
        )
        
        explanation = {
            "match_score": 0.92,
            "narrative": narrative,
            "algorithm_version": "v2.0.0"
        }
        
    return {
        "status": "success",
        "data": explanation
    }

@router.post("/trigger-notifications")
async def trigger_notifications(
    current_user: dict = Depends(AccessControlService.get_current_user)
):
    """
    Simulates the post-matching notification trigger.
    In production, this would be called by a background worker.
    """
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"]
    )
    await RecommendationDomainService.trigger_match_notifications(domain_user["id"])
    return {"status": "success", "message": "Matching notifications triggered"}

@router.get("/embeddings/stats")
async def get_embedding_stats(
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    """
    Returns embedding coverage stats for monitoring.
    """
    embedded_count = await EmbeddingService.count_embedded_jobs()
    return {
        "status": "success",
        "data": {
            "embedded_jobs": embedded_count,
            "embedding_model": "mistral-embed",
            "embedding_dims": 1024,
        },
    }

@router.post("/embeddings/backfill")
async def backfill_job_embeddings(
    payload: dict = None,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    """
    Batch-embed jobs that don't have embeddings yet.
    Accepts optional `limit` in payload (default 50, max 200).
    Requires authenticated user (admin use).
    """
    batch_limit = 50
    if payload and isinstance(payload.get("limit"), int):
        batch_limit = max(1, min(payload["limit"], 200))

    unembedded = await EmbeddingService.list_unembedded_jobs(limit=batch_limit)
    if not unembedded:
        return {
            "status": "success",
            "data": {"processed": 0, "message": "All jobs already have embeddings."},
        }

    stored = await EmbeddingService.embed_and_store_jobs(unembedded)
    remaining = await EmbeddingService.count_embedded_jobs()

    logger.info("Backfill: embedded %d/%d jobs, total embedded: %d", stored, len(unembedded), remaining)

    return {
        "status": "success",
        "data": {
            "processed": len(unembedded),
            "stored": stored,
            "total_embedded": remaining,
        },
    }

