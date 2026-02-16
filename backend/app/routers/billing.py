from fastapi import APIRouter, Request, Depends, HTTPException, Query
import stripe
from ..core.limiter import limiter
from ..core.security import get_current_user, verify_subscription, verify_csrf_token_header, require_company_access
from ..models.requests import BillingVerificationRequest
from ..core.database import supabase
from ..services.email import send_email
from ..utils.helpers import now_iso
from datetime import datetime, timezone, timedelta

router = APIRouter()

def _parse_iso_datetime(value: str) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None

def _is_active_subscription(sub: dict | None) -> bool:
    if not sub:
        return False
    status = (sub.get("status") or "").lower()
    if status not in ["active", "trialing"]:
        return False
    expires_at = _parse_iso_datetime(sub.get("current_period_end"))
    if not expires_at:
        return True
    return datetime.now(timezone.utc) <= expires_at

def _get_latest_subscription_by(column: str, value: str) -> dict | None:
    if not value:
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

@router.get("/subscription-status")
@limiter.limit("30/minute")
async def get_subscription_status(request: Request, userId: str = Query(...), user: dict = Depends(get_current_user)):
    authorized_ids = user.get("authorized_ids", [])
    user_id = user.get("id") or user.get("auth_id")
    is_company_admin = bool(user.get("company_name"))
    
    if userId not in authorized_ids:
        print("🚫 [AUTH] Access denied to subscription status")
        raise HTTPException(status_code=403, detail="Unauthorized")

    tier_limits = {
        "free": {"assessments": 0, "job_postings": 3, "name": "Free"},
        "premium": {"assessments": 0, "job_postings": 10, "name": "Premium"},
        "business": {"assessments": 10, "job_postings": 999, "name": "Business"},
        "freelance_premium": {"assessments": 0, "job_postings": 999, "name": "Freelance Premium"},
        "trial": {"assessments": 10, "job_postings": 999, "name": "Business Plan (Trial)"},
        "enterprise": {"assessments": 999999, "job_postings": 999, "name": "Enterprise"},
        "assessment_bundle": {"assessments": 10, "job_postings": 0, "name": "Assessment Bundle"},
        "single_assessment": {"assessments": 1, "job_postings": 0, "name": "Single Assessment"},
    }

    sub_details = {"tier": "free", "status": "active"}
    resolved_company_id = None
    resolved_is_company_context = False

    try:
        # Resolve context from requested userId (user scope vs company scope).
        # This avoids forcing recruiter users into company subscription when querying their own user profile.
        if userId == user_id:
            resolved_is_company_context = False
            sub_response = supabase.table("subscriptions").select("*").eq("user_id", user_id).execute()
            # Backward compatibility: if user-level subscription is missing for recruiters, fall back to company.
            if (not sub_response.data) and is_company_admin:
                target_company_id = require_company_access(user, user.get("company_id"))
                resolved_company_id = target_company_id
                resolved_is_company_context = True
                sub_response = supabase.table("subscriptions").select("*").eq("company_id", target_company_id).execute()
        else:
            target_company_id = require_company_access(user, userId)
            resolved_company_id = target_company_id
            resolved_is_company_context = True
            is_freelancer_company = False
            try:
                company_resp = supabase.table("companies").select("industry").eq("id", target_company_id).maybe_single().execute()
                if company_resp.data and company_resp.data.get("industry") == "Freelancer":
                    is_freelancer_company = True
            except Exception as e:
                print(f"⚠️ Failed to fetch company industry: {e}")

            sub_response = supabase.table("subscriptions").select("*").eq("company_id", target_company_id).execute()
            if not sub_response.data and not is_freelancer_company:
                # Auto-trial for companies (not freelancers)
                trial_end = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
                trial_data = {
                    "company_id": target_company_id,
                    "tier": "business",
                    "status": "trialing",
                    "current_period_end": trial_end,
                    "stripe_customer_id": "trial_cust",
                    "stripe_price_id": "trial_price",
                    "stripe_subscription_id": f"trial_{target_company_id[:8]}"
                }
                sub_response = supabase.table("subscriptions").insert(trial_data).execute()

        if sub_response and sub_response.data:
            sub_details = sub_response.data[0]
    except Exception as e:
        print(f"❌ Error fetching/creating subscription: {e}")
        # Fallback to free tier on database error instead of crashing
    tier = sub_details.get("tier", "free")
    limits = tier_limits.get(tier, tier_limits["free"])

    if resolved_is_company_context:
        try:
            target_company_id = resolved_company_id or require_company_access(user, user.get("company_id"))
            jobs_resp = supabase.table("jobs").select("id", count="exact").eq("company_id", target_company_id).execute()
            real_job_count = jobs_resp.count if jobs_resp.count is not None else 0
        except: real_job_count = 0

    # Fetch usage data from subscription_usage table
    stats = {"ai_assessments_used": 0, "active_jobs_count": 0}
    try:
        if sub_details.get("id"):
            usage_resp = supabase.table("subscription_usage").select("*").eq("subscription_id", sub_details["id"]).order("period_end", desc=True).limit(1).execute()
            if usage_resp.data:
                usage = usage_resp.data[0]
                stats["ai_assessments_used"] = usage.get("ai_assessments_used", 0)
                stats["active_jobs_count"] = usage.get("active_jobs_count", 0)
    except Exception as e:
        print(f"⚠️ Error fetching usage stats: {e}")

    # For UI clarity, return assessmentsAvailable as REMAINING credits
    total_assessments = limits["assessments"]
    used_assessments = stats["ai_assessments_used"]
    remaining_assessments = max(0, total_assessments - used_assessments)

    return {
        "tier": tier,
        "tierName": limits["name"],
        "status": sub_details.get("status", "active"),
        "expiresAt": sub_details.get("current_period_end"),
        "assessmentsAvailable": remaining_assessments,
        "assessmentsUsed": used_assessments,
        "jobPostingsAvailable": limits["job_postings"],
        "jobPostingsUsed": real_job_count if resolved_is_company_context else stats["active_jobs_count"],
    }

