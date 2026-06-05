from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from backend.app.services.subscription_access import fetch_latest_subscription_by, is_active_subscription


ASSESSMENT_LIMITS_BY_TIER = {
    "starter": 15,
    "growth": 60,
    "professional": 150,
    "enterprise": 999999,
}


def _get_latest_company_subscription(company_id: str) -> dict[str, Any] | None:
    return fetch_latest_subscription_by("company_id", company_id)


def _get_latest_usage_for_subscription(subscription_id: str) -> dict[str, Any]:
    return {}


def _require_company_assessment_capacity(company_id: str) -> dict[str, Any]:
    sub = _get_latest_company_subscription(company_id)
    tier = str((sub or {}).get("tier") or "free").lower()
    if not sub or not is_active_subscription(sub) or tier not in ASSESSMENT_LIMITS_BY_TIER:
        raise HTTPException(status_code=403, detail="Company subscription required for assessments")

    limit = ASSESSMENT_LIMITS_BY_TIER[tier]
    usage = _get_latest_usage_for_subscription(str(sub.get("id") or ""))
    used = int((usage or {}).get("ai_assessments_used") or 0)
    if used >= limit:
        raise HTTPException(status_code=403, detail="Assessment limit reached for current plan")
    return {"subscription": sub, "limit": limit, "used": used, "remaining": max(0, limit - used)}
