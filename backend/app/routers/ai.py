from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone

from ..ai_orchestration.client import AIClientError
from ..ai_orchestration.pipeline import generate_profile_with_orchestration
from ..core.limiter import limiter
from ..core.security import verify_subscription
from ..core.database import supabase
from ..models.requests import AIGuidedProfileRequest, AIGuidedProfileRequestV2
from ..models.responses import AIGuidedProfileResponse, AIGuidedProfileResponseV2

router = APIRouter()


def _parse_iso_datetime(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _is_active_subscription(sub: dict) -> bool:
    if not sub:
        return False
    status = (sub.get("status") or "").lower()
    if status not in ["active", "trialing"]:
        return False

    expires_at = _parse_iso_datetime(sub.get("current_period_end"))
    if expires_at:
        return datetime.now(timezone.utc) <= expires_at
    return True


def _subscription_allows_ai_profile(sub: dict) -> bool:
    tier = (sub.get("tier") or "").lower()
    allowed_tiers = {"premium", "business", "trial", "enterprise", "freelance_premium"}
    return _is_active_subscription(sub) and tier in allowed_tiers


def _fetch_latest_subscription_by(column: str, value: str) -> dict | None:
    if not supabase or not value:
        return None
    try:
        resp = (
            supabase
            .table("subscriptions")
            .select("*")
            .eq(column, value)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None
    except Exception:
        return None


def _require_ai_profile_access(user: dict) -> str:
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    # 1) Fast path from verify_subscription context
    user_tier = (user.get("subscription_tier") or "").lower()
    if user.get("is_subscription_active") and user_tier in {"premium", "business", "trial", "enterprise", "freelance_premium"}:
        return user_id

    # 2) User-level subscription (authoritative for candidate-side AI profile)
    user_sub = _fetch_latest_subscription_by("user_id", user_id)
    if _subscription_allows_ai_profile(user_sub or {}):
        return user_id

    # 3) Company-level fallback for recruiter/company plans
    company_id = user.get("company_id")
    if company_id and company_id in (user.get("authorized_ids") or []):
        company_sub = _fetch_latest_subscription_by("company_id", company_id)
        if _subscription_allows_ai_profile(company_sub or {}):
            return user_id

    raise HTTPException(status_code=403, detail="Premium or Business subscription required")

    return user_id


@router.post("/ai/profile/generate", response_model=AIGuidedProfileResponseV2)
@limiter.limit("8/minute")
async def profile_generate_v2(
    payload: AIGuidedProfileRequestV2,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    user_id = _require_ai_profile_access(user)

    try:
        result = generate_profile_with_orchestration(
            user_id=user_id,
            steps=[{"id": s.id, "text": s.text} for s in payload.steps],
            language=payload.language or "cs",
            existing_profile=payload.existingProfile or {},
            requested_prompt_version=payload.prompt_version,
        )
    except ValueError as e:
        if "release flag" in str(e).lower() or "disabled" in str(e).lower():
            raise HTTPException(status_code=503, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except AIClientError as e:
        raise HTTPException(status_code=503, detail=f"AI provider unavailable: {str(e)}")
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
    user_id = _require_ai_profile_access(user)

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
