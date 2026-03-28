import os
import time
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any

from fastapi import Request

from ..core.database import supabase
from ..core.security import verify_supabase_token
from ..utils.helpers import now_iso
from .jobs_shared import (
    _canonical_job_id,
    _is_missing_table_error,
    _normalize_job_id,
    _read_job_record,
    _safe_dict,
    _safe_positive_int,
    _safe_rows,
)

_SEARCH_EXPOSURES_AVAILABLE: bool = True
_SEARCH_EXPOSURES_WARNING_EMITTED: bool = False
_SEARCH_FEEDBACK_AVAILABLE: bool = True
_SEARCH_FEEDBACK_WARNING_EMITTED: bool = False
_INTERACTIONS_CSRF_WARNING_LAST_EMITTED: datetime | None = None

_INTERACTION_STATE_CACHE_TTL_SECONDS = 20
_INTERACTION_STATE_CACHE: dict[tuple[str, int], tuple[datetime, tuple[list[str], list[str]]]] = {}

_JOB_DIALOGUE_PREVIEW_CACHE_TTL_SECONDS = 30
_JOB_DIALOGUE_PREVIEW_CACHE: dict[str, tuple[float, int]] = {}
_JOB_DIALOGUE_PREVIEW_CACHE_LOCK = Lock()

_INVALID_INTERACTION_JOB_CACHE_TTL_SECONDS = 600
_INVALID_INTERACTION_JOB_CACHE: dict[str, float] = {}
_INVALID_INTERACTION_JOB_CACHE_LOCK = Lock()

_HYBRID_SEARCH_V2_HTTP_CACHE_TTL_SECONDS = 15
_HYBRID_SEARCH_V2_HTTP_CACHE_EMPTY_TTL_SECONDS = 300
_HYBRID_SEARCH_V2_HTTP_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_HYBRID_SEARCH_V2_HTTP_CACHE_LOCK = Lock()

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
_DIALOGUE_TERMINAL_STATUSES: set[str] = {
    "withdrawn",
    "rejected",
    "hired",
    "closed",
    "closed_timeout",
    "closed_rejected",
    "closed_withdrawn",
    "closed_role_filled",
}
_DIALOGUE_RESPONSE_TIMEOUT_HOURS: int = 72
_ROLE_DIALOGUE_PREVIEW_LIMIT: int = max(1, int(os.getenv("ROLE_DIALOGUE_PREVIEW_LIMIT", "25")))


