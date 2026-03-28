from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request

from ..core.database import supabase
from ..core.limiter import limiter
from ..core.security import get_current_user, require_company_access, verify_csrf_token_header, verify_subscription
from ..models.requests import JobInteractionRequest, JobInteractionStateSyncRequest
from ..services.job_catalog import list_company_job_ids
from ..services.jobs_interactions_runtime import (
    _INTERACTION_STATE_EVENTS,
    _RECOMMENDATION_SIGNAL_MAP,
    _clear_invalid_interaction_job_id,
    _fetch_user_interaction_state,
    _filter_existing_job_ids,
    _invalidate_user_interaction_state_cache,
    _is_cached_invalid_interaction_job_id,
    _mark_invalid_interaction_job_id,
    _maybe_emit_interactions_csrf_warning,
    _write_interaction_feedback_rows,
)
from ..services.jobs_shared import _canonical_job_id, _read_job_record, _safe_rows
from ..utils.helpers import now_iso

router = APIRouter()


@router.post("/jobs/interactions")
@limiter.limit("120/minute")
async def log_job_interaction(
    payload: JobInteractionRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    if not verify_csrf_token_header(request, user):
        _maybe_emit_interactions_csrf_warning()

    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    if _is_cached_invalid_interaction_job_id(payload.job_id):
        if not _read_job_record(payload.job_id):
            return {"status": "degraded", "reason": "job_interactions_invalid_job_id"}
        _clear_invalid_interaction_job_id(payload.job_id)
    if not _read_job_record(payload.job_id):
        _mark_invalid_interaction_job_id(payload.job_id)
        return {"status": "degraded", "reason": "job_interactions_invalid_job_id"}

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
        "metadata": metadata,
    }
    try:
        res = supabase.table("job_interactions").insert(insert_data).execute()
    except Exception as exc:
        error_text = str(exc).lower()
        if "job_interactions_job_id_fkey" in error_text or "foreign key constraint" in error_text:
            _mark_invalid_interaction_job_id(payload.job_id)
            return {"status": "degraded", "reason": "job_interactions_invalid_job_id"}
        print(f"⚠️ Failed to insert job_interactions telemetry: {exc}")
        return {"status": "degraded", "reason": "job_interactions_insert_failed"}

    if not res.data:
        return {"status": "degraded", "reason": "no_data_inserted"}
    _clear_invalid_interaction_job_id(payload.job_id)

    try:
        if payload.event_type in _INTERACTION_STATE_EVENTS:
            _invalidate_user_interaction_state_cache(user_id)

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
        background_tasks.add_task(
            _write_interaction_feedback_rows,
            feedback_rows,
            normalized_signal_type,
            payload.event_type,
        )
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
    client_dismissed = {jid for jid in client_dismissed if jid not in client_saved}

    server_saved, server_dismissed = _fetch_user_interaction_state(user_id, limit=20000)
    server_saved_set = set(server_saved)
    server_dismissed_set = set(server_dismissed)

    to_save = client_saved - server_saved_set
    to_unsave = server_saved_set - client_saved
    to_dismiss = client_dismissed - server_dismissed_set
    to_undismiss = server_dismissed_set - client_dismissed
    to_undismiss = {jid for jid in to_undismiss if jid not in client_saved}

    insert_rows = []
    meta = {
        "source": "state_sync",
        "client_updated_at": payload.client_updated_at,
        "origin": payload.source,
    }

    for job_id in to_save:
        insert_rows.append({"user_id": user_id, "job_id": int(job_id), "event_type": "save", "metadata": meta})
    for job_id in to_unsave:
        insert_rows.append({"user_id": user_id, "job_id": int(job_id), "event_type": "unsave", "metadata": meta})
    for job_id in to_dismiss:
        insert_rows.append({"user_id": user_id, "job_id": int(job_id), "event_type": "swipe_left", "metadata": meta})
    for job_id in to_undismiss:
        insert_rows.append({"user_id": user_id, "job_id": int(job_id), "event_type": "unsave", "metadata": meta})

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
            _invalidate_user_interaction_state_cache(user_id)
        except Exception as exc:
            print(f"⚠️ Failed to sync interaction state: {exc}")
            raise HTTPException(status_code=500, detail="Failed to sync interaction state")

    return {
        "saved_job_ids": sorted(list(client_saved)),
        "dismissed_job_ids": sorted(list(client_dismissed)),
        "updated_at": now_iso(),
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
    job_ids = list_company_job_ids(company_id, job_id=job_id, limit=5000)
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
    view_rows = _safe_rows(views_resp.data if views_resp else None)
    counts: dict[str, int] = {}
    for row in view_rows:
        jid = _canonical_job_id(row.get("job_id"))
        if not jid:
            continue
        counts[jid] = counts.get(jid, 0) + 1

    job_views = [{"job_id": jid, "views": count} for jid, count in counts.items()]
    return {
        "company_id": company_id,
        "window_days": window_days,
        "total": sum(counts.values()),
        "job_views": job_views,
    }
