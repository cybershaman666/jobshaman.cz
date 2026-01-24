import os
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional
import google.generativeai as genai
import resend
from supabase import create_client, Client
from dotenv import load_dotenv

from itsdangerous import URLSafeTimedSerializer
from fastapi.responses import HTMLResponse

load_dotenv()

app = FastAPI(title="JobShaman Backend Services")

# Configure APIs
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-shaman-key")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000") # Render URL after deploy
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
resend.api_key = os.getenv("RESEND_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
serializer = URLSafeTimedSerializer(SECRET_KEY)

class JobCheckRequest(BaseModel):
    id: str
    title: str
    company: str
    description: str

class JobCheckResponse(BaseModel):
    risk_score: float
    is_legal: bool
    reasons: List[str]
    needs_manual_review: bool

@app.get("/")
async def root():
    return {"status": "online", "service": "JobShaman Backend"}

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

@app.post("/check-legality", response_model=JobCheckResponse)
async def check_job_legality(job: JobCheckRequest):
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
        Analyze the following Czech job posting for potential fraud, multi-level marketing (MLM), pyramid schemes, or illegal practices.
        Job Title: {job.title}
        Company: {job.company}
        Description: {job.description}
        
        Provide a JSON response with:
        1. "risk_score": (float between 0 and 1, where 1 is absolute fraud)
        2. "is_legal": (boolean)
        3. "reasons": (list of strings explaining the score)
        4. "needs_manual_review": (boolean, true if risk_score is between 0.2 and 0.6)
        """
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        
        import json
        analysis = json.loads(text)
        
        result = JobCheckResponse(**analysis)
        
        # If it needs manual review, send email
        if result.needs_manual_review:
            send_review_email(job, result)
            
        # Update Supabase
        status = "approved" if result.is_legal and not result.needs_manual_review else "pending" if result.needs_manual_review else "rejected"
        supabase.table("jobs").update({
            "legality_status": status,
            "risk_score": result.risk_score,
            "verification_notes": ", ".join(result.reasons)
        }).eq("id", job.id).execute()
        
        return result
        
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
