from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request

from ..core.database import supabase
from ..core.limiter import limiter
from ..core.security import get_current_user, require_company_access, verify_csrf_token_header, verify_subscription
from ..models.requests import (
    ApplicationMessageCreateRequest,
    DialogueSolutionSnapshotUpsertRequest,
    JobApplicationCreateRequest,
    JobApplicationStatusUpdateRequest,
)
from ..services.dialogue_composer import build_dialogue_enrichment
from ..services.email import send_application_notification_email
from ..utils.helpers import now_iso
from ..utils.request_urls import get_request_base_url
from .jobs import (
    _build_closed_dialogue_payload,
    _build_company_dialogue_solution_snapshot_state,
    _build_dialogue_activity_payload,
    _build_dialogue_timeout_payload,
    _canonical_job_id,
    _enforce_candidate_dialogue_limit,
    _enforce_company_dialogue_slot_limit,
    _expire_dialogue_if_needed,
    _extract_attachment_asset_ids,
    _get_cached_my_dialogues,
    _hydrate_rows_with_primary_jobs,
    _invalidate_my_dialogues_cache,
    _is_active_dialogue_status,
    _is_missing_column_error,
    _is_missing_relationship_error,
    _is_missing_table_error,
    _load_dialogue_solution_snapshot,
    _load_dialogue_solution_snapshot_context,
    _normalize_job_id,
    _normalize_jcfpm_share_level,
    _read_job_record,
    _normalize_solution_snapshot_tags,
    _persist_dialogue_state,
    _safe_dict,
    _sanitize_application_message_attachments,
    _sanitize_candidate_profile_snapshot,
    _sanitize_cv_snapshot,
    _sanitize_jcfpm_payload,
    _schedule_dialogue_timeout,
    _serialize_application_dossier,
    _serialize_application_message,
    _serialize_candidate_application_row,
    _serialize_candidate_dialogue_capacity,
    _serialize_candidate_dialogue_capacity_from_rows,
    _serialize_company_application_row,
    _serialize_dialogue_message,
    _serialize_dialogue_record,
    _serialize_solution_snapshot,
    _set_cached_my_dialogues,
    _sync_company_dialogue_slots_usage,
    _trimmed_text,
    _user_has_direct_premium,
    _write_analytics_event,
    _write_company_activity_log,
)

router = APIRouter()


