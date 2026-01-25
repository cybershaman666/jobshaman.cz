from fastapi import FastAPI, HTTPException, Body, Request, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
import stripe
import resend
from supabase import create_client, Client
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

from itsdangerous import URLSafeTimedSerializer
from fastapi.responses import HTMLResponse
from apscheduler.schedulers.background import BackgroundScheduler
import sys
import os
import time
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.exceptions import RequestValidationError
from starlette.responses import JSONResponse

# Ensure we can import from the sibling scraper package
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from scraper.scraper_multi import run_all_scrapers

load_dotenv()

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="JobShaman Backend Services")

# Security setup
security = HTTPBearer()

# Define premium endpoints that require subscription
PREMIUM_ENDPOINTS = {
    "/check-legality": ["premium", "business"],
    "/match-candidates": ["business"],
    "/ai-optimize-job": ["premium", "business"],
    "/ai-assess-candidate": ["premium"],
}


def now_iso():
    return time.strftime("%Y-%m-%d %H:%M:%S")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Extract and verify user from JWT token"""
    try:
        token = credentials.credentials
        # For now, we'll use the token as user ID (in production, verify JWT)
        # TODO: Implement proper JWT verification
        if not token or token == "undefined":
            raise HTTPException(status_code=401, detail="Invalid authentication token")

        # Get user from Supabase
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not available")

        user_response = supabase.table("profiles").select("*").eq("id", token).execute()
        if not user_response.data:
            # Try companies table
            user_response = (
                supabase.table("companies").select("*").eq("id", token).execute()
            )
            if not user_response.data:
                raise HTTPException(status_code=401, detail="User not found")

        return user_response.data[0]
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def verify_subscription(
    user: dict = Depends(get_current_user), request: Request = None
):
    """Verify user has active subscription for premium features"""
    path = request.url.path

    # Check if this endpoint requires subscription
    if path not in PREMIUM_ENDPOINTS:
        return user  # No subscription required for this endpoint

    required_tiers = PREMIUM_ENDPOINTS[path]
    user_tier = user.get("subscription_tier", "free")

    # No admin bypass - all users must have valid subscriptions

    if user_tier not in required_tiers and user_tier != "admin":
        raise HTTPException(
            status_code=403,
            detail=f"Premium subscription required. Current tier: {user_tier}, Required: {', '.join(required_tiers)}",
        )

    # Verify subscription is active in database
    if user_tier in ["premium", "business"]:
        if user.get("id"):
            subscription_check = (
                supabase.table("subscriptions")
                .select("*")
                .eq("company_id" if user.get("company_name") else "user_id", user["id"])
                .eq("status", "active")
                .execute()
            )

            if not subscription_check.data and user_tier != "admin":
                raise HTTPException(
                    status_code=403, detail="Subscription not active or expired"
                )

    return user


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Scheduler
scheduler = BackgroundScheduler()
scheduler.add_job(func=run_all_scrapers, trigger="interval", hours=12)
scheduler.start()

# Configure APIs
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-shaman-key")
resend.api_key = os.getenv("RESEND_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
API_BASE_URL = os.getenv("API_BASE_URL", "https://jobshaman-cz.onrender.com")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")


def get_supabase_client():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(
            "❌ CHYBA: SUPABASE_URL nebo SUPABASE_KEY chybí v prostředí Renderu! Nastav je v dashboardu."
        )
        return None
    try:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"❌ Chyba při připojování k Supabase: {e}")
        return None


supabase: Client = get_supabase_client()
serializer = URLSafeTimedSerializer(SECRET_KEY)


class JobCheckRequest(BaseModel):
    id: str
    title: str
    company: str
    description: str

    needs_manual_review: bool = False


class CheckoutRequest(BaseModel):
    tier: str  # 'premium' | 'business'
    userId: str  # profile ID or company ID
    successUrl: str
    cancelUrl: str


class BillingVerificationRequest(BaseModel):
    feature: str
    endpoint: str


class JobCheckResponse(BaseModel):
    risk_score: float
    is_legal: bool
    reasons: List[str]
    needs_manual_review: bool


@app.get("/")
async def root():
    return {"status": "online", "service": "JobShaman Backend"}


@app.get("/scrape")
async def trigger_scrape():
    """Manual trigger for the scraper. Useful for local testing or external cron-jobs."""
    try:
        count = run_all_scrapers()
        # After scraping, find matches for everything new/active
        # (For efficiency, we could limit this to just new IDs, but here we run for all active)
        return {
            "status": "success",
            "jobs_saved": count,
            "message": "Scraping complete. Auto-matching will run as jobs are viewed or periodically.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/job-action/{job_id}/{action}", response_class=HTMLResponse)
async def perform_job_action(job_id: str, action: str, token: str):
    try:
        # Verify token (valid for 48 hours)
        email = serializer.loads(token, salt="job-action", max_age=172800)
        if email != "floki@jobshaman.cz":
            raise HTTPException(status_code=403, detail="Unauthorized")

        status = "approved" if action == "approve" else "rejected"
        supabase.table("jobs").update(
            {
                "legality_status": status,
                "verification_notes": f"Ručně {status} uživatelem floki",
            }
        ).eq("id", job_id).execute()

        return f"""
        <html>
            <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f0f9ff;">
                <div style="background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
                    <h1 style="color: #0369a1;">Hotovo!</h1>
                    <p>Inzerát <strong>{job_id}</strong> byl úspěšně <strong>{status}</strong>.</p>
                    <p style="color: #64748b; font-size: 0.8rem;">Můžete toto okno zavřít.</p>
                </div>
            </body>
        </html>
        """
    except Exception as e:
        return f"<h1>Chyba</h1><p>{str(e)}</p>", 400


def check_legality_rules(title: str, company: str, description: str):
    """
    Heuristic-based legality check using keywords and patterns.
    Returns: (risk_score, is_legal, reasons, needs_manual_review)
    """
    risk_score = 0.0
    reasons = []

    # Lowercase everything for matching
    text = f"{title} {company} {description}".lower()

    # 1. High-risk keyword categories
    fraud_keywords = {
        "MLM/Pyramid": [
            "mlm",
            "letadlo",
            "pyramida",
            "provize z lidí",
            "síťový marketing",
        ],
        "Crypto Fraud": [
            "kryptoměny",
            "bitcoin investice",
            "těžba bitcoinu",
            "zaručený výdělek",
        ],
        "Work from home scams": [
            "práce z domova 5000",
            "balení propisek",
            "lepení obálek",
        ],
        "Get rich quick": [
            "pasivní příjem",
            "rychle zbohatnout",
            "změňte svůj život",
            "bez zkušeností 100000",
        ],
        "Communication red flags": [
            "jen přes whatsapp",
            "piste na telegram",
            "whatsapp kontakt",
        ],
    }

    for category, keywords in fraud_keywords.items():
        found = [k for k in keywords if k in text]
        if found:
            # Increase risk score
            impact = 0.2 * len(found)
            risk_score += impact
            reasons.append(
                f"Nalezeny podezřelé výrazy ({category}): {', '.join(found)}"
            )

    # 2. Pattern checks
    if len(description) < 100:
        risk_score += 0.1
        reasons.append("Příliš krátký popis (podezřele málo informací)")

    if "???" in text or "!!!" in text:
        risk_score += 0.05
        reasons.append("Nadměrná interpunkce (neformální/nátlakový tón)")

    # Normalize score
    risk_score = min(risk_score, 1.0)

    # Decision logic
    is_legal = risk_score < 0.6
    needs_manual_review = 0.15 <= risk_score <= 0.6

    return risk_score, is_legal, reasons, needs_manual_review


@app.post("/check-legality", response_model=JobCheckResponse)
@limiter.limit("30/minute")  # Rate limiting
async def check_job_legality(
    job: JobCheckRequest, request: Request, user: dict = Depends(verify_subscription)
):
    try:
        # Rule-based analysis (replaces Gemini)
        risk_score, is_legal, reasons, needs_manual_review = check_legality_rules(
            job.title, job.company, job.description
        )

        result = JobCheckResponse(
            risk_score=risk_score,
            is_legal=is_legal,
            reasons=reasons,
            needs_manual_review=needs_manual_review,
        )

        # If it needs manual review, send email
        if result.needs_manual_review:
            send_review_email(job, result)

        # Update Supabase
        if supabase:
            status = (
                "approved"
                if result.is_legal and not result.needs_manual_review
                else "pending"
                if result.needs_manual_review
                else "rejected"
            )
            supabase.table("jobs").update(
                {
                    "legality_status": status,
                    "risk_score": result.risk_score,
                    "verification_notes": ", ".join(result.reasons)
                    or "Zkontrolováno pravidly",
                }
            ).eq("id", job.id).execute()

            # Auto-trigger matching for approved jobs
            if status == "approved":
                print(f"DEBUG: Triggering auto-match for job {job.id}")
                # We could store these in DB here if we had the table

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def calculate_candidate_match(candidate: dict, job: dict):
    """
    Heuristic-based matching between a candidate and a job.
    """
    score = 0.0
    reasons = []

    # 1. Skill Matching (Highest Weight)
    candidate_skills = set([s.lower() for s in candidate.get("skills", [])])
    job_skills = set([s.lower() for s in job.get("required_skills", [])])

    if job_skills:
        overlap = candidate_skills.intersection(job_skills)
        if overlap:
            skill_score = len(overlap) / len(job_skills)
            score += skill_score * 0.5  # 50% weight for skills
            reasons.append(
                f"Shoda v dovednostech ({len(overlap)}): {', '.join(overlap)}"
            )

    # 2. Title Matching
    cand_title = (candidate.get("job_title") or "").lower()
    job_title = (job.get("title") or "").lower()

    if cand_title and job_title:
        # Simple keyword overlap in titles
        cand_words = set(cand_title.split())
        job_words = set(job_title.split())
        title_overlap = cand_words.intersection(job_words)
        if title_overlap:
            score += 0.3  # 30% weight for title overlap
            reasons.append(f"Podobný název pozice: {cand_title}")

    # 3. Keyword Overlap in Descriptions
    desc = (job.get("description") or "").lower()
    cv = (candidate.get("cv_text") or "").lower()

    if desc and cv:
        # Look for skills in CV text too (in case 'skills' tag is incomplete)
        for skill in job_skills:
            if skill in cv and skill not in overlap:
                score += 0.05
                reasons.append(f"Zjištěna dovednost v CV: {skill}")

    # Normalize
    score = round(min(score, 1.0) * 100, 1)  # Internal percentage
    return score, reasons


@app.post("/match-candidates")
@limiter.limit("10/minute")  # Stricter rate limiting for matching
async def match_candidates_service(
    job_id: int = Query(...),
    request: Request = None,
    user: dict = Depends(verify_subscription),
):
    """
    Endpoint to find best matches for a job in the database.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    try:
        # 1. Fetch Job
        job_res = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
        if not job_res.data:
            raise HTTPException(status_code=404, detail="Job not found")
        job = job_res.data

        # 2. Fetch all candidates
        cand_res = supabase.table("candidate_profiles").select("*").execute()
        candidates = cand_res.data

        matches = []
        for cand in candidates:
            score, reasons = calculate_candidate_match(cand, job)
            if score > 15:  # Lower threshold for more results
                match_obj = {
                    "candidate_id": cand["id"],
                    "score": score,
                    "reasons": reasons,
                    "profile": {
                        "name": cand.get("full_name") or "Anonymní kandidát",
                        "job_title": cand.get("job_title") or "Hledá práci",
                        "skills": cand.get("skills") or [],
                        "bio": cand.get("cv_text")[:200] if cand.get("cv_text") else "",
                    },
                }
                matches.append(match_obj)

        # Sort and take top 10
        matches.sort(key=lambda x: x["score"], reverse=True)
        top_matches = matches[:10]

        # 3. Persist matches to Supabase (simplistic background task)
        # We don't save the 'profile' nested object to the DB
        db_matches = [
            {
                "job_id": job_id,
                "candidate_id": m["candidate_id"],
                "match_score": m["score"],
                "match_reasons": m["reasons"],
            }
            for m in top_matches
        ]

        try:
            supabase.table("job_candidate_matches").delete().eq(
                "job_id", job_id
            ).execute()
            if db_matches:
                supabase.table("job_candidate_matches").insert(db_matches).execute()
        except Exception:
            pass  # Silent fail if table not ready

        # Log premium feature access
        try:
            supabase.table("premium_access_logs").insert(
                {
                    "user_id": user.get("id"),
                    "feature": "match_candidates",
                    "endpoint": "/match-candidates",
                    "ip_address": get_remote_address(request),
                    "timestamp": now_iso(),
                    "subscription_tier": user.get("subscription_tier", "free"),
                }
            ).execute()
        except Exception:
            pass  # Silent fail for logging

        return {"job_id": job_id, "matches": top_matches}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def send_review_email(job: JobCheckRequest, result: JobCheckResponse):
    try:
        token = serializer.dumps("floki@jobshaman.cz", salt="job-action")
        approve_url = f"{API_BASE_URL}/job-action/{job.id}/approve?token={token}"
        reject_url = f"{API_BASE_URL}/job-action/{job.id}/reject?token={token}"

        r = resend.Emails.send(
            {
                "from": "JobShaman <noreply@jobshaman.cz>",
                "to": ["floki@jobshaman.cz"],
                "subject": f"⚠️ Ruční kontrola inzerátu: {job.title}",
                "html": f"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
                <h2 style="color: #1e40af;">⚠️ Vyžadována ruční kontrola</h2>
                <p><strong>Firma:</strong> {job.company}</p>
                <p><strong>Pozice:</strong> {job.title}</p>
                <p><strong>AI Risk Score:</strong> <span style="color: #e11d48; font-weight: bold;">{result.risk_score}</span></p>
                <p><strong>Důvody AI:</strong> {", ".join(result.reasons)}</p>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: 4px; margin: 20px 0;">
                    <p><strong>Popis pozice:</strong></p>
                    <div style="font-size: 0.9rem; color: #475569;">{job.description}</div>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 30px;">
                    <a href="{approve_url}" style="background: #059669; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">✅ Schválit</a>
                    <a href="{reject_url}" style="background: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">❌ Zamítnout</a>
                </div>
                
                <p style="font-size: 0.8rem; color: #94a3b8; margin-top: 20px;">
                    Odkazy jsou platné 48 hodin.
                </p>
            </div>
            """,
            }
        )
        return r
    except Exception as e:
        print(f"Failed to send email: {e}")


# --- BILLING VERIFICATION ENDPOINTS ---


@app.post("/verify-billing")
@limiter.limit("100/minute")
async def verify_billing(
    request: BillingVerificationRequest,
    http_request: Request,
    user: dict = Depends(verify_subscription),
):
    """
    Server-side billing verification for premium features
    This is the ONLY way to verify feature access
    """
    try:
        user_tier = user.get("subscription_tier", "free")
        user_id = user.get("id")

        # Define feature access by tier
        feature_access = {
            "premium": {
                "features": ["COVER_LETTER", "CV_OPTIMIZATION", "ATC_HACK"],
                "assessments": 0,
            },
            "business": {
                "features": [
                    "COMPANY_AI_AD",
                    "COMPANY_RECOMMENDATIONS",
                    "COMPANY_UNLIMITED_JOBS",
                ],
                "assessments": 10,
            },
            "assessment_bundle": {
                "features": ["COMPANY_AI_AD", "COMPANY_RECOMMENDATIONS"],
                "assessments": 10,
            },
        }

        # Check if user has access to the feature
        tier_config = feature_access.get(user_tier, {"features": [], "assessments": 0})

        if request.feature not in tier_config["features"]:
            return {
                "hasAccess": False,
                "subscriptionTier": user_tier,
                "reason": f"Feature '{request.feature}' not available in {user_tier} tier",
            }

        # For assessment features, check usage
        if "ASSESS" in request.feature and user_tier in [
            "business",
            "assessment_bundle",
        ]:
            # Get current usage
            usage_response = (
                supabase.table("subscriptions")
                .select("ai_assessments_used")
                .eq("company_id", user_id)
                .execute()
            )
            current_usage = (
                usage_response.data[0].get("ai_assessments_used", 0)
                if usage_response.data
                else 0
            )

            if current_usage >= tier_config["assessments"]:
                return {
                    "hasAccess": False,
                    "subscriptionTier": user_tier,
                    "reason": "Assessment limit exceeded",
                    "usage": {
                        "current": current_usage,
                        "limit": tier_config["assessments"],
                        "remaining": 0,
                    },
                }

            return {
                "hasAccess": True,
                "subscriptionTier": user_tier,
                "usage": {
                    "current": current_usage,
                    "limit": tier_config["assessments"],
                    "remaining": tier_config["assessments"] - current_usage,
                },
            }

        return {"hasAccess": True, "subscriptionTier": user_tier}

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Billing verification failed: {str(e)}"
        )


@app.get("/subscription-status")
@limiter.limit("30/minute")
async def get_subscription_status(
    request: Request, userId: str = Query(...), user: dict = Depends(get_current_user)
):
    """
    Get subscription status for UI display purposes only
    Does NOT grant access to features
    """
    try:
        if user.get("id") != userId:
            raise HTTPException(
                status_code=403, detail="Cannot access other users' subscription info"
            )

        user_tier = user.get("subscription_tier", "free")

        # Get subscription details if not free tier
        subscription_details = None
        if user_tier != "free":
            table_name = "companies" if user.get("company_name") else "profiles"
            sub_response = (
                supabase.table("subscriptions")
                .select("*")
                .eq(
                    "company_id" if user.get("company_name") else "user_id",
                    user.get("id"),
                )
                .execute()
            )

            if sub_response.data:
                subscription_details = sub_response.data[0]

        return {
            "tier": user_tier,
            "status": subscription_details.get("status", "active")
            if subscription_details
            else "inactive",
            "expiresAt": subscription_details.get("current_period_end")
            if subscription_details
            else None,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get subscription status: {str(e)}"
        )


# --- STRIPE ENDPOINTS ---


@app.post("/create-checkout-session")
async def create_checkout_session(req: CheckoutRequest):
    try:
        # Live Stripe Price IDs
        prices = {
            "premium": "price_1StDJuG2Aezsy59eqi584FWl",
            "business": "price_1StDKmG2Aezsy59e1eiG9bny",
            "assessment": "price_1StDLUG2Aezsy59eJaSeiWvY",
            "assessment_bundle": "price_1StDTGG2Aezsy59esZLgocHw",
        }

        price_id = prices.get(req.tier)
        if not price_id:
            raise HTTPException(status_code=400, detail="Invalid tier")

        # 'premium' and 'business' are subscriptions, 'assessment' is a one-time payment
        mode = "subscription" if req.tier in ["premium", "business"] else "payment"

        checkout_session = stripe.checkout.Session.create(
            line_items=[
                {
                    "price": price_id,
                    "quantity": 1,
                }
            ],
            mode=mode,
            success_url=req.successUrl,
            cancel_url=req.cancelUrl,
            metadata={"userId": req.userId, "tier": req.tier},
        )
        return {"url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook Error: {str(e)}")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"]["userId"]
        tier = session["metadata"]["tier"]

        # SECURITY: Verify payment amount matches expected tier pricing
        expected_amounts = {
            "premium": 29000,  # 290 CZK in cents
            "business": 59000,  # 590 CZK in cents
            "assessment": 15000,  # 150 CZK in cents
            "assessment_bundle": 39000,  # 390 CZK in cents
        }

        expected_amount = expected_amounts.get(tier)
        if expected_amount and session["amount_total"] != expected_amount:
            print(
                f"🚨 SECURITY ALERT: Payment amount mismatch for {user_id}. Expected: {expected_amount}, Got: {session['amount_total']}"
            )
            # Don't grant access if payment amount doesn't match
            return {"status": "error", "message": "Payment verification failed"}

        # Additional security: Verify the payment was successful
        if session["payment_status"] != "paid":
            print(
                f"🚨 SECURITY ALERT: Payment not completed for {user_id}. Status: {session['payment_status']}"
            )
            return {"status": "error", "message": "Payment not completed"}

        if supabase:
            if tier == "premium":
                # Update Candidate Profile
                supabase.table("profiles").update({"subscription_tier": "premium"}).eq(
                    "id", user_id
                ).execute()
            elif tier == "business":
                # Update Company Profile
                supabase.table("companies").update(
                    {"subscription_tier": "business"}
                ).eq("id", user_id).execute()
                # Also create/update subscriptions table entry
                existing = (
                    supabase.table("subscriptions")
                    .select("id")
                    .eq("company_id", user_id)
                    .execute()
                )
                if existing.data:
                    supabase.table("subscriptions").update(
                        {
                            "tier": "business",
                            "status": "active",
                            "stripe_subscription_id": session.get("subscription"),
                            "current_period_start": session.get("current_period_start"),
                            "current_period_end": session.get("current_period_end"),
                            "updated_at": now_iso(),
                        }
                    ).eq("company_id", user_id).execute()
                else:
                    supabase.table("subscriptions").insert(
                        {
                            "company_id": user_id,
                            "tier": "business",
                            "status": "active",
                            "stripe_subscription_id": session.get("subscription"),
                            "current_period_start": session.get("current_period_start"),
                            "current_period_end": session.get("current_period_end"),
                        }
                    ).execute()
            elif tier == "assessment":
                # Update Candidate Profile for one-time assessment
                supabase.table("profiles").update({"has_assessment": True}).eq(
                    "id", user_id
                ).execute()
            elif tier == "assessment_bundle":
                # Update Company Profile for bundle
                supabase.table("companies").update(
                    {"subscription_tier": "assessment_bundle"}
                ).eq("id", user_id).execute()

        print(f"✅ Stripe Payment verified and completed for {user_id} tier: {tier}")

    return {"status": "success"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