def _try_get_optional_user_id(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        user = verify_supabase_token(token)
        return user.get("id") or user.get("auth_id")
    except Exception:
        return None


def _maybe_emit_interactions_csrf_warning() -> None:
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


def _is_active_dialogue_status(status_value: Any) -> bool:
    status = str(status_value or "pending").strip().lower() or "pending"
    return status not in _DIALOGUE_TERMINAL_STATUSES


def _resolve_role_dialogue_limit(job: dict[str, Any]) -> int:
    for key in (
        "dialogue_capacity_limit",
        "dialogue_slots_limit",
        "dialogue_limit",
        "max_dialogues",
        "max_active_dialogues",
    ):
        raw = job.get(key)
        if raw is not None and str(raw).strip() != "":
            return _safe_positive_int(raw, _ROLE_DIALOGUE_PREVIEW_LIMIT)
    return _ROLE_DIALOGUE_PREVIEW_LIMIT


def _resolve_reaction_window_hours(job: dict[str, Any]) -> int:
    for key in ("reaction_window_hours", "dialogue_timeout_hours", "dialogue_response_timeout_hours"):
        raw = job.get(key)
        if raw is not None and str(raw).strip() != "":
            return _safe_positive_int(raw, _DIALOGUE_RESPONSE_TIMEOUT_HOURS)
    return _DIALOGUE_RESPONSE_TIMEOUT_HOURS


def _attach_job_dialogue_preview_metrics(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not jobs:
        return jobs

    jobs_by_id: dict[str, list[dict[str, Any]]] = {}
    numeric_job_ids_by_key: dict[str, int] = {}
    for job in jobs:
        if not isinstance(job, dict):
            continue
        canonical = _canonical_job_id(job.get("id"))
        if not canonical:
            continue
        jobs_by_id.setdefault(canonical, []).append(job)
        normalized = _normalize_job_id(canonical)
        if isinstance(normalized, int):
            numeric_job_ids_by_key.setdefault(canonical, normalized)

    open_counts: dict[str, int] = {key: 0 for key in jobs_by_id.keys()}
    stale_keys: list[str] = []
    numeric_ids_to_fetch: list[int] = []
    cache_now = time.monotonic()

    if numeric_job_ids_by_key:
        with _JOB_DIALOGUE_PREVIEW_CACHE_LOCK:
            for key, numeric_id in numeric_job_ids_by_key.items():
                cached = _JOB_DIALOGUE_PREVIEW_CACHE.get(key)
                if cached and (cache_now - cached[0]) <= _JOB_DIALOGUE_PREVIEW_CACHE_TTL_SECONDS:
                    open_counts[key] = max(0, int(cached[1] or 0))
                    continue
                stale_keys.append(key)
                numeric_ids_to_fetch.append(numeric_id)

    if supabase and numeric_ids_to_fetch:
        try:
            fetched_counts: dict[str, int] = {key: 0 for key in stale_keys}
            app_rows_resp = (
                supabase
                .table("job_applications")
                .select("job_id,status")
                .in_("job_id", list(dict.fromkeys(numeric_ids_to_fetch)))
                .limit(5000)
                .execute()
            )
            for row in _safe_rows(app_rows_resp.data if app_rows_resp else None):
                if not _is_active_dialogue_status(row.get("status")):
                    continue
                row_key = _canonical_job_id(row.get("job_id"))
                if row_key in fetched_counts:
                    fetched_counts[row_key] = fetched_counts.get(row_key, 0) + 1
            with _JOB_DIALOGUE_PREVIEW_CACHE_LOCK:
                cached_at = time.monotonic()
                for key in stale_keys:
                    opened = max(0, int(fetched_counts.get(key, 0) or 0))
                    open_counts[key] = opened
                    _JOB_DIALOGUE_PREVIEW_CACHE[key] = (cached_at, opened)
        except Exception as exc:
            print(f"⚠️ Failed to compute per-role dialogue preview metrics: {exc}")

    for key, group in jobs_by_id.items():
        opened = max(0, int(open_counts.get(key, 0) or 0))
        for job in group:
            limit = _resolve_role_dialogue_limit(job)
            timeout_hours = _resolve_reaction_window_hours(job)
            job["open_dialogues_count"] = opened
            job["dialogue_capacity_limit"] = limit
            job["reaction_window_hours"] = timeout_hours
            job["reaction_window_days"] = max(1, int((timeout_hours + 23) // 24))

    return jobs


def _interaction_state_cache_key(user_id: str, limit: int) -> tuple[str, int]:
    return (str(user_id or ""), max(1, min(20000, int(limit or 10000))))


def _get_cached_user_interaction_state(user_id: str, limit: int) -> tuple[list[str], list[str]] | None:
    key = _interaction_state_cache_key(user_id, limit)
    cached = _INTERACTION_STATE_CACHE.get(key)
    if not cached:
        return None
    cached_at, payload = cached
    if datetime.now(timezone.utc) - cached_at > timedelta(seconds=_INTERACTION_STATE_CACHE_TTL_SECONDS):
        _INTERACTION_STATE_CACHE.pop(key, None)
        return None
    return payload


def _set_cached_user_interaction_state(user_id: str, limit: int, payload: tuple[list[str], list[str]]) -> None:
    _INTERACTION_STATE_CACHE[_interaction_state_cache_key(user_id, limit)] = (datetime.now(timezone.utc), payload)


def _invalidate_user_interaction_state_cache(user_id: str | None) -> None:
    if not user_id:
        return
    prefix = str(user_id)
    keys = [key for key in list(_INTERACTION_STATE_CACHE.keys()) if key[0] == prefix]
    for key in keys:
        _INTERACTION_STATE_CACHE.pop(key, None)


def _fetch_user_interaction_state(user_id: str, limit: int = 10000) -> tuple[list[str], list[str]]:
    if not supabase or not user_id:
        return [], []
    cached = _get_cached_user_interaction_state(user_id, limit)
    if cached is not None:
        return cached
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
        rows = _safe_rows(resp.data if resp else None)
    except Exception as exc:
        print(f"⚠️ Failed to fetch interaction state for user {user_id}: {exc}")
        return [], []

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

    saved_job_ids = sorted([job_id for job_id, is_saved in saved_state_by_job.items() if is_saved])
    saved_set = set(saved_job_ids)
    dismissed_job_ids = sorted(
        [job_id for job_id, is_dismissed in dismissed_state_by_job.items() if is_dismissed and job_id not in saved_set]
    )
    payload = (saved_job_ids, dismissed_job_ids)
    _set_cached_user_interaction_state(user_id, limit, payload)
    return payload


def _filter_out_dismissed_jobs(jobs: list[dict[str, Any]], dismissed_job_ids: set[str]) -> list[dict[str, Any]]:
    if not jobs or not dismissed_job_ids:
        return jobs
    out: list[dict[str, Any]] = []
    for row in jobs:
        job_id = _canonical_job_id((row or {}).get("id"))
        if job_id and job_id in dismissed_job_ids:
            continue
        out.append(row)
    return out


def _filter_existing_job_ids(job_ids: set[str]) -> set[str]:
    if not job_ids:
        return set()
    existing: set[str] = set()
    for jid in job_ids:
        canonical = _canonical_job_id(jid)
        normalized = _normalize_job_id(canonical)
        if not canonical or not isinstance(normalized, int):
            continue
        if _read_job_record(normalized):
            existing.add(canonical)
    return existing


def _is_cached_invalid_interaction_job_id(job_id: Any) -> bool:
    key = _canonical_job_id(job_id)
    if not key:
        return False
    now = time.monotonic()
    with _INVALID_INTERACTION_JOB_CACHE_LOCK:
        cached_at = _INVALID_INTERACTION_JOB_CACHE.get(key)
        if cached_at is None:
            return False
        if now - cached_at <= _INVALID_INTERACTION_JOB_CACHE_TTL_SECONDS:
            return True
        _INVALID_INTERACTION_JOB_CACHE.pop(key, None)
        return False


def _mark_invalid_interaction_job_id(job_id: Any) -> None:
    key = _canonical_job_id(job_id)
    if not key:
        return
    with _INVALID_INTERACTION_JOB_CACHE_LOCK:
        _INVALID_INTERACTION_JOB_CACHE[key] = time.monotonic()


def _clear_invalid_interaction_job_id(job_id: Any) -> None:
    key = _canonical_job_id(job_id)
    if not key:
        return
    with _INVALID_INTERACTION_JOB_CACHE_LOCK:
        _INVALID_INTERACTION_JOB_CACHE.pop(key, None)


def _write_analytics_event(
    event_type: str,
    user_id: str | None = None,
    company_id: str | None = None,
    feature: str | None = None,
    tier: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    if not supabase or not event_type:
        return
    try:
        supabase.table("analytics_events").insert(
            {
                "event_type": event_type,
                "user_id": user_id or None,
                "company_id": company_id or None,
                "feature": feature or None,
                "tier": tier or None,
                "metadata": metadata or {},
                "created_at": now_iso(),
            }
        ).execute()
    except Exception as exc:
        if _is_missing_table_error(exc, "analytics_events"):
            return
        print(f"⚠️ Failed to write analytics event {event_type}: {exc}")


def _write_interaction_feedback_rows(
    feedback_rows: list[dict[str, Any]],
    normalized_signal_type: str,
    raw_event_type: str,
) -> None:
    if not feedback_rows or not supabase:
        return

    recommendation_rows = [
        row for row in feedback_rows
        if str(row.get("signal_type") or "").strip().lower() in _RECOMMENDATION_ALLOWED_SIGNALS
    ]
    valid_job_ids = _filter_existing_job_ids(
        {
            _canonical_job_id(row.get("job_id"))
            for row in feedback_rows
            if isinstance(row, dict) and row.get("job_id") is not None
        }
    )
    if valid_job_ids:
        feedback_rows = [
            row for row in feedback_rows
            if isinstance(row, dict) and _canonical_job_id(row.get("job_id")) in valid_job_ids
        ]
        recommendation_rows = [
            row for row in recommendation_rows
            if isinstance(row, dict) and _canonical_job_id(row.get("job_id")) in valid_job_ids
        ]
    else:
        return

    try:
        if recommendation_rows:
            supabase.table("recommendation_feedback_events").insert(recommendation_rows).execute()
    except Exception as feedback_exc:
        print(f"⚠️ Failed to write recommendation feedback events: {feedback_exc}")

    search_feedback_rows = []
    for row in feedback_rows:
        signal_type = row.get("signal_type")
        if signal_type == normalized_signal_type:
            signal_type = raw_event_type
        search_feedback_rows.append(
            {
                "request_id": row.get("request_id"),
                "user_id": row.get("user_id"),
                "job_id": row.get("job_id"),
                "signal_type": signal_type,
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


def _write_recommendation_exposures(exposure_rows: list[dict[str, Any]]) -> None:
    if not exposure_rows or not supabase:
        return
    try:
        valid_job_ids = _filter_existing_job_ids(
            {
                _canonical_job_id(row.get("job_id"))
                for row in exposure_rows
                if isinstance(row, dict) and row.get("job_id") is not None
            }
        )
        if not valid_job_ids:
            return
        exposure_rows = [
            row for row in exposure_rows
            if isinstance(row, dict) and _canonical_job_id(row.get("job_id")) in valid_job_ids
        ]
        supabase.table("recommendation_exposures").upsert(
            exposure_rows, on_conflict="request_id,user_id,job_id"
        ).execute()
    except Exception as exp_exc:
        print(f"⚠️ Failed to write recommendation exposures: {exp_exc}")


def _write_search_exposures(request_id: str, exposures: list[dict[str, Any]]) -> None:
    global _SEARCH_EXPOSURES_AVAILABLE, _SEARCH_EXPOSURES_WARNING_EMITTED
    if not exposures or not supabase or not _SEARCH_EXPOSURES_AVAILABLE:
        return

    exposure_write_started = datetime.now(timezone.utc)
    try:
        valid_job_ids = _filter_existing_job_ids(
            {
                _canonical_job_id(row.get("job_id"))
                for row in exposures
                if isinstance(row, dict) and row.get("job_id") is not None
            }
        )
        if not valid_job_ids:
            return
        exposures = [
            row for row in exposures
            if isinstance(row, dict) and _canonical_job_id(row.get("job_id")) in valid_job_ids
        ]
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