@router.post("/jobs/applications")
@limiter.limit("60/minute")
async def create_dialogue_legacy(
    payload: JobApplicationCreateRequest,
    request: Request,
    background_tasks: BackgroundTasks = None,
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
    if requested_share_level != "do_not_share" and not _user_has_direct_premium(user):
        requested_share_level = "do_not_share"
    cv_snapshot = _sanitize_cv_snapshot(payload.cv_snapshot)
    candidate_profile_snapshot = _sanitize_candidate_profile_snapshot(payload.candidate_profile_snapshot)
    shared_jcfpm_payload = _sanitize_jcfpm_payload(requested_share_level, payload.shared_jcfpm_payload)
    application_payload = _build_dialogue_timeout_payload(_safe_dict(payload.metadata), current_turn="company")

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
            row = _expire_dialogue_if_needed(existing.data[0])
            return {
                "status": "exists",
                "application_id": row.get("id"),
                "created_at": row.get("created_at"),
                "application": _serialize_application_dossier(row),
                "candidate_capacity": _serialize_candidate_dialogue_capacity(user_id, user=user),
            }
    except Exception as exc:
        print(f"⚠️ Failed to check existing application: {exc}")

    _enforce_candidate_dialogue_limit(user_id, user=user)

    company_id = None
    try:
        job_row = _safe_dict(_read_job_record(job_id))
        if not job_row:
            raise HTTPException(status_code=404, detail="Job not found")
        company_id = job_row.get("company_id")
        posted_by = str(job_row.get("posted_by") or "").strip()
        if posted_by and posted_by == str(user_id):
            raise HTTPException(status_code=409, detail="You cannot open a dialogue on your own mini challenge.")
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        print(f"⚠️ Failed to resolve company for job {job_id}: {exc}")

    if company_id:
        _enforce_company_dialogue_slot_limit(str(company_id), user)

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
        if _safe_dict(payload.metadata).get("application_draft_used"):
            _write_analytics_event(
                event_type="application_draft_used_on_submit",
                user_id=user_id,
                company_id=str(company_id or "") or None,
                feature="candidate_copilot",
                tier=(user.get("subscription_tier") or "").lower() or None,
                metadata={
                    "job_id": job_id,
                    "application_id": app_id,
                    "source": payload.source or "application_modal",
                    "cv_document_id": payload.cv_document_id,
                },
            )
        if company_id:
            _sync_company_dialogue_slots_usage(str(company_id))
        _invalidate_my_dialogues_cache(user_id)
        if background_tasks is not None:
            background_tasks.add_task(
                send_application_notification_email,
                candidate_profile=candidate_profile_snapshot,
                metadata=_safe_dict(payload.metadata),
                cover_letter=payload.cover_letter,
                cv_snapshot=cv_snapshot,
            )
        return {
            "status": "created",
            "application_id": app_id,
            "application": _serialize_application_dossier(row or insert_payload),
            "candidate_capacity": _serialize_candidate_dialogue_capacity(user_id, user=user),
        }
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
                if _safe_dict(payload.metadata).get("application_draft_used"):
                    _write_analytics_event(
                        event_type="application_draft_used_on_submit",
                        user_id=user_id,
                        company_id=str(company_id or "") or None,
                        feature="candidate_copilot",
                        tier=(user.get("subscription_tier") or "").lower() or None,
                        metadata={
                            "job_id": job_id,
                            "application_id": app_id,
                            "source": payload.source or "application_modal",
                            "cv_document_id": payload.cv_document_id,
                            "legacy_fallback": True,
                        },
                    )
                if company_id:
                    _sync_company_dialogue_slots_usage(str(company_id))
                return {
                    "status": "created",
                    "application_id": app_id,
                    "candidate_capacity": _serialize_candidate_dialogue_capacity(user_id, user=user),
                }
            except Exception as fallback_exc:
                print(f"⚠️ Fallback create application also failed: {fallback_exc}")
        print(f"⚠️ Failed to create application: {exc}")
        raise HTTPException(status_code=500, detail="Failed to create application")


@router.get("/jobs/applications/me")
@limiter.limit("60/minute")
async def list_my_dialogues_legacy(
    request: Request,
    limit: int = Query(80, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    cached = _get_cached_my_dialogues(user_id, limit)
    if cached is not None:
        return cached

    select_attempts: list[tuple[str, str]] = [
        (
            "id,job_id,company_id,status,created_at,submitted_at,applied_at,updated_at,"
            "reviewed_at,reviewed_by,source,cover_letter,cv_document_id,cv_snapshot,"
            "shared_jcfpm_payload,jcfpm_share_level,application_payload,"
            "jobs(title,company,location,url,source,contact_email),"
            "companies(name,website)",
            "submitted_at",
        ),
        (
            "id,job_id,company_id,status,created_at,submitted_at,applied_at,updated_at,"
            "reviewed_at,reviewed_by,source,cover_letter,cv_document_id,cv_snapshot,"
            "shared_jcfpm_payload,jcfpm_share_level,application_payload,"
            "jobs(title,company,location,url,source),"
            "companies(name,website)",
            "submitted_at",
        ),
        (
            "id,job_id,company_id,status,created_at,applied_at,updated_at,"
            "source,cover_letter,cv_document_id,cv_snapshot,"
            "shared_jcfpm_payload,jcfpm_share_level,application_payload,"
            "jobs(title,company,location,url,source),"
            "companies(name,website)",
            "applied_at",
        ),
        (
            "id,job_id,company_id,status,created_at,applied_at,updated_at,"
            "source,cover_letter,cv_document_id,cv_snapshot,"
            "application_payload,"
            "jobs(title,company,location,url,source),"
            "companies(name,website)",
            "applied_at",
        ),
        (
            "id,job_id,company_id,status,created_at,applied_at,updated_at,source,"
            "application_payload,"
            "jobs(title,company,location,url,source),"
            "companies(name,website)",
            "applied_at",
        ),
        (
            "id,job_id,company_id,status,created_at,updated_at,source,"
            "application_payload,"
            "jobs(title,company,location,url,source),"
            "companies(name,website)",
            "created_at",
        ),
    ]

    resp = None
    last_error: Exception | None = None
    for select_clause, order_column in select_attempts:
        try:
            resp = (
                supabase
                .table("job_applications")
                .select(select_clause)
                .eq("candidate_id", user_id)
                .order(order_column, desc=True)
                .limit(limit)
                .execute()
            )
            last_error = None
            break
        except Exception as exc:
            last_error = exc
            continue

    if resp is None:
        if last_error and _is_missing_relationship_error(last_error, "job_applications", "jobs"):
            try:
                base_resp = (
                    supabase
                    .table("job_applications")
                    .select(
                        "id,job_id,company_id,status,created_at,submitted_at,applied_at,updated_at,"
                        "reviewed_at,reviewed_by,source,cover_letter,cv_document_id,cv_snapshot,"
                        "shared_jcfpm_payload,jcfpm_share_level,application_payload"
                    )
                    .eq("candidate_id", user_id)
                    .order("submitted_at", desc=True)
                    .limit(limit)
                    .execute()
                )
            except Exception as fallback_exc:
                print(f"⚠️ Failed to load candidate dialogues for {user_id}: {fallback_exc}")
                payload = {
                    "applications": [],
                    "candidate_capacity": _serialize_candidate_dialogue_capacity(user_id, user=user),
                }
                _set_cached_my_dialogues(user_id, limit, payload)
                return payload

            base_rows = [r for r in (base_resp.data or []) if isinstance(r, dict)]
            job_ids = [_canonical_job_id(r.get("job_id")) for r in base_rows if _canonical_job_id(r.get("job_id"))]
            company_ids = [str(r.get("company_id") or "").strip() for r in base_rows if str(r.get("company_id") or "").strip()]

            jobs_by_id: dict[str, dict] = {}
            if job_ids:
                try:
                    jobs_resp = (
                        supabase
                        .table("jobs")
                        .select("id,title,company,location,url,source,contact_email")
                        .in_("id", list({int(x) for x in job_ids if x.isdigit()} or job_ids))
                        .limit(len(job_ids))
                        .execute()
                    )
                    for job in jobs_resp.data or []:
                        if isinstance(job, dict):
                            jid = _canonical_job_id(job.get("id"))
                            if jid:
                                jobs_by_id[jid] = job
                except Exception as exc:
                    print(f"⚠️ Candidate dialogues fallback: failed to hydrate jobs: {exc}")

            companies_by_id: dict[str, dict] = {}
            if company_ids:
                try:
                    companies_resp = (
                        supabase
                        .table("companies")
                        .select("id,name,website")
                        .in_("id", list(dict.fromkeys(company_ids)))
                        .limit(len(company_ids))
                        .execute()
                    )
                    for company in companies_resp.data or []:
                        if isinstance(company, dict):
                            cid = str(company.get("id") or "").strip()
                            if cid:
                                companies_by_id[cid] = company
                except Exception as exc:
                    print(f"⚠️ Candidate dialogues fallback: failed to hydrate companies: {exc}")

            rows = []
            for row in base_rows:
                enriched = dict(row)
                jid = _canonical_job_id(row.get("job_id"))
                cid = str(row.get("company_id") or "").strip()
                if jid:
                    enriched["jobs"] = jobs_by_id.get(jid) or {}
                if cid:
                    enriched["companies"] = companies_by_id.get(cid) or {}
                rows.append(enriched)
            rows = _hydrate_rows_with_primary_jobs(rows)
            rows = [_expire_dialogue_if_needed(row) for row in rows if isinstance(row, dict)]
            payload = {
                "applications": [_serialize_candidate_application_row(row) for row in rows],
                "candidate_capacity": _serialize_candidate_dialogue_capacity_from_rows(user_id, rows, user=user),
            }
            _set_cached_my_dialogues(user_id, limit, payload)
            return payload

        print(f"⚠️ Failed to load candidate dialogues for {user_id}: {last_error}")
        payload = {
            "applications": [],
            "candidate_capacity": _serialize_candidate_dialogue_capacity(user_id, user=user),
        }
        _set_cached_my_dialogues(user_id, limit, payload)
        return payload

    rows = _hydrate_rows_with_primary_jobs([row for row in (resp.data or []) if isinstance(row, dict)])
    rows = [_expire_dialogue_if_needed(row) for row in rows]
    payload = {
        "applications": [_serialize_candidate_application_row(row) for row in rows],
        "candidate_capacity": _serialize_candidate_dialogue_capacity_from_rows(user_id, rows, user=user),
    }
    _set_cached_my_dialogues(user_id, limit, payload)
    return payload


@router.get("/jobs/applications/{application_id}")
@limiter.limit("60/minute")
async def get_my_dialogue_detail_legacy(
    application_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    try:
        resp = (
            supabase
            .table("job_applications")
            .select("*,jobs(id,title,company,location,url,source,contact_email),companies(id,name,website)")
            .eq("id", application_id)
            .eq("candidate_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        if _is_missing_relationship_error(exc, "job_applications", "jobs"):
            base = (
                supabase
                .table("job_applications")
                .select("*")
                .eq("id", application_id)
                .eq("candidate_id", user_id)
                .maybe_single()
                .execute()
            )
            row = base.data if base else None
            if not isinstance(row, dict):
                raise HTTPException(status_code=404, detail="Application not found")
            jid = _canonical_job_id(row.get("job_id"))
            cid = str(row.get("company_id") or "").strip()
            if jid:
                try:
                    job_resp = (
                        supabase
                        .table("jobs")
                        .select("id,title,company,location,url,source,contact_email")
                        .eq("id", int(jid) if jid.isdigit() else jid)
                        .maybe_single()
                        .execute()
                    )
                    row["jobs"] = job_resp.data if job_resp and isinstance(job_resp.data, dict) else {}
                except Exception:
                    row["jobs"] = {}
            if cid:
                try:
                    company_resp = (
                        supabase
                        .table("companies")
                        .select("id,name,website")
                        .eq("id", cid)
                        .maybe_single()
                        .execute()
                    )
                    row["companies"] = company_resp.data if company_resp and isinstance(company_resp.data, dict) else {}
                except Exception:
                    row["companies"] = {}
            resp = type("Resp", (), {"data": row})()
        else:
            if not _is_missing_column_error(exc, "contact_email"):
                raise HTTPException(status_code=500, detail="Failed to load application detail")
            resp = (
                supabase
                .table("job_applications")
                .select("*,jobs(id,title,company,location,url,source),companies(id,name,website)")
                .eq("id", application_id)
                .eq("candidate_id", user_id)
                .maybe_single()
                .execute()
            )
    row = resp.data if resp else None
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    hydrated_rows = _hydrate_rows_with_primary_jobs([row] if isinstance(row, dict) else [])
    row = hydrated_rows[0] if hydrated_rows else row
    row = _expire_dialogue_if_needed(row)

    application = _serialize_candidate_application_row(row)
    application.update(build_dialogue_enrichment(str(application.get("id") or "")))
    return {"application": application}


@router.post("/jobs/applications/{application_id}/withdraw")
@limiter.limit("30/minute")
async def withdraw_my_dialogue_legacy(
    application_id: str,
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

    try:
        resp = (
            supabase
            .table("job_applications")
            .select("id,candidate_id,company_id,status,application_payload")
            .eq("id", application_id)
            .eq("candidate_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        if not _is_missing_column_error(exc, "application_payload"):
            raise HTTPException(status_code=500, detail="Failed to load application")
        resp = (
            supabase
            .table("job_applications")
            .select("id,candidate_id,company_id,status")
            .eq("id", application_id)
            .eq("candidate_id", user_id)
            .maybe_single()
            .execute()
        )
    row = resp.data if resp else None
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")

    row = _expire_dialogue_if_needed(row)
    current_status = str(row.get("status") or "pending")
    if not _is_active_dialogue_status(current_status):
        return {
            "status": current_status,
            "candidate_capacity": _serialize_candidate_dialogue_capacity(user_id, user=user),
        }

    try:
        try:
            supabase.table("job_applications").update({
                "status": "withdrawn",
                "updated_at": now_iso(),
            }).eq("id", application_id).eq("candidate_id", user_id).execute()
        except Exception as exc:
            if _is_missing_column_error(exc, "updated_at"):
                supabase.table("job_applications").update({
                    "status": "withdrawn",
                }).eq("id", application_id).eq("candidate_id", user_id).execute()
            else:
                raise
    except Exception as exc:
        print(f"⚠️ Failed to withdraw application: {exc}")
        raise HTTPException(status_code=500, detail="Failed to withdraw application")

    _write_company_activity_log(
        company_id=str(row.get("company_id") or ""),
        event_type="application_withdrawn",
        payload=_build_dialogue_activity_payload(
            application_id=application_id,
            status="withdrawn",
            close_reason="withdrawn",
        ),
        actor_user_id=user_id,
        subject_type="application",
        subject_id=application_id,
    )

    if row.get("company_id"):
        _sync_company_dialogue_slots_usage(str(row.get("company_id")))

    _persist_dialogue_state(
        application_id,
        application_payload=_build_closed_dialogue_payload(
            row.get("application_payload"),
            close_reason="withdrawn",
        ),
        status="withdrawn",
    )
    _invalidate_my_dialogues_cache(user_id)

    return {
        "status": "withdrawn",
        "candidate_capacity": _serialize_candidate_dialogue_capacity(user_id, user=user),
    }


@router.get("/jobs/applications/{application_id}/messages")
@limiter.limit("60/minute")
async def list_my_dialogue_messages_legacy(
    application_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    try:
        app_resp = (
            supabase
            .table("job_applications")
            .select("id,candidate_id,company_id,status,application_payload")
            .eq("id", application_id)
            .eq("candidate_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        if not _is_missing_column_error(exc, "application_payload"):
            raise HTTPException(status_code=500, detail="Failed to load application")
        app_resp = (
            supabase
            .table("job_applications")
            .select("id,candidate_id,company_id,status")
            .eq("id", application_id)
            .eq("candidate_id", user_id)
            .maybe_single()
            .execute()
        )
    app_row = app_resp.data if app_resp else None
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    app_row = _expire_dialogue_if_needed(app_row)

    try:
        resp = (
            supabase
            .table("application_messages")
            .select("*")
            .eq("application_id", application_id)
            .order("created_at", desc=False)
            .execute()
        )
    except Exception as exc:
        if _is_missing_table_error(exc, "application_messages"):
            return {"messages": []}
        raise HTTPException(status_code=500, detail="Failed to load messages")

    rows = [r for r in (resp.data or []) if isinstance(r, dict)]
    unread_ids = [str(r.get("id") or "") for r in rows if str(r.get("sender_role") or "") == "recruiter" and not r.get("read_by_candidate_at")]
    if unread_ids:
        try:
            supabase.table("application_messages").update({"read_by_candidate_at": now_iso()}).in_("id", unread_ids).execute()
        except Exception:
            pass
        for row in rows:
            if str(row.get("id") or "") in unread_ids:
                row["read_by_candidate_at"] = now_iso()

    request_base_url = get_request_base_url(request)
    return {"messages": [_serialize_application_message(row, request_base_url) for row in rows]}


@router.post("/jobs/applications/{application_id}/messages")
@limiter.limit("60/minute")
async def create_my_dialogue_message_legacy(
    application_id: str,
    payload: ApplicationMessageCreateRequest,
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

    try:
        app_resp = (
            supabase
            .table("job_applications")
            .select("id,candidate_id,company_id,status,application_payload")
            .eq("id", application_id)
            .eq("candidate_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        if not _is_missing_column_error(exc, "application_payload"):
            raise HTTPException(status_code=500, detail="Failed to load application")
        app_resp = (
            supabase
            .table("job_applications")
            .select("id,candidate_id,company_id,status")
            .eq("id", application_id)
            .eq("candidate_id", user_id)
            .maybe_single()
            .execute()
        )
    app_row = app_resp.data if app_resp else None
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    app_row = _expire_dialogue_if_needed(app_row)
    if not _is_active_dialogue_status(app_row.get("status")):
        raise HTTPException(status_code=409, detail="Dialogue is closed")

    body = str(payload.body or "").strip()
    attachments = _sanitize_application_message_attachments(payload.attachments)
    asset_ids = _extract_attachment_asset_ids(attachments)
    if not body and not attachments:
        raise HTTPException(status_code=400, detail="Message body or attachment required")

    insert_payload = {
        "application_id": application_id,
        "company_id": app_row.get("company_id"),
        "candidate_id": user_id,
        "sender_user_id": user_id,
        "sender_role": "candidate",
        "body": body,
        "attachments": attachments,
        "asset_ids": asset_ids,
        "created_at": now_iso(),
        "read_by_candidate_at": now_iso(),
        "read_by_company_at": None,
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
    _schedule_dialogue_timeout(app_row, current_turn="company")
    _write_company_activity_log(
        company_id=str(app_row.get("company_id") or ""),
        event_type="application_message_from_candidate",
        payload={
            "application_id": application_id,
            "message_id": str(row.get("id") or ""),
            "has_attachments": bool(attachments),
        },
        actor_user_id=user_id,
        subject_type="application",
        subject_id=application_id,
    )
    _invalidate_my_dialogues_cache(user_id)
    return {"message": _serialize_application_message(row, get_request_base_url(request))}


@router.get("/company/applications")
@limiter.limit("60/minute")
async def list_company_dialogues_legacy(
    request: Request,
    company_id: str = Query(...),
    job_id: str | None = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    require_company_access(user, company_id)
    resp = None
    try:
        query = (
            supabase
            .table("job_applications")
            .select("*,jobs(id,title),profiles(id,full_name,email,avatar_url)")
            .eq("company_id", company_id)
            .order("submitted_at", desc=True)
            .limit(limit)
        )
        if job_id:
            query = query.eq("job_id", _normalize_job_id(job_id))
        resp = query.execute()
    except Exception as exc:
        try:
            order_column = "applied_at" if _is_missing_column_error(exc, "submitted_at") else "created_at"
            legacy_query = (
                supabase
                .table("job_applications")
                .select("*")
                .eq("company_id", company_id)
                .order(order_column, desc=True)
                .limit(limit)
            )
            if job_id:
                legacy_query = legacy_query.eq("job_id", _normalize_job_id(job_id))
            resp = legacy_query.execute()
        except Exception:
            return {"company_id": company_id, "applications": []}

    rows = _hydrate_rows_with_primary_jobs([row for row in (resp.data or []) if isinstance(row, dict)])
    rows = [_expire_dialogue_if_needed(row) for row in rows]
    out = []
    for row in rows:
        out.append(_serialize_company_application_row(row))

    return {"company_id": company_id, "applications": out}


@router.get("/company/applications/{application_id}")
@limiter.limit("60/minute")
async def get_company_dialogue_detail_legacy(
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
            .select("*,jobs(id,title),profiles(id,full_name,email,avatar_url)")
            .eq("id", application_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        try:
            resp = (
                supabase
                .table("job_applications")
                .select("*")
                .eq("id", application_id)
                .maybe_single()
                .execute()
            )
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to load application detail")
    row = resp.data if resp else None
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    hydrated_rows = _hydrate_rows_with_primary_jobs([row] if isinstance(row, dict) else [])
    row = hydrated_rows[0] if hydrated_rows else row
    row = _expire_dialogue_if_needed(row)
    require_company_access(user, str(row.get("company_id") or ""))
    application = _serialize_application_dossier(row)
    application.update(build_dialogue_enrichment(str(application.get("id") or "")))
    return {"application": application}


@router.get("/company/applications/{application_id}/messages")
@limiter.limit("60/minute")
async def list_company_dialogue_messages_legacy(
    application_id: str,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        app_resp = (
            supabase
            .table("job_applications")
            .select("id,company_id,status,application_payload")
            .eq("id", application_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        if not _is_missing_column_error(exc, "application_payload"):
            raise HTTPException(status_code=500, detail="Failed to load application")
        app_resp = (
            supabase
            .table("job_applications")
            .select("id,company_id,status")
            .eq("id", application_id)
            .maybe_single()
            .execute()
        )
    app_row = app_resp.data if app_resp else None
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    app_row = _expire_dialogue_if_needed(app_row)

    require_company_access(user, str(app_row.get("company_id") or ""))

    try:
        resp = (
            supabase
            .table("application_messages")
            .select("*")
            .eq("application_id", application_id)
            .order("created_at", desc=False)
            .execute()
        )
    except Exception as exc:
        if _is_missing_table_error(exc, "application_messages"):
            return {"messages": []}
        raise HTTPException(status_code=500, detail="Failed to load messages")

    rows = [r for r in (resp.data or []) if isinstance(r, dict)]
    unread_ids = [str(r.get("id") or "") for r in rows if str(r.get("sender_role") or "") == "candidate" and not r.get("read_by_company_at")]
    if unread_ids:
        try:
            supabase.table("application_messages").update({"read_by_company_at": now_iso()}).in_("id", unread_ids).execute()
        except Exception:
            pass
        for row in rows:
            if str(row.get("id") or "") in unread_ids:
                row["read_by_company_at"] = now_iso()

    request_base_url = get_request_base_url(request)
    return {"messages": [_serialize_application_message(row, request_base_url) for row in rows]}


@router.post("/company/applications/{application_id}/messages")
@limiter.limit("60/minute")
async def create_company_dialogue_message_legacy(
    application_id: str,
    payload: ApplicationMessageCreateRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    try:
        app_resp = (
            supabase
            .table("job_applications")
            .select("id,company_id,candidate_id,status,application_payload")
            .eq("id", application_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        if not _is_missing_column_error(exc, "application_payload"):
            raise HTTPException(status_code=500, detail="Failed to load application")
        app_resp = (
            supabase
            .table("job_applications")
            .select("id,company_id,candidate_id,status")
            .eq("id", application_id)
            .maybe_single()
            .execute()
        )
    app_row = app_resp.data if app_resp else None
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    app_row = _expire_dialogue_if_needed(app_row)

    company_id = str(app_row.get("company_id") or "")
    require_company_access(user, company_id)
    if not _is_active_dialogue_status(app_row.get("status")):
        raise HTTPException(status_code=409, detail="Dialogue is closed")

    body = str(payload.body or "").strip()
    attachments = _sanitize_application_message_attachments(payload.attachments)
    asset_ids = _extract_attachment_asset_ids(attachments)
    if not body and not attachments:
        raise HTTPException(status_code=400, detail="Message body or attachment required")

    sender_user_id = user.get("id") or user.get("auth_id")
    insert_payload = {
        "application_id": application_id,
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
    _write_company_activity_log(
        company_id=company_id,
        event_type="application_message_from_company",
        payload={
            "application_id": application_id,
            "message_id": str(row.get("id") or ""),
            "has_attachments": bool(attachments),
        },
        actor_user_id=str(sender_user_id or ""),
        subject_type="application",
        subject_id=application_id,
    )
    return {"message": _serialize_application_message(row, get_request_base_url(request))}


@router.patch("/company/applications/{application_id}/status")
@limiter.limit("60/minute")
async def update_company_dialogue_status_legacy(
    application_id: str,
    payload: JobApplicationStatusUpdateRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    try:
        resp = (
            supabase
            .table("job_applications")
            .select("id,company_id,status,application_payload")
            .eq("id", application_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        if not _is_missing_column_error(exc, "application_payload"):
            raise HTTPException(status_code=500, detail="Failed to load application")
        resp = (
            supabase
            .table("job_applications")
            .select("id,company_id,status")
            .eq("id", application_id)
            .maybe_single()
            .execute()
        )
    row = resp.data if resp else None
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    row = _expire_dialogue_if_needed(row)

    require_company_access(user, str(row.get("company_id") or ""))
    if not _is_active_dialogue_status(row.get("status")):
        return {"status": str(row.get("status") or "closed")}

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
        payload=_build_dialogue_activity_payload(
            application_id=application_id,
            status=payload.status,
            close_reason=payload.status if not _is_active_dialogue_status(payload.status) else None,
        ),
        actor_user_id=user.get("id") or user.get("auth_id"),
        subject_type="application",
        subject_id=application_id,
    )

    if row.get("company_id"):
        _sync_company_dialogue_slots_usage(str(row.get("company_id")))

    updated_row = dict(row)
    updated_row["status"] = payload.status
    if _is_active_dialogue_status(payload.status):
        _schedule_dialogue_timeout(updated_row, current_turn="candidate")
    else:
        _persist_dialogue_state(
            application_id,
            application_payload=_build_closed_dialogue_payload(
                updated_row.get("application_payload"),
                close_reason=str(payload.status or "closed"),
            ),
            status=payload.status,
        )

    return {"status": "success"}


@router.post("/dialogues")
@limiter.limit("60/minute")
async def create_dialogue(
    payload: JobApplicationCreateRequest,
    request: Request,
    background_tasks: BackgroundTasks = None,
    user: dict = Depends(get_current_user),
):
    response = await create_dialogue_legacy(payload=payload, request=request, background_tasks=background_tasks, user=user)
    dialogue = response.get("application")
    out = {
        "status": response.get("status"),
        "dialogue_id": str(response.get("application_id") or ""),
    }
    if response.get("candidate_capacity") is not None:
        out["candidate_capacity"] = response.get("candidate_capacity")
    if dialogue is not None:
        out["dialogue"] = _serialize_dialogue_record(dialogue)
    return out


@router.get("/dialogues/me")
@limiter.limit("60/minute")
async def list_my_dialogues(
    request: Request,
    limit: int = Query(80, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    response = await list_my_dialogues_legacy(request=request, limit=limit, user=user)
    rows = response.get("applications") or []
    dialogues: list[dict] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        dialogue = dict(row)
        dialogue["dialogue_id"] = str(dialogue.get("dialogue_id") or dialogue.get("id") or "")
        if dialogue.get("role_id") is None and dialogue.get("job_id") is not None:
            dialogue["role_id"] = str(dialogue.get("job_id") or "")
        if dialogue.get("role_title") is None and dialogue.get("job_title") is not None:
            dialogue["role_title"] = dialogue.get("job_title")
        dialogues.append(dialogue)
    return {
        "dialogues": dialogues,
        "candidate_capacity": response.get("candidate_capacity"),
    }


@router.get("/dialogues/{dialogue_id}")
@limiter.limit("60/minute")
async def get_my_dialogue_detail(
    dialogue_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    response = await get_my_dialogue_detail_legacy(application_id=dialogue_id, request=request, user=user)
    return {"dialogue": _serialize_dialogue_record(response.get("application"))}


@router.post("/dialogues/{dialogue_id}/withdraw")
@limiter.limit("30/minute")
async def withdraw_my_dialogue(
    dialogue_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    return await withdraw_my_dialogue_legacy(application_id=dialogue_id, request=request, user=user)


@router.get("/dialogues/{dialogue_id}/messages")
@limiter.limit("60/minute")
async def list_my_dialogue_messages(
    dialogue_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    response = await list_my_dialogue_messages_legacy(application_id=dialogue_id, request=request, user=user)
    rows = response.get("messages") or []
    return {"messages": [_serialize_dialogue_message(row) for row in rows if isinstance(row, dict)]}


@router.post("/dialogues/{dialogue_id}/messages")
@limiter.limit("60/minute")
async def create_my_dialogue_message(
    dialogue_id: str,
    payload: ApplicationMessageCreateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    response = await create_my_dialogue_message_legacy(
        application_id=dialogue_id,
        payload=payload,
        request=request,
        user=user,
    )
    return {"message": _serialize_dialogue_message(response.get("message"))}


@router.get("/solution-snapshots/me")
@limiter.limit("60/minute")
async def list_my_solution_snapshots(
    request: Request,
    limit: int = Query(12, ge=1, le=50),
    user: dict = Depends(get_current_user),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    try:
        resp = (
            supabase
            .table("job_solution_snapshots")
            .select("*,jobs(id,title),companies(id,name)")
            .eq("candidate_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = [row for row in (resp.data or []) if isinstance(row, dict)]
    except Exception as exc:
        if _is_missing_table_error(exc, "job_solution_snapshots"):
            return {"snapshots": []}
        if not (
            _is_missing_relationship_error(exc, "job_solution_snapshots", "jobs")
            or _is_missing_relationship_error(exc, "job_solution_snapshots", "companies")
        ):
            raise HTTPException(status_code=500, detail="Failed to load solution snapshots")

        fallback_resp = (
            supabase
            .table("job_solution_snapshots")
            .select("*")
            .eq("candidate_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = [row for row in (fallback_resp.data or []) if isinstance(row, dict)]
        job_ids = [int(jid) for jid in {_normalize_job_id(row.get("job_id")) for row in rows} if isinstance(jid, int)]
        company_ids = [cid for cid in {str((row or {}).get("company_id") or "").strip() for row in rows} if cid]
        jobs_by_id: dict[int, dict] = {}
        companies_by_id: dict[str, dict] = {}

        if job_ids:
            try:
                jobs_resp = (
                    supabase
                    .table("jobs")
                    .select("id,title")
                    .in_("id", job_ids)
                    .limit(len(job_ids))
                    .execute()
                )
                jobs_by_id = {
                    int(row.get("id")): row
                    for row in (jobs_resp.data or [])
                    if isinstance(row, dict) and isinstance(row.get("id"), int)
                }
            except Exception:
                jobs_by_id = {}

        if company_ids:
            try:
                companies_resp = (
                    supabase
                    .table("companies")
                    .select("id,name")
                    .in_("id", company_ids)
                    .limit(len(company_ids))
                    .execute()
                )
                companies_by_id = {
                    str(row.get("id") or ""): row
                    for row in (companies_resp.data or [])
                    if isinstance(row, dict)
                }
            except Exception:
                companies_by_id = {}

        for row in rows:
            normalized_job_id = _normalize_job_id(row.get("job_id"))
            if isinstance(normalized_job_id, int):
                row["jobs"] = jobs_by_id.get(normalized_job_id, {})
            company_id = str(row.get("company_id") or "").strip()
            if company_id:
                row["companies"] = companies_by_id.get(company_id, {})
    rows = _hydrate_rows_with_primary_jobs(rows)

    return {
        "snapshots": [
            serialized
            for serialized in (_serialize_solution_snapshot(row) for row in rows)
            if serialized is not None
        ]
    }


@router.get("/company/dialogues")
@limiter.limit("60/minute")
async def list_company_dialogues(
    request: Request,
    company_id: str = Query(...),
    role_id: str | None = Query(None),
    job_id: str | None = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    user: dict = Depends(verify_subscription),
):
    response = await list_company_dialogues_legacy(
        request=request,
        company_id=company_id,
        job_id=role_id or job_id,
        limit=limit,
        user=user,
    )
    rows = response.get("applications") or []
    return {
        "company_id": company_id,
        "dialogues": [_serialize_dialogue_record(row) for row in rows if isinstance(row, dict)],
    }


@router.get("/company/dialogues/{dialogue_id}")
@limiter.limit("60/minute")
async def get_company_dialogue_detail(
    dialogue_id: str,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    response = await get_company_dialogue_detail_legacy(application_id=dialogue_id, request=request, user=user)
    return {"dialogue": _serialize_dialogue_record(response.get("application"))}


@router.get("/company/dialogues/{dialogue_id}/messages")
@limiter.limit("60/minute")
async def list_company_dialogue_messages(
    dialogue_id: str,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    response = await list_company_dialogue_messages_legacy(application_id=dialogue_id, request=request, user=user)
    rows = response.get("messages") or []
    return {"messages": [_serialize_dialogue_message(row) for row in rows if isinstance(row, dict)]}


@router.post("/company/dialogues/{dialogue_id}/messages")
@limiter.limit("60/minute")
async def create_company_dialogue_message(
    dialogue_id: str,
    payload: ApplicationMessageCreateRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    response = await create_company_dialogue_message_legacy(
        application_id=dialogue_id,
        payload=payload,
        request=request,
        user=user,
    )
    return {"message": _serialize_dialogue_message(response.get("message"))}


@router.patch("/company/dialogues/{dialogue_id}/status")
@limiter.limit("60/minute")
async def update_company_dialogue_status(
    dialogue_id: str,
    payload: JobApplicationStatusUpdateRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    return await update_company_dialogue_status_legacy(
        application_id=dialogue_id,
        payload=payload,
        request=request,
        user=user,
    )


@router.get("/company/dialogues/{dialogue_id}/solution-snapshot")
@limiter.limit("60/minute")
async def get_company_dialogue_solution_snapshot(
    dialogue_id: str,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    dialogue_row = _load_dialogue_solution_snapshot_context(dialogue_id)
    if not dialogue_row:
        raise HTTPException(status_code=404, detail="Dialogue not found")
    require_company_access(user, str(dialogue_row.get("company_id") or ""))

    snapshot_row = _load_dialogue_solution_snapshot(dialogue_id)
    return _build_company_dialogue_solution_snapshot_state(dialogue_row, snapshot_row)


@router.put("/company/dialogues/{dialogue_id}/solution-snapshot")
@limiter.limit("30/minute")
async def upsert_company_dialogue_solution_snapshot(
    dialogue_id: str,
    payload: DialogueSolutionSnapshotUpsertRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    dialogue_row = _load_dialogue_solution_snapshot_context(dialogue_id)
    if not dialogue_row:
        raise HTTPException(status_code=404, detail="Dialogue not found")
    require_company_access(user, str(dialogue_row.get("company_id") or ""))

    existing_snapshot = _load_dialogue_solution_snapshot(dialogue_id)
    state = _build_company_dialogue_solution_snapshot_state(dialogue_row, existing_snapshot)
    if state.get("reason") == "missing_job":
        raise HTTPException(status_code=409, detail="This dialogue is missing a linked role.")
    if state.get("reason") == "not_micro_job":
        raise HTTPException(status_code=409, detail="Solution snapshots are available only for micro jobs.")
    if state.get("reason") == "awaiting_completion":
        raise HTTPException(status_code=409, detail="Mark the micro job as hired first to save a solution snapshot.")

    timestamp = now_iso()
    base_payload = {
        "dialogue_id": dialogue_id,
        "job_id": dialogue_row.get("job_id"),
        "company_id": dialogue_row.get("company_id"),
        "candidate_id": dialogue_row.get("candidate_id"),
        "problem": _trimmed_text(payload.problem, 2000),
        "solution": _trimmed_text(payload.solution, 3000),
        "result": _trimmed_text(payload.result, 2000),
        "problem_tags": _normalize_solution_snapshot_tags(payload.problem_tags),
        "solution_tags": _normalize_solution_snapshot_tags(payload.solution_tags),
        "is_public": bool(payload.is_public),
        "share_slug": _trimmed_text((existing_snapshot or {}).get("share_slug"), 120) or uuid4().hex[:16],
        "updated_at": timestamp,
    }

    try:
        if existing_snapshot:
            save_resp = (
                supabase
                .table("job_solution_snapshots")
                .update(base_payload)
                .eq("id", existing_snapshot.get("id"))
                .select("*")
                .single()
                .execute()
            )
        else:
            insert_payload = dict(base_payload)
            insert_payload["created_at"] = timestamp
            insert_payload["created_by"] = user.get("id") or user.get("auth_id")
            save_resp = (
                supabase
                .table("job_solution_snapshots")
                .insert(insert_payload)
                .select("*")
                .single()
                .execute()
            )
    except Exception as exc:
        if _is_missing_table_error(exc, "job_solution_snapshots"):
            raise HTTPException(status_code=409, detail="Solution snapshots unavailable")
        print(f"⚠️ Failed to save solution snapshot for dialogue {dialogue_id}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to save solution snapshot")

    snapshot_row = save_resp.data if save_resp and isinstance(save_resp.data, dict) else None
    if not snapshot_row:
        raise HTTPException(status_code=500, detail="Failed to save solution snapshot")

    snapshot_row["jobs"] = _safe_dict(dialogue_row.get("jobs"))
    snapshot_row["companies"] = _safe_dict(dialogue_row.get("companies"))

    _write_company_activity_log(
        company_id=str(dialogue_row.get("company_id") or ""),
        event_type="solution_snapshot_saved",
        payload={
            "dialogue_id": dialogue_id,
            "job_id": dialogue_row.get("job_id"),
            "candidate_id": dialogue_row.get("candidate_id"),
            "job_title": _trimmed_text(_safe_dict(dialogue_row.get("jobs")).get("title"), 200) or None,
        },
        actor_user_id=user.get("id") or user.get("auth_id"),
        subject_type="dialogue",
        subject_id=dialogue_id,
    )

    return {"snapshot": _serialize_solution_snapshot(snapshot_row)}
