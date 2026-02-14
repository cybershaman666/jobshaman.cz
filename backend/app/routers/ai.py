from fastapi import APIRouter, Depends, HTTPException, Request

from ..core.limiter import limiter
from ..core.security import verify_subscription
from ..models.requests import AIGuidedProfileRequest
from ..models.responses import AIGuidedProfileResponse
from ..services.ai_profile import generate_profile_from_story

router = APIRouter()


@router.post("/ai/profile-from-story", response_model=AIGuidedProfileResponse)
@limiter.limit("5/minute")
async def profile_from_story(payload: AIGuidedProfileRequest, request: Request, user: dict = Depends(verify_subscription)):
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    if not user.get("is_subscription_active") or user.get("subscription_tier") != "premium":
        raise HTTPException(status_code=403, detail="Premium subscription required")

    # Sanitize and cap input length
    steps = []
    for step in payload.steps:
        text = (step.text or "").strip()[:5000]
        if not text:
            continue
        steps.append({"id": (step.id or "").strip(), "text": text})

    if not steps:
        raise HTTPException(status_code=400, detail="No valid steps provided")

    try:
        data = generate_profile_from_story(
            steps=steps,
            language=payload.language or "cs",
            existing_profile=payload.existingProfile or {},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}")

    return {
        "profileUpdates": data.get("profileUpdates") or {},
        "aiProfile": data.get("aiProfile") or {},
        "cv_ai_text": data.get("cv_ai_text") or "",
        "cv_summary": data.get("cv_summary") or "",
    }
