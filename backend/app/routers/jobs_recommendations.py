from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request

from ..core.limiter import limiter
from ..core.security import get_current_user
from ..matching_engine import recommend_jobs_for_user
from ..services.jobs_interactions_runtime import (
    _attach_job_dialogue_preview_metrics,
    _write_recommendation_exposures,
)

router = APIRouter()


@router.get("/jobs/recommendations")
@limiter.limit("30/minute")
async def get_job_recommendations(
    request: Request,
    background_tasks: BackgroundTasks,
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    matches = recommend_jobs_for_user(user_id=user_id, limit=limit, allow_cache=True)
    request_id = str(uuid4())

    exposure_rows = []
    enriched_matches = []
    for idx, item in enumerate(matches):
        job = item.get("job") or {}
        job_id = job.get("id")
        if not job_id:
            continue
        position = int(item.get("position") or (idx + 1))
        score = float(item.get("score") or 0.0)
        model_version = item.get("model_version") or "career-os-v2"
        scoring_version = item.get("scoring_version") or "scoring-v1"

        exposure_rows.append(
            {
                "request_id": request_id,
                "user_id": user_id,
                "job_id": job_id,
                "position": position,
                "score": score,
                "predicted_action_probability": float(item.get("action_probability") or 0.0),
                "action_model_version": item.get("action_model_version") or None,
                "ranking_strategy": (item.get("breakdown") or {}).get("selection_strategy"),
                "is_new_job": bool((item.get("breakdown") or {}).get("is_new_job")),
                "model_version": model_version,
                "scoring_version": scoring_version,
                "source": "recommendations_api",
            }
        )
        enriched_matches.append(
            {
                **item,
                "position": position,
                "request_id": request_id,
            }
        )

    _attach_job_dialogue_preview_metrics(
        [item.get("job") for item in enriched_matches if isinstance(item.get("job"), dict)]
    )

    if exposure_rows:
        background_tasks.add_task(_write_recommendation_exposures, exposure_rows)

    return {"jobs": enriched_matches, "request_id": request_id}


@router.post("/jobs/recommendations/warmup")
@limiter.limit("15/minute")
async def warmup_job_recommendations(
    request: Request,
    background_tasks: BackgroundTasks,
    limit: int = Query(80, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    background_tasks.add_task(
        recommend_jobs_for_user,
        user_id=user_id,
        limit=limit,
        allow_cache=True,
    )

    return {"status": "scheduled", "limit": limit}
