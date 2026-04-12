from typing import Any
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from ..core.database import supabase
from ..core.limiter import limiter
from ..core.security import get_current_user, require_company_access, verify_csrf_token_header, verify_subscription
from ..models.requests import JobDraftPublishRequest, JobDraftUpsertRequest, JobLifecycleUpdateRequest
from ..services.jobs_postgres_store import list_company_jobs, update_job_fields
from ..services.email import send_email
from ..utils.helpers import now_iso
from .jobs import (
    _build_job_human_context_editor_state,
    _build_public_activity_payload,
    _build_role_activity_payload,
    _compose_job_description_from_draft,
    _draft_to_validation_report,
    _enforce_company_job_publish_limit,
    _enforce_company_role_open_limit,
    _extract_job_description_metadata,
    _fetch_company_member_rows,
    _fetch_company_public_member_ids,
    _fetch_company_team_context,
    _fetch_profiles_map,
    _generate_native_job_id,
    _get_draft_micro_job_state,
    _increment_company_role_opens_usage,
    _is_missing_column_error,
    _is_missing_table_error,
    _normalize_company_activity_payload,
    _normalize_job_id,
    _probe_schema_select,
    _read_company_team_member_profile,
    _read_job_record,
    _require_job_access,
    _safe_dict,
    _safe_string_list,
    _serialize_company_activity_event,
    _serialize_role_record,
    _sync_company_active_jobs_usage,
    _sync_job_public_people,
    _sync_main_job_shadow_to_supabase,
    _sync_main_job_to_jobs_postgres,
    _trimmed_text,
    _write_company_activity_log,
)


class TeamInvitationRequest(BaseModel):
    company_id: str
    email: str
    name: str
    role: str  # 'recruiter' | 'admin'


router = APIRouter()


