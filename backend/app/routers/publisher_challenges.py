from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from ..core.database import supabase
from ..core.limiter import limiter
from ..core.security import get_current_user, verify_csrf_token_header
from ..models.requests import (
    ApplicationMessageCreateRequest,
    JobApplicationStatusUpdateRequest,
    JobLifecycleUpdateRequest,
)
from ..services.dialogue_composer import build_dialogue_enrichment
from ..services.jobs_postgres_store import update_job_fields
from ..utils.helpers import now_iso
from .jobs import (
    _NATIVE_JOB_SOURCE,
    _build_closed_dialogue_payload,
    _build_profile_mini_challenge_description,
    _derive_profile_first_reply_prompt,
    _derive_profile_mini_challenge_label,
    _expire_dialogue_if_needed,
    _extract_attachment_asset_ids,
    _extract_job_description_metadata,
    _fetch_candidate_profile_for_draft,
    _fetch_profile_identity,
    _generate_native_job_id,
    _hydrate_rows_with_primary_jobs,
    _is_active_dialogue_status,
    _is_missing_column_error,
    _is_missing_table_error,
    _normalize_job_id,
    _normalize_micro_job_collaboration_modes,
    _normalize_micro_job_kind,
    _normalize_micro_job_long_term_potential,
    _normalize_micro_job_time_estimate,
    _normalize_profile_mini_challenge_reward,
    _parse_profile_mini_challenge_budget,
    _persist_dialogue_state,
    _require_dialogue_publisher_access,
    _require_job_access,
    _safe_dict,
    _sanitize_application_message_attachments,
    _schedule_dialogue_timeout,
    _serialize_application_dossier,
    _serialize_company_application_row,
    _serialize_dialogue_message,
    _serialize_dialogue_record,
    _sync_main_job_shadow_to_supabase,
    _sync_main_job_to_jobs_postgres,
    _trimmed_text,
)

router = APIRouter()


class ProfileMiniChallengeCreateRequest(BaseModel):
    title: str
    problem: str
    timeEstimate: str | None = None
    reward: str | None = None
    location: str | None = None
    first_reply_prompt: str | None = None
    micro_job_kind: str | None = None
    collaboration_modes: list[str] | None = None
    long_term_potential: str | None = None


