from fastapi import FastAPI, HTTPException, Body, Request
from pydantic import BaseModel
from typing import List, Optional
import stripe
import resend
from supabase import create_client, Client
from dotenv import load_dotenv

from itsdangerous import URLSafeTimedSerializer
from fastapi.responses import HTMLResponse
from apscheduler.schedulers.background import BackgroundScheduler
import sys
import os
# Ensure we can import from the sibling scraper package
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from scraper.scraper_multi import run_all_scrapers

load_dotenv()

app = FastAPI(title="JobShaman Backend Services")

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
        print("❌ CHYBA: SUPABASE_URL nebo SUPABASE_KEY chybí v prostředí Renderu! Nastav je v dashboardu.")
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

    needs_manual_review: bool

class CheckoutRequest(BaseModel):
    tier: str # 'premium' | 'business'
    userId: str # profile ID or company ID
    successUrl: str
    cancelUrl: str

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
        return {"status": "success", "jobs_saved": count, "message": "Scraping complete. Auto-matching will run as jobs are viewed or periodically."}
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
        supabase.table("jobs").update({
            "legality_status": status,
            "verification_notes": f"Ručně {status} uživatelem floki"
        }).eq("id", job_id).execute()
        
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
        "MLM/Pyramid": ["mlm", "letadlo", "pyramida", "provize z lidí", "síťový marketing"],
        "Crypto Fraud": ["kryptoměny", "bitcoin investice", "těžba bitcoinu", "zaručený výdělek"],
        "Work from home scams": ["práce z domova 5000", "balení propisek", "lepení obálek"],
        "Get rich quick": ["pasivní příjem", "rychle zbohatnout", "změňte svůj život", "bez zkušeností 100000"],
        "Communication red flags": ["jen přes whatsapp", "piste na telegram", "whatsapp kontakt"]
    }
    
    for category, keywords in fraud_keywords.items():
        found = [k for k in keywords if k in text]
        if found:
            # Increase risk score
            impact = 0.2 * len(found)
            risk_score += impact
            reasons.append(f"Nalezeny podezřelé výrazy ({category}): {', '.join(found)}")

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
async def check_job_legality(job: JobCheckRequest):
    try:
        # Rule-based analysis (replaces Gemini)
        risk_score, is_legal, reasons, needs_manual_review = check_legality_rules(
            job.title, job.company, job.description
        )
        
        result = JobCheckResponse(
            risk_score=risk_score,
            is_legal=is_legal,
            reasons=reasons,
            needs_manual_review=needs_manual_review
        )
        
        # If it needs manual review, send email
        if result.needs_manual_review:
            send_review_email(job, result)
            
        # Update Supabase
        if supabase:
            status = "approved" if result.is_legal and not result.needs_manual_review else "pending" if result.needs_manual_review else "rejected"
            supabase.table("jobs").update({
                "legality_status": status,
                "risk_score": result.risk_score,
                "verification_notes": ", ".join(result.reasons) or "Zkontrolováno pravidly"
            }).eq("id", job.id).execute()
            
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
    candidate_skills = set([s.lower() for s in candidate.get('skills', [])])
    job_skills = set([s.lower() for s in job.get('required_skills', [])])
    
    if job_skills:
        overlap = candidate_skills.intersection(job_skills)
        if overlap:
            skill_score = len(overlap) / len(job_skills)
            score += skill_score * 0.5  # 50% weight for skills
            reasons.append(f"Shoda v dovednostech ({len(overlap)}): {', '.join(overlap)}")
    
    # 2. Title Matching
    cand_title = (candidate.get('job_title') or "").lower()
    job_title = (job.get('title') or "").lower()
    
    if cand_title and job_title:
        # Simple keyword overlap in titles
        cand_words = set(cand_title.split())
        job_words = set(job_title.split())
        title_overlap = cand_words.intersection(job_words)
        if title_overlap:
            score += 0.3  # 30% weight for title overlap
            reasons.append(f"Podobný název pozice: {cand_title}")
            
    # 3. Keyword Overlap in Descriptions
    desc = (job.get('description') or "").lower()
    cv = (candidate.get('cv_text') or "").lower()
    
    if desc and cv:
        # Look for skills in CV text too (in case 'skills' tag is incomplete)
        for skill in job_skills:
            if skill in cv and skill not in overlap:
                score += 0.05
                reasons.append(f"Zjištěna dovednost v CV: {skill}")

    # Normalize
    score = round(min(score, 1.0) * 100, 1) # Internal percentage
    return score, reasons