@router.post("/verify-billing")
@limiter.limit("100/minute")
async def verify_billing(billing_request: BillingVerificationRequest, request: Request, user: dict = Depends(verify_subscription)):
    feature_access = {
        "premium": ["COVER_LETTER", "CV_OPTIMIZATION", "AI_JOB_ANALYSIS"],
        "basic": ["COVER_LETTER", "CV_OPTIMIZATION", "AI_JOB_ANALYSIS"],
        "business": ["COVER_LETTER", "CV_OPTIMIZATION", "AI_JOB_ANALYSIS", "COMPANY_AI_AD", "COMPANY_RECOMMENDATIONS", "COMPANY_UNLIMITED_JOBS"],
        "trial": ["COVER_LETTER", "CV_OPTIMIZATION", "AI_JOB_ANALYSIS", "COMPANY_AI_AD", "COMPANY_RECOMMENDATIONS", "COMPANY_UNLIMITED_JOBS"],
        "enterprise": ["COVER_LETTER", "CV_OPTIMIZATION", "AI_JOB_ANALYSIS", "COMPANY_AI_AD", "COMPANY_RECOMMENDATIONS", "COMPANY_UNLIMITED_JOBS"],
        "assessment_bundle": ["COMPANY_AI_AD", "COMPANY_RECOMMENDATIONS"],
        "freelance_premium": ["COVER_LETTER", "CV_OPTIMIZATION", "AI_JOB_ANALYSIS"],
        "single_assessment": [],
        "free": [],
    }

    def _can_access(tier: str, active: bool) -> bool:
        if tier in feature_access and not active:
            return False
        return billing_request.feature in feature_access.get(tier, [])

    # Fast path from verify_subscription context
    user_tier = user.get("subscription_tier", "free")
    is_active = bool(user.get("is_subscription_active", False))
    if _can_access(user_tier, is_active):
        return {"hasAccess": True, "subscriptionTier": user_tier}

    # Authoritative fallback: resolve latest user-level and all authorized company-level subscriptions.
    # This prevents false paywalls when the auth context points to an unrelated/inactive company.
    user_id = user.get("id") or user.get("auth_id")
    authorized_ids = user.get("authorized_ids") or []

    candidates: list[dict] = []
    if user_id:
        user_sub = _get_latest_subscription_by("user_id", user_id)
        if user_sub:
            candidates.append(user_sub)

    for company_id in authorized_ids:
        if company_id == user_id:
            continue
        company_sub = _get_latest_subscription_by("company_id", company_id)
        if company_sub:
            candidates.append(company_sub)

    for sub in candidates:
        tier = (sub.get("tier") or "free").lower()
        active = _is_active_subscription(sub)
        if _can_access(tier, active):
            return {"hasAccess": True, "subscriptionTier": tier}

    if user_tier in feature_access and not is_active:
        return {"hasAccess": False, "reason": "Inactive subscription"}

    return {"hasAccess": False, "reason": f"Feature {billing_request.feature} not in {user_tier} tier"}

@router.post("/cancel-subscription")
@limiter.limit("10/minute")
async def cancel_subscription(request: Request, user: dict = Depends(verify_subscription)):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    
    user_id = user.get("id") or user.get("auth_id")
    is_company = user.get("company_name") is not None

    if is_company:
        company_id = require_company_access(user, user.get("company_id"))
    
    sub_resp = supabase.table("subscriptions").select("*").eq(
        "company_id" if is_company else "user_id",
        company_id if is_company else user_id
    ).eq("status", "active").execute()
    if not sub_resp.data: raise HTTPException(status_code=404, detail="No active subscription")
    
    sub = sub_resp.data[0]
    stripe_id = sub.get("stripe_subscription_id")
    if stripe_id and not stripe_id.startswith("trial_"):
        try:
            stripe.Subscription.delete(stripe_id)
        except: pass

    supabase.table("subscriptions").update({"status": "canceled", "canceled_at": now_iso()}).eq("id", sub["id"]).execute()
    return {"status": "success"}
