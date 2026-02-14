from fastapi import APIRouter, Depends, HTTPException, Request

from ..ai_orchestration.pipeline import generate_profile_with_orchestration
from ..core.limiter import limiter
from ..core.security import verify_subscription
from ..models.requests import AIGuidedProfileRequest, AIGuidedProfileRequestV2
from ..models.responses import AIGuidedProfileResponse, AIGuidedProfileResponseV2

router = APIRouter()


def _require_premium(user: dict) -> str:
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    if not user.get("is_subscription_active") or user.get("subscription_tier") != "premium":
        raise HTTPException(status_code=403, detail="Premium subscription required")

    return user_id


@router.post("/ai/profile/generate", response_model=AIGuidedProfileResponseV2)
@limiter.limit("8/minute")
async def profile_generate_v2(
    payload: AIGuidedProfileRequestV2,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    user_id = _require_premium(user)

    try:
        result = generate_profile_with_orchestration(
            user_id=user_id,
            steps=[{"id": s.id, "text": s.text} for s in payload.steps],
            language=payload.language or "cs",
            existing_profile=payload.existingProfile or {},
            requested_prompt_version=payload.prompt_version,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI processing failed: {str(e)}")

    return result


@router.post("/ai/profile-from-story", response_model=AIGuidedProfileResponse)
@limiter.limit("5/minute")
async def profile_from_story(
    payload: AIGuidedProfileRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    """Legacy endpoint kept for backward compatibility. Maps V2 response to old contract."""
    user_id = _require_premium(user)

    try:
        result = generate_profile_with_orchestration(
            user_id=user_id,
            steps=[{"id": s.id, "text": s.text} for s in payload.steps],
            language=payload.language or "cs",
            existing_profile=payload.existingProfile or {},
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI processing failed: {str(e)}")

    return {
        "profileUpdates": result.profile_updates.model_dump(),
        "aiProfile": result.ai_profile.model_dump(),
        "cv_ai_text": result.cv_ai_text,
        "cv_summary": result.cv_summary,
    }