@app.post("/match-candidates")
async def match_candidates_service(job_id: int):
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
            if score > 15: # Lower threshold for more results
                match_obj = {
                    "candidate_id": cand['id'],
                    "score": score,
                    "reasons": reasons,
                    "profile": {
                        "name": cand.get("full_name") or "Anonymní kandidát",
                        "job_title": cand.get("job_title") or "Hledá práci",
                        "skills": cand.get("skills") or [],
                        "bio": cand.get("cv_text")[:200] if cand.get("cv_text") else ""
                    }
                }
                matches.append(match_obj)
        
        # Sort and take top 10
        matches.sort(key=lambda x: x['score'], reverse=True)
        top_matches = matches[:10]

        # 3. Persist matches to Supabase (simplistic background task)
        # We don't save the 'profile' nested object to the DB
        db_matches = [
            {
                "job_id": job_id,
                "candidate_id": m["candidate_id"],
                "match_score": m["score"],
                "match_reasons": m["reasons"]
            }
            for m in top_matches
        ]
        
        try:
            supabase.table("job_candidate_matches").delete().eq("job_id", job_id).execute()
            if db_matches:
                supabase.table("job_candidate_matches").insert(db_matches).execute()
        except Exception:
            pass # Silent fail if table not ready

        return {"job_id": job_id, "matches": top_matches}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def send_review_email(job: JobCheckRequest, result: JobCheckResponse):
    try:
        token = serializer.dumps("floki@jobshaman.cz", salt="job-action")
        approve_url = f"{API_BASE_URL}/job-action/{job.id}/approve?token={token}"
        reject_url = f"{API_BASE_URL}/job-action/{job.id}/reject?token={token}"
        
        r = resend.Emails.send({
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
            """
        })
        return r
    except Exception as e:
        print(f"Failed to send email: {e}")

# --- STRIPE ENDPOINTS ---

@app.post("/create-checkout-session")
async def create_checkout_session(req: CheckoutRequest):
    try:
        # Live Stripe Price IDs
        prices = {
            "premium": "price_1StDJuG2Aezsy59eqi584FWl",
            "business": "price_1StDKmG2Aezsy59e1eiG9bny",
            "assessment": "price_1StDLUG2Aezsy59eJaSeiWvY",
            "assessment_bundle": "price_1StDTGG2Aezsy59esZLgocHw"
        }
        
        price_id = prices.get(req.tier)
        if not price_id:
            raise HTTPException(status_code=400, detail="Invalid tier")
        
        # 'premium' and 'business' are subscriptions, 'assessment' is a one-time payment
        mode = 'subscription' if req.tier in ['premium', 'business'] else 'payment'
        
        checkout_session = stripe.checkout.Session.create(
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            mode=mode,
            success_url=req.successUrl,
            cancel_url=req.cancelUrl,
            metadata={
                "userId": req.userId,
                "tier": req.tier
            }
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
        
        if supabase:
            if tier == "premium":
                # Update Candidate Profile
                supabase.table("profiles").update({
                    "subscription_tier": "premium"
                }).eq("id", user_id).execute()
            elif tier == "business":
                # Update Company Profile
                supabase.table("companies").update({
                    "subscription_tier": "business"
                }).eq("id", user_id).execute()
            elif tier == "assessment":
                # Update Candidate Profile for one-time assessment
                supabase.table("profiles").update({
                    "has_assessment": True
                }).eq("id", user_id).execute()
            elif tier == "assessment_bundle":
                # Update Company Profile for bundle
                supabase.table("companies").update({
                    "subscription_tier": "assessment_bundle"
                }).eq("id", user_id).execute()
                
        print(f"✅ Stripe Payment completed for {user_id} tier: {tier}")

    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
