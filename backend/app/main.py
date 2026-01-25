from fastapi import FastAPI, HTTPException, Body, Request, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, validator, Field
from typing import List, Optional
import stripe
import resend
from supabase import create_client, Client
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
import jwt
import re
from datetime import datetime, timedelta
import html
import bleach

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
    "/check-legality": ["basic", "business"],
    "/match-candidates": ["business"],
    "/ai-optimize-job": ["basic", "business"],
    "/ai-assess-candidate": ["basic"],
}


def now_iso():
    return time.strftime("%Y-%m-%d %H:%M:%S")


def verify_supabase_token(token: str) -> dict:
    """Verify Supabase JWT token and return user data"""
    try:
        # Use Supabase client to verify the token
        if not supabase:
            raise HTTPException(
                status_code=500, detail="Authentication service unavailable"
            )

        # Get user from Supabase auth
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        user_data = user_response.user

        # Get additional user profile data
        profile_response = (
            supabase.table("profiles").select("*").eq("id", user_data.id).execute()
        )
        if profile_response.data and len(profile_response.data) > 0:
            profile_data = profile_response.data[0]
            if isinstance(profile_data, dict):
                result = profile_data.copy()
                result["user_type"] = "candidate"
                result["auth_id"] = user_data.id
                result["email"] = getattr(user_data, "email", "")
                return result

        # Try companies table
        company_response = (
            supabase.table("companies").select("*").eq("id", user_data.id).execute()
        )
        if company_response.data and len(company_response.data) > 0:
            company_data = company_response.data[0]
            if isinstance(company_data, dict):
                result = company_data.copy()
                result["user_type"] = "company"
                result["auth_id"] = user_data.id
                result["email"] = getattr(user_data, "email", "")
                return result

        # Try companies table
        company_response = (
            supabase.table("companies").select("*").eq("id", user_data.id).execute()
        )
        if company_response.data:
            result = company_response.data[0].copy()
            result["user_type"] = "company"
            result["auth_id"] = user_data.id
            result["email"] = getattr(user_data, "email", "")
            return result

        # Try companies table
        company_response = (
            supabase.table("companies").select("*").eq("id", user_data.id).execute()
        )
        if company_response.data:
            result = {"user_type": "company"}
            # Add auth user data
            if hasattr(user_data, "model_dump"):
                for key, value in user_data.model_dump().items():
                    result[key] = value
            # Add company data
            for key, value in company_response.data[0].items():
                result[key] = value
            return result

        # Try companies table
        company_response = (
            supabase.table("companies").select("*").eq("id", user_data.id).execute()
        )
        if company_response.data:
            user_dict = (
                user_data.model_dump() if hasattr(user_data, "model_dump") else {}
            )
            company_dict = company_response.data[0]
            result = {**user_dict, **company_dict, "user_type": "company"}
            return result

        # Try companies table
        company_response = (
            supabase.table("companies").select("*").eq("id", user_data.id).execute()
        )
        if company_response.data:
            user_dict = (
                user_data.model_dump()
                if hasattr(user_data, "model_dump")
                else vars(user_data)
            )
            result = {**user_dict, **company_response.data[0], "user_type": "company"}
            return result

        raise HTTPException(status_code=401, detail="User profile not found")

    except Exception as e:
        if "Invalid" in str(e) or "expired" in str(e).lower():
            raise HTTPException(
                status_code=401, detail="Invalid or expired authentication token"
            )
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Extract and verify user from Supabase JWT token"""
    try:
        token = credentials.credentials

        # Validate token format
        if not token or token == "undefined":
            raise HTTPException(status_code=401, detail="Authentication token required")

        # Basic token format validation
        if not token.startswith("eyJ") or len(token) < 100:
            raise HTTPException(status_code=401, detail="Invalid token format")

        # Verify with Supabase
        user = verify_supabase_token(token)

        # Check if user is active
        if user.get("banned", False):
            raise HTTPException(status_code=403, detail="Account suspended")

        return user

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Authentication failed")


async def get_current_active_user(current_user: dict = Depends(get_current_user)):
    """Ensure user is active and not banned"""
    if current_user.get("banned", False):
        raise HTTPException(status_code=403, detail="Account suspended")
    return current_user


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


# Configure CORS with specific origins for security
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://localhost:3000",
    "https://localhost:5173",
    "https://jobshaman-cz.onrender.com",
    "https://jobshaman.cz",
]

# In production, you can override with environment variable
production_origins = os.getenv("ALLOWED_ORIGINS")
if production_origins:
    allowed_origins = [origin.strip() for origin in production_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "User-Agent"],
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
    id: str = Field(..., min_length=1, max_length=100, description="Job ID")
    title: str = Field(..., min_length=1, max_length=200, description="Job title")
    company: str = Field(..., min_length=1, max_length=200, description="Company name")
    description: str = Field(
        ..., min_length=10, max_length=5000, description="Job description"
    )
    needs_manual_review: bool = False

    @validator("title", "company")
    def sanitize_text_fields(cls, v):
        """Sanitize text fields to prevent XSS"""
        if not v:
            raise ValueError("This field cannot be empty")
        # Remove HTML tags and escape special characters
        return html.escape(bleach.clean(v.strip(), tags=[], attributes={}, strip=True))

    @validator("description")
    def validate_description(cls, v):
        """Validate and sanitize description"""
        if not v or len(v.strip()) < 10:
            raise ValueError("Description must be at least 10 characters long")
        # Allow basic formatting but sanitize dangerous content
        allowed_tags = ["p", "br", "strong", "em", "ul", "ol", "li"]
        return bleach.clean(v.strip(), tags=allowed_tags, attributes={}, strip=True)


class CheckoutRequest(BaseModel):
    tier: str = Field(
        ...,
        regex=r"^(premium|business|assessment|assessment_bundle)$",
        description="Subscription tier",
    )
    userId: str = Field(..., min_length=1, max_length=100, description="User ID")
    successUrl: str = Field(..., regex=r"^https?://.+", description="Success URL")
    cancelUrl: str = Field(..., regex=r"^https?://.+", description="Cancel URL")

    @validator("successUrl", "cancelUrl")
    def validate_urls(cls, v):
        """Validate URLs to prevent redirect attacks"""
        if not v.startswith(
            ("http://localhost", "https://localhost", "https://jobshaman")
        ):
            raise ValueError("URL must point to authorized domain")
        return v


class BillingVerificationRequest(BaseModel):
    feature: str
    endpoint: str


class JobCheckResponse(BaseModel):
    risk_score: float
    is_legal: bool
    reasons: List[str]
    needs_manual_review: bool


@app.get("/")
@limiter.limit("100/minute")  # General rate limiting
async def root(request: Request):
    return {"status": "online", "service": "JobShaman Backend"}


@app.get("/scrape")
@limiter.limit("5/minute")  # Very strict rate limiting for scraping
async def trigger_scrape(request: Request):
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
@limiter.limit("20/minute")  # Rate limiting for job actions
async def perform_job_action(job_id: str, action: str, token: str, request: Request):
    try:
        # Verify token (valid for 48 hours) and check if user is admin
        email = serializer.loads(token, salt="job-action", max_age=172800)

        # Check if user has admin role in database
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not available")

        admin_check = (
            supabase.table("profiles").select("role").eq("email", email).execute()
        )
        if not admin_check.data or admin_check.data[0].get("role") != "admin":
            raise HTTPException(
                status_code=403, detail="Unauthorized - admin access required"
            )

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
        # Get admin users from database
        admin_users = (
            supabase.table("profiles").select("email").eq("role", "admin").execute()
        )
        admin_emails = (
            [user["email"] for user in admin_users.data] if admin_users.data else []
        )

        # If no admins in database, use fallback email from environment
        if not admin_emails:
            admin_emails = [os.getenv("ADMIN_EMAIL", "admin@jobshaman.cz")]

        # Create tokens for each admin
        admin_email = admin_emails[0]  # Use first admin for the token
        token = serializer.dumps(admin_email, salt="job-action")
        approve_url = f"{API_BASE_URL}/job-action/{job.id}/approve?token={token}"
        reject_url = f"{API_BASE_URL}/job-action/{job.id}/reject?token={token}"

        r = resend.Emails.send(
            {
                "from": "JobShaman <noreply@jobshaman.cz>",
                "to": admin_emails,
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
            "basic": {
                "features": ["COVER_LETTER", "CV_OPTIMIZATION", "AI_JOB_ANALYSIS"],
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
            "basic": "price_1StDJuG2Aezsy59eqi584FWl",  # Was premium
            "business": "price_1StDKmG2Aezsy59e1eiG9bny",
            "assessment_bundle": "price_1StDTGG2Aezsy59esZLgocHw",
        }

        price_id = prices.get(req.tier)
        if not price_id:
            raise HTTPException(status_code=400, detail="Invalid tier")

        # 'basic' and 'business' are subscriptions, 'assessment_bundle' is also a subscription
        mode = (
            "subscription"
            if req.tier in ["basic", "business", "assessment_bundle"]
            else "payment"
        )

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
            "basic": 99000,  # 990 CZK in cents
            "business": 499000,  # 4 990 CZK in cents
            "assessment_bundle": 99000,  # 990 CZK in cents
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
            if tier == "basic":
                # Update Candidate Profile
                supabase.table("profiles").update({"subscription_tier": "basic"}).eq(
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