@router.get("/publisher/mini-challenges")
@limiter.limit("60/minute")
async def list_publisher_mini_challenges(
    request: Request,
    limit: int = Query(80, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    user_id = str(user.get("id") or user.get("auth_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    resp = (
        supabase
        .table("jobs")
        .select("*")
        .eq("posted_by", user_id)
        .order("updated_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows = [row for row in (resp.data or []) if isinstance(row, dict)]
    published_rows: list[dict[str, Any]] = []
    job_ids: list[int] = []
    for row in rows:
        metadata, _cleaned = _extract_job_description_metadata(row.get("description"))
        if metadata.get("challenge_format") != "micro_job":
            continue
        normalized_job_id = _normalize_job_id(row.get("id"))
        repair_payload: dict[str, Any] = {}
        if str(row.get("legality_status") or "").strip().lower() != "legal":
            repair_payload["legality_status"] = "legal"
        if str(row.get("status") or "").strip().lower() == "active" and row.get("is_active") is not True:
            repair_payload["is_active"] = True
        if not str(row.get("source") or "").strip():
            repair_payload["source"] = _NATIVE_JOB_SOURCE
        if repair_payload and isinstance(normalized_job_id, int):
            repair_payload["updated_at"] = now_iso()
            try:
                try:
                    update_job_fields(normalized_job_id, repair_payload)
                except Exception:
                    pass
                shadow_row = dict(row)
                shadow_row.update(repair_payload)
                _sync_main_job_shadow_to_supabase(shadow_row, create_if_missing=False)
                row = shadow_row
            except Exception as exc:
                print(f"⚠️ Failed to repair publisher mini challenge visibility fields: {exc}")
        published_rows.append(row)
        if isinstance(normalized_job_id, int):
            job_ids.append(normalized_job_id)

    stats_by_job_id: dict[int, dict[str, int]] = {}
    if job_ids:
        try:
            applications_resp = (
                supabase
                .table("job_applications")
                .select("job_id,status")
                .in_("job_id", job_ids)
                .limit(max(200, len(job_ids) * 40))
                .execute()
            )
            for row in applications_resp.data or []:
                if not isinstance(row, dict):
                    continue
                normalized_job_id = _normalize_job_id(row.get("job_id"))
                if not isinstance(normalized_job_id, int):
                    continue
                stats = stats_by_job_id.setdefault(normalized_job_id, {"reply_count": 0, "open_dialogues_count": 0})
                stats["reply_count"] += 1
                if _is_active_dialogue_status(row.get("status")):
                    stats["open_dialogues_count"] += 1
        except Exception as exc:
            print(f"⚠️ Failed to load publisher mini challenge dialogue counts: {exc}")

    enriched_rows: list[dict[str, Any]] = []
    for row in published_rows:
        normalized_job_id = _normalize_job_id(row.get("id"))
        stats = stats_by_job_id.get(normalized_job_id if isinstance(normalized_job_id, int) else -1, {})
        enriched = dict(row)
        enriched["reply_count"] = int(stats.get("reply_count") or 0)
        enriched["open_dialogues_count"] = int(stats.get("open_dialogues_count") or 0)
        enriched_rows.append(enriched)

    return {"jobs": enriched_rows}


@router.post("/publisher/mini-challenges")
@limiter.limit("30/minute")
async def create_publisher_mini_challenge(
    payload: ProfileMiniChallengeCreateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    user_id = str(user.get("id") or user.get("auth_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    title = _trimmed_text(payload.title, 180)
    problem = _trimmed_text(payload.problem, 4000)
    if not title or not problem:
        raise HTTPException(status_code=400, detail="Title and problem are required.")

    candidate_profile = _fetch_candidate_profile_for_draft(user_id)
    profile_identity = _fetch_profile_identity(user_id)
    company_label, contact_email = _derive_profile_mini_challenge_label(user, candidate_profile, profile_identity)
    reward = _normalize_profile_mini_challenge_reward(payload.reward)
    salary_from, salary_to = _parse_profile_mini_challenge_budget(reward)
    location = _trimmed_text(payload.location, 160) or "Remote"
    time_estimate = _normalize_micro_job_time_estimate(payload.timeEstimate) or None
    micro_job_kind = _normalize_micro_job_kind(payload.micro_job_kind) or "one_off_task"
    collaboration_modes = _normalize_micro_job_collaboration_modes(payload.collaboration_modes or ["async"])
    if not collaboration_modes:
        collaboration_modes = ["async"]
    long_term_potential = _normalize_micro_job_long_term_potential(payload.long_term_potential) or "maybe"
    first_reply_prompt = _trimmed_text(payload.first_reply_prompt, 2000) or _derive_profile_first_reply_prompt(title, problem)
    preferred_country = str(_safe_dict(candidate_profile.get("preferences")).get("preferredCountryCode") or candidate_profile.get("preferred_country_code") or "").strip().lower()
    country_code = preferred_country if preferred_country in {"cs", "cz", "sk", "pl", "de", "at"} else "cz"
    work_type = "Remote" if "remote" in location.lower() else "Hybrid"
    description = _build_profile_mini_challenge_description(
        title=title,
        problem=problem,
        time_estimate=time_estimate,
        reward=reward,
        first_reply_prompt=first_reply_prompt,
        micro_job_kind=micro_job_kind,
        collaboration_modes=collaboration_modes,
        long_term_potential=long_term_potential,
    )

    now = now_iso()
    job_id = _generate_native_job_id()
    job_row = {
        "id": job_id,
        "title": title,
        "company": company_label,
        "location": location,
        "description": description,
        "salary_from": salary_from,
        "salary_to": salary_to,
        "salary_currency": "CZK",
        "salary_timeframe": "project_total",
        "work_type": work_type,
        "work_model": work_type.lower(),
        "source": _NATIVE_JOB_SOURCE,
        "legality_status": "legal",
        "verification_notes": "publisher_profile_mini_challenge",
        "scraped_at": now,
        "posted_by": user_id,
        "recruiter_id": user_id,
        "contact_email": contact_email,
        "country_code": country_code,
        "status": "active",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    try:
        _sync_main_job_to_jobs_postgres(job_row, source_kind="native")
        _sync_main_job_shadow_to_supabase(job_row, create_if_missing=True)
    except Exception as exc:
        print(f"⚠️ Failed to create publisher mini challenge: {exc}")
        raise HTTPException(status_code=500, detail="Failed to publish mini challenge")

    return {"job": job_row}


@router.patch("/publisher/mini-challenges/{job_id}/lifecycle")
@limiter.limit("30/minute")
async def update_publisher_mini_challenge_lifecycle(
    job_id: str,
    payload: JobLifecycleUpdateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    job_row = _require_job_access(user, job_id)
    normalized_job_id = _normalize_job_id(job_id)
    update_payload = {
        "status": payload.status,
        "is_active": payload.status == "active",
        "updated_at": now_iso(),
    }
    try:
        update_job_fields(normalized_job_id, update_payload)
    except Exception:
        pass
    shadow_row = dict(job_row)
    shadow_row.update(update_payload)
    _sync_main_job_shadow_to_supabase(shadow_row, create_if_missing=False)
    return {"status": "success"}


@router.get("/publisher/mini-challenges/{job_id}/dialogues")
@limiter.limit("60/minute")
async def list_publisher_mini_challenge_dialogues(
    job_id: str,
    request: Request,
    limit: int = Query(200, ge=1, le=1000),
    user: dict = Depends(get_current_user),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    normalized_job_id = _normalize_job_id(job_id)
    _require_job_access(user, job_id)
    try:
        resp = (
            supabase
            .table("job_applications")
            .select("*,jobs(id,title),profiles(id,full_name,email,avatar_url)")
            .eq("job_id", normalized_job_id)
            .order("submitted_at", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception as exc:
        order_column = "applied_at" if _is_missing_column_error(exc, "submitted_at") else "created_at"
        resp = (
            supabase
            .table("job_applications")
            .select("*")
            .eq("job_id", normalized_job_id)
            .order(order_column, desc=True)
            .limit(limit)
            .execute()
        )

    rows = _hydrate_rows_with_primary_jobs([row for row in (resp.data or []) if isinstance(row, dict)])
    rows = [_expire_dialogue_if_needed(row) for row in rows]
    return {"dialogues": [_serialize_dialogue_record(_serialize_company_application_row(row)) for row in rows]}


@router.get("/publisher/dialogues/{dialogue_id}")
@limiter.limit("60/minute")
async def get_publisher_dialogue_detail(
    dialogue_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        resp = (
            supabase
            .table("job_applications")
            .select("*,jobs(id,title),profiles(id,full_name,email,avatar_url)")
            .eq("id", dialogue_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        resp = (
            supabase
            .table("job_applications")
            .select("*")
            .eq("id", dialogue_id)
            .maybe_single()
            .execute()
        )
    row = resp.data if resp else None
    if not isinstance(row, dict):
        raise HTTPException(status_code=404, detail="Dialogue not found")
    hydrated_rows = _hydrate_rows_with_primary_jobs([row])
    row = hydrated_rows[0] if hydrated_rows else row
    row = _expire_dialogue_if_needed(row)
    _require_dialogue_publisher_access(user, row)
    application = _serialize_application_dossier(row)
    application.update(build_dialogue_enrichment(str(application.get("id") or "")))
    return {"dialogue": _serialize_dialogue_record(application)}


@router.get("/publisher/dialogues/{dialogue_id}/messages")
@limiter.limit("60/minute")
async def list_publisher_dialogue_messages(
    dialogue_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        app_resp = (
            supabase
            .table("job_applications")
            .select("id,job_id,company_id,status,application_payload")
            .eq("id", dialogue_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        if not _is_missing_column_error(exc, "application_payload"):
            raise HTTPException(status_code=500, detail="Failed to load dialogue")
        app_resp = (
            supabase
            .table("job_applications")
            .select("id,job_id,company_id,status")
            .eq("id", dialogue_id)
            .maybe_single()
            .execute()
        )
    app_row = app_resp.data if app_resp else None
    if not isinstance(app_row, dict):
        raise HTTPException(status_code=404, detail="Dialogue not found")
    app_row = _expire_dialogue_if_needed(app_row)
    _require_dialogue_publisher_access(user, app_row)

    try:
        resp = (
            supabase
            .table("application_messages")
            .select("*")
            .eq("application_id", dialogue_id)
            .order("created_at", desc=False)
            .execute()
        )
    except Exception as exc:
        if _is_missing_table_error(exc, "application_messages"):
            return {"messages": []}
        raise HTTPException(status_code=500, detail="Failed to load messages")

    rows = [row for row in (resp.data or []) if isinstance(row, dict)]
    unread_ids = [str(row.get("id") or "") for row in rows if str(row.get("sender_role") or "") == "candidate" and not row.get("read_by_company_at")]
    if unread_ids:
        try:
            supabase.table("application_messages").update({"read_by_company_at": now_iso()}).in_("id", unread_ids).execute()
        except Exception:
            pass
        for row in rows:
            if str(row.get("id") or "") in unread_ids:
                row["read_by_company_at"] = now_iso()
    return {"messages": [_serialize_dialogue_message(row) for row in rows]}


@router.post("/publisher/dialogues/{dialogue_id}/messages")
@limiter.limit("60/minute")
async def create_publisher_dialogue_message(
    dialogue_id: str,
    payload: ApplicationMessageCreateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    try:
        app_resp = (
            supabase
            .table("job_applications")
            .select("id,job_id,company_id,candidate_id,status,application_payload")
            .eq("id", dialogue_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        if not _is_missing_column_error(exc, "application_payload"):
            raise HTTPException(status_code=500, detail="Failed to load dialogue")
        app_resp = (
            supabase
            .table("job_applications")
            .select("id,job_id,company_id,candidate_id,status")
            .eq("id", dialogue_id)
            .maybe_single()
            .execute()
        )
    app_row = app_resp.data if app_resp else None
    if not isinstance(app_row, dict):
        raise HTTPException(status_code=404, detail="Dialogue not found")
    app_row = _expire_dialogue_if_needed(app_row)
    _require_dialogue_publisher_access(user, app_row)
    if not _is_active_dialogue_status(app_row.get("status")):
        raise HTTPException(status_code=409, detail="Dialogue is closed")

    body = str(payload.body or "").strip()
    attachments = _sanitize_application_message_attachments(payload.attachments)
    asset_ids = _extract_attachment_asset_ids(attachments)
    if not body and not attachments:
        raise HTTPException(status_code=400, detail="Message body or attachment required")

    sender_user_id = user.get("id") or user.get("auth_id")
    insert_payload = {
        "application_id": dialogue_id,
        "company_id": app_row.get("company_id"),
        "candidate_id": app_row.get("candidate_id"),
        "sender_user_id": sender_user_id,
        "sender_role": "recruiter",
        "body": body,
        "attachments": attachments,
        "asset_ids": asset_ids,
        "created_at": now_iso(),
        "read_by_candidate_at": None,
        "read_by_company_at": now_iso(),
    }
    try:
        try:
            resp = supabase.table("application_messages").insert(insert_payload).execute()
        except Exception as exc:
            if _is_missing_column_error(exc, "asset_ids"):
                fallback_payload = dict(insert_payload)
                fallback_payload.pop("asset_ids", None)
                resp = supabase.table("application_messages").insert(fallback_payload).execute()
            else:
                raise
    except Exception as exc:
        if _is_missing_table_error(exc, "application_messages"):
            raise HTTPException(status_code=503, detail="Messaging not available")
        raise HTTPException(status_code=500, detail="Failed to send message")

    row = (resp.data or [insert_payload])[0]
    _schedule_dialogue_timeout(app_row, current_turn="candidate")
    return {"message": _serialize_dialogue_message(row)}


@router.patch("/publisher/dialogues/{dialogue_id}/status")
@limiter.limit("60/minute")
async def update_publisher_dialogue_status(
    dialogue_id: str,
    payload: JobApplicationStatusUpdateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    try:
        resp = (
            supabase
            .table("job_applications")
            .select("id,job_id,company_id,status,application_payload")
            .eq("id", dialogue_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        if not _is_missing_column_error(exc, "application_payload"):
            raise HTTPException(status_code=500, detail="Failed to load dialogue")
        resp = (
            supabase
            .table("job_applications")
            .select("id,job_id,company_id,status")
            .eq("id", dialogue_id)
            .maybe_single()
            .execute()
        )
    row = resp.data if resp else None
    if not isinstance(row, dict):
        raise HTTPException(status_code=404, detail="Dialogue not found")
    row = _expire_dialogue_if_needed(row)
    _require_dialogue_publisher_access(user, row)
    if not _is_active_dialogue_status(row.get("status")):
        return {"status": str(row.get("status") or "closed")}

    try:
        try:
            supabase.table("job_applications").update({"status": payload.status, "updated_at": now_iso(), "reviewed_at": now_iso()}).eq("id", dialogue_id).execute()
        except Exception as exc:
            if _is_missing_column_error(exc, "updated_at") or _is_missing_column_error(exc, "reviewed_at"):
                supabase.table("job_applications").update({"status": payload.status}).eq("id", dialogue_id).execute()
            else:
                raise
    except Exception as exc:
        print(f"⚠️ Failed to update publisher dialogue status: {exc}")
        raise HTTPException(status_code=500, detail="Failed to update dialogue status")

    updated_row = dict(row)
    updated_row["status"] = payload.status
    if _is_active_dialogue_status(payload.status):
        _schedule_dialogue_timeout(updated_row, current_turn="candidate")
    else:
        _persist_dialogue_state(
            dialogue_id,
            application_payload=_build_closed_dialogue_payload(
                updated_row.get("application_payload"),
                close_reason=str(payload.status or "closed"),
            ),
            status=payload.status,
        )
    return {"status": payload.status}
