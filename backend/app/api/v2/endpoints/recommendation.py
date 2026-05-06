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
    try:
        # Validate input
        if not current_user or not current_user.get("id"):
            logger.warning("Invalid current_user in get_recommendation_feed")
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Clamp limit to reasonable range
        limit = max(1, min(int(limit), 500))
        
        # Get or create user mirror
        try:
            domain_user = await IdentityDomainService.get_or_create_user_mirror(
                supabase_id=current_user["id"],
                email=current_user.get("email", ""),
                role=current_user.get("role", "candidate"),
            )
        except Exception as mirror_err:
            logger.error(f"Failed to create user mirror: {mirror_err}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to initialize user profile")
        
        if not domain_user or not domain_user.get("id"):
            logger.error("User mirror creation returned invalid user")
            raise HTTPException(status_code=500, detail="Failed to create user profile")
        
        # Build recommendation feed with error handling
        try:
            feed = await RecommendationDomainService.build_candidate_feed(
                domain_user["id"], 
                limit=limit
            )
        except Exception as feed_err:
            logger.error(f"Failed to build recommendation feed: {feed_err}", exc_info=True)
            # Return empty feed instead of 500 error
            feed = {
                "snapshot_id": None,
                "algorithm_version": "2.0.0-fallback",
                "source": "jobs_nf",
                "retrieval_mode": "fallback",
                "items": [],
                "sections": [],
                "total_count": 0,
                "vector_recall_count": 0,
                "error": str(feed_err)
            }
        
        return {
            "status": "success",
            "data": feed,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_recommendation_feed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/explain/{job_id}")
async def explain_recommendation(
    job_id: str, 
    current_user: dict = Depends(AccessControlService.get_current_user)
):
    """
    Explains why a job was recommended to the current user.
    Integrates with Identity (profile) and AI Governance (logs).
    """
    try:
        if not current_user or not current_user.get("id"):
            logger.warning("Invalid current_user in explain_recommendation")
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        if not job_id or not job_id.strip():
            raise HTTPException(status_code=400, detail="Job ID is required")
        
        # 1. Ensure user exists in our V2 mirror
        try:
            domain_user = await IdentityDomainService.get_or_create_user_mirror(
                supabase_id=current_user["id"],
                email=current_user.get("email", ""),
                role=current_user.get("role", "candidate"),
            )
        except Exception as mirror_err:
            logger.error(f"Failed to create user mirror: {mirror_err}")
            raise HTTPException(status_code=500, detail="Failed to initialize user profile")
        
        # 2. Check if we already have a log for this
        try:
            explanation = await AIGovernanceService.get_explanation(domain_user["id"], job_id)
        except Exception as e:
            logger.warning(f"Failed to get explanation: {e}")
            explanation = None
        
        if not explanation:
            # 3. Generate a mock explanation
            narrative = "Tato práce ti byla doporučena, protože tvoje dovednosti silně rezonují s požadavky pozice. Tvůj profil naznačuje vhodnost pro tuto roli."
            
            try:
                log_id = await AIGovernanceService.log_recommendation(
                    user_id=domain_user["id"],
                    job_id=job_id,
                    score=0.85,
                    signals=["profile_match", "skill_resonance"],
                    narrative=narrative
                )
            except Exception as log_err:
                logger.warning(f"Failed to log recommendation: {log_err}")
            
            explanation = {
                "match_score": 0.85,
                "narrative": narrative,
                "algorithm_version": "v2.0.0"
            }
        
        return {
            "status": "success",
            "data": explanation
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in explain_recommendation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/trigger-notifications")
async def trigger_notifications(
    current_user: dict = Depends(AccessControlService.get_current_user)
):
    """
    Simulates the post-matching notification trigger.
    In production, this would be called by a background worker.
    """
    try:
        if not current_user or not current_user.get("id"):
            logger.warning("Invalid current_user in trigger_notifications")
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        try:
            domain_user = await IdentityDomainService.get_or_create_user_mirror(
                supabase_id=current_user["id"],
                email=current_user.get("email", ""),
                role=current_user.get("role", "candidate"),
            )
        except Exception as mirror_err:
            logger.error(f"Failed to create user mirror: {mirror_err}")
            raise HTTPException(status_code=500, detail="Failed to initialize user profile")
        
        try:
            await RecommendationDomainService.trigger_match_notifications(domain_user["id"])
        except Exception as notif_err:
            logger.warning(f"Failed to trigger notifications: {notif_err}", exc_info=True)
            # Don't fail the request, it's just a notification trigger
        
        return {"status": "success", "message": "Matching notifications triggered"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in trigger_notifications: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/embeddings/stats")
async def get_embedding_stats(
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    """
    Returns embedding coverage stats for monitoring.
    """
    try:
        if not current_user or not current_user.get("id"):
            logger.warning("Invalid current_user in get_embedding_stats")
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        try:
            embedded_count = await EmbeddingService.count_embedded_jobs()
        except Exception as e:
            logger.warning(f"Failed to count embedded jobs: {e}")
            embedded_count = 0
        
        return {
            "status": "success",
            "data": {
                "embedded_jobs": embedded_count,
                "embedding_model": "mistral-embed",
                "embedding_dims": 1024,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_embedding_stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

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

