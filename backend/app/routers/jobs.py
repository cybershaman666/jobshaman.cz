import os
from fastapi import APIRouter, Request, Depends, HTTPException, Query, BackgroundTasks
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from ..core.limiter import limiter
from ..core.security import get_current_user, verify_subscription, verify_csrf_token_header, require_company_access, verify_supabase_token
from ..models.requests import JobCheckRequest, JobStatusUpdateRequest, JobInteractionRequest, JobInteractionStateSyncRequest, JobApplicationCreateRequest, JobApplicationStatusUpdateRequest, HybridJobSearchRequest, HybridJobSearchV2Request, JobAnalyzeRequest, JobDraftUpsertRequest, JobDraftPublishRequest, JobLifecycleUpdateRequest
from ..models.responses import JobCheckResponse
from ..services.legality import check_legality_rules
from ..services.matching import calculate_candidate_match
from ..matching_engine import recommend_jobs_for_user, hybrid_search_jobs, hybrid_search_jobs_v2
from ..services.email import send_review_email, send_recruiter_legality_email
from ..core.database import supabase
from ..core.runtime_config import get_active_model_config
from ..ai_orchestration.client import AIClientError, call_primary_with_fallback, _extract_json
from ..utils.helpers import now_iso

router = APIRouter()
_SEARCH_EXPOSURES_AVAILABLE: bool = True
_SEARCH_EXPOSURES_WARNING_EMITTED: bool = False
_SEARCH_FEEDBACK_AVAILABLE: bool = True
_SEARCH_FEEDBACK_WARNING_EMITTED: bool = False
_INTERACTIONS_CSRF_WARNING_LAST_EMITTED: datetime | None = None

# recommendation_feedback_events historically expects a narrower signal taxonomy
# than raw UI interaction events. Keep search_feedback_events raw, but normalize
# recommendation feedback writes to avoid DB constraint violations.
_RECOMMENDATION_SIGNAL_MAP: dict[str, str] = {
    "swipe_right": "save",
    "swipe_left": "unsave",
}
_RECOMMENDATION_ALLOWED_SIGNALS: set[str] = {
    "impression",
    "open_detail",
    "apply_click",
    "save",
    "unsave",
}
_INTERACTION_STATE_EVENTS = ["save", "unsave", "swipe_left", "swipe_right"]


def _is_missing_table_error(exc: Exception, table_name: str) -> bool:
    msg = str(exc).lower()
    return ("pgrst205" in msg and table_name.lower() in msg) or f"table '{table_name.lower()}'" in msg


