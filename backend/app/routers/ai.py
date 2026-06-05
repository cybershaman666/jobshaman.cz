from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request

from backend.app.models.requests import AIExecuteRequest
from backend.app.services.subscription_access import user_has_allowed_subscription


COMPANY_AI_ACTIONS = {"generate_assessment"}
CANDIDATE_PREMIUM_AI_ACTIONS = {"optimize_cv_for_ats", "analyze_user_cv", "parse_profile_from_cv"}
COMPANY_AI_TIERS = {"starter", "growth", "professional", "enterprise"}
CANDIDATE_PREMIUM_TIERS = {"premium", "starter", "growth", "professional", "enterprise"}


def _user_has_allowed_subscription(user: dict[str, Any], allowed_tiers: set[str]) -> bool:
    return user_has_allowed_subscription(user, allowed_tiers)


async def ai_execute(payload: AIExecuteRequest, request: Request, user: dict[str, Any]) -> dict[str, Any]:
    action = str(payload.action or "").strip()
    if action in COMPANY_AI_ACTIONS and not _user_has_allowed_subscription(user, COMPANY_AI_TIERS):
        raise HTTPException(status_code=403, detail="Company subscription required for this AI action")
    if action in CANDIDATE_PREMIUM_AI_ACTIONS and not _user_has_allowed_subscription(user, CANDIDATE_PREMIUM_TIERS):
        raise HTTPException(status_code=403, detail="Premium subscription required for this AI action")
    raise HTTPException(status_code=501, detail=f"AI action is not implemented in legacy router: {action}")