@router.post("/company/roles")
@limiter.limit("60/minute")
async def create_company_role(
    payload: JobDraftUpsertRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    response = await create_company_job_draft(payload=payload, request=request, user=user)
    return {"role": _serialize_role_record(response.get("draft"))}


@router.get("/company/roles")
@limiter.limit("60/minute")
async def list_company_roles(
    request: Request,
    user: dict = Depends(verify_subscription),
):
    response = await list_company_job_drafts(request=request, user=user)
    rows = response.get("drafts") or []
    return {"roles": [_serialize_role_record(row) for row in rows if isinstance(row, dict)]}


@router.get("/company/jobs/published")
@limiter.limit("60/minute")
async def list_company_published_jobs(
    request: Request,
    user: dict = Depends(verify_subscription),
    limit: int = Query(200, ge=1, le=1000),
):
    company_id = str(user.get("company_id") or "").strip()
    if not company_id:
        raise HTTPException(status_code=400, detail="Company account required")
    rows = list_company_jobs(company_id=company_id, limit=limit)
    return {"jobs": rows}


@router.get("/company/roles/{role_id}")
@limiter.limit("60/minute")
async def get_company_role(
    role_id: str,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    response = await get_company_job_draft(draft_id=role_id, request=request, user=user)
    return {"role": _serialize_role_record(response.get("draft"))}


@router.patch("/company/roles/{role_id}")
@limiter.limit("60/minute")
async def update_company_role(
    role_id: str,
    payload: JobDraftUpsertRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    response = await update_company_job_draft(draft_id=role_id, payload=payload, request=request, user=user)
    return {"role": _serialize_role_record(response.get("draft"))}


@router.post("/company/roles/{role_id}/validate")
@limiter.limit("60/minute")
async def validate_company_role(
    role_id: str,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    return await validate_company_job_draft(draft_id=role_id, request=request, user=user)


@router.post("/company/roles/{role_id}/publish")
@limiter.limit("30/minute")
async def publish_company_role(
    role_id: str,
    payload: JobDraftPublishRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    response = await publish_company_job_draft(draft_id=role_id, payload=payload, request=request, user=user)
    if isinstance(response, dict):
        response = dict(response)
        response["role_id"] = str(role_id)
        if response.get("job_id") is not None and response.get("published_job_id") is None:
            response["published_job_id"] = response.get("job_id")
    return response


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


@router.get("/activity/public")
@limiter.limit("120/minute")
async def get_public_activity_feed(
    request: Request,
    limit: int = Query(5, ge=1, le=10),
    lang: str = Query("en"),
):
    return _build_public_activity_payload(lang, limit=limit)


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
        "payload": _normalize_company_activity_payload(event_type, payload if isinstance(payload, dict) else {}),
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


@router.get("/company/human-context/people")
@limiter.limit("60/minute")
async def list_company_human_context_people(
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    company_id = require_company_access(user, user.get("company_id"))
    owner_id, team_profiles = _fetch_company_team_context(company_id)
    member_rows = _fetch_company_member_rows(company_id)
    user_ids = _fetch_company_public_member_ids(company_id)
    profiles_by_id = _fetch_profiles_map(user_ids)

    people: list[dict[str, Any]] = []
    meta_by_user_id: dict[str, dict[str, Any]] = {}
    if owner_id:
        meta_by_user_id[owner_id] = _read_company_team_member_profile(
            team_profiles,
            member_id=owner_id,
            user_id=owner_id,
            source="owner",
        )
    for row in member_rows:
        user_id = _trimmed_text((row or {}).get("user_id"), 120)
        if not user_id:
            continue
        source = "owner" if owner_id and user_id == owner_id else "member"
        meta_by_user_id[user_id] = _read_company_team_member_profile(
            team_profiles,
            member_id=_trimmed_text((row or {}).get("id"), 120),
            user_id=user_id,
            source=source,
        )

    for user_id in sorted(user_ids):
        profile = profiles_by_id.get(user_id, {})
        display_name = _trimmed_text(profile.get("full_name") or profile.get("email") or "Team member", 120)
        if not display_name:
            continue
        meta = meta_by_user_id.get(user_id, {})
        people.append({
            "user_id": user_id,
            "display_name": display_name,
            "avatar_url": _trimmed_text(profile.get("avatar_url"), 500) or None,
            "email": _trimmed_text(profile.get("email") or meta.get("invited_email"), 180) or None,
            "display_role": _trimmed_text(meta.get("company_role"), 120) or None,
            "short_context": _trimmed_text(meta.get("short_bio"), 280) or None,
        })

    people.sort(key=lambda row: (str(row.get("display_name") or "").lower(), str(row.get("email") or "").lower()))
    return {"people": people}


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
    company_goal = body.get("company_goal")
    insert_payload = {
        "company_id": company_id,
        "created_by": user_id,
        "updated_by": user_id,
        **body,
    }
    try:
        resp = supabase.table("job_drafts").insert(insert_payload).execute()
    except Exception as exc:
        if _is_missing_column_error(exc, "company_goal"):
            fallback_body = dict(body)
            fallback_body.pop("company_goal", None)
            editor_state = _safe_dict(fallback_body.get("editor_state"))
            handshake = _safe_dict(editor_state.get("handshake"))
            if company_goal is not None:
                handshake["company_goal"] = str(company_goal)[:4000]
            editor_state["handshake"] = handshake
            fallback_body["editor_state"] = editor_state
            fallback_insert = {
                "company_id": company_id,
                "created_by": user_id,
                "updated_by": user_id,
                **fallback_body,
            }
            resp = supabase.table("job_drafts").insert(fallback_insert).execute()
        else:
            raise
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
    company_goal = body.get("company_goal")
    next_draft = {**current, **body}
    next_quality = _draft_to_validation_report(next_draft)
    update_payload = {
        **body,
        "updated_by": user.get("id") or user.get("auth_id"),
        "updated_at": now_iso(),
        "quality_report": next_quality,
    }
    try:
        resp = supabase.table("job_drafts").update(update_payload).eq("id", draft_id).execute()
    except Exception as exc:
        if _is_missing_column_error(exc, "company_goal"):
            fallback_payload = dict(update_payload)
            fallback_payload.pop("company_goal", None)
            editor_state = _safe_dict(fallback_payload.get("editor_state") or current.get("editor_state"))
            handshake = _safe_dict(editor_state.get("handshake"))
            if company_goal is not None:
                handshake["company_goal"] = str(company_goal)[:4000]
            editor_state["handshake"] = handshake
            fallback_payload["editor_state"] = editor_state
            resp = supabase.table("job_drafts").update(fallback_payload).eq("id", draft_id).execute()
        else:
            raise
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
    micro_job = _get_draft_micro_job_state(draft)
    is_micro_job = micro_job.get("challenge_format") == "micro_job"
    handshake = _safe_dict(_safe_dict(draft.get("editor_state")).get("handshake"))
    company_goal = str(draft.get("company_goal") or handshake.get("company_goal") or "").strip() or None
    actor_user_id = user.get("id") or user.get("auth_id")
    existing_job_id = _normalize_job_id(draft.get("job_id"))
    existing_job_row = _read_job_record(existing_job_id) if existing_job_id else None
    now = now_iso()

    job_payload = {
        "title": draft.get("title"),
        "company": company_name,
        "description": _compose_job_description_from_draft(draft),
        "location": draft.get("location_public") or draft.get("workplace_address") or "Location not specified",
        "salary_from": draft.get("salary_from"),
        "salary_to": draft.get("salary_to"),
        "salary_currency": draft.get("salary_currency") or "CZK",
        "salary_timeframe": "project_total" if is_micro_job else (draft.get("salary_timeframe") or "month"),
        "benefits": [] if is_micro_job else _safe_string_list(draft.get("benefits_structured"), limit=50),
        "contact_email": draft.get("contact_email"),
        "workplace_address": draft.get("workplace_address"),
        "company_id": company_id,
        "posted_by": actor_user_id,
        "recruiter_id": actor_user_id,
        "company_goal": company_goal,
        "contract_type": None if is_micro_job else draft.get("contract_type"),
        "work_type": draft.get("work_model"),
        "work_model": draft.get("work_model"),
        "currency": draft.get("salary_currency") or "CZK",
        "source": "jobshaman.cz",
        "source_kind": "native",
        "status": "active",
        "is_active": True,
        "legality_status": existing_job_row.get("legality_status") if isinstance(existing_job_row, dict) and existing_job_row.get("legality_status") else "legal",
        "created_at": (existing_job_row or {}).get("created_at") or now,
        "updated_at": now,
        "scraped_at": now,
    }

    if not existing_job_id:
        _enforce_company_role_open_limit(company_id, user)
    _enforce_company_job_publish_limit(company_id, user, existing_job_id=existing_job_id)
    job_id = existing_job_id or _generate_native_job_id()
    if existing_job_id:
        _require_job_access(user, str(job_id))

    job_row = dict(existing_job_row or {})
    job_row.update(job_payload)
    job_row["id"] = job_id
    job_row["company_id"] = company_id
    _sync_main_job_to_jobs_postgres(job_row, source_kind="native")
    _sync_main_job_shadow_to_supabase(job_row, create_if_missing=True)

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
        "company_goal": company_goal,
        "location": job_payload["location"],
        "salary_from": job_payload["salary_from"],
        "salary_to": job_payload["salary_to"],
        "salary_currency": job_payload["salary_currency"],
        "salary_timeframe": job_payload["salary_timeframe"],
        "contract_type": job_payload["contract_type"],
        "work_type": job_payload["work_type"],
        "benefits": job_payload["benefits"],
        "challenge_format": micro_job.get("challenge_format"),
        "micro_job_kind": micro_job.get("kind"),
        "micro_job_time_estimate": micro_job.get("time_estimate"),
        "micro_job_collaboration_modes": micro_job.get("collaboration_modes"),
        "micro_job_long_term_potential": micro_job.get("long_term_potential"),
        "source_draft_id": draft_id,
    }

    try:
        supabase.table("job_versions").insert({
            "job_id": job_id,
            "draft_id": draft_id,
            "version_number": next_version,
            "published_snapshot": snapshot,
            "change_summary": payload.change_summary,
            "published_by": actor_user_id,
            "published_at": now,
        }).execute()
    except Exception as exc:
        print(f"⚠️ Failed to persist job version: {exc}")

    try:
        supabase.table("job_drafts").update({
            "job_id": job_id,
            "status": "published_linked",
            "quality_report": validation,
            "updated_by": actor_user_id,
            "updated_at": now,
        }).eq("id", draft_id).execute()
    except Exception as exc:
        print(f"⚠️ Failed to update draft after publish: {exc}")

    _sync_job_public_people(job_id=job_id, company_id=company_id, editor_state=draft.get("editor_state"))

    _write_company_activity_log(
        company_id=company_id,
        event_type="job_updated" if existing_job_id else "job_published",
        payload=_build_role_activity_payload(
            job_id=str(job_id),
            job_title=str(job_payload.get("title") or ""),
            version_number=next_version,
            next_status="active",
        ),
        actor_user_id=actor_user_id,
        subject_type="job",
        subject_id=str(job_id),
    )
    _sync_company_active_jobs_usage(company_id)
    if not existing_job_id:
        _increment_company_role_opens_usage(company_id)

    return {"status": "success", "job_id": job_id, "version_number": next_version, "validation": validation}


@router.post("/company/roles/{job_id}/edit-draft")
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
    source = _read_job_record(job_id)
    if not source:
        raise HTTPException(status_code=404, detail="Job not found")
    existing_human_context = _build_job_human_context_editor_state(job_id, company_id)
    description_metadata, cleaned_description = _extract_job_description_metadata(source.get("description"))
    benefits = source.get("benefits")
    if not isinstance(benefits, list):
        benefits = []
    draft_payload = {
        "company_id": company_id,
        "job_id": _normalize_job_id(job_id),
        "status": "draft",
        "title": source.get("title") or "",
        "role_summary": cleaned_description,
        "responsibilities": cleaned_description,
        "requirements": "",
        "nice_to_have": "",
        "benefits_structured": benefits,
        "salary_from": source.get("salary_from"),
        "salary_to": source.get("salary_to"),
        "salary_currency": source.get("salary_currency") or source.get("currency") or "CZK",
        "salary_timeframe": source.get("salary_timeframe") or ("project_total" if description_metadata.get("challenge_format") == "micro_job" else "month"),
        "contract_type": source.get("contract_type"),
        "work_model": source.get("work_type") or source.get("work_model"),
        "workplace_address": source.get("workplace_address") or source.get("location"),
        "location_public": source.get("location"),
        "contact_email": source.get("contact_email"),
        "editor_state": {
            "selected_section": "role_summary",
            "hiring_stage": description_metadata.get("hiring_stage") or "collecting_cvs",
            "micro_job": {
                "challenge_format": description_metadata.get("challenge_format") or "standard",
                "kind": description_metadata.get("kind"),
                "time_estimate": description_metadata.get("time_estimate"),
                "collaboration_modes": description_metadata.get("collaboration_modes") or [],
                "long_term_potential": description_metadata.get("long_term_potential"),
            },
            "human_context": existing_human_context,
        },
        "created_by": user.get("id") or user.get("auth_id"),
        "updated_by": user.get("id") or user.get("auth_id"),
    }
    resp = supabase.table("job_drafts").insert(draft_payload).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to create edit draft")
    draft = resp.data[0]
    draft["quality_report"] = _draft_to_validation_report(draft)
    return {"draft": draft}


@router.get("/company/roles/{job_id}/versions")
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


@router.post("/company/roles/{job_id}/duplicate")
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
    source = _read_job_record(job_id)
    if not source:
        raise HTTPException(status_code=404, detail="Job not found")
    company_id = str(source.get("company_id") or "")
    existing_human_context = _build_job_human_context_editor_state(job_id, company_id)
    description_metadata, cleaned_description = _extract_job_description_metadata(source.get("description"))
    benefits = source.get("benefits")
    if not isinstance(benefits, list):
        benefits = []
    resp = supabase.table("job_drafts").insert({
        "company_id": company_id,
        "status": "draft",
        "title": f"{str(source.get('title') or '').strip()} (Copy)".strip(),
        "role_summary": cleaned_description,
        "responsibilities": cleaned_description,
        "requirements": "",
        "nice_to_have": "",
        "benefits_structured": benefits,
        "salary_from": source.get("salary_from"),
        "salary_to": source.get("salary_to"),
        "salary_currency": source.get("salary_currency") or source.get("currency") or "CZK",
        "salary_timeframe": source.get("salary_timeframe") or ("project_total" if description_metadata.get("challenge_format") == "micro_job" else "month"),
        "contract_type": source.get("contract_type"),
        "work_model": source.get("work_type") or source.get("work_model"),
        "workplace_address": source.get("workplace_address") or source.get("location"),
        "location_public": source.get("location"),
        "contact_email": source.get("contact_email"),
        "editor_state": {
            "selected_section": "role_summary",
            "hiring_stage": description_metadata.get("hiring_stage") or "collecting_cvs",
            "micro_job": {
                "challenge_format": description_metadata.get("challenge_format") or "standard",
                "kind": description_metadata.get("kind"),
                "time_estimate": description_metadata.get("time_estimate"),
                "collaboration_modes": description_metadata.get("collaboration_modes") or [],
                "long_term_potential": description_metadata.get("long_term_potential"),
            },
            "human_context": existing_human_context,
        },
        "created_by": user.get("id") or user.get("auth_id"),
        "updated_by": user.get("id") or user.get("auth_id"),
    }).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to duplicate job into draft")
    draft = resp.data[0]
    draft["quality_report"] = _draft_to_validation_report(draft)
    return {"draft": draft}


@router.patch("/company/roles/{job_id}/lifecycle")
@router.patch("/company/jobs/{job_id}/lifecycle")
@limiter.limit("30/minute")
async def update_company_job_lifecycle(
    job_id: str,
    payload: JobLifecycleUpdateRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    job_row = _require_job_access(user, job_id)
    normalized_job_id = _normalize_job_id(job_id)
    patch = {
        "status": payload.status,
        "is_active": payload.status not in {"paused", "closed", "archived"},
        "updated_at": now_iso(),
    }
    try:
        update_job_fields(normalized_job_id, patch)
    except Exception:
        pass
    shadow_row = dict(job_row)
    shadow_row.update(patch)
    _sync_main_job_shadow_to_supabase(shadow_row, create_if_missing=False)

    event_type = (
        "job_closed" if payload.status == "closed"
        else "job_paused" if payload.status == "paused"
        else "job_archived" if payload.status == "archived"
        else "job_reopened"
    )
    _write_company_activity_log(
        company_id=str(job_row.get("company_id") or ""),
        event_type=event_type,
        payload=_build_role_activity_payload(
            job_id=str(job_id),
            job_title=str(job_row.get("title") or ""),
            previous_status=str(job_row.get("status") or ""),
            next_status=payload.status,
        ),
        actor_user_id=user.get("id") or user.get("auth_id"),
        subject_type="job",
        subject_id=str(job_id),
    )
    _sync_company_active_jobs_usage(str(job_row.get("company_id") or ""))
    return {"status": "success", "job_id": normalized_job_id, "next_status": payload.status}


@router.post("/companies/team/invite")
@limiter.limit("30/minute")
async def create_team_invitation(
    invitation_req: TeamInvitationRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    company_id = require_company_access(user, invitation_req.company_id)
    if not company_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    # Verify user is admin of the company
    user_id = user.get("id") or user.get("auth_id")
    try:
        admin_check = (
            supabase
            .table("company_members")
            .select("id, role")
            .eq("company_id", company_id)
            .eq("user_id", user_id)
            .execute()
        )
        is_admin = any(
            (m.get("role") == "admin")
            for m in (admin_check.data or [])
        )
        # Also allow company owners (they own the company row)
        if not is_admin:
            company_resp = supabase.table("companies").select("id").eq("id", company_id).eq("owner_id", user_id).maybe_single().execute()
            if company_resp.data:
                is_admin = True
    except Exception:
        # Fallback: if company_members table is not ready, check if user is in authorized_ids
        # and treat company owners as admins
        company_resp = supabase.table("companies").select("id").eq("id", company_id).eq("owner_id", user_id).maybe_single().execute()
        is_admin = bool(company_resp.data) if company_resp else False

    if not is_admin:
        raise HTTPException(status_code=403, detail="Only company admins can send team invitations")

    # Validate role
    role = invitation_req.role
    if role not in ("recruiter", "admin"):
        raise HTTPException(status_code=400, detail="Role must be 'recruiter' or 'admin'")

    # Generate invitation token
    invitation_token = secrets.token_urlsafe(32)

    # Check if an active invitation for this email already exists
    try:
        existing = (
            supabase
            .table("company_members")
            .select("id")
            .eq("company_id", company_id)
            .eq("invited_email", invitation_req.email)
            .eq("status", "invited")
            .execute()
        )
        if existing.data:
            raise HTTPException(status_code=409, detail="An invitation for this email already exists")
    except HTTPException:
        raise
    except Exception:
        pass  # Table or column might not exist yet, proceed anyway

    # Insert invitation into company_members
    insert_payload = {
        "company_id": company_id,
        "invited_email": invitation_req.email,
        "invited_name": invitation_req.name,
        "role": role,
        "invitation_token": invitation_token,
        "invited_at": now_iso(),
        "invited_by": user.get("id") or user.get("auth_id"),
        "status": "invited",
    }

    try:
        member_response = supabase.table("company_members").insert(insert_payload).execute()
    except Exception as exc:
        # Fallback if invited_email/invited_name/invitation_token/status columns don't exist yet
        if _is_missing_column_error(exc, "invited_email") or _is_missing_column_error(exc, "invitation_token"):
            fallback_payload = {
                "company_id": company_id,
                "role": role,
                "invited_at": now_iso(),
                "invited_by": user.get("id") or user.get("auth_id"),
            }
            member_response = supabase.table("company_members").insert(fallback_payload).execute()
        else:
            raise

    if not member_response.data:
        raise HTTPException(status_code=500, detail="Failed to create team invitation")

    invitation_id = member_response.data[0]["id"]

    # Get company name for the email
    company_name = "Company"
    try:
        company_resp = supabase.table("companies").select("name").eq("id", company_id).maybe_single().execute()
        company_name = str((company_resp.data or {}).get("name") or company_name)
    except Exception:
        pass

    # Send invitation email
    try:
        invite_link = f"https://jobshaman.cz/company/invite/{invitation_token}"
        send_email(
            to_email=invitation_req.email,
            subject=f"Team Invitation: Join {company_name} on JobShaman",
            html=f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
                <div style="background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
                    <h2 style="color: #0f172a; margin-bottom: 12px;">You've been invited to join {company_name}</h2>
                    <p style="color: #475569; line-height: 1.6;">
                        Hello <strong>{invitation_req.name}</strong>,<br><br>
                        You've been invited to join the <strong>{company_name}</strong> team on JobShaman 
                        as a <strong>{role}</strong>.<br><br>
                        Click the button below to accept the invitation:
                    </p>
                    <div style="margin: 24px 0;">
                        <a href="{invite_link}" style="display: inline-block; padding: 12px 20px; background-color: #0ea5e9; color: #ffffff; border-radius: 8px; text-decoration: none; font-weight: 600;">
                            Accept Invitation
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 14px;">
                        If you did not expect this invitation, you can safely ignore this email.
                    </p>
                </div>
                <div style="text-align: center; margin-top: 24px; color: #94a3b8; font-size: 12px;">&copy; 2024 JobShaman</div>
            </div>
            """,
        )
    except Exception:
        pass  # Don't fail the request if email sending fails

    return {"status": "success", "invitation_id": invitation_id, "token": invitation_token}


@router.get("/companies/team/invite/{token}")
async def get_team_invitation_details(token: str):
    """Verify an invitation token and return invitation details."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not available")

    # Look up the invitation by token
    try:
        inv_resp = (
            supabase
            .table("company_members")
            .select("id,company_id,invited_email,invited_name,role,status,invited_at")
            .eq("invitation_token", token)
            .single()
            .execute()
        )
    except Exception:
        # Try fallback if invitation_token column doesn't exist
        raise HTTPException(status_code=404, detail="Invitation not found")

    if not inv_resp.data:
        raise HTTPException(status_code=404, detail="Invitation not found")

    invitation = inv_resp.data

    # Get company name
    company_name = "Company"
    try:
        company_resp = supabase.table("companies").select("name").eq("id", invitation["company_id"]).maybe_single().execute()
        company_name = str((company_resp.data or {}).get("name") or company_name)
    except Exception:
        pass

    return {
        "invitation_id": invitation["id"],
        "company_id": invitation["company_id"],
        "company_name": company_name,
        "invited_email": invitation.get("invited_email", ""),
        "invited_name": invitation.get("invited_name", ""),
        "role": invitation.get("role", "recruiter"),
        "status": invitation.get("status", "invited"),
        "invited_at": invitation.get("invited_at"),
    }
