import os
import stripe
from fastapi import APIRouter, Request, Depends, HTTPException
from ..core.config import STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PREMIUM, STRIPE_PRICE_BUSINESS, STRIPE_PRICE_ASSESSMENT_BUNDLE, STRIPE_PRICE_SINGLE_ASSESSMENT
from ..core.limiter import limiter
from ..core.security import get_current_user, verify_csrf_token_header
from ..models.requests import CheckoutRequest
from ..core.database import supabase
from ..utils.helpers import now_iso
from datetime import datetime, timezone, timedelta

router = APIRouter()

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

@router.post("/create-checkout-session")
@limiter.limit("10/minute")
async def create_checkout_session(req: CheckoutRequest, request: Request, user: dict = Depends(get_current_user)):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF token validation failed")
        
    is_valid_user = (user.get("id") == req.userId or user.get("auth_id") == req.userId)
    is_valid_company = (user.get("company_id") == req.userId)
    
    if not (is_valid_user or is_valid_company):
        raise HTTPException(status_code=403, detail="User ID mismatch")

    try:
        if not stripe.api_key:
            raise HTTPException(status_code=500, detail="Stripe not configured")

        tier_mapping = {
            "premium": "premium",
            "basic": "premium",
            "business": "business",
            "assessment_bundle": "assessment_bundle",
            "single_assessment": "single_assessment",
        }

        backend_tier = tier_mapping.get(req.tier)
        if not backend_tier:
            raise HTTPException(status_code=400, detail=f"Invalid tier: {req.tier}")

        prices = {
            "premium": STRIPE_PRICE_PREMIUM,
            "business": STRIPE_PRICE_BUSINESS,
            "assessment_bundle": STRIPE_PRICE_ASSESSMENT_BUNDLE,
            "single_assessment": STRIPE_PRICE_SINGLE_ASSESSMENT,
        }

        price_id = prices.get(backend_tier)
        mode = "subscription" if backend_tier in ["premium", "business"] else "payment"

        checkout_session = stripe.checkout.Session.create(
            line_items=[{"price": price_id, "quantity": 1}],
            mode=mode,
            success_url=req.successUrl,
            cancel_url=req.cancelUrl,
            metadata={"userId": req.userId, "tier": backend_tier},
        )
        return {"url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret missing")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if event["type"] == "checkout.session.completed":
        session = event.get("data", {}).get("object")
        metadata = session.get("metadata")
        user_id = metadata.get("userId")
        tier = metadata.get("tier")

        if not user_id or not tier:
            raise HTTPException(status_code=400, detail="Missing metadata")

        if supabase:
            if tier in ["premium", "basic"]:
                # Logic for candidates
                data = {
                    "user_id": user_id,
                    "tier": "premium",
                    "status": "active",
                    "stripe_subscription_id": session.get("subscription"),
                    "updated_at": now_iso(),
                }
                supabase.table("subscriptions").upsert(data, on_conflict="user_id").execute()
            
            elif tier == "business":
                data = {
                    "company_id": user_id,
                    "tier": "business",
                    "status": "active",
                    "stripe_subscription_id": session.get("subscription"),
                    "updated_at": now_iso(),
                }
                supabase.table("subscriptions").upsert(data, on_conflict="company_id").execute()
            
            elif tier in ["assessment_bundle", "single_assessment"]:
                data = {
                    "company_id": user_id,
                    "tier": tier,
                    "status": "active",
                    "stripe_subscription_id": session.get("subscription") or f"oneshot_{session.get('id')}",
                    "current_period_end": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
                    "updated_at": now_iso(),
                }
                supabase.table("subscriptions").upsert(data, on_conflict="company_id").execute()

    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        stripe_sub_id = subscription["id"]
        supabase.table("subscriptions").update({
            "current_period_end": datetime.fromtimestamp(subscription["current_period_end"], timezone.utc).isoformat(),
            "status": "active" if subscription["status"] in ["active", "trialing"] else "inactive",
            "updated_at": now_iso()
        }).eq("stripe_subscription_id", stripe_sub_id).execute()

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        stripe_sub_id = subscription["id"]
        supabase.table("subscriptions").update({
            "status": "canceled",
            "canceled_at": now_iso(),
            "updated_at": now_iso()
        }).eq("stripe_subscription_id", stripe_sub_id).execute()

    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        stripe_sub_id = invoice.get("subscription")
        if stripe_sub_id:
            supabase.table("subscriptions").update({
                "status": "suspended",
                "updated_at": now_iso()
            }).eq("stripe_subscription_id", stripe_sub_id).execute()

    return {"status": "success"}
