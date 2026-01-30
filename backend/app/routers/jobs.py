from fastapi import APIRouter, Request, Depends, HTTPException, Query
from ..core.limiter import limiter
from ..core.security import get_current_user, verify_subscription, verify_csrf_token_header
from ..models.requests import JobCheckRequest, JobStatusUpdateRequest
from ..models.responses import JobCheckResponse
from ..services.legality import check_legality_rules
from ..services.matching import calculate_candidate_match
from ..services.email import send_review_email
from ..core.database import supabase
from ..utils.helpers import now_iso

router = APIRouter()

@router.get("/")
async def root(request: Request):
    return {"status": "JobShaman API is running"}

@router.post("/check-legality", response_model=JobCheckResponse)
@limiter.limit("5/minute")
async def check_job_legality(job: JobCheckRequest, request: Request, user: dict = Depends(verify_subscription)):
    risk_score, is_legal, reasons, needs_review = check_legality_rules(job.title, job.company, job.description)
    result = JobCheckResponse(risk_score=risk_score, is_legal=is_legal, reasons=reasons, needs_manual_review=needs_review)
    if needs_review:
        send_review_email(job, result)
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
