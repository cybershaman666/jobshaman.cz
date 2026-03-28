from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from ..core.limiter import limiter
from ..core.security import get_current_user, verify_csrf_token_header, verify_subscription
from ..models.requests import JobCheckRequest, JobStatusUpdateRequest
from ..models.responses import JobCheckResponse
from ..services.legality import check_legality_rules
from ..services.email import send_review_email, send_recruiter_legality_email
from ..services.jobs_postgres_store import delete_job_by_id, update_job_fields
from ..services.jobs_shared import (
    _delete_main_job_shadow_from_supabase,
    _normalize_job_id,
    _read_job_record,
    _require_job_access,
    _safe_row,
    _sync_main_job_shadow_to_supabase,
)

router = APIRouter()


@router.post("/check-legality", response_model=JobCheckResponse)
@limiter.limit("5/minute")
async def check_job_legality(
    job: JobCheckRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    print(f"🔥 [CRITICAL] check_job_legality REACHED for job {job.id}")
    _require_job_access(user, str(job.id))
    risk_score, is_legal, reasons, needs_review = check_legality_rules(
        job.title,
        job.company,
        job.description,
        country_code=job.country_code,
        location=job.location,
    )
    print(f"   [RESULT] Risk Score: {risk_score}, Is Legal: {is_legal}, Needs Review: {needs_review}")
    result = JobCheckResponse(risk_score=risk_score, is_legal=is_legal, reasons=reasons, needs_manual_review=needs_review)

    db_status = "legal"
    if not is_legal:
        db_status = "illegal"
    elif needs_review:
        db_status = "review"

    print(f"💾 [DB] Updating job {job.id} legality_status to: {db_status}")
    try:
        job_id_norm = _normalize_job_id(job.id)
        update_data = {
            "legality_status": db_status,
            "risk_score": risk_score,
            "verification_notes": ", ".join(reasons) if reasons else "",
        }

        primary_updated = update_job_fields(job_id_norm, update_data)
        shadow_updated = False
        existing_row = _read_job_record(job_id_norm) or {"id": job_id_norm}
        existing_row.update(update_data)
        shadow_updated = _sync_main_job_shadow_to_supabase(existing_row, create_if_missing=False)

        if not primary_updated and not shadow_updated:
            print(f"⚠️ [DB WARNING] No primary or shadow row updated for job {job.id}.")
        else:
            print(f"✅ [DB] Successfully updated legality state for job {job.id}")
    except Exception as e:
        print(f"❌ [DB ERROR] Failed to update job status for {job.id}: {e}")

    if not is_legal or needs_review:
        print(f"⚠️ [ACTION] Job {job.id} flagged! Sending emails...")
        email_context = {
            "job_id": job.id,
            "job_title": job.title,
            "job_company": job.company,
            "is_legal": is_legal,
            "needs_review": needs_review,
            "risk_score": risk_score,
            "reasons": reasons,
        }
        send_review_email(job, result, context=email_context)

        try:
            job_row = _safe_row(_read_job_record(job.id))
            if job_row and job_row.get("contact_email"):
                rec_email = str(job_row["contact_email"])
                print("📧 Sending status update to recruiter.")
                send_recruiter_legality_email(rec_email, str(job_row.get("title") or ""), result)
            else:
                print(f"⚠️ Could not find recruiter email for job {job.id}")
        except Exception as e:
            print(f"❌ Error notifying recruiter: {e}")

    return result


@router.put("/{job_id}/status")
async def update_job_status(
    job_id: str,
    update: JobStatusUpdateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    job_row = _require_job_access(user, job_id)
    normalized_job_id = _normalize_job_id(job_id)
    patch = {
        "status": update.status,
        "is_active": update.status not in {"paused", "closed", "archived"},
    }
    try:
        update_job_fields(normalized_job_id, patch)
    except Exception:
        pass
    shadow_row = dict(job_row)
    shadow_row.update(patch)
    _sync_main_job_shadow_to_supabase(shadow_row, create_if_missing=False)
    return {"status": "success"}


@router.delete("/{job_id}")
async def delete_job(
    job_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    print(f"🗑️ [REQUEST] Delete job {job_id}")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    _require_job_access(user, job_id)
    try:
        delete_job_by_id(job_id)
    except Exception:
        pass
    _delete_main_job_shadow_from_supabase(job_id)
    return {"status": "success"}
