from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request

from backend.app.core.legacy_compat import verify_csrf_token_header
from backend.app.core.legacy_supabase import get_legacy_supabase_client
from backend.app.models.requests import JobApplicationCreateRequest
from backend.app.services.subscription_access import fetch_latest_subscription_by, is_active_subscription


supabase = get_legacy_supabase_client()

JOB_LIMITS_BY_TIER = {
    "free": 1,
    "trial": 1,
    "starter": 3,
    "growth": 10,
    "professional": 20,
    "enterprise": 999,
}


def _require_company_tier(user: dict[str, Any], company_id: str, allowed_tiers: set[str]) -> str:
    fast_tier = str(user.get("subscription_tier") or "").lower()
    if company_id == str(user.get("company_id") or "") and user.get("is_subscription_active") and fast_tier in allowed_tiers:
        return fast_tier
    sub = fetch_latest_subscription_by("company_id", company_id)
    tier = str((sub or {}).get("tier") or "free").lower()
    if sub and is_active_subscription(sub) and tier in allowed_tiers:
        return tier
    if "free" in allowed_tiers:
        return "free"
    raise HTTPException(status_code=403, detail="Current plan does not include this feature")


def _require_job_access(user: dict[str, Any], job_id: str) -> dict[str, Any]:
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    response = supabase.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
    row = response.data or {}
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    return row


def _user_has_direct_premium(user: dict[str, Any]) -> bool:
    tier = str(user.get("subscription_tier") or "").lower()
    if user.get("is_subscription_active") and tier == "premium":
        return True
    user_id = user.get("id") or user.get("auth_id")
    sub = fetch_latest_subscription_by("user_id", str(user_id or ""))
    return bool(sub and is_active_subscription(sub) and str(sub.get("tier") or "").lower() == "premium")


def _count_company_active_jobs(company_id: str, exclude_job_id: str | None = None) -> int:
    if not supabase or not company_id:
        return 0
    try:
        query = supabase.table("jobs").select("id,status").eq("company_id", company_id)
        rows = (query.execute().data or [])
    except Exception:
        return 0
    count = 0
    for row in rows:
        if exclude_job_id and str((row or {}).get("id")) == str(exclude_job_id):
            continue
        status = str((row or {}).get("status") or "active").lower()
        if status not in {"closed", "archived", "draft", "deleted"}:
            count += 1
    return count


def _enforce_company_job_publish_limit(company_id: str, user: dict[str, Any], exclude_job_id: str | None = None) -> None:
    tier = _require_company_tier(user, company_id, set(JOB_LIMITS_BY_TIER))
    limit = JOB_LIMITS_BY_TIER.get(tier, JOB_LIMITS_BY_TIER["free"])
    active_count = _count_company_active_jobs(company_id, exclude_job_id=exclude_job_id)
    if active_count >= limit:
        raise HTTPException(status_code=403, detail=f"Current plan allows up to {limit} active job postings")


async def create_job_application(
    payload: JobApplicationCreateRequest,
    request: Request,
    user: dict[str, Any],
) -> dict[str, Any]:
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF token validation failed")
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    share_level = payload.jcfpm_share_level or "do_not_share"
    shared_payload = payload.shared_jcfpm_payload
    if share_level == "full_report" and not _user_has_direct_premium(user):
        share_level = "do_not_share"
        shared_payload = None

    row = {
        "user_id": user.get("id") or user.get("auth_id"),
        "job_id": payload.job_id,
        "jcfpm_share_level": share_level,
        "shared_jcfpm_payload": shared_payload,
    }
    response = supabase.table("job_applications").insert(row).execute()
    application = (response.data or [row])[0]
    return {"status": "success", "application": application}


async def match_candidates_service(request: Request, job_id: str, user: dict[str, Any]) -> dict[str, Any]:
    job = _require_job_access(user, job_id)
    company_id = str(job.get("company_id") or user.get("company_id") or "")
    _require_company_tier(user, company_id, {"growth", "professional", "enterprise"})
    return {"status": "success", "candidates": []}