def _try_get_optional_user_id(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth_header:
        return None
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        user = verify_supabase_token(token)
        return user.get("id") or user.get("auth_id")
    except Exception:
        return None


def _parse_iso_datetime(value: str) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _is_active_subscription(sub: dict) -> bool:
    if not sub:
        return False
    status = (sub.get("status") or "").lower()
    if status not in ["active", "trialing"]:
        return False

    expires_at = _parse_iso_datetime(sub.get("current_period_end"))
    if expires_at:
        return datetime.now(timezone.utc) <= expires_at
    return True


def _fetch_latest_subscription_by(column: str, value: str) -> dict | None:
    if not supabase or not value:
        return None
    try:
        resp = (
            supabase
            .table("subscriptions")
            .select("*")
            .eq(column, value)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None
    except Exception:
        return None


def _user_has_allowed_subscription(user: dict, allowed_tiers: set[str]) -> bool:
    user_tier = (user.get("subscription_tier") or "").lower()
    if user.get("is_subscription_active") and user_tier in allowed_tiers:
        return True

    user_id = user.get("id") or user.get("auth_id")
    if user_id:
        user_sub = _fetch_latest_subscription_by("user_id", user_id)
        if user_sub and _is_active_subscription(user_sub) and (user_sub.get("tier") or "").lower() in allowed_tiers:
            return True

    # Keep recruiter/company fallback for shared auth contexts.
    for company_id in (user.get("authorized_ids") or []):
        if company_id == user_id:
            continue
        company_sub = _fetch_latest_subscription_by("company_id", company_id)
        if company_sub and _is_active_subscription(company_sub) and (company_sub.get("tier") or "").lower() in allowed_tiers:
            return True

    return False

def _normalize_job_id(job_id: str):
    return int(job_id) if str(job_id).isdigit() else job_id


def _canonical_job_id(job_id) -> str:
    if job_id is None:
        return ""
    value = str(job_id).strip()
    if not value:
        return ""
    return value


def _fetch_user_interaction_state(user_id: str, limit: int = 10000) -> tuple[list[str], list[str]]:
    if not supabase or not user_id:
        return [], []
    try:
        resp = (
            supabase.table("job_interactions")
            .select("job_id,event_type,created_at")
            .eq("user_id", user_id)
            .in_("event_type", _INTERACTION_STATE_EVENTS)
            .order("created_at", desc=True)
            .limit(max(1, min(20000, int(limit))))
            .execute()
        )
        rows = resp.data or []
    except Exception as exc:
        print(f"⚠️ Failed to fetch interaction state for user {user_id}: {exc}")
        return [], []

    # Keep "saved" and "dismissed" as separate state tracks.
    # swipe_left should not implicitly remove a previously saved job.
    saved_state_by_job: dict[str, bool] = {}
    dismissed_state_by_job: dict[str, bool] = {}
    for row in rows:
        job_id = _canonical_job_id(row.get("job_id"))
        if not job_id:
            continue
        event_type = str(row.get("event_type") or "").strip().lower()

        if job_id not in saved_state_by_job and event_type in {"save", "unsave", "swipe_right"}:
            saved_state_by_job[job_id] = event_type in {"save", "swipe_right"}

        if job_id not in dismissed_state_by_job and event_type in {"swipe_left", "save", "unsave", "swipe_right"}:
            dismissed_state_by_job[job_id] = event_type == "swipe_left"

    saved_job_ids: list[str] = []
    dismissed_job_ids: list[str] = []
    for job_id, is_saved in saved_state_by_job.items():
        if is_saved:
            saved_job_ids.append(job_id)
    saved_set = set(saved_job_ids)
    for job_id, is_dismissed in dismissed_state_by_job.items():
        if is_dismissed and job_id not in saved_set:
            dismissed_job_ids.append(job_id)

    saved_job_ids.sort()
    dismissed_job_ids.sort()
    return saved_job_ids, dismissed_job_ids


def _filter_out_dismissed_jobs(jobs: list[dict], dismissed_job_ids: set[str]) -> list[dict]:
    if not jobs or not dismissed_job_ids:
        return jobs
    out: list[dict] = []
    for row in jobs:
        job_id = _canonical_job_id((row or {}).get("id"))
        if job_id and job_id in dismissed_job_ids:
            continue
        out.append(row)
    return out


def _filter_existing_job_ids(job_ids: set[str]) -> set[str]:
    if not supabase or not job_ids:
        return set()
    existing: set[str] = set()
    normalized_ints = []
    for jid in job_ids:
        if str(jid).isdigit():
            normalized_ints.append(int(jid))
    if not normalized_ints:
        return set()

    batch_size = 500
    for i in range(0, len(normalized_ints), batch_size):
        chunk = normalized_ints[i : i + batch_size]
        try:
            resp = (
                supabase
                .table("jobs")
                .select("id")
                .in_("id", chunk)
                .limit(len(chunk))
                .execute()
            )
            for row in resp.data or []:
                job_id = _canonical_job_id((row or {}).get("id"))
                if job_id:
                    existing.add(job_id)
        except Exception as exc:
            print(f"⚠️ Failed to filter existing job IDs for sync: {exc}")
            return set()
    return existing


def _is_missing_column_error(exc: Exception, column_name: str) -> bool:
    msg = str(exc).lower()
    return column_name.lower() in msg and ("does not exist" in msg or "column" in msg)


def _safe_dict(value) -> dict:
    return value if isinstance(value, dict) else {}


def _safe_string_list(value, limit: int = 12) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        text = str(item or "").strip()
        if text:
            out.append(text[:300])
        if len(out) >= limit:
            break
    return out


def _serialize_company_activity_event(row: dict | None) -> dict:
    source = row or {}
    payload = source.get("payload")
    return {
        "id": source.get("id"),
        "company_id": source.get("company_id"),
        "event_type": source.get("event_type"),
        "subject_type": source.get("subject_type"),
        "subject_id": source.get("subject_id"),
        "payload": payload if isinstance(payload, dict) else {},
        "actor_user_id": source.get("actor_user_id"),
        "created_at": source.get("created_at"),
    }


def _write_company_activity_log(
    company_id: str,
    event_type: str,
    payload: dict | None = None,
    actor_user_id: str | None = None,
    subject_type: str | None = None,
    subject_id: str | None = None,
):
    if not supabase or not company_id or not event_type:
        return

    try:
        supabase.table("company_activity_log").insert({
            "company_id": company_id,
            "event_type": event_type,
            "subject_type": subject_type or None,
            "subject_id": subject_id or None,
            "payload": payload if isinstance(payload, dict) else {},
            "actor_user_id": actor_user_id or None,
        }).execute()
    except Exception as exc:
        if _is_missing_table_error(exc, "company_activity_log"):
            return
        print(f"⚠️ Failed to write company activity log: {exc}")


def _normalize_jcfpm_share_level(level: str | None, payload: dict | None = None) -> str:
    normalized = str(level or "").strip().lower()
    if normalized in {"summary", "full_report", "do_not_share"}:
        return normalized
    if payload:
        return "summary"
    return "do_not_share"


def _sanitize_cv_snapshot(raw) -> dict:
    value = _safe_dict(raw)
    return {
        "id": str(value.get("id") or "").strip() or None,
        "label": str(value.get("label") or "").strip() or None,
        "originalName": str(value.get("originalName") or "").strip() or None,
        "fileUrl": str(value.get("fileUrl") or "").strip() or None,
    }


def _sanitize_candidate_profile_snapshot(raw) -> dict:
    value = _safe_dict(raw)
    return {
        "name": str(value.get("name") or "").strip() or None,
        "email": str(value.get("email") or "").strip() or None,
        "phone": str(value.get("phone") or "").strip() or None,
        "jobTitle": str(value.get("jobTitle") or "").strip() or None,
        "linkedin": str(value.get("linkedin") or "").strip() or None,
        "skills": _safe_string_list(value.get("skills"), limit=12),
        "values": _safe_string_list(value.get("values"), limit=8),
        "preferredCountryCode": str(value.get("preferredCountryCode") or "").strip().upper() or None,
    }


def _sanitize_jcfpm_payload(level: str, raw) -> dict | None:
    if level == "do_not_share":
        return None

    value = _safe_dict(raw)
    base = {
        "schema_version": "jcfpm-share-v1",
        "share_level": level,
        "completed_at": str(value.get("completed_at") or "").strip() or None,
        "confidence": float(value.get("confidence") or 0) if value.get("confidence") is not None else None,
        "archetype": _safe_dict(value.get("archetype")) or None,
        "top_dimensions": [],
        "strengths": _safe_string_list(value.get("strengths"), limit=6),
        "environment_fit_summary": _safe_string_list(value.get("environment_fit_summary"), limit=5),
        "jhi_adjustment_summary": [],
    }

    for item in (value.get("top_dimensions") or [])[:3]:
        if not isinstance(item, dict):
            continue
        base["top_dimensions"].append({
            "dimension": str(item.get("dimension") or "").strip()[:64],
            "percentile": int(item.get("percentile") or 0),
            "label": str(item.get("label") or "").strip()[:200] or None,
        })

    for item in (value.get("jhi_adjustment_summary") or [])[:6]:
        if not isinstance(item, dict):
            continue
        base["jhi_adjustment_summary"].append({
            "field": str(item.get("field") or "").strip()[:120],
            "from": int(item.get("from") or 0),
            "to": int(item.get("to") or 0),
            "reason": str(item.get("reason") or "").strip()[:500],
        })

    if level != "full_report":
        return base

    full = {
        **base,
        "dimension_scores": [],
        "fit_scores": [],
        "narrative_summary": _safe_dict(value.get("narrative_summary")),
    }
    for item in (value.get("dimension_scores") or [])[:12]:
        if not isinstance(item, dict):
            continue
        full["dimension_scores"].append({
            "dimension": str(item.get("dimension") or "").strip()[:64],
            "raw_score": float(item.get("raw_score") or 0),
            "percentile": int(item.get("percentile") or 0),
            "percentile_band": str(item.get("percentile_band") or "").strip()[:80] or None,
            "label": str(item.get("label") or "").strip()[:200] or None,
        })
    for item in (value.get("fit_scores") or [])[:5]:
        if not isinstance(item, dict):
            continue
        full["fit_scores"].append({
            "title": str(item.get("title") or "").strip()[:200],
            "fit_score": float(item.get("fit_score") or 0),
            "salary_range": str(item.get("salary_range") or "").strip()[:120] or None,
            "growth_potential": str(item.get("growth_potential") or "").strip()[:120] or None,
            "ai_impact": str(item.get("ai_impact") or "").strip()[:120] or None,
            "remote_friendly": str(item.get("remote_friendly") or "").strip()[:120] or None,
        })
    return full


def _derive_candidate_headline(snapshot: dict | None) -> str | None:
    data = _safe_dict(snapshot)
    job_title = str(data.get("jobTitle") or "").strip()
    skills = _safe_string_list(data.get("skills"), limit=3)
    if job_title and skills:
        return f"{job_title} • {', '.join(skills)}"
    if job_title:
        return job_title
    if skills:
        return ", ".join(skills)
    return None


def _serialize_company_application_row(row: dict) -> dict:
    job = _safe_dict(row.get("jobs"))
    profile = _safe_dict(row.get("profiles"))
    candidate_snapshot = _safe_dict(row.get("candidate_profile_snapshot"))
    jcfpm_share_level = _normalize_jcfpm_share_level(row.get("jcfpm_share_level"), _safe_dict(row.get("shared_jcfpm_payload")))
    cover_letter = str(row.get("cover_letter") or "").strip()
    cv_snapshot = _safe_dict(row.get("cv_snapshot"))
    return {
        "id": row.get("id"),
        "job_id": row.get("job_id"),
        "candidate_id": row.get("candidate_id"),
        "status": row.get("status"),
        "created_at": row.get("created_at"),
        "submitted_at": row.get("submitted_at") or row.get("applied_at") or row.get("created_at"),
        "updated_at": row.get("updated_at") or row.get("created_at"),
        "job_title": job.get("title"),
        "candidate_name": profile.get("full_name") or candidate_snapshot.get("name") or profile.get("email") or "Candidate",
        "candidate_email": profile.get("email") or candidate_snapshot.get("email"),
        "has_cover_letter": bool(cover_letter),
        "has_cv": bool(cv_snapshot.get("fileUrl") or cv_snapshot.get("originalName") or row.get("cv_document_id")),
        "jcfpm_share_level": jcfpm_share_level,
        "has_jcfpm": jcfpm_share_level != "do_not_share" and bool(row.get("shared_jcfpm_payload")),
        "candidate_headline": _derive_candidate_headline(candidate_snapshot),
    }


def _serialize_application_dossier(row: dict) -> dict:
    base = _serialize_company_application_row(row)
    base.update({
        "company_id": row.get("company_id"),
        "source": row.get("source"),
        "reviewed_at": row.get("reviewed_at"),
        "reviewed_by": row.get("reviewed_by"),
        "cover_letter": row.get("cover_letter"),
        "cv_document_id": row.get("cv_document_id"),
        "cv_snapshot": _sanitize_cv_snapshot(row.get("cv_snapshot")),
        "candidate_profile_snapshot": _sanitize_candidate_profile_snapshot(row.get("candidate_profile_snapshot")),
        "shared_jcfpm_payload": _sanitize_jcfpm_payload(
            _normalize_jcfpm_share_level(row.get("jcfpm_share_level"), _safe_dict(row.get("shared_jcfpm_payload"))),
            row.get("shared_jcfpm_payload"),
        ),
        "application_payload": _safe_dict(row.get("application_payload")),
    })
    return base


def _probe_schema_select(table_name: str, select_clause: str) -> dict:
    if not supabase:
        return {"ready": False, "sample_rows": 0, "issue": "supabase unavailable"}
    try:
        resp = supabase.table(table_name).select(select_clause).limit(2).execute()
        return {
            "ready": True,
            "sample_rows": len(resp.data or []),
            "issue": None,
        }
    except Exception as exc:
        return {
            "ready": False,
            "sample_rows": 0,
            "issue": str(exc)[:240],
        }


def _draft_to_validation_report(draft: dict) -> dict:
    blocking: list[str] = []
    warnings: list[str] = []
    suggestions: list[str] = []

    title = str(draft.get("title") or "").strip()
    role_summary = str(draft.get("role_summary") or "").strip()
    responsibilities = str(draft.get("responsibilities") or "").strip()
    requirements = str(draft.get("requirements") or "").strip()
    contact_email = str(draft.get("contact_email") or "").strip()
    location_public = str(draft.get("location_public") or draft.get("workplace_address") or "").strip()
    salary_from = draft.get("salary_from")
    salary_to = draft.get("salary_to")
    benefits = _safe_string_list(draft.get("benefits_structured"), limit=50)

    if not title:
        blocking.append("Missing title.")
    if not role_summary:
        blocking.append("Missing role summary.")
    if not responsibilities:
        blocking.append("Missing responsibilities.")
    if not requirements:
        blocking.append("Missing requirements.")
    if not location_public:
        blocking.append("Missing public location.")
    if not contact_email:
        blocking.append("Missing application contact email.")

    if salary_from is None or salary_to is None:
        warnings.append("Salary is not fully transparent.")
    elif float(salary_to or 0) < float(salary_from or 0):
        blocking.append("Salary max cannot be lower than salary min.")

    if len(requirements) < 120:
        warnings.append("Requirements section is still very short.")
    if len(benefits) < 2:
        warnings.append("Benefits are likely too vague or too thin.")
    if len(role_summary) < 80:
        suggestions.append("Expand the role summary to make the opportunity clearer.")
    if len(responsibilities) < 180:
        suggestions.append("Add more concrete day-to-day responsibilities.")
    if len(requirements) < 180:
        suggestions.append("Clarify must-have skills and expected experience.")

    transparency_score = max(0, min(100, 100 - len(blocking) * 22 - len(warnings) * 8))
    clarity_score = max(0, min(100, 45 + min(len(role_summary), 400) // 12 + min(len(responsibilities), 600) // 18))
    return {
        "blockingIssues": blocking,
        "warnings": warnings,
        "suggestions": suggestions,
        "transparencyScore": transparency_score,
        "clarityScore": clarity_score,
    }


def _compose_job_description_from_draft(draft: dict) -> str:
    sections: list[str] = []
    for heading, key in [
        ("Role Summary", "role_summary"),
        ("Team Intro", "team_intro"),
        ("Responsibilities", "responsibilities"),
        ("Requirements", "requirements"),
        ("Nice to Have", "nice_to_have"),
        ("How To Apply", "application_instructions"),
    ]:
        value = str(draft.get(key) or "").strip()
        if value:
            sections.append(f"### {heading}\n{value}")
    benefits = _safe_string_list(draft.get("benefits_structured"), limit=20)
    if benefits:
        sections.append("### Benefits\n" + "\n".join([f"- {item}" for item in benefits]))
    return "\n\n".join(sections).strip()

def _coerce_job_analysis_payload(raw: dict) -> dict:
    summary = str(raw.get("summary") or "").strip()
    hidden = raw.get("hiddenRisks")
    if not isinstance(hidden, list):
        hidden = raw.get("hidden_risks")
    if not isinstance(hidden, list):
        hidden = []
    hidden = [str(item).strip() for item in hidden if str(item).strip()][:12]
    cultural = str(raw.get("culturalFit") or raw.get("cultural_fit") or "").strip()
    if not summary:
        raise ValueError("Missing summary in AI response")
    if not cultural:
        cultural = "Neutrální"
    return {
        "summary": summary[:2000],
        "hiddenRisks": hidden,
        "culturalFit": cultural[:200],
    }

def _job_analysis_prompt(description: str, title: str | None = None, language: str = "cs") -> str:
    normalized_lang = (language or "cs").strip().lower()
    output_lang = "Czech" if normalized_lang.startswith("cs") else "English"
    job_title = (title or "").strip()
    title_line = f"Job title: {job_title}\n" if job_title else ""
    return f"""
Analyze the following job posting as a pragmatic career advisor.
Output language: {output_lang}
Return STRICT JSON only with keys:
- summary: string
- hiddenRisks: string[]
- culturalFit: string

Rules:
- summary = one sentence of what the job actually is
- hiddenRisks = implied red flags or ambiguity
- culturalFit = short tone assessment
- no markdown, no extra keys

{title_line}Job description:
{description[:7000]}
""".strip()

def _require_job_access(user: dict, job_id: str):
    """Ensure the current user is authorized to manage the given job."""
    job_id_norm = _normalize_job_id(job_id)

    job_resp = supabase.table("jobs").select("id, company_id, title, status").eq("id", job_id_norm).maybe_single().execute()
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
        # Telemetry endpoint: do not block UX on CSRF token race/cooldown.
        global _INTERACTIONS_CSRF_WARNING_LAST_EMITTED
        now = datetime.now(timezone.utc)
        if (
            _INTERACTIONS_CSRF_WARNING_LAST_EMITTED is None
            or now - _INTERACTIONS_CSRF_WARNING_LAST_EMITTED >= timedelta(minutes=10)
        ):
            print(
                "⚠️ /jobs/interactions called without valid CSRF token; "
                "accepting authenticated telemetry request (throttled, 10m window)."
            )
            _INTERACTIONS_CSRF_WARNING_LAST_EMITTED = now

    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    metadata = getattr(payload, "metadata", None) or {}
    if not isinstance(metadata, dict):
        metadata = {}
    request_id = payload.request_id or metadata.get("request_id")
    scoring_version = getattr(payload, "scoring_version", None) or metadata.get("scoring_version")
    model_version = getattr(payload, "model_version", None) or metadata.get("model_version")

    insert_data = {
        "user_id": user_id,
        "job_id": payload.job_id,
        "event_type": payload.event_type,
        "dwell_time_ms": payload.dwell_time_ms,
        "session_id": payload.session_id,
        "metadata": metadata
    }
    try:
        res = supabase.table("job_interactions").insert(insert_data).execute()
    except Exception as exc:
        # Telemetry should not degrade UX when DB constraints/table shape drift.
        print(f"⚠️ Failed to insert job_interactions telemetry: {exc}")
        return {"status": "degraded", "reason": "job_interactions_insert_failed"}

    if not res.data:
        return {"status": "degraded", "reason": "no_data_inserted"}

    try:
        normalized_signal_type = _RECOMMENDATION_SIGNAL_MAP.get(payload.event_type, payload.event_type)

        feedback_rows = [
            {
                "request_id": request_id,
                "user_id": user_id,
                "job_id": payload.job_id,
                "signal_type": normalized_signal_type,
                "signal_value": payload.signal_value,
                "scoring_version": scoring_version,
                "model_version": model_version,
                "metadata": metadata,
            }
        ]

        # Capture implicit relevance signals without changing client event taxonomy.
        if payload.dwell_time_ms is not None:
            feedback_rows.append(
                {
                    "request_id": request_id,
                    "user_id": user_id,
                    "job_id": payload.job_id,
                    "signal_type": "dwell_ms",
                    "signal_value": float(payload.dwell_time_ms),
                    "scoring_version": scoring_version,
                    "model_version": model_version,
                    "metadata": metadata,
                }
            )
        if payload.scroll_depth is not None:
            feedback_rows.append(
                {
                    "request_id": request_id,
                    "user_id": user_id,
                    "job_id": payload.job_id,
                    "signal_type": "scroll_depth",
                    "signal_value": float(payload.scroll_depth),
                    "scoring_version": scoring_version,
                    "model_version": model_version,
                    "metadata": metadata,
                }
            )
        recommendation_rows = [
            row for row in feedback_rows
            if str(row.get("signal_type") or "").strip().lower() in _RECOMMENDATION_ALLOWED_SIGNALS
        ]

        try:
            if recommendation_rows:
                supabase.table("recommendation_feedback_events").insert(recommendation_rows).execute()
        except Exception as feedback_exc:
            print(f"⚠️ Failed to write recommendation feedback events: {feedback_exc}")

        search_feedback_rows = []
        for row in feedback_rows:
            raw_signal_type = row.get("signal_type")
            if raw_signal_type == normalized_signal_type:
                raw_signal_type = payload.event_type
            search_feedback_rows.append(
                {
                    "request_id": row.get("request_id"),
                    "user_id": row.get("user_id"),
                    "job_id": row.get("job_id"),
                    "signal_type": raw_signal_type,
                    "signal_value": row.get("signal_value"),
                    "metadata": row.get("metadata") or {},
                }
            )
        global _SEARCH_FEEDBACK_AVAILABLE, _SEARCH_FEEDBACK_WARNING_EMITTED
        if search_feedback_rows and _SEARCH_FEEDBACK_AVAILABLE:
            try:
                supabase.table("search_feedback_events").insert(search_feedback_rows).execute()
            except Exception as search_exc:
                if _is_missing_table_error(search_exc, "search_feedback_events"):
                    _SEARCH_FEEDBACK_AVAILABLE = False
                    if not _SEARCH_FEEDBACK_WARNING_EMITTED:
                        print("⚠️ search_feedback_events table missing. Disabling search feedback writes.")
                        _SEARCH_FEEDBACK_WARNING_EMITTED = True
                else:
                    print(f"⚠️ Failed to write search feedback events: {search_exc}")
        return {"status": "success"}
    except Exception as exc:
        print(f"⚠️ Partial telemetry failure after interaction insert: {exc}")
        return {"status": "degraded", "reason": "secondary_feedback_failed"}


@router.get("/jobs/interactions/state")
@limiter.limit("120/minute")
async def get_job_interaction_state(
    request: Request,
    limit: int = Query(5000, ge=1, le=20000),
    user: dict = Depends(get_current_user),
):
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    saved_job_ids, dismissed_job_ids = _fetch_user_interaction_state(user_id, limit=limit)
    return {
        "saved_job_ids": saved_job_ids,
        "dismissed_job_ids": dismissed_job_ids,
    }


@router.post("/jobs/interactions/state/sync")
@limiter.limit("60/minute")
async def sync_job_interaction_state(
    payload: JobInteractionStateSyncRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    def _normalize_ids(values: list[str]) -> list[str]:
        out: list[str] = []
        for raw in values or []:
            job_id = _canonical_job_id(raw)
            if not job_id:
                continue
            if job_id.isdigit():
                out.append(job_id)
        return out

    client_saved = set(_normalize_ids(payload.saved_job_ids))
    client_dismissed = set(_normalize_ids(payload.dismissed_job_ids))
    # Saved always wins over dismissed.
    client_dismissed = {jid for jid in client_dismissed if jid not in client_saved}

    server_saved, server_dismissed = _fetch_user_interaction_state(user_id, limit=20000)
    server_saved_set = set(server_saved)
    server_dismissed_set = set(server_dismissed)

    to_save = client_saved - server_saved_set
    to_unsave = server_saved_set - client_saved
    to_dismiss = client_dismissed - server_dismissed_set
    to_undismiss = server_dismissed_set - client_dismissed

    # If a job is saved, dismissals should be cleared by save.
    to_undismiss = {jid for jid in to_undismiss if jid not in client_saved}

    insert_rows = []
    meta = {
        "source": "state_sync",
        "client_updated_at": payload.client_updated_at,
        "origin": payload.source,
    }

    for job_id in to_save:
        insert_rows.append({
            "user_id": user_id,
            "job_id": int(job_id),
            "event_type": "save",
            "metadata": meta,
        })
    for job_id in to_unsave:
        insert_rows.append({
            "user_id": user_id,
            "job_id": int(job_id),
            "event_type": "unsave",
            "metadata": meta,
        })
    for job_id in to_dismiss:
        insert_rows.append({
            "user_id": user_id,
            "job_id": int(job_id),
            "event_type": "swipe_left",
            "metadata": meta,
        })
    for job_id in to_undismiss:
        insert_rows.append({
            "user_id": user_id,
            "job_id": int(job_id),
            "event_type": "unsave",
            "metadata": meta,
        })

    if insert_rows:
        valid_job_ids = _filter_existing_job_ids({str(row.get("job_id")) for row in insert_rows if row.get("job_id") is not None})
        if valid_job_ids:
            insert_rows = [row for row in insert_rows if _canonical_job_id(row.get("job_id")) in valid_job_ids]
        else:
            insert_rows = []

    if insert_rows:
        try:
            batch_size = 500
            for i in range(0, len(insert_rows), batch_size):
                supabase.table("job_interactions").insert(insert_rows[i : i + batch_size]).execute()
        except Exception as exc:
            print(f"⚠️ Failed to sync interaction state: {exc}")
            raise HTTPException(status_code=500, detail="Failed to sync interaction state")

    updated_at = now_iso()
    return {
        "saved_job_ids": sorted(list(client_saved)),
        "dismissed_job_ids": sorted(list(client_dismissed)),
        "updated_at": updated_at,
    }


@router.get("/company/dashboard/job_views")
@limiter.limit("60/minute")
async def get_company_job_views(
    request: Request,
    company_id: str = Query(...),
    window_days: int = Query(90, ge=7, le=365),
    job_id: str | None = Query(None),
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    require_company_access(user, company_id)
    jobs_query = (
        supabase
        .table("jobs")
        .select("id")
        .eq("company_id", company_id)
    )
    if job_id:
        jobs_query = jobs_query.eq("id", _normalize_job_id(job_id))
    jobs_resp = jobs_query.execute()
    job_rows = jobs_resp.data or []
    job_ids = [row.get("id") for row in job_rows if row.get("id")]
    if not job_ids:
        return {"company_id": company_id, "window_days": window_days, "total": 0, "job_views": []}

    since_iso = (datetime.now(timezone.utc) - timedelta(days=window_days)).isoformat()
    views_resp = (
        supabase
        .table("job_interactions")
        .select("job_id,created_at")
        .eq("event_type", "open_detail")
        .in_("job_id", job_ids)
        .gte("created_at", since_iso)
        .limit(50000)
        .execute()
    )
    view_rows = views_resp.data or []
    counts: dict[str, int] = {}
    for row in view_rows:
        jid = _canonical_job_id(row.get("job_id"))
        if not jid:
            continue
        counts[jid] = counts.get(jid, 0) + 1

    job_views = [{"job_id": jid, "views": count} for jid, count in counts.items()]
    total = sum(counts.values())
    return {
        "company_id": company_id,
        "window_days": window_days,
        "total": total,
        "job_views": job_views,
    }


@router.post("/jobs/applications")
@limiter.limit("60/minute")
async def create_job_application(
    payload: JobApplicationCreateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    job_id = _normalize_job_id(payload.job_id)
    if job_id is None:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    requested_share_level = _normalize_jcfpm_share_level(payload.jcfpm_share_level, _safe_dict(payload.shared_jcfpm_payload))
    cv_snapshot = _sanitize_cv_snapshot(payload.cv_snapshot)
    candidate_profile_snapshot = _sanitize_candidate_profile_snapshot(payload.candidate_profile_snapshot)
    shared_jcfpm_payload = _sanitize_jcfpm_payload(requested_share_level, payload.shared_jcfpm_payload)
    application_payload = _safe_dict(payload.metadata)

    try:
        existing = (
            supabase
            .table("job_applications")
            .select("*")
            .eq("job_id", job_id)
            .eq("candidate_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if existing.data:
            row = existing.data[0]
            return {
                "status": "exists",
                "application_id": row.get("id"),
                "created_at": row.get("created_at"),
                "application": _serialize_application_dossier(row),
            }
    except Exception as exc:
        print(f"⚠️ Failed to check existing application: {exc}")

    company_id = None
    try:
        job_resp = supabase.table("jobs").select("company_id").eq("id", job_id).maybe_single().execute()
        company_id = (job_resp.data or {}).get("company_id") if job_resp else None
    except Exception as exc:
        print(f"⚠️ Failed to resolve company for job {job_id}: {exc}")

    insert_payload = {
        "job_id": job_id,
        "candidate_id": user_id,
        "company_id": company_id,
        "status": "pending",
        "source": payload.source or "application_modal",
        "applied_at": now_iso(),
        "submitted_at": now_iso(),
        "updated_at": now_iso(),
        "cover_letter": payload.cover_letter,
        "cv_document_id": payload.cv_document_id,
        "cv_snapshot": cv_snapshot,
        "candidate_profile_snapshot": candidate_profile_snapshot,
        "jcfpm_share_level": requested_share_level,
        "shared_jcfpm_payload": shared_jcfpm_payload,
        "application_payload": application_payload,
    }
    try:
        res = supabase.table("job_applications").insert(insert_payload).execute()
        app_id = None
        row = None
        if res.data:
            app_id = res.data[0].get("id")
            row = res.data[0]
        return {"status": "created", "application_id": app_id, "application": _serialize_application_dossier(row or insert_payload)}
    except Exception as exc:
        if any(_is_missing_column_error(exc, col) for col in [
            "source",
            "submitted_at",
            "updated_at",
            "cover_letter",
            "cv_document_id",
            "cv_snapshot",
            "candidate_profile_snapshot",
            "jcfpm_share_level",
            "shared_jcfpm_payload",
            "application_payload",
        ]):
            try:
                fallback_payload = {
                    "job_id": job_id,
                    "candidate_id": user_id,
                    "company_id": company_id,
                    "status": "pending",
                    "applied_at": now_iso(),
                }
                res = supabase.table("job_applications").insert(fallback_payload).execute()
                app_id = res.data[0].get("id") if res.data else None
                return {"status": "created", "application_id": app_id}
            except Exception as fallback_exc:
                print(f"⚠️ Fallback create application also failed: {fallback_exc}")
        print(f"⚠️ Failed to create application: {exc}")
        raise HTTPException(status_code=500, detail="Failed to create application")


@router.get("/company/applications")
@limiter.limit("60/minute")
async def list_company_applications(
    request: Request,
    company_id: str = Query(...),
    job_id: str | None = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    require_company_access(user, company_id)
    try:
        query = (
            supabase
            .table("job_applications")
            .select("*,jobs(id,title),profiles(id,full_name,email)")
            .eq("company_id", company_id)
            .order("submitted_at", desc=True)
            .limit(limit)
        )
        if job_id:
            query = query.eq("job_id", _normalize_job_id(job_id))
        resp = query.execute()
    except Exception as exc:
        if not _is_missing_column_error(exc, "submitted_at"):
            raise HTTPException(status_code=500, detail="Failed to load company applications")
        legacy_query = (
            supabase
            .table("job_applications")
            .select("*,jobs(id,title),profiles(id,full_name,email)")
            .eq("company_id", company_id)
            .order("applied_at", desc=True)
            .limit(limit)
        )
        if job_id:
            legacy_query = legacy_query.eq("job_id", _normalize_job_id(job_id))
        resp = legacy_query.execute()

    rows = resp.data or []
    out = []
    for row in rows:
        out.append(_serialize_company_application_row(row))

    return {"company_id": company_id, "applications": out}


@router.get("/company/applications/{application_id}")
@limiter.limit("60/minute")
async def get_company_application_detail(
    application_id: str,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        resp = (
            supabase
            .table("job_applications")
            .select("*,jobs(id,title),profiles(id,full_name,email)")
            .eq("id", application_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        if not any(_is_missing_column_error(exc, col) for col in [
            "source",
            "reviewed_at",
            "reviewed_by",
            "cover_letter",
            "cv_document_id",
            "cv_snapshot",
            "candidate_profile_snapshot",
            "jcfpm_share_level",
            "shared_jcfpm_payload",
            "application_payload",
        ]):
            raise HTTPException(status_code=500, detail="Failed to load application detail")
        resp = (
            supabase
            .table("job_applications")
            .select("*,jobs(id,title),profiles(id,full_name,email)")
            .eq("id", application_id)
            .maybe_single()
            .execute()
        )
    row = resp.data if resp else None
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    require_company_access(user, str(row.get("company_id") or ""))
    return {"application": _serialize_application_dossier(row)}


@router.patch("/company/applications/{application_id}/status")
@limiter.limit("60/minute")
async def update_company_application_status(
    application_id: str,
    payload: JobApplicationStatusUpdateRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    resp = (
        supabase
        .table("job_applications")
        .select("id,company_id")
        .eq("id", application_id)
        .maybe_single()
        .execute()
    )
    row = resp.data if resp else None
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")

    require_company_access(user, str(row.get("company_id") or ""))

    try:
        try:
            supabase.table("job_applications").update({"status": payload.status, "updated_at": now_iso(), "reviewed_at": now_iso()}).eq("id", application_id).execute()
        except Exception as exc:
            if _is_missing_column_error(exc, "updated_at") or _is_missing_column_error(exc, "reviewed_at"):
                supabase.table("job_applications").update({"status": payload.status}).eq("id", application_id).execute()
            else:
                raise
    except Exception as exc:
        print(f"⚠️ Failed to update application status: {exc}")
        raise HTTPException(status_code=500, detail="Failed to update application status")

    _write_company_activity_log(
        company_id=str(row.get("company_id") or ""),
        event_type="application_status_changed",
        payload={
            "application_id": application_id,
            "status": payload.status,
        },
        actor_user_id=user.get("id") or user.get("auth_id"),
        subject_type="application",
        subject_id=application_id,
    )

    return {"status": "success"}


@router.get("/company/schema/rollout-status")
@limiter.limit("60/minute")
async def get_company_rollout_schema_status(
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    job_applications = _probe_schema_select(
        "job_applications",
        "id,source,submitted_at,updated_at,cover_letter,cv_document_id,cv_snapshot,candidate_profile_snapshot,jcfpm_share_level,shared_jcfpm_payload,application_payload,reviewed_at,reviewed_by"
    )
    job_drafts = _probe_schema_select(
        "job_drafts",
        "id,job_id,status,title,updated_at"
    )
    job_versions = _probe_schema_select(
        "job_versions",
        "id,job_id,version_number,published_at"
    )

    return {
        "checked_at": now_iso(),
        "all_ready": bool(job_applications.get("ready") and job_drafts.get("ready") and job_versions.get("ready")),
        "job_applications": job_applications,
        "job_drafts": job_drafts,
        "job_versions": job_versions,
        "requested_by": user.get("id") or user.get("auth_id"),
    }


@router.get("/company/activity-log")
@limiter.limit("60/minute")
async def list_company_activity_log(
    request: Request,
    company_id: str = Query(...),
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    require_company_access(user, company_id)
    try:
        resp = (
            supabase
            .table("company_activity_log")
            .select("*")
            .eq("company_id", company_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception as exc:
        if _is_missing_table_error(exc, "company_activity_log"):
            raise HTTPException(status_code=409, detail="Company activity log unavailable")
        raise HTTPException(status_code=500, detail="Failed to load company activity log")

    rows = resp.data or []
    return {
        "company_id": company_id,
        "events": [_serialize_company_activity_event(row) for row in rows],
    }


@router.post("/company/activity-log")
@limiter.limit("60/minute")
async def create_company_activity_log_event(
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")

    company_id = str(body.get("company_id") or "").strip()
    event_type = str(body.get("event_type") or "").strip()
    if not company_id or not event_type:
        raise HTTPException(status_code=400, detail="company_id and event_type are required")

    require_company_access(user, company_id)

    payload = body.get("payload")
    insert_payload = {
        "company_id": company_id,
        "event_type": event_type,
        "subject_type": str(body.get("subject_type") or "").strip() or None,
        "subject_id": str(body.get("subject_id") or "").strip() or None,
        "payload": payload if isinstance(payload, dict) else {},
        "actor_user_id": user.get("id") or user.get("auth_id"),
    }

    try:
        resp = (
            supabase
            .table("company_activity_log")
            .insert(insert_payload)
            .select("*")
            .single()
            .execute()
        )
    except Exception as exc:
        if _is_missing_table_error(exc, "company_activity_log"):
            raise HTTPException(status_code=409, detail="Company activity log unavailable")
        raise HTTPException(status_code=500, detail="Failed to write company activity log")

    row = resp.data if resp else None
    if not row:
        raise HTTPException(status_code=500, detail="Failed to write company activity log")
    return {"event": _serialize_company_activity_event(row)}


@router.post("/company/job-drafts")
@limiter.limit("60/minute")
async def create_company_job_draft(
    payload: JobDraftUpsertRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    company_id = require_company_access(user, user.get("company_id"))
    user_id = user.get("id") or user.get("auth_id")
    body = payload.dict(exclude_none=True)
    insert_payload = {
        "company_id": company_id,
        "created_by": user_id,
        "updated_by": user_id,
        **body,
    }
    resp = supabase.table("job_drafts").insert(insert_payload).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to create job draft")
    draft = resp.data[0]
    draft["quality_report"] = _draft_to_validation_report(draft)
    return {"draft": draft}


@router.get("/company/job-drafts")
@limiter.limit("60/minute")
async def list_company_job_drafts(
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    company_id = require_company_access(user, user.get("company_id"))
    resp = (
        supabase
        .table("job_drafts")
        .select("*")
        .eq("company_id", company_id)
        .order("updated_at", desc=True)
        .limit(200)
        .execute()
    )
    drafts = resp.data or []
    return {"drafts": drafts}


@router.get("/company/job-drafts/{draft_id}")
@limiter.limit("60/minute")
async def get_company_job_draft(
    draft_id: str,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    resp = supabase.table("job_drafts").select("*").eq("id", draft_id).maybe_single().execute()
    draft = resp.data if resp else None
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    require_company_access(user, str(draft.get("company_id") or ""))
    if not draft.get("quality_report"):
        draft["quality_report"] = _draft_to_validation_report(draft)
    return {"draft": draft}


@router.patch("/company/job-drafts/{draft_id}")
@limiter.limit("60/minute")
async def update_company_job_draft(
    draft_id: str,
    payload: JobDraftUpsertRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    current_resp = supabase.table("job_drafts").select("*").eq("id", draft_id).maybe_single().execute()
    current = current_resp.data if current_resp else None
    if not current:
        raise HTTPException(status_code=404, detail="Draft not found")
    require_company_access(user, str(current.get("company_id") or ""))
    body = payload.dict(exclude_none=True)
    next_draft = {**current, **body}
    next_quality = _draft_to_validation_report(next_draft)
    update_payload = {
        **body,
        "updated_by": user.get("id") or user.get("auth_id"),
        "updated_at": now_iso(),
        "quality_report": next_quality,
    }
    resp = supabase.table("job_drafts").update(update_payload).eq("id", draft_id).execute()
    draft = (resp.data or [None])[0] or {**next_draft, **update_payload}
    draft["quality_report"] = next_quality
    return {"draft": draft}


@router.post("/company/job-drafts/{draft_id}/validate")
@limiter.limit("60/minute")
async def validate_company_job_draft(
    draft_id: str,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    current_resp = supabase.table("job_drafts").select("*").eq("id", draft_id).maybe_single().execute()
    draft = current_resp.data if current_resp else None
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    require_company_access(user, str(draft.get("company_id") or ""))
    report = _draft_to_validation_report(draft)
    try:
        supabase.table("job_drafts").update({
            "quality_report": report,
            "status": "ready_for_publish" if not report["blockingIssues"] else draft.get("status") or "draft",
            "updated_at": now_iso(),
        }).eq("id", draft_id).execute()
    except Exception:
        pass
    return {"validation": report}


@router.post("/company/job-drafts/{draft_id}/publish")
@limiter.limit("30/minute")
async def publish_company_job_draft(
    draft_id: str,
    payload: JobDraftPublishRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    current_resp = supabase.table("job_drafts").select("*").eq("id", draft_id).maybe_single().execute()
    draft = current_resp.data if current_resp else None
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    company_id = require_company_access(user, str(draft.get("company_id") or ""))
    validation = _draft_to_validation_report(draft)
    if validation["blockingIssues"]:
        raise HTTPException(status_code=400, detail={"validation": validation})

    company_name = "Company"
    try:
        company_resp = supabase.table("companies").select("name").eq("id", company_id).maybe_single().execute()
        company_name = str((company_resp.data or {}).get("name") or company_name)
    except Exception:
        pass

    job_payload = {
        "title": draft.get("title"),
        "company": company_name,
        "description": _compose_job_description_from_draft(draft),
        "location": draft.get("location_public") or draft.get("workplace_address") or "Location not specified",
        "salary_from": draft.get("salary_from"),
        "salary_to": draft.get("salary_to"),
        "salary_currency": draft.get("salary_currency") or "CZK",
        "salary_timeframe": draft.get("salary_timeframe") or "month",
        "benefits": _safe_string_list(draft.get("benefits_structured"), limit=50),
        "contact_email": draft.get("contact_email"),
        "workplace_address": draft.get("workplace_address"),
        "company_id": company_id,
        "contract_type": draft.get("contract_type"),
        "work_type": draft.get("work_model"),
        "source": "jobshaman.cz",
        "scraped_at": now_iso(),
    }

    existing_job_id = _normalize_job_id(draft.get("job_id"))
    job_id = existing_job_id
    if job_id:
        _require_job_access(user, str(job_id))
        job_resp = supabase.table("jobs").update(job_payload).eq("id", job_id).execute()
        job_row = (job_resp.data or [None])[0] or {"id": job_id}
    else:
        job_resp = supabase.table("jobs").insert(job_payload).execute()
        job_row = (job_resp.data or [None])[0]
        if not job_row:
            raise HTTPException(status_code=500, detail="Failed to publish draft")
        job_id = _normalize_job_id(job_row.get("id"))

    next_version = 1
    try:
        version_resp = (
            supabase
            .table("job_versions")
            .select("version_number")
            .eq("job_id", job_id)
            .order("version_number", desc=True)
            .limit(1)
            .execute()
        )
        if version_resp.data:
            next_version = int(version_resp.data[0].get("version_number") or 0) + 1
    except Exception:
        next_version = 1

    snapshot = {
        "title": job_payload["title"],
        "description": job_payload["description"],
        "location": job_payload["location"],
        "salary_from": job_payload["salary_from"],
        "salary_to": job_payload["salary_to"],
        "salary_currency": job_payload["salary_currency"],
        "salary_timeframe": job_payload["salary_timeframe"],
        "contract_type": job_payload["contract_type"],
        "work_type": job_payload["work_type"],
        "benefits": job_payload["benefits"],
        "source_draft_id": draft_id,
    }

    try:
        supabase.table("job_versions").insert({
            "job_id": job_id,
            "draft_id": draft_id,
            "version_number": next_version,
            "published_snapshot": snapshot,
            "change_summary": payload.change_summary,
            "published_by": user.get("id") or user.get("auth_id"),
            "published_at": now_iso(),
        }).execute()
    except Exception as exc:
        print(f"⚠️ Failed to persist job version: {exc}")

    try:
        supabase.table("job_drafts").update({
            "job_id": job_id,
            "status": "published_linked",
            "quality_report": validation,
            "updated_by": user.get("id") or user.get("auth_id"),
            "updated_at": now_iso(),
        }).eq("id", draft_id).execute()
    except Exception as exc:
        print(f"⚠️ Failed to update draft after publish: {exc}")

    _write_company_activity_log(
        company_id=company_id,
        event_type="job_updated" if existing_job_id else "job_published",
        payload={
            "job_id": str(job_id),
            "job_title": str(job_payload.get("title") or ""),
            "version_number": next_version,
        },
        actor_user_id=user.get("id") or user.get("auth_id"),
        subject_type="job",
        subject_id=str(job_id),
    )

    return {"status": "success", "job_id": job_id, "version_number": next_version, "validation": validation}


@router.post("/company/jobs/{job_id}/edit-draft")
@limiter.limit("30/minute")
async def create_edit_draft_from_job(
    job_id: str,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    job_row = _require_job_access(user, job_id)
    company_id = str(job_row.get("company_id") or "")
    source_resp = supabase.table("jobs").select("*").eq("id", _normalize_job_id(job_id)).maybe_single().execute()
    source = source_resp.data if source_resp else None
    if not source:
        raise HTTPException(status_code=404, detail="Job not found")
    benefits = source.get("benefits")
    if not isinstance(benefits, list):
        benefits = []
    draft_payload = {
        "company_id": company_id,
        "job_id": _normalize_job_id(job_id),
        "status": "draft",
        "title": source.get("title") or "",
        "role_summary": source.get("description") or "",
        "responsibilities": source.get("description") or "",
        "requirements": "",
        "nice_to_have": "",
        "benefits_structured": benefits,
        "salary_from": source.get("salary_from"),
        "salary_to": source.get("salary_to"),
        "salary_currency": source.get("salary_currency") or source.get("currency") or "CZK",
        "salary_timeframe": source.get("salary_timeframe") or "month",
        "contract_type": source.get("contract_type"),
        "work_model": source.get("work_type") or source.get("work_model"),
        "workplace_address": source.get("workplace_address") or source.get("location"),
        "location_public": source.get("location"),
        "contact_email": source.get("contact_email"),
        "created_by": user.get("id") or user.get("auth_id"),
        "updated_by": user.get("id") or user.get("auth_id"),
    }
    resp = supabase.table("job_drafts").insert(draft_payload).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to create edit draft")
    draft = resp.data[0]
    draft["quality_report"] = _draft_to_validation_report(draft)
    return {"draft": draft}


@router.get("/company/jobs/{job_id}/versions")
@limiter.limit("60/minute")
async def list_job_versions(
    job_id: str,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    _require_job_access(user, job_id)
    resp = (
        supabase
        .table("job_versions")
        .select("*")
        .eq("job_id", _normalize_job_id(job_id))
        .order("version_number", desc=True)
        .limit(50)
        .execute()
    )
    return {"versions": resp.data or []}


@router.post("/company/jobs/{job_id}/duplicate")
@limiter.limit("30/minute")
async def duplicate_job_into_draft(
    job_id: str,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    _require_job_access(user, job_id)
    source_resp = supabase.table("jobs").select("*").eq("id", _normalize_job_id(job_id)).maybe_single().execute()
    source = source_resp.data if source_resp else None
    if not source:
        raise HTTPException(status_code=404, detail="Job not found")
    company_id = str(source.get("company_id") or "")
    benefits = source.get("benefits")
    if not isinstance(benefits, list):
        benefits = []
    resp = supabase.table("job_drafts").insert({
        "company_id": company_id,
        "status": "draft",
        "title": f"{str(source.get('title') or '').strip()} (Copy)".strip(),
        "role_summary": source.get("description") or "",
        "responsibilities": source.get("description") or "",
        "requirements": "",
        "nice_to_have": "",
        "benefits_structured": benefits,
        "salary_from": source.get("salary_from"),
        "salary_to": source.get("salary_to"),
        "salary_currency": source.get("salary_currency") or source.get("currency") or "CZK",
        "salary_timeframe": source.get("salary_timeframe") or "month",
        "contract_type": source.get("contract_type"),
        "work_model": source.get("work_type") or source.get("work_model"),
        "workplace_address": source.get("workplace_address") or source.get("location"),
        "location_public": source.get("location"),
        "contact_email": source.get("contact_email"),
        "created_by": user.get("id") or user.get("auth_id"),
        "updated_by": user.get("id") or user.get("auth_id"),
    }).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to duplicate job into draft")
    draft = resp.data[0]
    draft["quality_report"] = _draft_to_validation_report(draft)
    return {"draft": draft}


@router.patch("/company/jobs/{job_id}/lifecycle")
@limiter.limit("30/minute")
async def update_company_job_lifecycle(
    job_id: str,
    payload: JobLifecycleUpdateRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    job_row = _require_job_access(user, job_id)
    supabase.table("jobs").update({"status": payload.status}).eq("id", _normalize_job_id(job_id)).execute()

    event_type = (
        "job_closed" if payload.status == "closed"
        else "job_paused" if payload.status == "paused"
        else "job_archived" if payload.status == "archived"
        else "job_reopened"
    )
    _write_company_activity_log(
        company_id=str(job_row.get("company_id") or ""),
        event_type=event_type,
        payload={
            "job_id": str(job_row.get("id") or job_id),
            "job_title": str(job_row.get("title") or ""),
            "previous_status": str(job_row.get("status") or "active"),
            "next_status": payload.status,
        },
        actor_user_id=user.get("id") or user.get("auth_id"),
        subject_type="job",
        subject_id=str(job_row.get("id") or job_id),
    )
    return {"status": "success"}


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
    request_id = str(uuid4())

    exposure_rows = []
    enriched_matches = []
    for idx, item in enumerate(matches):
        job = item.get("job") or {}
        job_id = job.get("id")
        if not job_id:
            continue
        position = int(item.get("position") or (idx + 1))
        score = float(item.get("score") or 0.0)
        model_version = item.get("model_version") or "career-os-v2"
        scoring_version = item.get("scoring_version") or "scoring-v1"

        exposure_rows.append(
            {
                "request_id": request_id,
                "user_id": user_id,
                "job_id": job_id,
                "position": position,
                "score": score,
                "predicted_action_probability": float(item.get("action_probability") or 0.0),
                "action_model_version": item.get("action_model_version") or None,
                "ranking_strategy": (item.get("breakdown") or {}).get("selection_strategy"),
                "is_new_job": bool((item.get("breakdown") or {}).get("is_new_job")),
                "model_version": model_version,
                "scoring_version": scoring_version,
                "source": "recommendations_api",
            }
        )
        enriched_matches.append(
            {
                **item,
                "position": position,
                "request_id": request_id,
            }
        )

    if exposure_rows:
        try:
            supabase.table("recommendation_exposures").upsert(
                exposure_rows, on_conflict="request_id,user_id,job_id"
            ).execute()
        except Exception as exp_exc:
            print(f"⚠️ Failed to write recommendation exposures: {exp_exc}")

    return {"jobs": enriched_matches, "request_id": request_id}


@router.post("/jobs/recommendations/warmup")
@limiter.limit("15/minute")
async def warmup_job_recommendations(
    request: Request,
    background_tasks: BackgroundTasks,
    limit: int = Query(80, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    background_tasks.add_task(
        recommend_jobs_for_user,
        user_id=user_id,
        limit=limit,
        allow_cache=True,
    )

    return {"status": "scheduled", "limit": limit}


@router.post("/jobs/hybrid-search")
@limiter.limit("60/minute")
async def jobs_hybrid_search(
    payload: HybridJobSearchRequest,
    request: Request,
):
    user_id = _try_get_optional_user_id(request)
    dismissed_job_ids: set[str] = set()
    if user_id:
        _, dismissed = _fetch_user_interaction_state(user_id, limit=12000)
        dismissed_job_ids = set(dismissed)

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
    if dismissed_job_ids:
        jobs = result.get("jobs") or []
        filtered_jobs = _filter_out_dismissed_jobs(jobs, dismissed_job_ids)
        result["jobs"] = filtered_jobs
        result["has_more"] = bool(result.get("has_more")) or (len(filtered_jobs) < len(jobs))
        result["total_count"] = max(len(filtered_jobs), int(result.get("total_count") or 0) - (len(jobs) - len(filtered_jobs)))
    return result


@router.post("/jobs/hybrid-search-v2")
@limiter.limit("90/minute")
async def jobs_hybrid_search_v2(
    payload: HybridJobSearchV2Request,
    request: Request,
):
    user_id = _try_get_optional_user_id(request)
    dismissed_job_ids: set[str] = set()
    if user_id:
        _, dismissed = _fetch_user_interaction_state(user_id, limit=12000)
        dismissed_job_ids = set(dismissed)
    request_id = str(uuid4())
    result = hybrid_search_jobs_v2(
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
            "sort_mode": payload.sort_mode,
        },
        page=payload.page,
        page_size=payload.page_size,
        user_id=user_id,
    )

    jobs = result.get("jobs") or []
    if dismissed_job_ids:
        filtered_jobs = _filter_out_dismissed_jobs(jobs, dismissed_job_ids)
        removed_count = len(jobs) - len(filtered_jobs)
        jobs = filtered_jobs
    else:
        removed_count = 0
    exposures = []
    for idx, job in enumerate(jobs):
        job_id = job.get("id")
        if not job_id:
            continue
        exposures.append(
            {
                "request_id": request_id,
                "user_id": user_id,
                "job_id": job_id,
                "position": int(job.get("rank_position") or (idx + 1)),
                "query": payload.search_term or "",
                "filters_json": {
                    "sort_mode": payload.sort_mode,
                    "filter_city": payload.filter_city,
                    "filter_date_posted": payload.filter_date_posted,
                    "filter_country_codes": payload.filter_country_codes,
                    "exclude_country_codes": payload.exclude_country_codes,
                    "filter_language_codes": payload.filter_language_codes,
                    "radius_km": payload.radius_km,
                },
                "ranking_features_json": {
                    "hybrid_score": job.get("hybrid_score"),
                    "fts_score": job.get("fts_score"),
                    "trigram_score": job.get("trigram_score"),
                    "profile_fit_score": job.get("profile_fit_score"),
                    "recency_score": job.get("recency_score"),
                    "behavior_prior_score": job.get("behavior_prior_score"),
                },
            }
        )
    global _SEARCH_EXPOSURES_AVAILABLE, _SEARCH_EXPOSURES_WARNING_EMITTED
    if exposures and _SEARCH_EXPOSURES_AVAILABLE:
        exposure_write_started = datetime.now(timezone.utc)
        try:
            supabase.table("search_exposures").upsert(exposures, on_conflict="request_id,job_id").execute()
            exposure_write_ms = int((datetime.now(timezone.utc) - exposure_write_started).total_seconds() * 1000)
            print(
                f"📊 [Hybrid Search V2] exposures_upsert_ok request_id={request_id} "
                f"rows={len(exposures)} write_ms={exposure_write_ms}"
            )
        except Exception as exc:
            exposure_write_ms = int((datetime.now(timezone.utc) - exposure_write_started).total_seconds() * 1000)
            if _is_missing_table_error(exc, "search_exposures"):
                _SEARCH_EXPOSURES_AVAILABLE = False
                if not _SEARCH_EXPOSURES_WARNING_EMITTED:
                    print("⚠️ search_exposures table missing. Disabling search exposure writes.")
                    _SEARCH_EXPOSURES_WARNING_EMITTED = True
            else:
                print(
                    f"⚠️ Failed to write search exposures (request_id={request_id}, "
                    f"rows={len(exposures)}, write_ms={exposure_write_ms}): {exc}"
                )

    meta = result.get("meta") or {}
    response = {
        "jobs": jobs,
        "has_more": result.get("has_more", False),
        "total_count": max(len(jobs), int(result.get("total_count", 0)) - removed_count),
        "request_id": request_id,
        "meta": {
            "sort_mode": payload.sort_mode,
            "latency_ms": meta.get("latency_ms"),
            "fallback": meta.get("fallback"),
            "fallback_reason": meta.get("fallback_reason"),
            "effective_page_size": meta.get("effective_page_size"),
            "requested_page_size": meta.get("requested_page_size"),
            "cooldown_active": meta.get("cooldown_active"),
            "cooldown_until": meta.get("cooldown_until"),
            "result_count": len(jobs),
            "dismissed_filtered_count": removed_count,
        },
    }
    if payload.debug:
        response["meta"]["debug"] = {
            "user_id_present": bool(user_id),
            "engine_meta": meta,
        }
    return response

@router.post("/jobs/analyze")
@limiter.limit("20/minute")
async def analyze_job(
    payload: JobAnalyzeRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    allowed_tiers = {"premium"}
    if not _user_has_allowed_subscription(user, allowed_tiers):
        raise HTTPException(status_code=403, detail="Premium subscription required")

    normalized_job_id = _normalize_job_id(payload.job_id) if payload.job_id else None

    # Cache fast path: return already saved analysis from jobs.ai_analysis
    if normalized_job_id is not None:
        try:
            cached = (
                supabase
                .table("jobs")
                .select("id, ai_analysis")
                .eq("id", normalized_job_id)
                .maybe_single()
                .execute()
            )
            ai_cached = (cached.data or {}).get("ai_analysis") if cached and cached.data else None
            if isinstance(ai_cached, dict) and ai_cached.get("summary"):
                return {"analysis": ai_cached, "cached": True}
        except Exception as exc:
            print(f"⚠️ Failed to read cached ai_analysis for job {normalized_job_id}: {exc}")

    default_primary = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    default_fallback = os.getenv("OPENAI_FALLBACK_MODEL", "gpt-4.1-nano")
    cfg = get_active_model_config("ai_orchestration", "job_analysis")
    primary_model = cfg.get("primary_model") or default_primary
    fallback_model = cfg.get("fallback_model") or default_fallback
    generation_config = {
        "temperature": cfg.get("temperature", 0),
        "top_p": cfg.get("top_p", 1),
        "top_k": cfg.get("top_k", 1),
    }
    prompt = _job_analysis_prompt(payload.description, payload.title, payload.language or "cs")

    try:
        result, fallback_used = call_primary_with_fallback(
            prompt,
            primary_model,
            fallback_model,
            generation_config=generation_config,
        )
        parsed = _extract_json(result.text)
        analysis = _coerce_job_analysis_payload(parsed)
    except AIClientError as exc:
        raise HTTPException(status_code=503, detail=f"AI provider unavailable: {str(exc)}")
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f"AI response invalid: {str(exc)}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI processing failed: {str(exc)}")

    if normalized_job_id is not None:
        try:
            supabase.table("jobs").update({"ai_analysis": analysis}).eq("id", normalized_job_id).execute()
        except Exception as exc:
            print(f"⚠️ Failed to persist ai_analysis for job {normalized_job_id}: {exc}")

    return {
        "analysis": analysis,
        "cached": False,
        "meta": {
            "model_used": result.model_name,
            "fallback_used": fallback_used,
            "token_usage": {"input": result.tokens_in, "output": result.tokens_out},
            "latency_ms": result.latency_ms,
        },
    }

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
