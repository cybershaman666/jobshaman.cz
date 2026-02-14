from fastapi import APIRouter, Request, Depends, HTTPException, Query
from ..core.limiter import limiter
from ..core.security import get_current_user, verify_subscription, verify_csrf_token_header, require_company_access
from ..models.requests import JobCheckRequest, JobStatusUpdateRequest, JobInteractionRequest, HybridJobSearchRequest
from ..models.responses import JobCheckResponse
from ..services.legality import check_legality_rules
from ..services.matching import calculate_candidate_match
from ..matching_engine import recommend_jobs_for_user, hybrid_search_jobs
from ..services.email import send_review_email, send_recruiter_legality_email
from ..core.database import supabase
from ..utils.helpers import now_iso

router = APIRouter()

def _normalize_job_id(job_id: str):
    return int(job_id) if str(job_id).isdigit() else job_id

def _require_job_access(user: dict, job_id: str):
    """Ensure the current user is authorized to manage the given job."""
    job_id_norm = _normalize_job_id(job_id)

    job_resp = supabase.table("jobs").select("id, company_id").eq("id", job_id_norm).maybe_single().execute()
    if not job_resp.data:
        raise HTTPException(status_code=404, detail="Job not found")

    company_id = job_resp.data.get("company_id")
    require_company_access(user, company_id)

    return job_resp.data

@router.get("/")
async def root(request: Request):
    return {"status": "JobShaman API is running"}

@router.post("/check-legality", response_model=JobCheckResponse)
@limiter.limit("5/minute")
async def check_job_legality(job: JobCheckRequest, request: Request, user: dict = Depends(verify_subscription)):
    print(f"🔥 [CRITICAL] check_job_legality REACHED for job {job.id}")
    _require_job_access(user, str(job.id))
    risk_score, is_legal, reasons, needs_review = check_legality_rules(
        job.title,
        job.company,
        job.description,
        country_code=job.country_code,
        location=job.location
    )
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
        
        # Use existing columns: legality_status, risk_score, verification_notes
        update_data = {
            "legality_status": db_status,
            "risk_score": risk_score,
            "verification_notes": ", ".join(reasons) if reasons else ""
        }
        
        update_result = supabase.table("jobs").update(update_data).eq("id", job_id_int).execute()
        
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
                print("📧 Sending status update to recruiter.")
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
    _require_job_access(user, job_id)
    # Query Supabase for job ownership and update status
    resp = supabase.table("jobs").update({"status": update.status}).eq("id", job_id).execute()
    return {"status": "success"}

@router.delete("/{job_id}")
async def delete_job(job_id: str, request: Request, user: dict = Depends(get_current_user)):
    print(f"🗑️ [REQUEST] Delete job {job_id}")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    _require_job_access(user, job_id)
    supabase.table("jobs").delete().eq("id", job_id).execute()
    return {"status": "success"}

@router.post("/jobs/interactions")
@limiter.limit("120/minute")
async def log_job_interaction(payload: JobInteractionRequest, request: Request, user: dict = Depends(get_current_user)):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    try:
        insert_data = {
            "user_id": user_id,
            "job_id": payload.job_id,
            "event_type": payload.event_type,
            "dwell_time_ms": payload.dwell_time_ms,
            "session_id": payload.session_id,
            "metadata": payload.metadata or {}
        }
        res = supabase.table("job_interactions").insert(insert_data).execute()
        if not res.data:
            return {"status": "error", "message": "No data inserted"}
        return {"status": "success"}
    except Exception as e:
        print(f"❌ Error logging job interaction: {e}")
        raise HTTPException(status_code=500, detail="Failed to log interaction")


@router.get("/jobs/recommendations")
@limiter.limit("30/minute")
async def get_job_recommendations(
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    matches = recommend_jobs_for_user(user_id=user_id, limit=limit, allow_cache=True)
    return {"jobs": matches}


@router.post("/jobs/hybrid-search")
@limiter.limit("60/minute")
async def jobs_hybrid_search(
    payload: HybridJobSearchRequest,
    request: Request,
):
    result = hybrid_search_jobs(
        {
            "search_term": payload.search_term,
            "user_lat": payload.user_lat,
            "user_lng": payload.user_lng,
            "radius_km": payload.radius_km,
            "filter_city": payload.filter_city,
            "filter_contract_types": payload.filter_contract_types,
            "filter_benefits": payload.filter_benefits,
            "filter_min_salary": payload.filter_min_salary,
            "filter_date_posted": payload.filter_date_posted,
            "filter_experience_levels": payload.filter_experience_levels,
            "filter_country_codes": payload.filter_country_codes,
            "exclude_country_codes": payload.exclude_country_codes,
            "filter_language_codes": payload.filter_language_codes,
        },
        page=payload.page,
        page_size=payload.page_size,
    )
    return result

@router.post("/match-candidates")
@limiter.limit("10/minute")
async def match_candidates_service(request: Request, job_id: str = Query(...), user: dict = Depends(verify_subscription)):
    _require_job_access(user, job_id)
    if not user.get("is_subscription_active"):
        raise HTTPException(status_code=403, detail="Active subscription required")
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
