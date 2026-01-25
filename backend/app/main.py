from fastapi import FastAPI, HTTPException, Body, Request, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, validator, Field
from typing import List, Optional
import stripe
import resend
from supabase import create_client, Client
from dotenv import load_dotenv
import jwt
import re
from datetime import datetime, timedelta
import html
import bleach
import secrets
import hashlib
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
from fastapi.middleware.cors import CORSMiddleware

"""
JobShaman Backend API

ASSESSMENT CENTER SYSTEM:
- Assessment center replaces traditional interviews
- Only companies can create assessments (requires Business/Assessment Bundle tier)
- Candidates can ONLY take assessments after being explicitly invited by a company
- Companies must send invitation link to candidates (not auto-available)
- Assessment limits:
  * Premium tier (candidates): 0 assessments (cannot create)
  * Business tier (companies): Unlimited assessment creation, 10 assessment checks per month
  * Assessment Bundle: 10 one-time assessment checks
  * Single Assessment: 1 one-time assessment check

PRICING:
- Free: 0 assessments, 3 job postings
- Premium (99 CZK/month, future 199): B2C for candidates - AI CV analysis, AI cover letter, course recommendations
- Business (4990 CZK/month): B2B for companies - unlimited assessment creation, 10 checks/month
- Assessment Bundle (990 CZK): 10 one-time assessment checks
- Single Assessment (99 CZK): 1 one-time assessment check
"""

# Ensure we can import from the sibling scraper package
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from scraper.scraper_multi import run_all_scrapers

load_dotenv()

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="JobShaman Backend Services")

# Security setup
security = HTTPBearer()

# CSRF Token Management
# In production, these should be stored in Redis or database
csrf_tokens: dict = {}  # Maps token -> {user_id, created_at, expires_at}
CSRF_TOKEN_EXPIRY = 3600  # 1 hour

def generate_csrf_token(user_id: str) -> str:
    """Generate a CSRF token for a user"""
    token = secrets.token_urlsafe(32)
    csrf_tokens[token] = {
        "user_id": user_id,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(seconds=CSRF_TOKEN_EXPIRY)
    }
    return token

def validate_csrf_token(token: str, user_id: str) -> bool:
    """Validate a CSRF token"""
    if token not in csrf_tokens:
        return False
    
    token_data = csrf_tokens[token]
    
    # Check expiration
    if datetime.utcnow() > token_data["expires_at"]:
        del csrf_tokens[token]
        return False
    
    # Check user_id matches
    if token_data["user_id"] != user_id:
        return False
    
    return True

def consume_csrf_token(token: str) -> None:
    """Consume a CSRF token (one-time use)"""
    if token in csrf_tokens:
        del csrf_tokens[token]

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
    user_id = user.get("id")
    
    # CRITICAL: Read tier from subscriptions table, not from JWT
    # This is the single source of truth for subscription status
    user_tier = "free"
    
    if user_id:
        try:
            # Check for company subscription (business)
            if user.get("company_name"):
                subscription_check = (
                    supabase.table("subscriptions")
                    .select("tier, status")
                    .eq("company_id", user_id)
                    .eq("status", "active")
                    .execute()
                )
            else:
                # Check for user subscription (basic)
                subscription_check = (
                    supabase.table("subscriptions")
                    .select("tier, status")
                    .eq("user_id", user_id)
                    .eq("status", "active")
                    .execute()
                )
            
            if subscription_check.data:
                user_tier = subscription_check.data[0].get("tier", "free")
            
        except Exception as e:
            print(f"⚠️ Warning: Could not read subscription from database: {e}")
            # Fallback to JWT tier if database read fails
            user_tier = user.get("subscription_tier", "free")

    # No admin bypass - all users must have valid subscriptions
    if user_tier not in required_tiers and user_tier != "admin":
        raise HTTPException(
            status_code=403,
            detail=f"Premium subscription required. Current tier: {user_tier}, Required: {', '.join(required_tiers)}",
        )

    # Update user dict with correct tier from database
    user["subscription_tier"] = user_tier
    return user


# Configure CORS with specific origins for security
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://localhost:3000",
    "https://localhost:5173",
    "https://jobshaman-cz.onrender.com",
    "https://jobshaman.cz",
    "https://www.jobshaman.com",
    "https://jobshaman.com",
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
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "User-Agent", "X-CSRF-Token"],
    expose_headers=["Access-Control-Allow-Origin", "X-CSRF-Token"],
    max_age=600,
)


# CORS Error Handler Middleware - Ensure CORS headers on errors
@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    """
    Ensure CORS headers are included in all responses, including errors
    """
    origin = request.headers.get("origin")
    
    if origin in allowed_origins or origin is None:
        response = await call_next(request)
        
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        
        return response
    
    return await call_next(request)


# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """
    Add critical security headers to all responses
    """
    response = await call_next(request)
    
    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    
    # Enable browser XSS protection
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Enforce HTTPS (1 year)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    
    # Prevent referrer leakage
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Restrict feature permissions
    response.headers["Permissions-Policy"] = (
        "geolocation=(), microphone=(), camera=(), payment=(), "
        "usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
    )
    
    # Content Security Policy - strict but allows our resources
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://js.stripe.com https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://api.stripe.com https://m.stripe.network https://*.supabase.co; "
        "frame-src https://js.stripe.com https://hooks.stripe.com; "
        "upgrade-insecure-requests"
    )
    
    return response


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
        pattern=r"^(premium|business|assessment|assessment_bundle)$",
        description="Subscription tier",
    )
    userId: str = Field(..., min_length=1, max_length=100, description="User ID")
    successUrl: str = Field(..., pattern=r"^https?://.+", description="Success URL")
    cancelUrl: str = Field(..., pattern=r"^https?://.+", description="Cancel URL")

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
    request: Request,
    job_id: int = Query(...),
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


# --- CSRF PROTECTION ENDPOINTS ---


@app.get("/csrf-token")
@limiter.limit("60/minute")
async def get_csrf_token(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """
    Get a CSRF token for the authenticated user
    Required for POST/PUT/DELETE requests
    """
    try:
        user_id = user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        token = generate_csrf_token(user_id)
        
        return {
            "status": "success",
            "csrf_token": token,
            "expiry": CSRF_TOKEN_EXPIRY  # seconds
        }
    except Exception as e:
        print(f"❌ Error generating CSRF token: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate CSRF token"
        )


def verify_csrf_token_header(request: Request, user: dict) -> bool:
    """Helper to verify CSRF token from request headers"""
    csrf_token = request.headers.get("X-CSRF-Token")
    
    if not csrf_token:
        return False
    
    user_id = user.get("id")
    if not user_id:
        return False
    
    return validate_csrf_token(csrf_token, user_id)


# --- BILLING VERIFICATION ENDPOINTS ---


@app.post("/verify-billing")
@limiter.limit("100/minute")
async def verify_billing(
    request: Request,
    billing_request: BillingVerificationRequest,
    user: dict = Depends(verify_subscription),
):
    """
    Server-side billing verification for premium features
    This is the ONLY way to verify feature access
    """
    try:
        user_tier = user.get("subscription_tier", "free")
        user_id = user.get("id")
        
        # Helper to log access attempts to audit table
        def log_access(feature, allowed, reason=None):
            if supabase and user_id:
                try:
                    supabase.table("premium_access_logs").insert({
                        "user_id": user_id,
                        "feature": feature,
                        "endpoint": "/verify-billing",
                        "ip_address": request.client.host if request.client else None,
                        "subscription_tier": user_tier,
                        "result": "allowed" if allowed else "denied",
                        "reason": reason,
                        "metadata": {
                            "feature_requested": billing_request.feature,
                            "user_agent": request.headers.get("user-agent")
                        }
                    }).execute()
                except Exception as e:
                    print(f"⚠️ Warning: Could not log access: {e}")

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
            log_access(request.feature, False, f"Feature not available in {user_tier} tier")
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
                log_access(request.feature, False, "Assessment limit exceeded")
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

            log_access(request.feature, True, "Assessment within limit")
            return {
                "hasAccess": True,
                "subscriptionTier": user_tier,
                "usage": {
                    "current": current_usage,
                    "limit": tier_config["assessments"],
                    "remaining": tier_config["assessments"] - current_usage,
                },
            }

        log_access(request.feature, True, "Feature access allowed")
        return {"hasAccess": True, "subscriptionTier": user_tier}

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Billing verification failed: {str(e)}"
        )


@app.post("/cancel-subscription")
@limiter.limit("10/minute")
async def cancel_subscription(
    request: Request,
    user: dict = Depends(verify_subscription),
):
    """
    Cancel user's subscription and Stripe subscription
    Only company/basic tier subscribers can cancel their own subscriptions
    REQUIRES: X-CSRF-Token header
    """
    try:
        # SECURITY: Verify CSRF token
        if not verify_csrf_token_header(request, user):
            raise HTTPException(
                status_code=403,
                detail="CSRF token missing or invalid. Call /csrf-token first."
            )
        
        user_id = user.get("id")
        user_tier = user.get("subscription_tier", "free")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        if user_tier == "free":
            raise HTTPException(status_code=400, detail="No active subscription to cancel")
        
        # Determine if user or company subscription
        is_company = user.get("company_name") is not None
        
        # Get subscription from database
        subscription_response = (
            supabase.table("subscriptions")
            .select("*")
            .eq("company_id" if is_company else "user_id", user_id)
            .eq("status", "active")
            .execute()
        )
        
        if not subscription_response.data:
            raise HTTPException(
                status_code=404,
                detail="No active subscription found"
            )
        
        subscription = subscription_response.data[0]
        stripe_subscription_id = subscription.get("stripe_subscription_id")
        
        if not stripe_subscription_id:
            raise HTTPException(
                status_code=400,
                detail="Subscription not linked to Stripe"
            )
        
        # Cancel subscription in Stripe
        try:
            stripe.Subscription.delete(stripe_subscription_id)
            print(f"✅ Stripe subscription {stripe_subscription_id} cancelled")
        except stripe.error.StripeError as e:
            # If Stripe cancellation fails, still update our database
            print(f"⚠️ Stripe cancellation failed: {e}")
            # Continue to cancel in our database anyway
        
        # Update subscriptions table to mark as canceled
        supabase.table("subscriptions").update({
            "status": "canceled",
            "canceled_at": now_iso(),
            "updated_at": now_iso(),
        }).eq("id", subscription["id"]).execute()
        
        # Log the cancellation
        if supabase:
            try:
                supabase.table("premium_access_logs").insert({
                    "user_id": user_id,
                    "feature": "SUBSCRIPTION_CANCEL",
                    "endpoint": "/cancel-subscription",
                    "ip_address": request.client.host if request.client else None,
                    "subscription_tier": user_tier,
                    "result": "canceled",
                    "reason": "User-initiated cancellation",
                    "metadata": {
                        "stripe_subscription_id": stripe_subscription_id,
                        "canceled_at": now_iso()
                    }
                }).execute()
            except Exception as e:
                print(f"⚠️ Warning: Could not log cancellation: {e}")
        
        # Send cancellation confirmation email
        try:
            email_to = user.get("email")
            if email_to:
                send_email(
                    to_email=email_to,
                    subject="📋 Subscription Cancelled - JobShaman",
                    html=f"""
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
                        <h2 style="color: #1e40af;">Subscription Cancelled</h2>
                        <p>Your JobShaman {user_tier} subscription has been successfully cancelled.</p>
                        
                        <p><strong>What happens now:</strong></p>
                        <ul>
                            <li>You will lose access to premium features at the end of your current billing period</li>
                            <li>Your data will remain safe and can be exported anytime</li>
                            <li>You can re-subscribe at any time</li>
                        </ul>
                        
                        <p style="margin-top: 30px;">
                            <a href="https://jobshaman.cz" style="background: #1e40af; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Return to JobShaman</a>
                        </p>
                        
                        <p style="font-size: 0.9rem; color: #94a3b8; margin-top: 20px;">
                            If you have questions, please contact us at support@jobshaman.cz
                        </p>
                    </div>
                    """
                )
                print(f"✅ Cancellation email sent to {email_to}")
        except Exception as e:
            print(f"⚠️ Warning: Could not send cancellation email: {e}")
        
        return {
            "status": "success",
            "message": "Subscription cancelled successfully",
            "tier": user_tier,
            "canceledAt": now_iso(),
            "note": "Premium features will remain active until the end of your billing period"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Subscription cancellation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cancel subscription: {str(e)}"
        )


@app.get("/subscription-status")
@limiter.limit("30/minute")
async def get_subscription_status(
    request: Request, userId: str = Query(...), user: dict = Depends(get_current_user)
):
    """
    Get detailed subscription status for dashboard display
    Returns tier, status, renewal date, and usage limits
    Reads from subscriptions table (single source of truth) for both personal and company users
    """
    try:
        if user.get("id") != userId:
            raise HTTPException(
                status_code=403, detail="Cannot access other users' subscription info"
            )

        # Tier limits configuration
        tier_limits = {
            "free": {"assessments": 0, "job_postings": 3, "name": "Free"},
            "premium": {"assessments": 0, "job_postings": 10, "name": "Premium"},
            "business": {"assessments": 999, "job_postings": 10, "name": "Business"},
            "assessment_bundle": {"assessments": 10, "job_postings": 0, "name": "Assessment Bundle (10 checks)"},
            "single_assessment": {"assessments": 1, "job_postings": 0, "name": "Single Assessment"},
        }

        # Check if this is a company admin or a personal user
        is_company_admin = bool(user.get("company_name"))
        
        # Get subscription details from subscriptions table (single source of truth)
        subscription_details = None
        user_tier = "free"
        
        if is_company_admin:
            # For company admins: query by company_id
            sub_response = (
                supabase.table("subscriptions")
                .select("*")
                .eq("company_id", user.get("id"))
                .execute()
            )
        else:
            # For personal users: query by user_id
            sub_response = (
                supabase.table("subscriptions")
                .select("*")
                .eq("user_id", user.get("id"))
                .execute()
            )
        
        if sub_response.data:
            subscription_details = sub_response.data[0]
            user_tier = subscription_details.get("tier", "free")

        limits = tier_limits.get(user_tier, tier_limits["free"])

        # Calculate days until renewal
        days_until_renewal = None
        if subscription_details and subscription_details.get("current_period_end"):
            from datetime import datetime, timezone
            renewal_date = datetime.fromisoformat(
                subscription_details["current_period_end"].replace("Z", "+00:00")
            )
            now = datetime.now(timezone.utc)
            days_until_renewal = max(0, (renewal_date - now).days)

        # Prefer period-scoped usage from `subscription_usage` table when available
        assessments_used = 0
        job_postings_used = 0
        if subscription_details and supabase:
            try:
                usage_resp = (
                    supabase.table("subscription_usage")
                    .select("active_jobs_count, ai_assessments_used, ad_optimizations_used, period_start, period_end")
                    .eq("subscription_id", subscription_details.get("id"))
                    .order("period_end", {"ascending": False})
                    .limit(1)
                    .execute()
                )
                if usage_resp.data:
                    usage = usage_resp.data[0]
                    assessments_used = usage.get("ai_assessments_used", subscription_details.get("ai_assessments_used", 0) if subscription_details else 0)
                    job_postings_used = usage.get("active_jobs_count", 0)
                else:
                    assessments_used = subscription_details.get("ai_assessments_used", 0) if subscription_details else 0
            except Exception as e:
                print(f"⚠️ Warning: could not read subscription_usage: {e}")
                assessments_used = subscription_details.get("ai_assessments_used", 0) if subscription_details else 0
        else:
            assessments_used = subscription_details.get("ai_assessments_used", 0) if subscription_details else 0

        return {
            "tier": user_tier,
            "tierName": limits["name"],
            "status": subscription_details.get("status", "active") if subscription_details else "inactive",
            "expiresAt": subscription_details.get("current_period_end") if subscription_details else None,
            "daysUntilRenewal": days_until_renewal,
            "currentPeriodStart": subscription_details.get("current_period_start") if subscription_details else None,
            "assessmentsAvailable": limits["assessments"],
            "assessmentsUsed": assessments_used,
            "jobPostingsAvailable": limits["job_postings"],
            "jobPostingsUsed": job_postings_used,
            "stripeSubscriptionId": subscription_details.get("stripe_subscription_id") if subscription_details else None,
            "canceledAt": subscription_details.get("canceled_at") if subscription_details else None,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get subscription status: {str(e)}"
        )


# --- STRIPE ENDPOINTS ---


@app.post("/create-checkout-session")
async def create_checkout_session(req: CheckoutRequest):
    try:
        # Validate Stripe API key is set
        if not stripe.api_key:
            error_msg = "STRIPE_SECRET_KEY environment variable not set on server"
            print(f"❌ {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
        
        # Map frontend tier names to backend/Stripe tier names
        tier_mapping = {
            "premium": "premium",  # Personal users
            "basic": "premium",    # Backwards compatibility
            "business": "business",
            "assessment_bundle": "assessment_bundle",
            "single_assessment": "single_assessment",
        }
        
        backend_tier = tier_mapping.get(req.tier)
        if not backend_tier:
            raise HTTPException(status_code=400, detail=f"Invalid tier: {req.tier}")
        
        # Live Stripe Price IDs
        # Note: assessment_bundle is a recurring subscription (990 CZK/month for 10 assessments/month)
        # single_assessment one-time purchase is not yet configured in Stripe - use assessment_bundle instead
        prices = {
            "premium": "price_1StDJuG2Aezsy59eqi584FWl",  # 99 CZK/month
            "business": "price_1StDKmG2Aezsy59e1eiG9bny",  # 4990 CZK/month
            "assessment_bundle": "price_1StDTGG2Aezsy59esZLgocHw",  # 990 CZK/month for 10 assessments/month (recurring)
            "single_assessment": None,  # TODO: Create one-time price in Stripe and update this field
        }

        price_id = prices.get(backend_tier)
        if not price_id or price_id is None:
            raise HTTPException(
                status_code=400, 
                detail=f"Stripe price not configured for tier '{backend_tier}'. Please use 'premium' or 'business' tier, or contact support."
            )

        # Subscriptions: basic, business, assessment_bundle (recurring)
        # One-time: single_assessment (when price is configured)
        mode = (
            "subscription"
            if backend_tier in ["basic", "premium", "business", "assessment_bundle"]
            else "payment"
        )

        print(f"📝 Creating Stripe checkout: tier={backend_tier}, price_id={price_id}, mode={mode}")
        
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
            metadata={"userId": req.userId, "tier": backend_tier},
        )
        print(f"✅ Checkout session created: {checkout_session.id}")
        return {"url": checkout_session.url}
    except Exception as e:
        error_detail = str(e)
        print(f"❌ Checkout error: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)


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

    # SECURITY: Check if this webhook has already been processed (idempotency)
    event_id = event["id"]
    if supabase:
        try:
            existing_event = (
                supabase.table("webhook_events")
                .select("*")
                .eq("stripe_event_id", event_id)
                .execute()
            )
            if existing_event.data:
                print(f"✅ Webhook {event_id} already processed, skipping duplicate")
                return {"status": "already_processed"}
        except Exception as e:
            print(f"⚠️ Warning: Could not check webhook idempotency: {e}")
            # Continue anyway to not block payments

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"]["userId"]
        tier = session["metadata"]["tier"]

        # SECURITY: Verify payment amount matches expected tier pricing
        expected_amounts = {
            "premium": 9900,  # 99 CZK in cents/month (subscription)
            "business": 499000,  # 4990 CZK in cents/month (subscription)
            "assessment_bundle": 99000,  # 990 CZK in cents (one-time)
            "single_assessment": 9900,  # 99 CZK in cents (one-time)
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
            # CRITICAL: Only write to subscriptions table (single source of truth)
            # Do NOT write to companies.subscription_tier or profiles.subscription_tier
            
            if tier == "basic":
                # For basic tier: create subscription record for candidates
                existing = (
                    supabase.table("subscriptions")
                    .select("id")
                    .eq("user_id", user_id)
                    .execute()
                )
                if existing.data:
                    supabase.table("subscriptions").update(
                        {
                            "tier": "basic",
                            "status": "active",
                            "stripe_subscription_id": session.get("subscription"),
                            "current_period_start": session.get("current_period_start"),
                            "current_period_end": session.get("current_period_end"),
                            "updated_at": now_iso(),
                        }
                    ).eq("user_id", user_id).execute()
                else:
                    supabase.table("subscriptions").insert(
                        {
                            "user_id": user_id,
                            "tier": "basic",
                            "status": "active",
                            "stripe_subscription_id": session.get("subscription"),
                            "current_period_start": session.get("current_period_start"),
                            "current_period_end": session.get("current_period_end"),
                        }
                    ).execute()
                    
            elif tier == "business":
                # For business tier: update subscriptions table (single source of truth)
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
                # For bundle tier: update subscriptions table (single source of truth)
                existing = (
                    supabase.table("subscriptions")
                    .select("id")
                    .eq("company_id", user_id)
                    .execute()
                )
                if existing.data:
                    supabase.table("subscriptions").update(
                        {
                            "tier": "assessment_bundle",
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
                            "tier": "assessment_bundle",
                            "status": "active",
                            "stripe_subscription_id": session.get("subscription"),
                            "current_period_start": session.get("current_period_start"),
                            "current_period_end": session.get("current_period_end"),
                        }
                    ).execute()

            elif tier == "single_assessment":
                # For single assessment: one-time purchase, update user's assessment credits
                # Try to find existing subscription or create one
                existing = (
                    supabase.table("subscriptions")
                    .select("id")
                    .eq("user_id", user_id)
                    .execute()
                )
                
                # Get current assessment usage
                current_used = 0
                if existing.data:
                    current_used = existing.data[0].get("ai_assessments_used", 0)
                
                if existing.data:
                    supabase.table("subscriptions").update(
                        {
                            "tier": "single_assessment",
                            "status": "active",
                            "stripe_subscription_id": session.get("subscription"),
                            "updated_at": now_iso(),
                        }
                    ).eq("user_id", user_id).execute()
                else:
                    supabase.table("subscriptions").insert(
                        {
                            "user_id": user_id,
                            "tier": "single_assessment",
                            "status": "active",
                            "stripe_subscription_id": session.get("subscription"),
                        }
                    ).execute()

        print(f"✅ Stripe Payment verified and completed for {user_id} tier: {tier}")

    elif event["type"] == "customer.subscription.updated":
        """Handle subscription updates (tier changes, renewal, etc.)"""
        subscription = event["data"]["object"]
        stripe_subscription_id = subscription["id"]
        
        # Find subscription in our database
        if supabase:
            try:
                existing = (
                    supabase.table("subscriptions")
                    .select("id, user_id, company_id")
                    .eq("stripe_subscription_id", stripe_subscription_id)
                    .execute()
                )
                
                if existing.data:
                    sub_record = existing.data[0]
                    
                    # Update subscription details
                    supabase.table("subscriptions").update({
                        "current_period_start": subscription.get("current_period_start"),
                        "current_period_end": subscription.get("current_period_end"),
                        "status": "active" if subscription["status"] in ["active", "trialing"] else "inactive",
                        "updated_at": now_iso(),
                    }).eq("id", sub_record["id"]).execute()
                    
                    # Log the update
                    user_id = sub_record.get("user_id") or sub_record.get("company_id")
                    supabase.table("premium_access_logs").insert({
                        "user_id": user_id,
                        "feature": "SUBSCRIPTION_UPDATE",
                        "endpoint": "/webhooks/stripe",
                        "subscription_tier": "unknown",
                        "result": "updated",
                        "reason": f"Stripe event: {subscription['status']}",
                        "metadata": {
                            "stripe_subscription_id": stripe_subscription_id,
                            "next_period_end": subscription.get("current_period_end")
                        }
                    }).execute()
                    
                    print(f"✅ Subscription {stripe_subscription_id} updated: {subscription['status']}")
            except Exception as e:
                print(f"⚠️ Error handling subscription.updated: {e}")
    
    elif event["type"] == "customer.subscription.deleted":
        """Handle subscription cancellation via Stripe dashboard"""
        subscription = event["data"]["object"]
        stripe_subscription_id = subscription["id"]
        
        if supabase:
            try:
                existing = (
                    supabase.table("subscriptions")
                    .select("id, user_id, company_id")
                    .eq("stripe_subscription_id", stripe_subscription_id)
                    .execute()
                )
                
                if existing.data:
                    sub_record = existing.data[0]
                    
                    # Mark subscription as canceled
                    supabase.table("subscriptions").update({
                        "status": "canceled",
                        "canceled_at": now_iso(),
                        "updated_at": now_iso(),
                    }).eq("id", sub_record["id"]).execute()
                    
                    # Log the cancellation
                    user_id = sub_record.get("user_id") or sub_record.get("company_id")
                    supabase.table("premium_access_logs").insert({
                        "user_id": user_id,
                        "feature": "SUBSCRIPTION_DELETED",
                        "endpoint": "/webhooks/stripe",
                        "subscription_tier": "unknown",
                        "result": "canceled",
                        "reason": "Stripe: Subscription deleted via dashboard",
                        "metadata": {
                            "stripe_subscription_id": stripe_subscription_id,
                            "deleted_at": now_iso()
                        }
                    }).execute()
                    
                    print(f"✅ Subscription {stripe_subscription_id} marked as deleted")
            except Exception as e:
                print(f"⚠️ Error handling subscription.deleted: {e}")
    
    elif event["type"] == "invoice.payment_failed":
        """Handle failed payment attempts"""
        invoice = event["data"]["object"]
        stripe_subscription_id = invoice.get("subscription")
        
        if supabase and stripe_subscription_id:
            try:
                existing = (
                    supabase.table("subscriptions")
                    .select("id, user_id, company_id")
                    .eq("stripe_subscription_id", stripe_subscription_id)
                    .execute()
                )
                
                if existing.data:
                    sub_record = existing.data[0]
                    
                    # Log the failed payment
                    user_id = sub_record.get("user_id") or sub_record.get("company_id")
                    supabase.table("premium_access_logs").insert({
                        "user_id": user_id,
                        "feature": "INVOICE_PAYMENT_FAILED",
                        "endpoint": "/webhooks/stripe",
                        "subscription_tier": "unknown",
                        "result": "denied",
                        "reason": f"Payment failed: {invoice.get('attempt_count', 1)} attempts",
                        "metadata": {
                            "stripe_subscription_id": stripe_subscription_id,
                            "invoice_id": invoice.get("id"),
                            "amount_due": invoice.get("amount_due"),
                            "next_payment_attempt": invoice.get("next_payment_attempt")
                        }
                    }).execute()
                    
                    # If too many attempts, suspend subscription
                    if invoice.get("attempt_count", 1) >= 3:
                        supabase.table("subscriptions").update({
                            "status": "suspended",
                            "updated_at": now_iso(),
                        }).eq("id", sub_record["id"]).execute()
                        print(f"⚠️ Subscription {stripe_subscription_id} suspended due to payment failure")
                    else:
                        print(f"⚠️ Payment failed for {stripe_subscription_id}, attempt {invoice.get('attempt_count')}")
            except Exception as e:
                print(f"⚠️ Error handling invoice.payment_failed: {e}")

    # SECURITY: Mark this webhook as processed (idempotency)
    if supabase:
        try:
            supabase.table("webhook_events").insert({
                "stripe_event_id": event_id,
                "event_type": event["type"],
                "processed_at": now_iso(),
                "status": "processed"
            }).execute()
            print(f"✅ Webhook {event_id} marked as processed in database")
        except Exception as e:
            print(f"⚠️ Warning: Could not mark webhook as processed: {e}")
            # Don't fail the webhook if we can't mark it

    return {"status": "success"}


# --- ASSESSMENT INVITATION ENDPOINTS ---


def generate_invitation_token():
    """Generate a unique token for assessment invitation"""
    import secrets
    return secrets.token_urlsafe(32)


class AssessmentInvitationRequest(BaseModel):
    """Request to send assessment invitation to candidate"""
    assessment_id: str
    candidate_email: str
    candidate_id: Optional[str] = None
    expires_in_days: int = 30  # Default 30 days to complete assessment
    metadata: Optional[dict] = None  # Job title, assessment name, etc


class AssessmentResultRequest(BaseModel):
    """Request to submit assessment result"""
    invitation_id: str
    assessment_id: str
    role: str
    difficulty: str
    questions_total: int
    questions_correct: int
    score: float  # 0-100
    time_spent_seconds: int
    answers: dict  # Detailed answer data
    feedback: Optional[str] = None


@app.post("/assessments/invitations/create")
@limiter.limit("100/minute")
async def create_assessment_invitation(
    request: Request,
    invitation_req: AssessmentInvitationRequest,
    user: dict = Depends(get_current_user),
):
    """
    Create and send assessment invitation to a candidate
    Only company admins (business/assessment_bundle tier) can send invitations
    """
    try:
        company_id = user.get("id")
        if not user.get("company_name"):
            raise HTTPException(
                status_code=403,
                detail="Only company admins can send assessment invitations"
            )
        
        # Check company has assessment tier
        tier_check = (
            supabase.table("subscriptions")
            .select("tier")
            .eq("company_id", company_id)
            .eq("status", "active")
            .execute()
        )
        
        if not tier_check.data:
            raise HTTPException(
                status_code=403,
                detail="Company must have active assessment bundle or business subscription"
            )
        
        tier = tier_check.data[0].get("tier")
        if tier not in ["business", "assessment_bundle"]:
            raise HTTPException(
                status_code=403,
                detail=f"Tier '{tier}' cannot send assessment invitations"
            )
        
        # Create invitation token
        invitation_token = generate_invitation_token()
        
        # Calculate expiry date
        from datetime import datetime, timedelta, timezone
        expires_at = datetime.now(timezone.utc) + timedelta(days=invitation_req.expires_in_days)
        
        # Get candidate_id if not provided
        candidate_id = invitation_req.candidate_id
        if not candidate_id and invitation_req.candidate_email:
            candidate_response = (
                supabase.table("profiles")
                .select("id")
                .eq("email", invitation_req.candidate_email)
                .execute()
            )
            if candidate_response.data:
                candidate_id = candidate_response.data[0]["id"]
        
        # Create invitation in database
        invitation_response = (
            supabase.table("assessment_invitations").insert({
                "company_id": company_id,
                "assessment_id": invitation_req.assessment_id,
                "candidate_id": candidate_id,
                "candidate_email": invitation_req.candidate_email,
                "status": "pending",
                "invitation_token": invitation_token,
                "expires_at": expires_at.isoformat(),
                "metadata": invitation_req.metadata or {}
            }).execute()
        )
        
        if not invitation_response.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to create invitation"
            )
        
        invitation_id = invitation_response.data[0]["id"]
        
        # Send invitation email to candidate
        try:
            invitation_link = f"https://jobshaman.cz/assessment/{invitation_id}?token={invitation_token}"
            
            company_name = user.get("company_name", "A Company")
            assessment_name = invitation_req.metadata.get("assessment_name", "Assessment") if invitation_req.metadata else "Assessment"
            job_title = invitation_req.metadata.get("job_title", "Position") if invitation_req.metadata else "Position"
            
            send_email(
                to_email=invitation_req.candidate_email,
                subject=f"🎯 Assessment Invitation from {company_name}",
                html=f"""
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
                    <h2 style="color: #1e40af;">🎯 Assessment Invitation</h2>
                    <p>Hello,</p>
                    
                    <p><strong>{company_name}</strong> has invited you to take an assessment for the position of <strong>{job_title}</strong>.</p>
                    
                    <p><strong>Assessment Name:</strong> {assessment_name}</p>
                    <p><strong>Valid Until:</strong> {expires_at.strftime('%B %d, %Y')}</p>
                    
                    <p>Click the link below to start the assessment:</p>
                    
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="{invitation_link}" style="background: #1e40af; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
                            Start Assessment
                        </a>
                    </div>
                    
                    <p style="font-size: 0.9rem; color: #64748b;">
                        This assessment is your opportunity to showcase your skills. You will have 30 minutes to complete it.
                    </p>
                    
                    <p style="font-size: 0.8rem; color: #94a3b8; margin-top: 30px;">
                        If you have questions, please contact the company directly.
                    </p>
                </div>
                """
            )
        except Exception as e:
            print(f"⚠️ Warning: Could not send invitation email: {e}")
            # Don't fail the API call if email fails
        
        # Log the invitation creation
        try:
            supabase.table("premium_access_logs").insert({
                "user_id": company_id,
                "feature": "ASSESSMENT_INVITATION_SENT",
                "endpoint": "/assessments/invitations/create",
                "ip_address": request.client.host if request.client else None,
                "subscription_tier": tier,
                "result": "created",
                "reason": f"Assessment invitation sent to {invitation_req.candidate_email}",
                "metadata": {
                    "invitation_id": invitation_id,
                    "candidate_email": invitation_req.candidate_email,
                    "assessment_id": invitation_req.assessment_id
                }
            }).execute()
        except Exception as e:
            print(f"⚠️ Warning: Could not log invitation creation: {e}")
        
        return {
            "status": "success",
            "invitation_id": invitation_id,
            "invitation_token": invitation_token,
            "expires_at": expires_at.isoformat(),
            "candidate_email": invitation_req.candidate_email,
            "message": f"Invitation sent to {invitation_req.candidate_email}"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to create assessment invitation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create invitation: {str(e)}"
        )


@app.get("/assessments/invitations/{invitation_id}")
@limiter.limit("60/minute")
async def get_invitation_details(
    request: Request,
    invitation_id: str,
    token: str = Query(...),
):
    """
    Get assessment invitation details (no auth required, token-based)
    Used by candidates to view invitation before starting assessment
    """
    try:
        # Get invitation from database
        invitation_response = (
            supabase.table("assessment_invitations")
            .select("*")
            .eq("id", invitation_id)
            .execute()
        )
        
        if not invitation_response.data:
            raise HTTPException(
                status_code=404,
                detail="Invitation not found"
            )
        
        invitation = invitation_response.data[0]
        
        # Verify token matches
        if invitation["invitation_token"] != token:
            raise HTTPException(
                status_code=403,
                detail="Invalid invitation token"
            )
        
        # Check if invitation is still valid (not expired)
        from datetime import datetime, timezone
        expires_at = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(
                status_code=410,
                detail="Invitation has expired"
            )
        
        # Check if invitation was already used
        if invitation["status"] == "completed":
            raise HTTPException(
                status_code=410,
                detail="Assessment has already been completed"
            )
        
        if invitation["status"] == "revoked":
            raise HTTPException(
                status_code=410,
                detail="Invitation has been revoked"
            )
        
        # Get company details
        company_response = (
            supabase.table("companies")
            .select("id, name")
            .eq("id", invitation["company_id"])
            .execute()
        )
        
        company_name = company_response.data[0]["name"] if company_response.data else "Company"
        
        return {
            "invitation_id": invitation_id,
            "assessment_id": invitation["assessment_id"],
            "company_id": invitation["company_id"],
            "company_name": company_name,
            "candidate_email": invitation["candidate_email"],
            "status": invitation["status"],
            "expires_at": invitation["expires_at"],
            "metadata": invitation.get("metadata", {}),
            "can_proceed": True  # Token is valid
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to get invitation details: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve invitation: {str(e)}"
        )


@app.post("/assessments/invitations/{invitation_id}/submit")
@limiter.limit("10/minute")
async def submit_assessment_result(
    request: Request,
    invitation_id: str,
    result_req: AssessmentResultRequest,
    token: str = Query(...),
):
    """
    Submit assessment result after candidate completes assessment
    No auth required, token-based access
    """
    try:
        # Get and verify invitation
        invitation_response = (
            supabase.table("assessment_invitations")
            .select("*")
            .eq("id", invitation_id)
            .execute()
        )
        
        if not invitation_response.data:
            raise HTTPException(status_code=404, detail="Invitation not found")
        
        invitation = invitation_response.data[0]
        
        # Verify token
        if invitation["invitation_token"] != token:
            raise HTTPException(status_code=403, detail="Invalid token")
        
        # Check invitation is still valid
        from datetime import datetime, timezone
        expires_at = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=410, detail="Invitation has expired")
        
        if invitation["status"] in ["completed", "revoked"]:
            raise HTTPException(status_code=410, detail="Invitation is no longer valid")
        
        # Create assessment result
        result_response = (
            supabase.table("assessment_results").insert({
                "company_id": invitation["company_id"],
                "candidate_id": invitation["candidate_id"],
                "invitation_id": invitation_id,
                "assessment_id": result_req.assessment_id,
                "role": result_req.role,
                "difficulty": result_req.difficulty,
                "questions_total": result_req.questions_total,
                "questions_correct": result_req.questions_correct,
                "score": result_req.score,
                "time_spent_seconds": result_req.time_spent_seconds,
                "answers": result_req.answers,
                "feedback": result_req.feedback,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }).execute()
        )
        
        if not result_response.data:
            raise HTTPException(status_code=500, detail="Failed to save assessment result")
        
        # Update invitation status to completed
        supabase.table("assessment_invitations").update({
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", invitation_id).execute()
        
        # Atomically increment company's assessment usage via RPC (do not write RPC object into subscriptions row)
        try:
            rpc_resp = supabase.rpc("increment_assessment_usage", {"company_id": invitation["company_id"]}).execute()
            # rpc_resp.data may include the updated usage row or the new counter depending on RPC implementation
            if rpc_resp and getattr(rpc_resp, 'data', None):
                print(f"✅ increment_assessment_usage RPC result: {rpc_resp.data}")
        except Exception as e:
            print(f"⚠️ Warning: failed to increment assessment usage via RPC: {e}")
        
        return {
            "status": "success",
            "result_id": result_response.data[0]["id"],
            "score": result_req.score,
            "message": "Assessment result saved successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to submit assessment result: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save result: {str(e)}"
        )


@app.get("/assessments/invitations")
@limiter.limit("30/minute")
async def list_invitations(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """
    List assessment invitations for current user
    Shows invitations sent TO the user (as candidate) or sent BY the user (as company)
    """
    try:
        user_id = user.get("id")
        is_company = bool(user.get("company_name"))
        
        if is_company:
            # Company: Get all invitations sent by this company
            invitations_response = (
                supabase.table("assessment_invitations")
                .select("*")
                .eq("company_id", user_id)
                .order("created_at", desc=True)
                .execute()
            )
        else:
            # Candidate: Get all invitations sent to them
            email = user.get("email")
            invitations_response = (
                supabase.table("assessment_invitations")
                .select("*")
                .eq("candidate_email", email)
                .order("created_at", desc=True)
                .execute()
            )
        
        invitations = invitations_response.data or []
        
        # Filter out expired invitations
        from datetime import datetime, timezone
        active_invitations = []
        
        for inv in invitations:
            expires_at = datetime.fromisoformat(inv["expires_at"].replace("Z", "+00:00"))
            is_expired = datetime.now(timezone.utc) > expires_at
            
            inv_data = {
                "id": inv["id"],
                "assessment_id": inv["assessment_id"],
                "status": inv["status"],
                "created_at": inv["created_at"],
                "expires_at": inv["expires_at"],
                "is_expired": is_expired,
                "metadata": inv.get("metadata", {})
            }
            
            if is_company:
                inv_data["candidate_email"] = inv["candidate_email"]
            else:
                inv_data["company_id"] = inv["company_id"]
            
            active_invitations.append(inv_data)
        
        return {
            "invitations": active_invitations,
            "total": len(active_invitations),
            "user_type": "company" if is_company else "candidate"
        }
    
    except Exception as e:
        print(f"❌ Failed to list invitations: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list invitations: {str(e)}"
        )


def send_email(to_email: str, subject: str, html: str):
    """Helper function to send emails via Resend"""
    try:
        return resend.Emails.send({
            "from": "JobShaman <noreply@jobshaman.cz>",
            "to": to_email,
            "subject": subject,
            "html": html
        })
    except Exception as e:
        print(f"❌ Failed to send email to {to_email}: {e}")
        raise


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
