from fastapi import APIRouter, Request, Depends, HTTPException, Query
import stripe
from ..core.limiter import limiter
from ..core.security import get_current_user, verify_subscription, verify_csrf_token_header
from ..models.requests import BillingVerificationRequest
from ..core.database import supabase
from ..services.email import send_email
from ..utils.helpers import now_iso
from datetime import datetime, timezone, timedelta

router = APIRouter()

@router.get("/subscription-status")
@limiter.limit("30/minute")
async def get_subscription_status(request: Request, userId: str = Query(...), user: dict = Depends(get_current_user)):
    authorized_ids = user.get("authorized_ids", [])
    user_id = user.get("id") or user.get("auth_id")
    is_company_admin = bool(user.get("company_name"))
    
    if userId not in authorized_ids:
        print(f"🚫 [AUTH] Access denied: {userId} not in authorized list {authorized_ids}")
        raise HTTPException(status_code=403, detail="Unauthorized")

    tier_limits = {
        "free": {"assessments": 0, "job_postings": 3, "name": "Free"},
        "premium": {"assessments": 0, "job_postings": 10, "name": "Premium"},
        "business": {"assessments": 10, "job_postings": 999, "name": "Business"},
        "trial": {"assessments": 10, "job_postings": 999, "name": "Business Plan (Trial)"},
        "enterprise": {"assessments": 999999, "job_postings": 999, "name": "Enterprise"},
        "assessment_bundle": {"assessments": 10, "job_postings": 0, "name": "Assessment Bundle"},
        "single_assessment": {"assessments": 1, "job_postings": 0, "name": "Single Assessment"},
    }

    sub_details = {"tier": "free", "status": "active"}
    try:
        if is_company_admin:
            # Use the company_id from the user profile, not the passed userId (which might be the user's ID)
            target_company_id = user.get("company_id")
            if not target_company_id:
                print(f"⚠️ Company Admin {user_id} has no company_id associated")
                # Fallback or error? For now, if no company_id, we can't fetch company subscription.
                # But is_company_admin is only true if company_name exists, implying company_id exists in our security logic.
                target_company_id = userId # Fallback to request param if something is weird, but risky.
            
            sub_response = supabase.table("subscriptions").select("*").eq("company_id", target_company_id).execute()
            if not sub_response.data:
                # Auto-trial
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
        else:
            sub_response = supabase.table("subscriptions").select("*").eq("user_id", user_id).execute()
        
        if sub_response and sub_response.data:
            sub_details = sub_response.data[0]
    except Exception as e:
        print(f"❌ Error fetching/creating subscription for {userId}: {e}")
        # Fallback to free tier on database error instead of crashing
    tier = sub_details.get("tier", "free")
    limits = tier_limits.get(tier, tier_limits["free"])

    if is_company_admin:
        try:
            target_company_id = user.get("company_id") or userId
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
        "jobPostingsUsed": real_job_count if is_company_admin else stats["active_jobs_count"],
    }

@router.post("/verify-billing")
@limiter.limit("100/minute")
async def verify_billing(billing_request: BillingVerificationRequest, request: Request, user: dict = Depends(verify_subscription)):
    user_tier = user.get("subscription_tier", "free")
    
    feature_access = {
        "basic": ["COVER_LETTER", "CV_OPTIMIZATION", "AI_JOB_ANALYSIS"],
        "business": ["COMPANY_AI_AD", "COMPANY_RECOMMENDATIONS", "COMPANY_UNLIMITED_JOBS"],
        "assessment_bundle": ["COMPANY_AI_AD", "COMPANY_RECOMMENDATIONS"],
    }
    
    allowed_features = feature_access.get(user_tier, [])
    if billing_request.feature in allowed_features:
        return {"hasAccess": True}
        
    return {"hasAccess": False, "reason": f"Feature {billing_request.feature} not in {user_tier} tier"}

@router.post("/cancel-subscription")
@limiter.limit("10/minute")
async def cancel_subscription(request: Request, user: dict = Depends(verify_subscription)):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    
    user_id = user.get("id") or user.get("auth_id")
    is_company = user.get("company_name") is not None
    
    sub_resp = supabase.table("subscriptions").select("*").eq("company_id" if is_company else "user_id", user_id).eq("status", "active").execute()
    if not sub_resp.data: raise HTTPException(status_code=404, detail="No active subscription")
    
    sub = sub_resp.data[0]
    stripe_id = sub.get("stripe_subscription_id")
    if stripe_id and not stripe_id.startswith("trial_"):
        try:
            stripe.Subscription.delete(stripe_id)
        except: pass

    supabase.table("subscriptions").update({"status": "canceled", "canceled_at": now_iso()}).eq("id", sub["id"]).execute()
    return {"status": "success"}
