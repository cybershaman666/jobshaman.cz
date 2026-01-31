from fastapi import APIRouter, Request, Depends, HTTPException, Query
from ..core.limiter import limiter
from ..core.security import get_current_user, verify_subscription, verify_csrf_token_header
from ..models.requests import JobCheckRequest, JobStatusUpdateRequest
from ..models.responses import JobCheckResponse
from ..services.legality import check_legality_rules
from ..services.matching import calculate_candidate_match
from ..services.email import send_review_email, send_recruiter_legality_email
from ..core.database import supabase
from ..utils.helpers import now_iso

router = APIRouter()

@router.get("/")
async def root(request: Request):
    return {"status": "JobShaman API is running"}

@router.post("/check-legality", response_model=JobCheckResponse)
@limiter.limit("5/minute")
async def check_job_legality(job: JobCheckRequest, request: Request, user: dict = Depends(verify_subscription)):
    print(f"🔥 [CRITICAL] check_job_legality REACHED for job {job.id}")
    print(f"   Auth User: {user.get('email', 'unknown')}")
    print(f"   Payload: title={job.title}, company={job.company}")
    risk_score, is_legal, reasons, needs_review = check_legality_rules(job.title, job.company, job.description)
    print(f"   [RESULT] Risk Score: {risk_score}, Is Legal: {is_legal}, Needs Review: {needs_review}")
    result = JobCheckResponse(risk_score=risk_score, is_legal=is_legal, reasons=reasons, needs_manual_review=needs_review)
    
    # Determine status for DB
    db_status = 'legal'
    if not is_legal:
        db_status = 'illegal'
    elif needs_review:
        db_status = 'review'
    
    # Update Supabase
    print(f"💾 [DB] Updating job {job.id} legality_status to: {db_status}")
    try:
        # Ensure job ID is treated as integer for BIGINT column
        job_id_int = int(job.id) if str(job.id).isdigit() else job.id
        
        update_result = supabase.table("jobs").update({
            "legality_status": db_status,
            "legality_reasons": reasons,
            "updated_at": now_iso()
        }).eq("id", job_id_int).execute()
        
        if not update_result.data:
            print(f"⚠️ [DB WARNING] No rows updated for job {job.id}. Check if ID exists and types match.")
        else:
            print(f"✅ [DB] Successfully updated status for job {job.id}")
            
    except Exception as e:
        print(f"❌ [DB ERROR] Failed to update job status for {job.id}: {e}")

    # If ad is illegal OR needs review, notify admin AND recruiter
    if not is_legal or needs_review:
        print(f"⚠️ [ACTION] Job {job.id} flagged! Sending emails...")
        
        # 1. Notify Admin
        email_context = {
            "job_id": job.id,
            "job_title": job.title,
            "job_company": job.company,
            "is_legal": is_legal,
            "needs_review": needs_review,
            "risk_score": risk_score,
            "reasons": reasons
        }
        send_review_email(job, result, context=email_context)

        # 2. Notify Recruiter (fetch email from DB first)
        try:
            job_data = supabase.table("jobs").select("contact_email, title").eq("id", job.id).single().execute()
            if job_data.data and job_data.data.get("contact_email"):
                rec_email = job_data.data["contact_email"]
                print(f"📧 Sending status update to recruiter: {rec_email}")
                send_recruiter_legality_email(rec_email, job_data.data["title"], result)
            else:
                print(f"⚠️ Could not find recruiter email for job {job.id}")
        except Exception as e:
            print(f"❌ Error notifying recruiter: {e}")
        
    return result

@router.put("/{job_id}/status")
async def update_job_status(job_id: str, update: JobStatusUpdateRequest, request: Request, user: dict = Depends(get_current_user)):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    # Query Supabase for job ownership and update status
    resp = supabase.table("jobs").update({"status": update.status}).eq("id", job_id).execute()
    return {"status": "success"}

@router.delete("/{job_id}")
async def delete_job(job_id: str, request: Request, user: dict = Depends(get_current_user)):
    print(f"🗑️ [REQUEST] Delete job {job_id} by user {user.get('email', 'unknown')}")
    print(f"🔑 [AUTH] Verifying CSRF token for user {user.get('email', 'unknown')}")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    supabase.table("jobs").delete().eq("id", job_id).execute()
    return {"status": "success"}

@router.post("/match-candidates")
@limiter.limit("10/minute")
async def match_candidates_service(request: Request, job_id: str = Query(...), user: dict = Depends(verify_subscription)):
    job_res = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    if not job_res.data: raise HTTPException(status_code=404, detail="Job not found")
    job = job_res.data
    
    cand_res = supabase.table("candidate_profiles").select("*").execute()
    candidates = cand_res.data or []
    
    matches = []
    for cand in candidates:
        score, reasons = calculate_candidate_match(cand, job)
        if score > 15:
            matches.append({"candidate_id": cand["id"], "score": score, "reasons": reasons})
    
    return {"job_id": job_id, "matches": sorted(matches, key=lambda x: x["score"], reverse=True)[:10]}
