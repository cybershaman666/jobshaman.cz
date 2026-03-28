import os
import re
import time
import json
from statistics import median
from typing import Any, cast
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from threading import Lock
from ..core.limiter import limiter
from ..models.requests import JobApplicationCreateRequest, DialogueSolutionSnapshotUpsertRequest, JobDraftUpsertRequest, JobDraftPublishRequest
from ..services.asset_service import load_assets_metadata, serialize_asset_metadata
from ..services.jobs_ai_runtime import (
    _build_application_draft_prompt,
    _coerce_job_analysis_payload,
    _derive_fit_signals,
    _extract_candidate_cv_context,
    _fallback_application_draft,
    _fetch_candidate_profile_for_draft,
    _fetch_cv_document_for_draft,
    _fetch_profile_identity,
    _generate_application_draft_text,
    _job_analysis_prompt,
    _resolve_application_draft_language,
)
from ..services.email import send_application_notification_email
from ..services.jobs_external_runtime import (
    _mark_provider_failure,
    _mark_provider_success,
    _merge_external_job_lists,
    _parse_country_code_csv,
    _provider_circuit_open,
    _provider_health_snapshot,
    _read_cached_external_jobs,
    _write_external_cache_snapshot,
)
from ..services.jobs_interactions_runtime import (
    _INTERACTION_STATE_EVENTS,
    _RECOMMENDATION_ALLOWED_SIGNALS,
    _RECOMMENDATION_SIGNAL_MAP,
    _attach_job_dialogue_preview_metrics,
    _clear_invalid_interaction_job_id,
    _fetch_user_interaction_state,
    _filter_existing_job_ids,
    _filter_out_dismissed_jobs,
    _invalidate_user_interaction_state_cache,
    _is_active_dialogue_status,
    _is_cached_invalid_interaction_job_id,
    _mark_invalid_interaction_job_id,
    _try_get_optional_user_id,
    _write_analytics_event,
    _write_interaction_feedback_rows,
    _write_recommendation_exposures,
    _write_search_exposures,
)
from ..services.job_signal_boost_store import get_latest_published_signal_output_for_candidate_job
from ..services.jobs_shared import (
    _JOB_PUBLIC_PERSON_MAX_RESPONDERS,
    _NATIVE_JOB_SOURCE,
    _canonical_job_id,
    _delete_main_job_shadow_from_supabase,
    _fetch_latest_subscription_by,
    _first_non_empty_text,
    _generate_native_job_id,
    _hydrate_rows_with_primary_jobs,
    _is_active_subscription,
    _is_missing_column_error,
    _is_missing_relationship_error,
    _is_missing_table_error,
    _normalize_job_id,
    _normalize_locale,
    _parse_optional_int,
    _read_job_record,
    _require_company_tier,
    _require_dialogue_publisher_access,
    _require_job_access,
    _safe_dict,
    _safe_positive_int,
    _safe_row,
    _safe_rows,
    _safe_string_list,
    _serialize_job_reference_for_dialogues,
    _string_list_from_json,
    _sync_main_job_shadow_to_supabase,
    _sync_main_job_to_jobs_postgres,
    _trimmed_text,
    _user_has_allowed_subscription,
    _user_has_direct_premium,
)
from ..core.database import supabase
from ..services.job_catalog import (
    count_company_active_jobs as count_company_active_jobs_main,
)
from ..services.jobs_postgres_store import count_active_main_jobs, jobs_postgres_enabled, jobs_postgres_main_enabled
from ..utils.helpers import now_iso
from ..utils.request_urls import get_request_base_url
from ..core import config

router = APIRouter()
_MY_DIALOGUES_CACHE_TTL_SECONDS = 20
_MY_DIALOGUES_CACHE: dict[tuple[str, int], tuple[datetime, dict[str, Any]]] = {}


async def create_job_application(*args, **kwargs):
    from .dialogues import create_dialogue_legacy

    return await create_dialogue_legacy(*args, **kwargs)


async def list_my_job_applications(*args, **kwargs):
    from .dialogues import list_my_dialogues_legacy

    return await list_my_dialogues_legacy(*args, **kwargs)


async def get_my_job_application_detail(*args, **kwargs):
    from .dialogues import get_my_dialogue_detail_legacy

    return await get_my_dialogue_detail_legacy(*args, **kwargs)


async def withdraw_my_job_application(*args, **kwargs):
    from .dialogues import withdraw_my_dialogue_legacy

    return await withdraw_my_dialogue_legacy(*args, **kwargs)


async def list_my_application_messages(*args, **kwargs):
    from .dialogues import list_my_dialogue_messages_legacy

    return await list_my_dialogue_messages_legacy(*args, **kwargs)


async def create_my_application_message(*args, **kwargs):
    from .dialogues import create_my_dialogue_message_legacy

    return await create_my_dialogue_message_legacy(*args, **kwargs)


async def list_company_applications(*args, **kwargs):
    from .dialogues import list_company_dialogues_legacy

    return await list_company_dialogues_legacy(*args, **kwargs)


async def get_company_application_detail(*args, **kwargs):
    from .dialogues import get_company_dialogue_detail_legacy

    return await get_company_dialogue_detail_legacy(*args, **kwargs)


async def list_company_application_messages(*args, **kwargs):
    from .dialogues import list_company_dialogue_messages_legacy

    return await list_company_dialogue_messages_legacy(*args, **kwargs)


async def create_company_application_message(*args, **kwargs):
    from .dialogues import create_company_dialogue_message_legacy

    return await create_company_dialogue_message_legacy(*args, **kwargs)


async def update_company_application_status(*args, **kwargs):
    from .dialogues import update_company_dialogue_status_legacy

    return await update_company_dialogue_status_legacy(*args, **kwargs)


@router.get("/jobs/stats/active-count")
async def jobs_active_count():
    if not jobs_postgres_main_enabled():
        return {
            "total_count": 0,
            "source": "jobs_postgres_disabled",
        }
    try:
        return {
            "total_count": int(count_active_main_jobs() or 0),
            "source": "jobs_postgres",
        }
    except Exception as exc:
        print(f"⚠️ Failed to read Jobs Postgres active-count: {exc}")
        return JSONResponse(
            status_code=503,
            content={
                "total_count": 0,
                "source": "jobs_postgres_error",
                "error": "jobs_postgres_active_count_unavailable",
            },
        )


def _my_dialogues_cache_key(user_id: str, limit: int) -> tuple[str, int]:
    return (str(user_id or ""), max(1, min(200, int(limit or 80))))


def _get_cached_my_dialogues(user_id: str, limit: int) -> dict[str, Any] | None:
    cached = _MY_DIALOGUES_CACHE.get(_my_dialogues_cache_key(user_id, limit))
    if not cached:
        return None
    cached_at, payload = cached
    if datetime.now(timezone.utc) - cached_at > timedelta(seconds=_MY_DIALOGUES_CACHE_TTL_SECONDS):
        _MY_DIALOGUES_CACHE.pop(_my_dialogues_cache_key(user_id, limit), None)
        return None
    return payload


def _set_cached_my_dialogues(user_id: str, limit: int, payload: dict[str, Any]) -> None:
    _MY_DIALOGUES_CACHE[_my_dialogues_cache_key(user_id, limit)] = (datetime.now(timezone.utc), payload)


def _invalidate_my_dialogues_cache(user_id: str | None) -> None:
    normalized = str(user_id or "").strip()
    if not normalized:
        return
    stale_keys = [key for key in _MY_DIALOGUES_CACHE.keys() if key[0] == normalized]
    for key in stale_keys:
        _MY_DIALOGUES_CACHE.pop(key, None)


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


_COMPANY_TIER_JOB_LIMITS: dict[str, int] = {
    "free": 1,
    "trial": 1,
    "starter": 3,
    "growth": 10,
    "professional": 20,
    "enterprise": 999999,
}

_COMPANY_TIER_ROLE_OPEN_LIMITS: dict[str, int] = {
    "free": 1,
    "trial": 1,
    "starter": 3,
    "growth": 10,
    "professional": 25,
    "enterprise": 999999,
}

_COMPANY_TIER_DIALOGUE_SLOT_LIMITS: dict[str, int] = {
    "free": 3,
    "trial": 3,
    "starter": 12,
    "growth": 40,
    "professional": 100,
    "enterprise": 999999,
}


def _count_company_active_jobs(company_id: str, exclude_job_id=None) -> int:
    return count_company_active_jobs_main(company_id, exclude_job_id=exclude_job_id)


def _enforce_company_job_publish_limit(company_id: str, user: dict, existing_job_id=None) -> None:
    tier = _require_company_tier(
        user,
        company_id,
        {"free", "trial", "starter", "growth", "professional", "enterprise"},
    )
    limit = _COMPANY_TIER_JOB_LIMITS.get(tier, _COMPANY_TIER_JOB_LIMITS["free"])
    active_jobs = _count_company_active_jobs(company_id, exclude_job_id=existing_job_id)
    if active_jobs >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Current plan allows up to {limit} active job postings",
        )


def _sync_company_active_jobs_usage(company_id: str) -> None:
    if not supabase or not company_id:
        return
    company_sub = _fetch_latest_subscription_by("company_id", company_id)
    subscription_id = str((company_sub or {}).get("id") or "")
    if not subscription_id:
        return
    active_jobs = _count_company_active_jobs(company_id)
    try:
        usage_resp = (
            supabase
            .table("subscription_usage")
            .select("id")
            .eq("subscription_id", subscription_id)
            .order("period_end", desc=True)
            .limit(1)
            .execute()
        )
        usage_rows = _safe_rows(usage_resp.data if usage_resp else None)
        if usage_rows:
            supabase.table("subscription_usage").update({"active_jobs_count": active_jobs}).eq("id", usage_rows[0]["id"]).execute()
    except Exception as exc:
        print(f"⚠️ Failed to sync active job usage for company {company_id}: {exc}")


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
_CANDIDATE_TIER_DIALOGUE_LIMITS: dict[str, int] = {
    "free": 3,
    "premium": 25,
}
_DIALOGUE_RESPONSE_TIMEOUT_HOURS: int = 72
_ROLE_DIALOGUE_PREVIEW_LIMIT: int = max(1, int(os.getenv("ROLE_DIALOGUE_PREVIEW_LIMIT", "25")))


def _get_latest_usage_row_for_subscription(subscription_id: str) -> dict | None:
    if not supabase or not subscription_id:
        return None
    try:
        usage_resp = (
            supabase
            .table("subscription_usage")
            .select("*")
            .eq("subscription_id", subscription_id)
            .order("period_end", desc=True)
            .limit(1)
            .execute()
        )
        rows = _safe_rows(usage_resp.data if usage_resp else None)
        return rows[0] if rows else None
    except Exception:
        return None


def _is_active_dialogue_status(status_value: Any) -> bool:
    status = str(status_value or "pending").strip().lower()
    if not status:
        status = "pending"
    return status not in _DIALOGUE_TERMINAL_STATUSES


def _serialize_dialogue_runtime(row: dict | None) -> dict[str, Any]:
    source = row or {}
    payload = _safe_dict(source.get("application_payload"))
    deadline_at = str(payload.get("dialogue_deadline_at") or "").strip() or None
    current_turn = str(payload.get("dialogue_current_turn") or "").strip() or None
    close_reason = str(payload.get("dialogue_closed_reason") or "").strip() or None
    closed_at = str(payload.get("dialogue_closed_at") or "").strip() or None
    timeout_hours_raw = payload.get("dialogue_timeout_hours")
    try:
        timeout_hours = int(timeout_hours_raw) if timeout_hours_raw is not None else _DIALOGUE_RESPONSE_TIMEOUT_HOURS
    except Exception:
        timeout_hours = _DIALOGUE_RESPONSE_TIMEOUT_HOURS

    status = str(source.get("status") or "").strip().lower()
    if status == "closed_timeout" and not close_reason:
        close_reason = "timeout"
    if status == "closed_timeout" and not closed_at:
        closed_at = str(source.get("updated_at") or source.get("reviewed_at") or "").strip() or None

    deadline_dt = _parse_iso_datetime(deadline_at or "")
    is_overdue = bool(
        deadline_dt
        and _is_active_dialogue_status(source.get("status"))
        and deadline_dt <= datetime.now(timezone.utc)
    )

    return {
        "dialogue_deadline_at": deadline_at,
        "dialogue_current_turn": current_turn,
        "dialogue_timeout_hours": timeout_hours,
        "dialogue_closed_reason": close_reason,
        "dialogue_closed_at": closed_at,
        "dialogue_is_overdue": is_overdue,
    }


def _build_dialogue_timeout_payload(existing_payload: Any, current_turn: str) -> dict[str, Any]:
    payload = _safe_dict(existing_payload)
    current_turn_value = str(current_turn or "").strip().lower() or "company"
    payload["dialogue_timeout_hours"] = _DIALOGUE_RESPONSE_TIMEOUT_HOURS
    payload["dialogue_current_turn"] = current_turn_value
    payload["dialogue_deadline_at"] = (
        datetime.now(timezone.utc) + timedelta(hours=_DIALOGUE_RESPONSE_TIMEOUT_HOURS)
    ).isoformat()
    payload.pop("dialogue_closed_reason", None)
    payload.pop("dialogue_closed_at", None)
    return payload


def _build_closed_dialogue_payload(existing_payload: Any, close_reason: str) -> dict[str, Any]:
    payload = _safe_dict(existing_payload)
    payload["dialogue_timeout_hours"] = _DIALOGUE_RESPONSE_TIMEOUT_HOURS
    payload.pop("dialogue_current_turn", None)
    payload.pop("dialogue_deadline_at", None)
    payload["dialogue_closed_reason"] = str(close_reason or "closed").strip().lower()
    payload["dialogue_closed_at"] = now_iso()
    return payload


def _resolve_dialogue_runtime_status(row: dict | None) -> str:
    source = row or {}
    normalized_status = str(source.get("status") or "").strip().lower() or "pending"
    close_reason = _normalize_dialogue_close_reason(_safe_dict(source.get("application_payload")).get("dialogue_closed_reason"))

    if normalized_status == "rejected":
        if close_reason == "timeout":
            return "closed_timeout"
        if close_reason == "withdrawn":
            return "withdrawn"
        if close_reason == "role_filled":
            return "closed_role_filled"
        if close_reason == "closed":
            return "closed"
    if normalized_status == "closed" and close_reason == "timeout":
        return "closed_timeout"
    return normalized_status


def _normalize_dialogue_close_reason(value: Any) -> str | None:
    raw = str(value or "").strip().lower()
    if not raw:
        return None

    mapping = {
        "closed_timeout": "timeout",
        "timeout": "timeout",
        "closed_rejected": "rejected",
        "rejected": "rejected",
        "closed_withdrawn": "withdrawn",
        "withdrawn": "withdrawn",
        "closed_role_filled": "role_filled",
        "role_filled": "role_filled",
        "filled": "role_filled",
        "hired": "hired",
        "hire": "hired",
        "closed": "closed",
    }
    if raw in mapping:
        return mapping[raw]
    if raw.startswith("closed_"):
        return raw.replace("closed_", "", 1) or "closed"
    return raw


def _dialogue_close_reason_label(value: Any) -> str | None:
    normalized = _normalize_dialogue_close_reason(value)
    if not normalized:
        return None

    labels = {
        "timeout": "Closed by timeout",
        "rejected": "Rejected",
        "withdrawn": "Candidate withdrew",
        "role_filled": "Role filled",
        "hired": "Hired",
        "closed": "Closed",
    }
    if normalized in labels:
        return labels[normalized]
    return normalized.replace("_", " ").strip().title() or "Closed"


def _build_dialogue_activity_payload(
    application_id: str,
    status: Any,
    close_reason: Any = None,
) -> dict[str, Any]:
    status_value = str(status or "pending").strip().lower() or "pending"
    normalized_close_reason = _normalize_dialogue_close_reason(close_reason or status_value)
    payload: dict[str, Any] = {
        "application_id": application_id,
        "status": status_value,
    }
    if _is_active_dialogue_status(status_value):
        return payload

    payload["close_reason"] = normalized_close_reason or "closed"
    payload["close_reason_label"] = _dialogue_close_reason_label(normalized_close_reason or "closed") or "Closed"
    return payload


def _normalize_dialogue_persisted_status(status: Any) -> str | None:
    normalized = str(status or "").strip().lower()
    if not normalized:
        return None
    if normalized in {"pending", "reviewed", "shortlisted", "rejected", "hired"}:
        return normalized
    if normalized in {"withdrawn", "closed", "timeout", "role_filled"}:
        return "rejected"
    if normalized.startswith("closed_"):
        return "rejected"
    return normalized


def _normalize_role_status(value: Any) -> str | None:
    raw = str(value or "").strip().lower()
    if not raw:
        return None

    mapping = {
        "published": "active",
        "open": "active",
        "reopened": "active",
        "live": "active",
    }
    return mapping.get(raw, raw)


def _role_status_label(value: Any) -> str | None:
    normalized = _normalize_role_status(value)
    if not normalized:
        return None

    labels = {
        "active": "Active",
        "paused": "Paused",
        "closed": "Closed",
        "archived": "Archived",
        "draft": "Draft",
        "published_linked": "Published",
    }
    if normalized in labels:
        return labels[normalized]
    return normalized.replace("_", " ").strip().title() or None


def _build_role_activity_payload(
    job_id: str,
    job_title: str,
    *,
    version_number: Any = None,
    previous_status: Any = None,
    next_status: Any = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "job_id": str(job_id or "").strip(),
        "job_title": str(job_title or "").strip(),
    }

    if version_number is not None:
        payload["version_number"] = version_number

    normalized_previous = _normalize_role_status(previous_status)
    normalized_next = _normalize_role_status(next_status)
    if normalized_previous:
        payload["previous_status"] = normalized_previous
        payload["previous_status_label"] = _role_status_label(normalized_previous) or normalized_previous.title()
    if normalized_next:
        payload["next_status"] = normalized_next
        payload["next_status_label"] = _role_status_label(normalized_next) or normalized_next.title()

    current_status = normalized_next or normalized_previous
    if current_status:
        payload["role_status"] = current_status
        payload["role_status_label"] = _role_status_label(current_status) or current_status.title()

    return payload


def _persist_dialogue_state(application_id: str, application_payload: dict | None = None, status: str | None = None) -> bool:
    if not supabase or not application_id:
        return False

    persisted_status = _normalize_dialogue_persisted_status(status)
    update_payload: dict[str, Any] = {}
    if persisted_status is not None:
        update_payload["status"] = persisted_status
    if application_payload is not None:
        update_payload["application_payload"] = application_payload
    if not update_payload:
        return False

    try:
        try:
            with_timestamp = dict(update_payload)
            with_timestamp["updated_at"] = now_iso()
            supabase.table("job_applications").update(with_timestamp).eq("id", application_id).execute()
            return True
        except Exception as exc:
            if _is_missing_column_error(exc, "updated_at"):
                supabase.table("job_applications").update(update_payload).eq("id", application_id).execute()
                return True
            raise
    except Exception as exc:
        if application_payload is not None and _is_missing_column_error(exc, "application_payload"):
            if persisted_status is None:
                return False
            status_payload = {"status": persisted_status}
            try:
                try:
                    supabase.table("job_applications").update({
                        "status": persisted_status,
                        "updated_at": now_iso(),
                    }).eq("id", application_id).execute()
                except Exception as update_exc:
                    if _is_missing_column_error(update_exc, "updated_at"):
                        supabase.table("job_applications").update(status_payload).eq("id", application_id).execute()
                    else:
                        raise
                return True
            except Exception as status_exc:
                print(f"⚠️ Failed to persist dialogue status for {application_id}: {status_exc}")
                return False
        print(f"⚠️ Failed to persist dialogue state for {application_id}: {exc}")
        return False


def _schedule_dialogue_timeout(row: dict | None, current_turn: str) -> dict:
    source = dict(row or {})
    application_id = str(source.get("id") or source.get("application_id") or "").strip()
    payload = _build_dialogue_timeout_payload(source.get("application_payload"), current_turn=current_turn)
    _persist_dialogue_state(application_id, application_payload=payload)
    source["application_payload"] = payload
    source["updated_at"] = now_iso()
    return source


def _expire_dialogue_if_needed(row: dict | None, sync_company_usage: bool = True) -> dict:
    source = dict(row or {})
    if source:
        source["status"] = _resolve_dialogue_runtime_status(source)
    if not source or not _is_active_dialogue_status(source.get("status")):
        return source

    runtime = _serialize_dialogue_runtime(source)
    if not runtime.get("dialogue_is_overdue"):
        return source

    application_id = str(source.get("id") or source.get("application_id") or "").strip()
    closed_payload = _build_closed_dialogue_payload(source.get("application_payload"), close_reason="timeout")
    persisted = _persist_dialogue_state(application_id, application_payload=closed_payload, status="closed_timeout")
    source["status"] = "closed_timeout"
    source["application_payload"] = closed_payload
    source["updated_at"] = now_iso()
    company_id = str(source.get("company_id") or "").strip()
    if persisted and company_id:
        _write_company_activity_log(
            company_id=company_id,
            event_type="application_status_changed",
            payload=_build_dialogue_activity_payload(
                application_id=application_id,
                status="closed_timeout",
                close_reason="timeout",
            ),
            actor_user_id=None,
            subject_type="application",
            subject_id=application_id,
        )
    if sync_company_usage and source.get("company_id"):
        _sync_company_dialogue_slots_usage(str(source.get("company_id") or ""))
    return source


def _count_candidate_active_dialogues(candidate_id: str) -> int:
    if not supabase or not candidate_id:
        return 0
    try:
        try:
            resp = (
                supabase
                .table("job_applications")
                .select("id,status,company_id,application_payload")
                .eq("candidate_id", candidate_id)
                .execute()
            )
        except Exception as exc:
            if not _is_missing_column_error(exc, "application_payload"):
                raise
            resp = (
                supabase
                .table("job_applications")
                .select("id,status,company_id")
                .eq("candidate_id", candidate_id)
                .execute()
            )
        total = 0
        for row in _safe_rows(resp.data if resp else None):
            normalized_row = _expire_dialogue_if_needed(row, sync_company_usage=False)
            if _is_active_dialogue_status((normalized_row or {}).get("status")):
                total += 1
        return total
    except Exception:
        return 0


def _resolve_candidate_dialogue_limit(candidate_id: str, user: dict | None = None) -> int:
    if not candidate_id:
        return _CANDIDATE_TIER_DIALOGUE_LIMITS["free"]
    if user and _user_has_direct_premium(user):
        return _CANDIDATE_TIER_DIALOGUE_LIMITS["premium"]
    candidate_sub = _fetch_latest_subscription_by("user_id", candidate_id)
    if candidate_sub and _is_active_subscription(candidate_sub):
        candidate_tier = str(candidate_sub.get("tier") or "").strip().lower()
        if candidate_tier == "premium":
            return _CANDIDATE_TIER_DIALOGUE_LIMITS["premium"]
    return _CANDIDATE_TIER_DIALOGUE_LIMITS["free"]


def _serialize_candidate_dialogue_capacity(candidate_id: str, user: dict | None = None) -> dict[str, int]:
    used = _count_candidate_active_dialogues(candidate_id)
    limit = _resolve_candidate_dialogue_limit(candidate_id, user=user)
    return {
        "active": used,
        "limit": limit,
        "remaining": max(0, limit - used),
    }


def _serialize_candidate_dialogue_capacity_from_rows(candidate_id: str, rows: list[dict] | None, user: dict | None = None) -> dict[str, int]:
    normalized_rows = rows or []
    used = 0
    for row in normalized_rows:
        if _is_active_dialogue_status((row or {}).get("status")):
            used += 1
    limit = _resolve_candidate_dialogue_limit(candidate_id, user=user)
    return {
        "active": used,
        "limit": limit,
        "remaining": max(0, limit - used),
    }


def _enforce_candidate_dialogue_limit(candidate_id: str, user: dict | None = None) -> None:
    current_active = _count_candidate_active_dialogues(candidate_id)
    limit = _resolve_candidate_dialogue_limit(candidate_id, user=user)
    if current_active >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Candidate limit reached: maximum {limit} active dialogues",
        )


def _count_company_active_dialogues(company_id: str) -> int:
    if not supabase or not company_id:
        return 0
    try:
        try:
            resp = (
                supabase
                .table("job_applications")
                .select("id,status,company_id,application_payload")
                .eq("company_id", company_id)
                .execute()
            )
        except Exception as exc:
            if not _is_missing_column_error(exc, "application_payload"):
                raise
            resp = (
                supabase
                .table("job_applications")
                .select("id,status,company_id")
                .eq("company_id", company_id)
                .execute()
            )
        total = 0
        for row in _safe_rows(resp.data if resp else None):
            normalized_row = _expire_dialogue_if_needed(row, sync_company_usage=False)
            if _is_active_dialogue_status((normalized_row or {}).get("status")):
                total += 1
        return total
    except Exception:
        return 0


def _sync_company_dialogue_slots_usage(company_id: str) -> None:
    if not supabase or not company_id:
        return
    company_sub = _fetch_latest_subscription_by("company_id", company_id)
    subscription_id = str((company_sub or {}).get("id") or "")
    if not subscription_id:
        return
    usage_row = _get_latest_usage_row_for_subscription(subscription_id)
    if not usage_row:
        return
    active_dialogues = _count_company_active_dialogues(company_id)
    try:
        supabase.table("subscription_usage").update({
            "active_dialogue_slots_used": active_dialogues
        }).eq("id", usage_row["id"]).execute()
    except Exception as exc:
        if not _is_missing_column_error(exc, "active_dialogue_slots_used"):
            print(f"⚠️ Failed to sync dialogue slot usage for company {company_id}: {exc}")


def _increment_company_role_opens_usage(company_id: str) -> None:
    if not supabase or not company_id:
        return
    company_sub = _fetch_latest_subscription_by("company_id", company_id)
    subscription_id = str((company_sub or {}).get("id") or "")
    if not subscription_id:
        return
    usage_row = _get_latest_usage_row_for_subscription(subscription_id)
    if not usage_row:
        return
    next_value = int((usage_row.get("role_opens_used") or 0) or 0) + 1
    try:
        supabase.table("subscription_usage").update({
            "role_opens_used": next_value
        }).eq("id", usage_row["id"]).execute()
    except Exception as exc:
        if not _is_missing_column_error(exc, "role_opens_used"):
            print(f"⚠️ Failed to increment role opens usage for company {company_id}: {exc}")


def _enforce_company_dialogue_slot_limit(company_id: str, user: dict) -> None:
    tier = _require_company_tier(
        user,
        company_id,
        {"free", "trial", "starter", "growth", "professional", "enterprise"},
    )
    limit = _COMPANY_TIER_DIALOGUE_SLOT_LIMITS.get(tier, _COMPANY_TIER_DIALOGUE_SLOT_LIMITS["free"])
    active_dialogues = _count_company_active_dialogues(company_id)
    if active_dialogues >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Current plan allows up to {limit} active dialogue slots",
        )


def _enforce_company_role_open_limit(company_id: str, user: dict) -> None:
    tier = _require_company_tier(
        user,
        company_id,
        {"free", "trial", "starter", "growth", "professional", "enterprise"},
    )
    limit = _COMPANY_TIER_ROLE_OPEN_LIMITS.get(tier, _COMPANY_TIER_ROLE_OPEN_LIMITS["free"])
    company_sub = _fetch_latest_subscription_by("company_id", company_id)
    subscription_id = str((company_sub or {}).get("id") or "")
    usage_row = _get_latest_usage_row_for_subscription(subscription_id) if subscription_id else None
    used = int((usage_row or {}).get("role_opens_used") or 0)
    if used >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Current plan allows up to {limit} role opens in the current billing period",
        )

def _empty_job_human_context_trust() -> dict[str, Any]:
    return {
        "dialogues_last_90d": None,
        "median_first_response_hours_last_90d": None,
    }


def _empty_job_human_context_payload() -> dict[str, Any]:
    return {
        "publisher": None,
        "responders": [],
        "trust": _empty_job_human_context_trust(),
    }


def _normalize_public_person_kind(value: Any) -> str | None:
    normalized = str(value or "").strip().lower()
    if normalized in {"publisher", "responder"}:
        return normalized
    return None

def _normalize_company_team_member_profiles(value: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(value, dict):
        return {}
    normalized: dict[str, dict[str, Any]] = {}
    for raw_key, raw_value in value.items():
        key = _trimmed_text(raw_key, 160)
        if not key or not isinstance(raw_value, dict):
            continue
        normalized[key] = {
            "invited_email": _trimmed_text(raw_value.get("invited_email"), 180) or None,
            "company_role": _trimmed_text(raw_value.get("company_role"), 120) or None,
            "relation_to_company": _trimmed_text(raw_value.get("relation_to_company"), 160) or None,
            "short_bio": _trimmed_text(raw_value.get("short_bio"), 280) or None,
        }
    return normalized


def _fetch_company_team_context(company_id: str) -> tuple[str | None, dict[str, dict[str, Any]]]:
    if not supabase or not company_id:
        return None, {}
    try:
        try:
            resp = supabase.table("companies").select("owner_id,team_member_profiles").eq("id", company_id).maybe_single().execute()
        except Exception as exc:
            if not _is_missing_column_error(exc, "team_member_profiles"):
                raise
            resp = supabase.table("companies").select("owner_id").eq("id", company_id).maybe_single().execute()
        row = _safe_dict(resp.data if resp else None)
        owner_id = str(row.get("owner_id") or "").strip() or None
        team_profiles = _normalize_company_team_member_profiles(row.get("team_member_profiles"))
        return owner_id, team_profiles
    except Exception:
        return None, {}


def _fetch_company_owner_id(company_id: str) -> str | None:
    owner_id, _team_profiles = _fetch_company_team_context(company_id)
    return owner_id


def _fetch_company_member_rows(company_id: str) -> list[dict[str, Any]]:
    if not supabase or not company_id:
        return []
    try:
        try:
            resp = (
                supabase
                .table("company_members")
                .select("id,user_id,role,invited_at,created_at,is_active")
                .eq("company_id", company_id)
                .eq("is_active", True)
                .limit(500)
                .execute()
            )
        except Exception as exc:
            if not _is_missing_column_error(exc, "is_active"):
                raise
            resp = (
                supabase
                .table("company_members")
                .select("id,user_id,role,invited_at,created_at")
                .eq("company_id", company_id)
                .limit(500)
                .execute()
            )
        return _safe_rows(resp.data if resp else None)
    except Exception as exc:
        if not _is_missing_table_error(exc, "company_members"):
            print(f"⚠️ Failed to load company members for human context ({company_id}): {exc}")
        return []


def _read_company_team_member_profile(
    team_profiles: dict[str, dict[str, Any]],
    *,
    member_id: str | None = None,
    user_id: str | None = None,
    source: str = "member",
) -> dict[str, Any]:
    keys = [
        f"{source}:{_trimmed_text(member_id, 120)}" if member_id else "",
        f"owner:{_trimmed_text(user_id, 120)}" if user_id else "",
        f"member:{_trimmed_text(member_id, 120)}" if member_id else "",
    ]
    for key in keys:
        if key and key in team_profiles:
            return team_profiles[key]
    return {}


def _fetch_company_public_member_ids(company_id: str) -> set[str]:
    if not supabase or not company_id:
        return set()
    user_ids: set[str] = set()
    owner_id, _team_profiles = _fetch_company_team_context(company_id)
    if owner_id:
        user_ids.add(owner_id)
    for row in _fetch_company_member_rows(company_id):
        user_id = str((row or {}).get("user_id") or "").strip()
        if user_id:
            user_ids.add(user_id)
    return user_ids


def _fetch_profiles_map(user_ids: set[str]) -> dict[str, dict[str, Any]]:
    if not supabase or not user_ids:
        return {}
    profiles_by_id: dict[str, dict[str, Any]] = {}
    ids = [uid for uid in user_ids if uid]
    batch_size = 200
    for index in range(0, len(ids), batch_size):
        chunk = ids[index:index + batch_size]
        try:
            resp = (
                supabase
                .table("profiles")
                .select("id,full_name,email,avatar_url")
                .in_("id", chunk)
                .limit(len(chunk))
                .execute()
            )
            for row in _safe_rows(resp.data if resp else None):
                row_id = str((row or {}).get("id") or "").strip()
                if row_id:
                    profiles_by_id[row_id] = row
        except Exception as exc:
            print(f"⚠️ Failed to load profile snapshots for human context: {exc}")
            break
    return profiles_by_id


def _normalize_human_context_editor_state(editor_state: Any) -> dict[str, Any]:
    human_context = _safe_dict(_safe_dict(editor_state).get("human_context"))
    publisher = human_context.get("publisher")
    responders = human_context.get("responders")
    return {
        "publisher": publisher if isinstance(publisher, dict) else None,
        "responders": responders if isinstance(responders, list) else [],
    }


def _normalize_job_public_person_input(
    value: Any,
    *,
    person_kind: str,
    allowed_user_ids: set[str],
    profiles_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    user_id = _trimmed_text(value.get("user_id") or value.get("person_id"), 120)
    if not user_id or user_id not in allowed_user_ids:
        return None

    profile = profiles_by_id.get(user_id, {})
    display_name = _trimmed_text(
        value.get("display_name") or profile.get("full_name") or profile.get("email") or "Team member",
        120,
    )
    display_role = _trimmed_text(value.get("display_role"), 120) or (
        "Hiring manager" if person_kind == "publisher" else "Team member"
    )
    short_context = _trimmed_text(value.get("short_context"), 280) or None
    avatar_url = _trimmed_text(value.get("avatar_url") or profile.get("avatar_url"), 500) or None

    return {
        "user_id": user_id,
        "person_kind": person_kind,
        "display_name": display_name,
        "display_role": display_role,
        "avatar_url": avatar_url,
        "short_context": short_context,
        "display_order": 0,
        "is_visible": True,
    }


def _normalize_job_public_people_from_editor_state(editor_state: Any, company_id: str) -> list[dict[str, Any]]:
    allowed_user_ids = _fetch_company_public_member_ids(company_id)
    if not allowed_user_ids:
        return []
    profiles_by_id = _fetch_profiles_map(allowed_user_ids)
    normalized_state = _normalize_human_context_editor_state(editor_state)
    rows: list[dict[str, Any]] = []
    used_user_ids: set[str] = set()

    publisher = _normalize_job_public_person_input(
        normalized_state.get("publisher"),
        person_kind="publisher",
        allowed_user_ids=allowed_user_ids,
        profiles_by_id=profiles_by_id,
    )
    if publisher:
        publisher["display_order"] = 0
        rows.append(publisher)
        used_user_ids.add(str(publisher.get("user_id") or ""))

    for responder_source in normalized_state.get("responders") or []:
        responder = _normalize_job_public_person_input(
            responder_source,
            person_kind="responder",
            allowed_user_ids=allowed_user_ids,
            profiles_by_id=profiles_by_id,
        )
        responder_user_id = str((responder or {}).get("user_id") or "")
        if not responder or not responder_user_id or responder_user_id in used_user_ids:
            continue
        used_user_ids.add(responder_user_id)
        responder["display_order"] = len(rows)
        rows.append(responder)
        if len(rows) >= _JOB_PUBLIC_PERSON_MAX_RESPONDERS + (1 if publisher else 0):
            break
    return rows


def _sync_job_public_people(job_id: Any, company_id: str, editor_state: Any) -> None:
    if not supabase or not company_id:
        return
    normalized_job_id = _normalize_job_id(job_id)
    if not isinstance(normalized_job_id, int):
        return
    rows = _normalize_job_public_people_from_editor_state(editor_state, company_id)
    try:
        supabase.table("job_public_people").delete().eq("job_id", normalized_job_id).eq("company_id", company_id).execute()
    except Exception as exc:
        if _is_missing_table_error(exc, "job_public_people"):
            print("⚠️ job_public_people table missing during publish sync.")
            return
        print(f"⚠️ Failed to clear job public people for job {normalized_job_id}: {exc}")
        return

    if not rows:
        return

    timestamp = now_iso()
    insert_payload = [
        {
            "job_id": normalized_job_id,
            "company_id": company_id,
            "user_id": row.get("user_id"),
            "person_kind": row.get("person_kind"),
            "display_name": row.get("display_name"),
            "display_role": row.get("display_role"),
            "avatar_url": row.get("avatar_url"),
            "short_context": row.get("short_context"),
            "display_order": row.get("display_order") or 0,
            "is_visible": True,
            "created_at": timestamp,
            "updated_at": timestamp,
        }
        for row in rows
    ]
    try:
        supabase.table("job_public_people").insert(insert_payload).execute()
    except Exception as exc:
        print(f"⚠️ Failed to persist job public people for job {normalized_job_id}: {exc}")


def _serialize_job_public_person(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "job_id": row.get("job_id"),
        "company_id": row.get("company_id"),
        "user_id": row.get("user_id"),
        "person_kind": _normalize_public_person_kind(row.get("person_kind")),
        "display_name": _trimmed_text(row.get("display_name"), 120),
        "display_role": _trimmed_text(row.get("display_role"), 120),
        "avatar_url": _trimmed_text(row.get("avatar_url"), 500) or None,
        "short_context": _trimmed_text(row.get("short_context"), 280) or None,
        "display_order": int(row.get("display_order") or 0),
    }


def _load_valid_job_public_people(job_id: Any, company_id: str) -> list[dict[str, Any]]:
    if not supabase or not company_id:
        return []
    normalized_job_id = _normalize_job_id(job_id)
    if not isinstance(normalized_job_id, int):
        return []
    try:
        resp = (
            supabase
            .table("job_public_people")
            .select("*")
            .eq("job_id", normalized_job_id)
            .eq("company_id", company_id)
            .eq("is_visible", True)
            .order("display_order")
            .order("created_at")
            .limit(12)
            .execute()
        )
    except Exception as exc:
        if _is_missing_table_error(exc, "job_public_people"):
            return []
        print(f"⚠️ Failed to load job public people for job {normalized_job_id}: {exc}")
        return []

    allowed_user_ids = _fetch_company_public_member_ids(company_id)
    rows: list[dict[str, Any]] = []
    for row in _safe_rows(resp.data if resp else None):
        kind = _normalize_public_person_kind((row or {}).get("person_kind"))
        user_id = str((row or {}).get("user_id") or "").strip()
        if not kind or not user_id or user_id not in allowed_user_ids:
            continue
        rows.append(row)
    return rows


def _build_job_human_context_editor_state(job_id: Any, company_id: str) -> dict[str, Any]:
    rows = _load_valid_job_public_people(job_id, company_id)
    publisher = None
    responders: list[dict[str, Any]] = []
    for row in rows:
        serialized = _serialize_job_public_person(row)
        if serialized.get("person_kind") == "publisher" and publisher is None:
            publisher = serialized
            continue
        if serialized.get("person_kind") == "responder" and len(responders) < _JOB_PUBLIC_PERSON_MAX_RESPONDERS:
            responders.append(serialized)
    return {
        "publisher": publisher,
        "responders": responders,
    }


def _compute_company_human_context_trust(company_id: str) -> dict[str, Any]:
    if not supabase or not company_id:
        return _empty_job_human_context_trust()

    since_dt = datetime.now(timezone.utc) - timedelta(days=90)
    since_iso = since_dt.isoformat()
    dialogues_count: int | None = 0
    application_rows: list[dict[str, Any]] = []

    try:
        count_resp = (
            supabase
            .table("job_applications")
            .select("id", count=cast(Any, "exact"))
            .eq("company_id", company_id)
            .gte("created_at", since_iso)
            .limit(1)
            .execute()
        )
        if count_resp.count is not None:
            dialogues_count = int(count_resp.count)
    except Exception as exc:
        print(f"⚠️ Failed to count human-context dialogues for company {company_id}: {exc}")
        dialogues_count = None

    try:
        app_resp = (
            supabase
            .table("job_applications")
            .select("id,created_at,submitted_at,reviewed_at")
            .eq("company_id", company_id)
            .gte("created_at", since_iso)
            .order("created_at", desc=True)
            .limit(5000)
            .execute()
        )
        application_rows = _safe_rows(app_resp.data if app_resp else None)
    except Exception as exc:
        print(f"⚠️ Failed to load human-context dialogue rows for company {company_id}: {exc}")
        application_rows = []

    if dialogues_count is None:
        dialogues_count = len(application_rows)

    if not application_rows:
        return {
            "dialogues_last_90d": dialogues_count,
            "median_first_response_hours_last_90d": None,
        }

    app_ids = [str((row or {}).get("id") or "").strip() for row in application_rows if str((row or {}).get("id") or "").strip()]
    first_message_by_application: dict[str, datetime] = {}
    batch_size = 200
    for index in range(0, len(app_ids), batch_size):
        chunk = app_ids[index:index + batch_size]
        try:
            message_resp = (
                supabase
                .table("application_messages")
                .select("application_id,sender_role,created_at")
                .in_("application_id", chunk)
                .eq("sender_role", "recruiter")
                .order("created_at")
                .limit(5000)
                .execute()
            )
        except Exception as exc:
            if _is_missing_table_error(exc, "application_messages"):
                break
            print(f"⚠️ Failed to load human-context message rows for company {company_id}: {exc}")
            continue
        for row in _safe_rows(message_resp.data if message_resp else None):
            application_id = str((row or {}).get("application_id") or "").strip()
            created_at = _parse_iso_datetime(str((row or {}).get("created_at") or ""))
            if not application_id or created_at is None or application_id in first_message_by_application:
                continue
            first_message_by_application[application_id] = created_at

    response_hours: list[float] = []
    for row in application_rows:
        application_id = str((row or {}).get("id") or "").strip()
        created_at = _parse_iso_datetime(str((row or {}).get("created_at") or row.get("submitted_at") or ""))
        if not application_id or created_at is None:
            continue
        first_response_at = first_message_by_application.get(application_id)
        if first_response_at is None:
            first_response_at = _parse_iso_datetime(str((row or {}).get("reviewed_at") or ""))
        if first_response_at is None or first_response_at < created_at:
            continue
        delta_hours = (first_response_at - created_at).total_seconds() / 3600
        if delta_hours < 0:
            continue
        response_hours.append(delta_hours)

    return {
        "dialogues_last_90d": dialogues_count,
        "median_first_response_hours_last_90d": round(float(median(response_hours)), 1) if response_hours else None,
    }


def _normalize_solution_snapshot_tags(value: Any, limit: int = 8) -> list[str]:
    values = value if isinstance(value, list) else str(value or "").split(",")
    normalized: list[str] = []
    seen: set[str] = set()
    for item in values:
        text = _trimmed_text(item, 60)
        if not text:
            continue
        dedupe_key = text.lower()
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        normalized.append(text)
        if len(normalized) >= limit:
            break
    return normalized


def _serialize_solution_snapshot(row: dict | None) -> dict[str, Any] | None:
    source = row or {}
    if not source:
        return None
    job = _safe_dict(source.get("jobs"))
    company = _safe_dict(source.get("companies"))
    return {
        "id": source.get("id"),
        "dialogue_id": str(source.get("dialogue_id") or source.get("application_id") or ""),
        "job_id": source.get("job_id"),
        "company_id": source.get("company_id"),
        "candidate_id": source.get("candidate_id"),
        "problem": _trimmed_text(source.get("problem"), 2000),
        "solution": _trimmed_text(source.get("solution"), 3000),
        "result": _trimmed_text(source.get("result"), 2000),
        "problem_tags": _normalize_solution_snapshot_tags(source.get("problem_tags")),
        "solution_tags": _normalize_solution_snapshot_tags(source.get("solution_tags")),
        "is_public": bool(source.get("is_public")),
        "share_slug": _trimmed_text(source.get("share_slug"), 120) or None,
        "created_at": source.get("created_at"),
        "updated_at": source.get("updated_at"),
        "job_title": _trimmed_text(source.get("job_title") or job.get("title"), 200) or None,
        "company_name": _trimmed_text(source.get("company_name") or company.get("name"), 200) or None,
        "candidate_name": _trimmed_text(source.get("candidate_name"), 160) or None,
    }


def _load_dialogue_solution_snapshot_context(dialogue_id: str) -> dict[str, Any] | None:
    if not supabase or not dialogue_id:
        return None
    try:
        resp = (
            supabase
            .table("job_applications")
            .select("id,job_id,company_id,candidate_id,status,submitted_at,created_at,companies(id,name)")
            .eq("id", dialogue_id)
            .maybe_single()
            .execute()
        )
        row = _safe_row(resp.data if resp else None)
        hydrated_rows = _hydrate_rows_with_primary_jobs([row] if row else [])
        return hydrated_rows[0] if hydrated_rows else row
    except Exception as exc:
        if not (
            _is_missing_relationship_error(exc, "job_applications", "jobs")
            or _is_missing_relationship_error(exc, "job_applications", "companies")
        ):
            raise

    base_resp = (
        supabase
        .table("job_applications")
        .select("id,job_id,company_id,candidate_id,status,submitted_at,created_at")
        .eq("id", dialogue_id)
        .maybe_single()
        .execute()
    )
    row = _safe_row(base_resp.data if base_resp else None)
    if not row:
        return None

    hydrated_rows = _hydrate_rows_with_primary_jobs([row])
    row = hydrated_rows[0] if hydrated_rows else row

    company_id = str(row.get("company_id") or "").strip()
    if company_id:
        try:
            company_resp = (
                supabase
                .table("companies")
                .select("id,name")
                .eq("id", company_id)
                .maybe_single()
                .execute()
            )
            row["companies"] = _safe_dict(company_resp.data if company_resp else None)
        except Exception:
            row["companies"] = {}
    return row


def _load_dialogue_solution_snapshot(dialogue_id: str) -> dict[str, Any] | None:
    if not supabase or not dialogue_id:
        return None
    try:
        resp = (
            supabase
            .table("job_solution_snapshots")
            .select("*,companies(id,name)")
            .eq("dialogue_id", dialogue_id)
            .maybe_single()
            .execute()
        )
        row = _safe_row(resp.data if resp else None)
        hydrated_rows = _hydrate_rows_with_primary_jobs([row] if row else [])
        return hydrated_rows[0] if hydrated_rows else row
    except Exception as exc:
        if _is_missing_table_error(exc, "job_solution_snapshots"):
            return None
        if not (
            _is_missing_relationship_error(exc, "job_solution_snapshots", "jobs")
            or _is_missing_relationship_error(exc, "job_solution_snapshots", "companies")
        ):
            raise

    base_resp = (
        supabase
        .table("job_solution_snapshots")
        .select("*")
        .eq("dialogue_id", dialogue_id)
        .maybe_single()
        .execute()
    )
    row = _safe_row(base_resp.data if base_resp else None)
    if not row:
        return None

    hydrated_rows = _hydrate_rows_with_primary_jobs([row])
    row = hydrated_rows[0] if hydrated_rows else row

    company_id = str(row.get("company_id") or "").strip()
    if company_id:
        try:
            company_resp = (
                supabase
                .table("companies")
                .select("id,name")
                .eq("id", company_id)
                .maybe_single()
                .execute()
            )
            row["companies"] = _safe_dict(company_resp.data if company_resp else None)
        except Exception:
            row["companies"] = {}
    return row


def _build_company_dialogue_solution_snapshot_state(dialogue_row: dict | None, snapshot_row: dict | None) -> dict[str, Any]:
    job = _safe_dict((dialogue_row or {}).get("jobs"))
    metadata, _cleaned = _extract_job_description_metadata(job.get("description"))
    is_micro_job = metadata.get("challenge_format") == "micro_job"
    status = str((dialogue_row or {}).get("status") or "").strip().lower()
    reason: str | None = None
    eligible = False

    if not job:
        reason = "missing_job"
    elif not is_micro_job:
        reason = "not_micro_job"
    elif status != "hired":
        reason = "awaiting_completion"
    else:
        eligible = True

    return {
        "eligible": eligible,
        "reason": reason,
        "snapshot": _serialize_solution_snapshot(snapshot_row),
    }


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


def _humanize_company_activity_event_type(event_type: Any) -> str:
    normalized = str(event_type or "").strip().lower()
    if not normalized:
        return "Activity logged"

    overrides = {
        "application_status_changed": "Dialogue status changed",
        "application_withdrawn": "Dialogue withdrawn",
        "application_message_from_candidate": "Candidate replied",
        "application_message_from_company": "Company replied",
        "assessment_invited": "Assessment invitation sent",
        "assessment_saved": "Assessment saved",
        "assessment_duplicated": "Assessment duplicated",
        "assessment_archived": "Assessment archived",
        "job_published": "Role published",
        "job_updated": "Role updated",
        "job_closed": "Role closed",
        "job_paused": "Role paused",
        "job_archived": "Role archived",
        "job_reopened": "Role reopened",
    }
    if normalized in overrides:
        return overrides[normalized]
    return normalized.replace("_", " ").strip().title() or "Activity logged"


def _normalize_company_activity_payload(event_type: str, payload: dict | None = None) -> dict[str, Any]:
    normalized_event_type = str(event_type or "").strip()
    value = _safe_dict(payload)

    if normalized_event_type == "assessment_invited":
        value["action_label"] = str(value.get("action_label") or "Assessment invitation sent").strip()
        if value.get("assessment_title") is not None:
            value["assessment_title"] = str(value.get("assessment_title") or "").strip() or None
        if value.get("candidate_name") is not None:
            value["candidate_name"] = str(value.get("candidate_name") or "").strip() or None
        if value.get("candidate_email") is not None:
            value["candidate_email"] = str(value.get("candidate_email") or "").strip() or None
        if value.get("job_title") is not None:
            value["job_title"] = str(value.get("job_title") or "").strip() or None
        return value

    if normalized_event_type == "assessment_saved":
        value["action_label"] = str(value.get("action_label") or "Assessment saved").strip()
        if value.get("assessment_title") is not None:
            value["assessment_title"] = str(value.get("assessment_title") or "").strip() or None
        if value.get("job_title") is not None:
            value["job_title"] = str(value.get("job_title") or "").strip() or None
        return value

    if normalized_event_type == "assessment_duplicated":
        value["action_label"] = str(value.get("action_label") or "Assessment duplicated").strip()
        if value.get("assessment_title") is not None:
            value["assessment_title"] = str(value.get("assessment_title") or "").strip() or None
        return value

    if normalized_event_type == "assessment_archived":
        value["action_label"] = str(value.get("action_label") or "Assessment archived").strip()
        if value.get("assessment_title") is not None:
            value["assessment_title"] = str(value.get("assessment_title") or "").strip() or None
        return value

    if normalized_event_type in {"application_message_from_candidate", "application_message_from_company"}:
        direction = "candidate" if normalized_event_type.endswith("_candidate") else "company"
        value["direction"] = str(value.get("direction") or direction).strip().lower() or direction
        direction_label = str(
            value.get("direction_label")
            or ("Candidate replied" if value["direction"] == "candidate" else "Company replied")
        ).strip()
        value["direction_label"] = direction_label
        value["action_label"] = str(value.get("action_label") or direction_label).strip()
        return value

    if normalized_event_type in {"application_status_changed", "application_withdrawn"}:
        return _build_dialogue_activity_payload(
            application_id=str(value.get("application_id") or "").strip(),
            status=value.get("status"),
            close_reason=value.get("close_reason"),
        ) | {
            key: raw
            for key, raw in value.items()
            if key not in {"application_id", "status", "close_reason", "close_reason_label"}
        }

    if normalized_event_type.startswith("job_"):
        return _build_role_activity_payload(
            job_id=str(value.get("job_id") or "").strip(),
            job_title=str(value.get("job_title") or "").strip(),
            version_number=value.get("version_number"),
            previous_status=value.get("previous_status"),
            next_status=value.get("next_status") or value.get("role_status"),
        ) | {
            key: raw
            for key, raw in value.items()
            if key not in {
                "job_id",
                "job_title",
                "version_number",
                "previous_status",
                "previous_status_label",
                "next_status",
                "next_status_label",
                "role_status",
                "role_status_label",
            }
        }

    value["action_label"] = str(value.get("action_label") or _humanize_company_activity_event_type(normalized_event_type)).strip()
    return value


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
            "payload": _normalize_company_activity_payload(event_type, payload if isinstance(payload, dict) else {}),
            "actor_user_id": actor_user_id or None,
        }).execute()
    except Exception as exc:
        if _is_missing_table_error(exc, "company_activity_log"):
            return
        print(f"⚠️ Failed to write company activity log: {exc}")


_PUBLIC_ACTIVITY_ALLOWED_EVENT_TYPES: set[str] = {
    "job_published",
    "job_updated",
    "application_message_from_candidate",
    "application_message_from_company",
    "application_status_changed",
    "solution_snapshot_saved",
}
_PUBLIC_ACTIVITY_COUNTRY_LABELS: dict[str, dict[str, str]] = {
    "CZ": {"cs": "Česka", "sk": "Česka", "de": "Tschechien", "at": "Tschechien", "pl": "Czech", "en": "Czechia"},
    "SK": {"cs": "Slovenska", "sk": "Slovenska", "de": "der Slowakei", "at": "der Slowakei", "pl": "Słowacji", "en": "Slovakia"},
    "PL": {"cs": "Polska", "sk": "Poľska", "de": "Polen", "at": "Polen", "pl": "Polski", "en": "Poland"},
    "DE": {"cs": "Německa", "sk": "Nemecka", "de": "Deutschland", "at": "Deutschland", "pl": "Niemiec", "en": "Germany"},
    "AT": {"cs": "Rakouska", "sk": "Rakúska", "de": "Österreich", "at": "Österreich", "pl": "Austrii", "en": "Austria"},
}
_PUBLIC_ACTIVITY_CITY_PREFIXES: dict[str, tuple[str, str]] = {
    "cs": ("Firma z", "Kandidát z"),
    "sk": ("Firma z", "Kandidát z"),
    "de": ("Team aus", "Person aus"),
    "at": ("Team aus", "Person aus"),
    "pl": ("Firma z", "Kandydat z"),
    "en": ("Team in", "Candidate in"),
}


def _public_activity_language(value: Any) -> str:
    normalized = str(value or "en").strip().lower()
    if normalized.startswith("de-at") or normalized == "at":
        return "at"
    base = normalized.split("-", 1)[0]
    if base in {"cs", "sk", "de", "pl", "en"}:
        return base
    return "en"


def _parse_optional_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except Exception:
        return None


def _fetch_rows_by_ids(table: str, columns: str, ids: list[Any]) -> list[dict[str, Any]]:
    if not supabase or not ids:
        return []
    unique_ids = list(dict.fromkeys([item for item in ids if item not in (None, "")]))
    if not unique_ids:
        return []

    rows: list[dict[str, Any]] = []
    chunk_size = 100
    for index in range(0, len(unique_ids), chunk_size):
        chunk = unique_ids[index:index + chunk_size]
        try:
            resp = supabase.table(table).select(columns).in_("id", chunk).limit(len(chunk)).execute()
            rows.extend(_safe_rows(resp.data if resp else None))
        except Exception:
            continue
    return rows


def _extract_address_fragments(value: Any) -> tuple[str | None, str | None]:
    raw = str(value or "").strip()
    if not raw:
        return (None, None)
    parts = [part.strip() for part in re.split(r"[,\n;/]+", raw) if str(part or "").strip()]
    if not parts:
        return (None, None)

    country_aliases = {
        "cz": "CZ", "czech republic": "CZ", "czechia": "CZ", "česko": "CZ", "česká republika": "CZ",
        "sk": "SK", "slovakia": "SK", "slovensko": "SK",
        "pl": "PL", "poland": "PL", "polsko": "PL",
        "de": "DE", "germany": "DE", "deutschland": "DE",
        "at": "AT", "austria": "AT", "österreich": "AT", "osterreich": "AT",
    }

    country_code: str | None = None
    city_label: str | None = None
    for part in reversed(parts):
        normalized = re.sub(r"\s+", " ", part).strip().lower()
        if not normalized:
            continue
        if normalized in country_aliases:
            country_code = country_aliases[normalized]
            continue
        if re.fullmatch(r"[A-Z]{2}", part.strip()):
            country_code = part.strip().upper()
            continue
        if not city_label:
            city_label = re.sub(r"\s+", " ", part).strip()
    return (city_label or None, country_code)


def _public_activity_place_label(city_label: str | None, country_code: str | None, language: str) -> str | None:
    normalized_language = _public_activity_language(language)
    city = str(city_label or "").strip()
    if city:
        return city
    code = str(country_code or "").strip().upper()
    if not code:
        return None
    return (_PUBLIC_ACTIVITY_COUNTRY_LABELS.get(code) or {}).get(normalized_language) or (_PUBLIC_ACTIVITY_COUNTRY_LABELS.get(code) or {}).get("en")


def _public_activity_actor_label(kind: str, city_label: str | None, country_code: str | None, language: str) -> str | None:
    place_label = _public_activity_place_label(city_label, country_code, language)
    if not place_label:
        return None
    normalized_language = _public_activity_language(language)
    company_prefix, candidate_prefix = _PUBLIC_ACTIVITY_CITY_PREFIXES.get(normalized_language, _PUBLIC_ACTIVITY_CITY_PREFIXES["en"])
    prefix = company_prefix if kind == "company" else candidate_prefix
    return f"{prefix} {place_label}"


def _public_activity_is_micro_job(job_row: dict[str, Any] | None, payload: dict[str, Any] | None) -> bool:
    metadata, _cleaned = _extract_job_description_metadata((job_row or {}).get("description"))
    if metadata.get("challenge_format") == "micro_job":
        return True
    return str(_safe_dict(payload).get("challenge_format") or "").strip().lower() == "micro_job"


def _public_activity_job_title(job_row: dict[str, Any] | None, payload: dict[str, Any] | None) -> str:
    return str((job_row or {}).get("title") or _safe_dict(payload).get("job_title") or "").strip()


def _public_activity_job_location(job_row: dict[str, Any] | None) -> tuple[str | None, str | None]:
    if not isinstance(job_row, dict):
        return (None, None)
    city_label, country_code = _extract_address_fragments(job_row.get("location"))
    if country_code:
        return (city_label, country_code)
    return (city_label, str(job_row.get("country_code") or "").strip().upper() or None)


def _public_activity_company_location(company_row: dict[str, Any] | None, job_row: dict[str, Any] | None) -> tuple[str | None, str | None]:
    company_city, company_country = _extract_address_fragments((company_row or {}).get("address"))
    if company_city or company_country:
        return (company_city, company_country)
    return _public_activity_job_location(job_row)


def _public_activity_candidate_location(candidate_row: dict[str, Any] | None, application_row: dict[str, Any] | None) -> tuple[str | None, str | None]:
    candidate_city, candidate_country = _extract_address_fragments((candidate_row or {}).get("address"))
    if candidate_city or candidate_country:
        return (candidate_city, candidate_country)

    profile_snapshot = _safe_dict((application_row or {}).get("candidate_profile_snapshot"))
    snapshot_city, snapshot_country = _extract_address_fragments(profile_snapshot.get("address"))
    if snapshot_city or snapshot_country:
        return (snapshot_city, snapshot_country)
    preferred_country = str(profile_snapshot.get("preferredCountryCode") or "").strip().upper() or None
    return (None, preferred_country)


def _public_activity_status_is_visible(payload: dict[str, Any]) -> bool:
    normalized_status = str(payload.get("status") or "").strip().lower()
    normalized_reason = _normalize_dialogue_close_reason(payload.get("close_reason") or normalized_status)
    return normalized_reason in {"hired", "role_filled", "closed"}


def _public_activity_job_update_is_visible(payload: dict[str, Any]) -> bool:
    next_status = _normalize_role_status(payload.get("next_status") or payload.get("role_status"))
    previous_status = _normalize_role_status(payload.get("previous_status"))
    return bool(next_status and next_status != previous_status and next_status in {"active", "paused", "closed", "archived"})


def _public_activity_build_copy(
    row: dict[str, Any],
    *,
    language: str,
    job_row: dict[str, Any] | None,
    company_row: dict[str, Any] | None,
    application_row: dict[str, Any] | None,
    candidate_row: dict[str, Any] | None,
) -> dict[str, Any] | None:
    normalized_language = _public_activity_language(language)
    event_type = str(row.get("event_type") or "").strip().lower()
    payload = _safe_dict(row.get("payload"))
    job_title = _public_activity_job_title(job_row, payload)
    if not job_title and event_type != "application_status_changed":
        return None

    is_micro_job = _public_activity_is_micro_job(job_row, payload)
    challenge_format = "micro_job" if is_micro_job else "standard"
    company_city, company_country = _public_activity_company_location(company_row, job_row)
    candidate_city, candidate_country = _public_activity_candidate_location(candidate_row, application_row)
    company_label = _public_activity_actor_label("company", company_city, company_country, normalized_language)
    candidate_label = _public_activity_actor_label("candidate", candidate_city, candidate_country, normalized_language)
    primary_city = company_city or candidate_city
    primary_country = company_country or candidate_country

    copy_map: dict[str, tuple[str, str]] = {}
    if normalized_language in {"cs", "sk"}:
        copy_map = {
            "job_published_micro": (f"{company_label} otevřel(a) mini výzvu „{job_title}“", "Nová krátká spolupráce je právě otevřená."),
            "job_published_standard": (f"{company_label} otevřel(a) výzvu „{job_title}“", "Na platformě přibyla nová role s jasně popsaným kontextem."),
            "job_updated_micro": (f"Mini výzva „{job_title}“ změnila stav", f"{company_label} upravil(a) stav mini výzvy."),
            "job_updated_standard": (f"Výzva „{job_title}“ změnila stav", f"{company_label} upravil(a) stav role."),
            "candidate_message_micro": (f"{candidate_label} reagoval(a) na mini výzvu „{job_title}“", "Na krátkou spolupráci přišla nová reakce."),
            "candidate_message_standard": (f"{candidate_label} reagoval(a) na výzvu „{job_title}“", "Ve feedu přibyla nová kandidátská odpověď."),
            "company_message_micro": (f"{company_label} odpověděl(a) na mini výzvu „{job_title}“", "Tým navázal na první reakci kandidáta."),
            "company_message_standard": (f"{company_label} odpověděl(a) u role „{job_title}“", "Firma pokračuje v prvním kontaktu s kandidátem."),
            "status_changed_micro": (f"Mini výzva „{job_title}“ byla uzavřena jako spolupráce", "Krátká spolupráce došla do konkrétního výsledku."),
            "status_changed_standard": (f"Role „{job_title}“ byla uzavřena", "Tým posunul výběr do uzavřeného stavu."),
            "solution_snapshot_saved": (f"Mini výzva „{job_title}“ byla dokončena", "Vznikl konkrétní příběh vyřešeného problému."),
        }
    elif normalized_language in {"de", "at"}:
        copy_map = {
            "job_published_micro": (f"{company_label} hat die Mini-Aufgabe „{job_title}“ geöffnet", "Eine neue kurze Zusammenarbeit ist live."),
            "job_published_standard": (f"{company_label} hat die Rolle „{job_title}“ geöffnet", "Eine neue Rolle mit klarem Teamkontext ist live."),
            "job_updated_micro": (f"Mini-Aufgabe „{job_title}“ hat den Status geändert", f"{company_label} hat den Status aktualisiert."),
            "job_updated_standard": (f"Rolle „{job_title}“ hat den Status geändert", f"{company_label} hat den Rollenstatus aktualisiert."),
            "candidate_message_micro": (f"{candidate_label} hat auf die Mini-Aufgabe „{job_title}“ reagiert", "Eine neue Reaktion auf eine kurze Zusammenarbeit ist eingegangen."),
            "candidate_message_standard": (f"{candidate_label} hat auf die Rolle „{job_title}“ reagiert", "Eine neue Kandidatenreaktion ist eingegangen."),
            "company_message_micro": (f"{company_label} hat auf die Mini-Aufgabe „{job_title}“ geantwortet", "Das Team setzt den ersten Dialog fort."),
            "company_message_standard": (f"{company_label} hat bei „{job_title}“ geantwortet", "Das Unternehmen führt den ersten Kontakt fort."),
            "status_changed_micro": (f"Mini-Aufgabe „{job_title}“ wurde abgeschlossen", "Eine kurze Zusammenarbeit wurde erfolgreich beendet."),
            "status_changed_standard": (f"Rolle „{job_title}“ wurde geschlossen", "Das Team hat die Rolle abgeschlossen."),
            "solution_snapshot_saved": (f"Mini-Aufgabe „{job_title}“ wurde abgeschlossen", "Ein konkreter Lösungsnachweis wurde gespeichert."),
        }
    elif normalized_language == "pl":
        copy_map = {
            "job_published_micro": (f"{company_label} otworzyła mini wyzwanie „{job_title}”", "Na platformie pojawiła się nowa krótka współpraca."),
            "job_published_standard": (f"{company_label} otworzyła rolę „{job_title}”", "Pojawiła się nowa rola z konkretnym kontekstem zespołu."),
            "job_updated_micro": (f"Mini wyzwanie „{job_title}” zmieniło status", f"{company_label} zaktualizowała status mini wyzwania."),
            "job_updated_standard": (f"Rola „{job_title}” zmieniła status", f"{company_label} zaktualizowała status roli."),
            "candidate_message_micro": (f"{candidate_label} odpowiedział(a) na mini wyzwanie „{job_title}”", "Pojawiła się nowa reakcja na krótką współpracę."),
            "candidate_message_standard": (f"{candidate_label} odpowiedział(a) na rolę „{job_title}”", "Do feedu trafiła nowa odpowiedź kandydata."),
            "company_message_micro": (f"{company_label} odpowiedziała na mini wyzwanie „{job_title}”", "Zespół kontynuuje pierwszy dialog."),
            "company_message_standard": (f"{company_label} odpowiedziała przy roli „{job_title}”", "Firma kontynuuje pierwszy kontakt z kandydatem."),
            "status_changed_micro": (f"Mini wyzwanie „{job_title}” zostało zakończone", "Krótka współpraca doszła do konkretnego wyniku."),
            "status_changed_standard": (f"Rola „{job_title}” została zamknięta", "Zespół zamknął proces dla tej roli."),
            "solution_snapshot_saved": (f"Mini wyzwanie „{job_title}” zostało ukończone", "Powstała konkretna historia rozwiązania problemu."),
        }
    else:
        copy_map = {
            "job_published_micro": (f"{company_label} opened the mini challenge “{job_title}”", "A new short collaboration just went live."),
            "job_published_standard": (f"{company_label} opened the role “{job_title}”", "A new role with clear team context just went live."),
            "job_updated_micro": (f"Mini challenge “{job_title}” changed status", f"{company_label} updated the mini challenge status."),
            "job_updated_standard": (f"Role “{job_title}” changed status", f"{company_label} updated the role status."),
            "candidate_message_micro": (f"{candidate_label} replied to the mini challenge “{job_title}”", "A new response landed on a short project."),
            "candidate_message_standard": (f"{candidate_label} replied to the role “{job_title}”", "A new candidate response landed in the feed."),
            "company_message_micro": (f"{company_label} replied on the mini challenge “{job_title}”", "The team continued the first contact."),
            "company_message_standard": (f"{company_label} replied on the role “{job_title}”", "The company continued the first contact with a candidate."),
            "status_changed_micro": (f"Mini challenge “{job_title}” was completed", "A short collaboration reached a concrete outcome."),
            "status_changed_standard": (f"Role “{job_title}” was closed", "The team moved this role into a closed state."),
            "solution_snapshot_saved": (f"Mini challenge “{job_title}” was completed", "A concrete solution story was captured."),
        }

    copy_key: str | None = None
    if event_type == "job_published":
        if not company_label:
            return None
        copy_key = "job_published_micro" if is_micro_job else "job_published_standard"
    elif event_type == "job_updated":
        if not company_label or not _public_activity_job_update_is_visible(payload):
            return None
        copy_key = "job_updated_micro" if is_micro_job else "job_updated_standard"
    elif event_type == "application_message_from_candidate":
        if not candidate_label:
            return None
        copy_key = "candidate_message_micro" if is_micro_job else "candidate_message_standard"
    elif event_type == "application_message_from_company":
        if not company_label:
            return None
        copy_key = "company_message_micro" if is_micro_job else "company_message_standard"
    elif event_type == "application_status_changed":
        if not _public_activity_status_is_visible(payload):
            return None
        copy_key = "status_changed_micro" if is_micro_job else "status_changed_standard"
    elif event_type == "solution_snapshot_saved":
        if not is_micro_job:
            return None
        copy_key = "solution_snapshot_saved"

    if not copy_key or copy_key not in copy_map:
        return None

    title, body = copy_map[copy_key]
    return {
        "id": str(row.get("id") or ""),
        "kind": event_type,
        "timestamp": row.get("created_at"),
        "title": title,
        "body": body,
        "city_label": primary_city,
        "country_code": primary_country,
        "job_title": job_title,
        "challenge_format": challenge_format,
        "is_micro_job": is_micro_job,
    }


def _build_public_activity_payload(language: str, limit: int = 5) -> dict[str, Any]:
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    normalized_language = _public_activity_language(language)
    now = datetime.now(timezone.utc)
    day_ago = (now - timedelta(hours=24)).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()

    try:
        resp = (
            supabase
            .table("company_activity_log")
            .select("*")
            .in_("event_type", list(_PUBLIC_ACTIVITY_ALLOWED_EVENT_TYPES))
            .gte("created_at", week_ago)
            .order("created_at", desc=True)
            .limit(max(60, limit * 8))
            .execute()
        )
    except Exception as exc:
        if _is_missing_table_error(exc, "company_activity_log"):
            return {"stats": {}, "events": [], "meta": {"generated_at": now.isoformat(), "window_hours": 168}}
        raise HTTPException(status_code=500, detail="Failed to load public activity")

    raw_rows = _safe_rows(resp.data if resp else None)
    if not raw_rows:
        return {"stats": {}, "events": [], "meta": {"generated_at": now.isoformat(), "window_hours": 168}}

    job_ids: list[int] = []
    company_ids: list[str] = []
    application_ids: list[str] = []
    candidate_ids: list[str] = []
    for row in raw_rows:
        payload = _safe_dict(row.get("payload"))
        subject_type = str(row.get("subject_type") or "").strip().lower()
        subject_id = str(row.get("subject_id") or "").strip()
        normalized_job_id = _normalize_job_id(payload.get("job_id") or (subject_id if subject_type == "job" else None))
        if isinstance(normalized_job_id, int):
            job_ids.append(normalized_job_id)
        company_id = str(row.get("company_id") or payload.get("company_id") or "").strip()
        if company_id:
            company_ids.append(company_id)
        application_id = str(payload.get("application_id") or payload.get("dialogue_id") or (subject_id if subject_type == "application" else "")).strip()
        if application_id:
            application_ids.append(application_id)
        candidate_id = str(payload.get("candidate_id") or "").strip()
        if candidate_id:
            candidate_ids.append(candidate_id)

    jobs_by_id = {
        parsed_job_id: row
        for row in _fetch_rows_by_ids("jobs", "id,title,location,country_code,description", job_ids)
        for parsed_job_id in [_parse_optional_int(row.get("id"))]
        if parsed_job_id is not None
    }
    companies_by_id = {
        str(row.get("id") or ""): row
        for row in _fetch_rows_by_ids("companies", "id,address", company_ids)
        if str(row.get("id") or "").strip()
    }
    applications_by_id = {
        str(row.get("id") or ""): row
        for row in _fetch_rows_by_ids("job_applications", "id,job_id,candidate_id,candidate_profile_snapshot,status", application_ids)
        if str(row.get("id") or "").strip()
    }

    for application_row in applications_by_id.values():
        normalized_job_id = _normalize_job_id(application_row.get("job_id"))
        if isinstance(normalized_job_id, int) and normalized_job_id not in jobs_by_id:
            job_ids.append(normalized_job_id)
        candidate_id = str(application_row.get("candidate_id") or "").strip()
        if candidate_id:
            candidate_ids.append(candidate_id)

    if job_ids:
        jobs_by_id.update({
            parsed_job_id: row
            for row in _fetch_rows_by_ids("jobs", "id,title,location,country_code,description", job_ids)
            for parsed_job_id in [_parse_optional_int(row.get("id"))]
            if parsed_job_id is not None
        })
    candidate_by_id = {
        str(row.get("id") or ""): row
        for row in _fetch_rows_by_ids("candidate_profiles", "id,address", candidate_ids)
        if str(row.get("id") or "").strip()
    }

    public_events: list[dict[str, Any]] = []
    new_challenges_today = 0
    candidate_replies_today = 0
    company_replies_today = 0
    completed_mini_projects_7d = 0

    for row in raw_rows:
        payload = _safe_dict(row.get("payload"))
        event_type = str(row.get("event_type") or "").strip().lower()
        created_at = str(row.get("created_at") or "").strip()
        is_last_day = created_at >= day_ago

        subject_type = str(row.get("subject_type") or "").strip().lower()
        subject_id = str(row.get("subject_id") or "").strip()
        normalized_job_id = _normalize_job_id(payload.get("job_id") or (subject_id if subject_type == "job" else None))
        application_id = str(payload.get("application_id") or payload.get("dialogue_id") or (subject_id if subject_type == "application" else "")).strip()
        application_row = applications_by_id.get(application_id) if application_id else None
        if not isinstance(normalized_job_id, int) and isinstance(application_row, dict):
            normalized_job_id = _normalize_job_id(application_row.get("job_id"))
        job_row = jobs_by_id.get(normalized_job_id) if isinstance(normalized_job_id, int) else None
        company_id = str(row.get("company_id") or payload.get("company_id") or "").strip()
        company_row = companies_by_id.get(company_id) if company_id else None
        candidate_id = str(payload.get("candidate_id") or (application_row or {}).get("candidate_id") or "").strip()
        candidate_row = candidate_by_id.get(candidate_id) if candidate_id else None

        public_item = _public_activity_build_copy(
            row,
            language=normalized_language,
            job_row=job_row,
            company_row=company_row,
            application_row=application_row,
            candidate_row=candidate_row,
        )
        if not public_item:
            continue

        public_events.append(public_item)
        if event_type == "job_published" and is_last_day:
            new_challenges_today += 1
        elif event_type == "application_message_from_candidate" and is_last_day:
            candidate_replies_today += 1
        elif event_type == "application_message_from_company" and is_last_day:
            company_replies_today += 1
        elif event_type == "solution_snapshot_saved":
            completed_mini_projects_7d += 1

        if len(public_events) >= limit:
            continue

    return {
        "stats": {
            "new_challenges_today": new_challenges_today,
            "candidate_replies_today": candidate_replies_today,
            "company_replies_today": company_replies_today,
            "completed_mini_projects_7d": completed_mini_projects_7d,
        },
        "events": public_events[:limit],
        "meta": {
            "generated_at": now.isoformat(),
            "window_hours": 168,
        },
    }


def _strip_html_tags(value: Any) -> str:
    text = str(value or "")
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p\s*>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _clip_text(value: Any, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    clipped = text[:limit].rsplit(" ", 1)[0].strip()
    return clipped or text[:limit].strip()


def _clip_words(text: str, max_words: int = 220) -> str:
    words = str(text or "").strip().split()
    if len(words) <= max_words:
        return " ".join(words)
    return " ".join(words[:max_words]).strip()


def _derive_profile_mini_challenge_label(user: dict, candidate_profile: dict[str, Any], profile_identity: dict[str, Any]) -> tuple[str, str | None]:
    full_name = _trimmed_text(profile_identity.get("full_name"), 160)
    email = _trimmed_text(profile_identity.get("email") or user.get("email"), 200)
    headline = _trimmed_text(candidate_profile.get("job_title"), 160)
    company_label = full_name or headline or (email.split("@", 1)[0] if email and "@" in email else None) or "JobShaman member"
    return company_label, email or None


def _derive_profile_first_reply_prompt(title: str, problem: str) -> str:
    cleaned_problem = _clip_text(str(problem or "").strip(), 260)
    if cleaned_problem:
        return f"What would you do first to solve \"{title}\" and what trade-off would you watch most closely?\n\nContext: {cleaned_problem}"
    return f"What would you do first to solve \"{title}\", and what trade-off would you watch most closely?"


def _normalize_profile_mini_challenge_reward(raw: Any) -> str | None:
    reward = re.sub(r"\s+", " ", str(raw or "")).strip()
    return reward[:160] if reward else None


def _parse_profile_mini_challenge_budget(raw: Any) -> tuple[int | None, int | None]:
    text = str(raw or "").strip()
    if not text:
        return (None, None)
    numbers = [int(match.replace(" ", "")) for match in re.findall(r"\d[\d\s]{0,8}", text)]
    if not numbers:
        return (None, None)
    if len(numbers) == 1:
        return (numbers[0], numbers[0])
    ordered = sorted(numbers[:2])
    return (ordered[0], ordered[-1])


def _build_profile_mini_challenge_description(
    *,
    title: str,
    problem: str,
    time_estimate: str | None,
    reward: str | None,
    first_reply_prompt: str,
    micro_job_kind: str | None,
    collaboration_modes: list[str],
    long_term_potential: str | None,
) -> str:
    draft = {
        "title": title,
        "role_summary": problem,
        "company_goal": "",
        "responsibilities": problem,
        "application_instructions": "Reply in the handshake with your first approach, the most important risk you see, and how you would keep the work grounded in reality.",
        "editor_state": {
            "hiring_stage": "collecting_cvs",
            "micro_job": {
                "challenge_format": "micro_job",
                "kind": micro_job_kind or "one_off_task",
                "time_estimate": time_estimate or "",
                "collaboration_modes": collaboration_modes,
                "long_term_potential": long_term_potential or "maybe",
            },
            "handshake": {
                "first_reply_prompt": first_reply_prompt,
            },
        },
        "first_reply_prompt": first_reply_prompt,
    }
    description = _compose_job_description_from_draft(draft)
    if reward:
        description = f"{description}\n\n### Reward\n{reward}".strip()
    return description


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
        "avatar_url": _trimmed_text(value.get("avatar_url") or value.get("avatarUrl") or value.get("photo"), 500) or None,
        "linkedin": str(value.get("linkedin") or "").strip() or None,
        "skills": _safe_string_list(value.get("skills"), limit=12),
        "values": _safe_string_list(value.get("values"), limit=8),
        "preferredCountryCode": str(value.get("preferredCountryCode") or "").strip().upper() or None,
    }


def _sanitize_jcfpm_payload(level: str, raw) -> dict | None:
    if level == "do_not_share":
        return None

    value = _safe_dict(raw)
    dimension_percentiles = {
        str(item.get("dimension") or "").strip(): int(item.get("percentile") or 0)
        for item in (value.get("dimension_scores") or [])
        if isinstance(item, dict)
    }
    comparison_signals = []
    existing_signals = value.get("comparison_signals") or []
    if isinstance(existing_signals, list) and existing_signals:
        for item in existing_signals[:6]:
            if not isinstance(item, dict):
                continue
            comparison_signals.append({
                "key": str(item.get("key") or "").strip()[:64],
                "label": str(item.get("label") or "").strip()[:120],
                "score": int(item.get("score") or 0),
            })
    elif dimension_percentiles:
        comparison_signals = [
            {"key": "analytical", "label": "Analytical structure", "score": int(dimension_percentiles.get("d1_cognitive") or 0)},
            {"key": "collaboration", "label": "Collaboration", "score": int(dimension_percentiles.get("d2_social") or 0)},
            {"key": "drive", "label": "Drive", "score": int(dimension_percentiles.get("d3_motivational") or 0)},
            {"key": "execution", "label": "Execution stamina", "score": int(dimension_percentiles.get("d4_energy") or 0)},
            {"key": "adaptability", "label": "Adaptability", "score": int(dimension_percentiles.get("d6_ai_readiness") or 0)},
            {"key": "judgement", "label": "Judgement", "score": int(dimension_percentiles.get("d12_moral_compass") or 0)},
        ]

    base = {
        "schema_version": "jcfpm-share-v1",
        "share_level": "summary",
        "completed_at": str(value.get("completed_at") or "").strip() or None,
        "confidence": float(value.get("confidence") or 0) if value.get("confidence") is not None else None,
        "archetype": _safe_dict(value.get("archetype")) or None,
        "top_dimensions": [],
        "strengths": _safe_string_list(value.get("strengths"), limit=6),
        "environment_fit_summary": _safe_string_list(value.get("environment_fit_summary"), limit=5),
        "jhi_adjustment_summary": [],
        "comparison_signals": comparison_signals,
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

    return base


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


def _serialize_company_dialogue_row(row: dict) -> dict:
    resolved_status = _resolve_dialogue_runtime_status(row)
    job = _safe_dict(row.get("jobs"))
    profile = _safe_dict(row.get("profiles"))
    candidate_snapshot = _safe_dict(row.get("candidate_profile_snapshot"))
    dialogue_runtime = _serialize_dialogue_runtime(row)
    jcfpm_share_level = _normalize_jcfpm_share_level(row.get("jcfpm_share_level"), _safe_dict(row.get("shared_jcfpm_payload")))
    cover_letter = str(row.get("cover_letter") or "").strip()
    cv_snapshot = _safe_dict(row.get("cv_snapshot"))
    out = {
        "id": row.get("id"),
        "job_id": row.get("job_id"),
        "candidate_id": row.get("candidate_id"),
        "status": resolved_status,
        "created_at": row.get("created_at"),
        "submitted_at": row.get("submitted_at") or row.get("applied_at") or row.get("created_at"),
        "updated_at": row.get("updated_at") or row.get("created_at"),
        "job_title": job.get("title"),
        "candidate_name": profile.get("full_name") or candidate_snapshot.get("name") or profile.get("email") or "Candidate",
        "candidate_email": profile.get("email") or candidate_snapshot.get("email"),
        "candidate_avatar_url": profile.get("avatar_url") or candidate_snapshot.get("avatar_url"),
        "has_cover_letter": bool(cover_letter),
        "has_cv": bool(cv_snapshot.get("fileUrl") or cv_snapshot.get("originalName") or row.get("cv_document_id")),
        "jcfpm_share_level": jcfpm_share_level,
        "has_jcfpm": jcfpm_share_level != "do_not_share" and bool(row.get("shared_jcfpm_payload")),
        "candidate_headline": _derive_candidate_headline(candidate_snapshot),
    }
    out.update(dialogue_runtime)
    return out


def _serialize_dialogue_dossier(row: dict) -> dict:
    base = _serialize_company_dialogue_row(row)
    dialogue_runtime = _serialize_dialogue_runtime(row)
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
        "signal_boost": _serialize_dialogue_signal_boost(row),
    })
    base.update(dialogue_runtime)
    return base


def _dialogue_signal_boost_share_url(locale: Any, share_slug: Any) -> str | None:
    slug = str(share_slug or "").strip()
    if not slug:
        return None
    base_public_url = str(config.APP_PUBLIC_URL or "").strip()
    if not base_public_url:
        return None
    normalized_locale = str(locale or "en").split("-", 1)[0].strip().lower() or "en"
    if normalized_locale == "at":
        normalized_locale = "de"
    return f"{base_public_url.rstrip('/')}/{normalized_locale}/signal/{slug}"


def _serialize_dialogue_signal_boost(row: dict) -> dict | None:
    candidate_id = str(row.get("candidate_id") or "").strip()
    job_id = str(row.get("job_id") or "").strip()
    if not candidate_id or not job_id:
        return None
    signal_output = get_latest_published_signal_output_for_candidate_job(candidate_id=candidate_id, job_id=job_id)
    if not signal_output:
        return None
    locale = str(signal_output.get("locale") or "en").strip() or "en"
    return {
        "output_id": str(signal_output.get("id") or "").strip(),
        "share_slug": str(signal_output.get("share_slug") or "").strip() or None,
        "share_url": _dialogue_signal_boost_share_url(locale, signal_output.get("share_slug")),
        "locale": locale,
        "signal_summary": _safe_dict(signal_output.get("signal_summary")) or None,
        "recruiter_readout": _safe_dict(signal_output.get("recruiter_readout")) or None,
        "published_at": signal_output.get("published_at"),
    }


def _extract_candidate_job_snapshot(row: dict) -> dict:
    job = _safe_dict(row.get("jobs"))
    application_payload = _safe_dict(row.get("application_payload"))
    return {
        "title": job.get("title") or application_payload.get("job_title"),
        "company": job.get("company") or application_payload.get("job_company"),
        "location": job.get("location") or application_payload.get("job_location"),
        "url": job.get("url") or application_payload.get("job_url"),
        "source": job.get("source") or application_payload.get("job_source"),
        "contact_email": job.get("contact_email") or application_payload.get("job_contact_email"),
    }


def _serialize_candidate_dialogue_row(row: dict) -> dict:
    base = _serialize_dialogue_dossier(row)
    company = _safe_dict(row.get("companies"))
    job_snapshot = _extract_candidate_job_snapshot(row)
    application_payload = _safe_dict(base.get("application_payload"))
    return {
        "id": base.get("id"),
        "job_id": base.get("job_id"),
        "company_id": base.get("company_id"),
        "status": base.get("status"),
        "submitted_at": base.get("submitted_at"),
        "updated_at": base.get("updated_at"),
        "reviewed_at": base.get("reviewed_at"),
        "reviewed_by": base.get("reviewed_by"),
        "source": base.get("source"),
        "has_cover_letter": base.get("has_cover_letter"),
        "has_cv": base.get("has_cv"),
        "has_jcfpm": base.get("has_jcfpm"),
        "jcfpm_share_level": base.get("jcfpm_share_level"),
        "cover_letter": base.get("cover_letter"),
        "cv_document_id": base.get("cv_document_id"),
        "cv_snapshot": base.get("cv_snapshot"),
        "candidate_profile_snapshot": base.get("candidate_profile_snapshot"),
        "shared_jcfpm_payload": base.get("shared_jcfpm_payload"),
        "application_payload": base.get("application_payload"),
        "company_name": company.get("name") or application_payload.get("job_company"),
        "company_website": company.get("website"),
        "job_snapshot": job_snapshot,
    }


def _sanitize_dialogue_message_attachments(raw: Any) -> list[dict]:
    if not isinstance(raw, list):
        return []
    attachments: list[dict] = []
    for item in raw[:5]:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        url = str(item.get("url") or "").strip()
        if not name or not url:
            continue
        attachment: dict[str, Any] = {
            "name": name[:255],
            "url": url[:2000],
        }
        path = str(item.get("path") or "").strip()
        if path:
            attachment["path"] = path[:500]
        size = _parse_optional_int(item.get("size"))
        if size is not None:
            attachment["size"] = max(0, min(size, 20 * 1024 * 1024))
            attachment["size_bytes"] = attachment["size"]
        content_type = str(item.get("content_type") or item.get("contentType") or "").strip()
        if content_type:
            attachment["content_type"] = content_type[:160]
            attachment["mime_type"] = attachment["content_type"]
        asset_id = str(item.get("asset_id") or item.get("id") or "").strip()
        if asset_id:
            attachment["asset_id"] = asset_id[:128]
            attachment["id"] = attachment["asset_id"]
        storage_provider = str(item.get("storage_provider") or item.get("provider") or "").strip()
        if storage_provider:
            attachment["storage_provider"] = storage_provider[:64]
            attachment["provider"] = attachment["storage_provider"]
        bucket = str(item.get("bucket") or "").strip()
        if bucket:
            attachment["bucket"] = bucket[:120]
        object_key = str(item.get("object_key") or "").strip()
        if object_key:
            attachment["object_key"] = object_key[:500]
        kind = str(item.get("kind") or "").strip()
        if kind:
            attachment["kind"] = kind[:64]
        download_url = str(item.get("download_url") or "").strip()
        if download_url:
            attachment["download_url"] = download_url[:2000]
        transcript_status = str(item.get("transcript_status") or "").strip()
        if transcript_status:
            attachment["transcript_status"] = transcript_status[:64]
        attachments.append(attachment)
    return attachments


def _extract_attachment_asset_ids(attachments: list[dict]) -> list[str]:
    asset_ids: list[str] = []
    seen: set[str] = set()
    for item in attachments:
        if not isinstance(item, dict):
            continue
        asset_id = str(item.get("asset_id") or item.get("id") or "").strip()
        if not asset_id or asset_id in seen:
            continue
        seen.add(asset_id)
        asset_ids.append(asset_id[:128])
    return asset_ids[:10]


def _normalize_message_asset_ids(value) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in value:
        asset_id = str(item or "").strip()
        if not asset_id or asset_id in seen:
            continue
        seen.add(asset_id)
        out.append(asset_id[:128])
        if len(out) >= 10:
            break
    return out


def _hydrate_dialogue_message_attachments(row: dict, request_base_url: str | None = None) -> list[dict]:
    attachments = _sanitize_dialogue_message_attachments(row.get("attachments"))
    asset_ids = _normalize_message_asset_ids(row.get("asset_ids"))
    if not request_base_url or not asset_ids:
        return attachments

    asset_rows = load_assets_metadata(asset_ids)
    if not asset_rows:
        return attachments

    hydrated_by_id: dict[str, dict] = {}
    for item in asset_rows:
        asset_id = str(item.get("id") or item.get("asset_id") or "").strip()
        if not asset_id:
            continue
        hydrated_by_id[asset_id] = serialize_asset_metadata(item, request_base_url)

    if not hydrated_by_id:
        return attachments

    merged: list[dict] = []
    seen_asset_ids: set[str] = set()
    for existing in attachments:
        current = dict(existing)
        asset_id = str(current.get("asset_id") or current.get("id") or "").strip()
        if not asset_id:
            merged.append(current)
            continue
        hydrated = hydrated_by_id.get(asset_id)
        if not hydrated:
            merged.append(current)
            continue
        transcript_status = str(current.get("transcript_status") or "").strip()
        current.update(hydrated)
        if transcript_status:
            current["transcript_status"] = transcript_status[:64]
        merged.append(current)
        seen_asset_ids.add(asset_id)

    for asset_id in asset_ids:
        if asset_id in seen_asset_ids:
            continue
        hydrated = hydrated_by_id.get(asset_id)
        if hydrated:
            merged.append(dict(hydrated))
            seen_asset_ids.add(asset_id)
    return merged


def _serialize_dialogue_message(row: dict, request_base_url: str | None = None) -> dict:
    attachments = _hydrate_dialogue_message_attachments(row, request_base_url=request_base_url)
    audio_transcript_status = "not_applicable"
    if any(str(item.get("kind") or "").lower() == "audio" for item in attachments):
        audio_transcript_status = "ready" if any(str(item.get("transcript_status") or "").lower() == "ready" for item in attachments) else "pending"
    return {
        "id": str(row.get("id") or ""),
        "application_id": str(row.get("application_id") or ""),
        "company_id": row.get("company_id"),
        "candidate_id": row.get("candidate_id"),
        "sender_user_id": row.get("sender_user_id"),
        "sender_role": "candidate" if str(row.get("sender_role") or "").lower() == "candidate" else "recruiter",
        "body": str(row.get("body") or ""),
        "attachments": attachments,
        "audio_transcript_status": audio_transcript_status,
        "created_at": row.get("created_at"),
        "read_by_candidate_at": row.get("read_by_candidate_at"),
        "read_by_company_at": row.get("read_by_company_at"),
    }


def _serialize_dialogue_record(row: dict | None) -> dict:
    source = row or {}
    dialogue_id = str(source.get("dialogue_id") or source.get("id") or "")
    role_id = source.get("role_id")
    if role_id is None and source.get("job_id") is not None:
        role_id = str(source.get("job_id") or "")
    role_title = source.get("role_title")
    if role_title is None and source.get("job_title") is not None:
        role_title = source.get("job_title")

    out = dict(source)
    out["dialogue_id"] = dialogue_id
    if role_id is not None:
        out["role_id"] = role_id
    if role_title is not None:
        out["role_title"] = role_title
    return out


# Compatibility aliases during the application -> dialogue transition.
_serialize_company_application_row = _serialize_company_dialogue_row
_serialize_application_dossier = _serialize_dialogue_dossier
_serialize_candidate_application_row = _serialize_candidate_dialogue_row
_sanitize_application_message_attachments = _sanitize_dialogue_message_attachments
_hydrate_application_message_attachments = _hydrate_dialogue_message_attachments
_serialize_application_message = _serialize_dialogue_message


def _serialize_dialogue_message_record(row: dict | None) -> dict:
    source = row or {}
    out = dict(source)
    out["dialogue_id"] = str(source.get("dialogue_id") or source.get("application_id") or "")
    return out


def _serialize_role_record(row: dict | None) -> dict:
    source = row or {}
    out = dict(source)
    out["role_id"] = str(source.get("role_id") or source.get("id") or "")
    if source.get("job_id") is not None and "published_job_id" not in out:
        out["published_job_id"] = source.get("job_id")
    return out


def _probe_schema_select(table_name: str, select_clause: str) -> dict:
    if not supabase:
        return {"ready": False, "sample_rows": 0, "issue": "supabase unavailable"}
    try:
        resp = supabase.table(table_name).select(select_clause).limit(2).execute()
        return {
            "ready": True,
            "sample_rows": len(_safe_rows(resp.data if resp else None)),
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
    handshake = _safe_dict(_safe_dict(draft.get("editor_state")).get("handshake"))
    micro_job = _get_draft_micro_job_state(draft)
    is_micro_job = micro_job.get("challenge_format") == "micro_job"
    first_reply_prompt = str(draft.get("first_reply_prompt") or handshake.get("first_reply_prompt") or "").strip()
    company_truth_hard = str(draft.get("company_truth_hard") or handshake.get("company_truth_hard") or "").strip()
    company_truth_fail = str(draft.get("company_truth_fail") or handshake.get("company_truth_fail") or "").strip()
    company_goal = str(draft.get("company_goal") or handshake.get("company_goal") or "").strip()

    if not title:
        blocking.append("Missing title.")
    if not role_summary:
        blocking.append("Missing role summary.")
    if not responsibilities:
        blocking.append("Missing responsibilities.")
    if not is_micro_job and not requirements:
        blocking.append("Missing requirements.")
    if not location_public:
        blocking.append("Missing public location.")
    if not contact_email:
        blocking.append("Missing application contact email.")
    if not is_micro_job and not company_truth_hard:
        blocking.append("Missing the company truth: what is actually hard about this role.")
    if not is_micro_job and not company_truth_fail:
        blocking.append("Missing the company truth: who typically struggles in this role.")
    if not is_micro_job and not company_goal:
        blocking.append("Missing the company goal: what outcome this role should drive.")
    if is_micro_job and not micro_job.get("kind"):
        blocking.append("Missing micro job type.")
    if is_micro_job and not micro_job.get("time_estimate"):
        blocking.append("Missing micro job time estimate.")
    if is_micro_job and not micro_job.get("collaboration_modes"):
        blocking.append("Missing micro job collaboration type.")

    if is_micro_job and salary_from is None and salary_to is None:
        blocking.append("Missing micro job budget.")
    elif salary_from is None or salary_to is None:
        warnings.append("Salary is not fully transparent.")
    elif float(salary_to or 0) < float(salary_from or 0):
        blocking.append("Salary max cannot be lower than salary min.")

    if not is_micro_job and len(requirements) < 120:
        warnings.append("Requirements section is still very short.")
    if not is_micro_job and len(benefits) < 2:
        warnings.append("Benefits are likely too vague or too thin.")
    if not first_reply_prompt:
        warnings.append("Add a first-reply prompt so candidates know how to start the handshake.")
    if len(role_summary) < (60 if is_micro_job else 80):
        suggestions.append("Expand the role summary to make the opportunity clearer.")
    if not is_micro_job and len(responsibilities) < 180:
        suggestions.append("Add more concrete day-to-day responsibilities.")
    if not is_micro_job and len(requirements) < 180:
        suggestions.append("Clarify must-have skills and expected experience.")
    if not is_micro_job and company_truth_hard and len(company_truth_hard) < 60:
        suggestions.append("Make the 'what is hard' truth prompt more concrete.")
    if not is_micro_job and company_truth_fail and len(company_truth_fail) < 60:
        suggestions.append("Clarify what type of person usually struggles here.")
    if not is_micro_job and company_goal and len(company_goal) < 24:
        suggestions.append("Make the goal more concrete (what success should look like).")

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
    micro_job = _get_draft_micro_job_state(draft)
    is_micro_job = micro_job.get("challenge_format") == "micro_job"
    section_definitions = [
        ("Role Summary", "role_summary"),
        ("Goal", "company_goal"),
        ("Responsibilities", "responsibilities"),
        ("How To Apply", "application_instructions"),
    ] if is_micro_job else [
        ("Role Summary", "role_summary"),
        ("Goal", "company_goal"),
        ("Team Intro", "team_intro"),
        ("Responsibilities", "responsibilities"),
        ("Requirements", "requirements"),
        ("Nice to Have", "nice_to_have"),
        ("How To Apply", "application_instructions"),
    ]
    for heading, key in section_definitions:
        value = str(draft.get(key) or "").strip()
        if value:
            sections.append(f"### {heading}\n{value}")
    handshake = _safe_dict(_safe_dict(draft.get("editor_state")).get("handshake"))
    first_reply_prompt = str(draft.get("first_reply_prompt") or handshake.get("first_reply_prompt") or "").strip()
    company_truth_hard = str(draft.get("company_truth_hard") or handshake.get("company_truth_hard") or "").strip()
    company_truth_fail = str(draft.get("company_truth_fail") or handshake.get("company_truth_fail") or "").strip()
    if first_reply_prompt:
        sections.append(f"### First Reply\n{first_reply_prompt}")
    if not is_micro_job and company_truth_hard:
        sections.append(f"### Company Truth: What Is Actually Hard?\n{company_truth_hard}")
    if not is_micro_job and company_truth_fail:
        sections.append(f"### Company Truth: Who Typically Struggles?\n{company_truth_fail}")
    if is_micro_job:
        micro_lines: list[str] = []
        kind = micro_job.get("kind")
        time_estimate = micro_job.get("time_estimate")
        collaboration_modes = micro_job.get("collaboration_modes") or []
        long_term_potential = micro_job.get("long_term_potential")
        if kind:
            micro_lines.append(f"- Type: {str(kind).replace('_', ' ').title()}")
        if time_estimate:
            micro_lines.append(f"- Time estimate: {time_estimate}")
        if collaboration_modes:
            micro_lines.append(f"- Collaboration: {', '.join([str(item).title() for item in collaboration_modes])}")
        if long_term_potential:
            micro_lines.append(f"- Long-term potential: {str(long_term_potential).title()}")
        if micro_lines:
            sections.append("### Micro Job Setup\n" + "\n".join(micro_lines))
    benefits = _safe_string_list(draft.get("benefits_structured"), limit=20)
    if not is_micro_job and benefits:
        sections.append("### Benefits\n" + "\n".join([f"- {item}" for item in benefits]))
    return _prepend_job_description_markers("\n\n".join(sections).strip(), draft)


_JOB_DESCRIPTION_METADATA_PATTERN = re.compile(r"^\s*<!--\s*jobshaman:([a-z_]+)=([^\n>]*)\s*-->\s*", re.IGNORECASE)
_ALLOWED_HIRING_STAGES = {
    "collecting_cvs",
    "reviewing_first_10",
    "shortlisting",
    "final_interviews",
    "offer_stage",
}
_ALLOWED_CHALLENGE_FORMATS = {"standard", "micro_job"}
_ALLOWED_MICRO_JOB_KINDS = {
    "one_off_task",
    "short_project",
    "audit_review",
    "prototype",
    "experiment",
}
_ALLOWED_MICRO_JOB_COLLABORATION = {"remote", "async", "call"}
_ALLOWED_MICRO_JOB_LONG_TERM_POTENTIAL = {"yes", "maybe", "no"}


def _normalize_hiring_stage(raw: Any) -> str | None:
    if not isinstance(raw, str):
        return None
    normalized = raw.strip().lower()
    if normalized in _ALLOWED_HIRING_STAGES:
        return normalized
    return None


def _normalize_challenge_format(raw: Any) -> str | None:
    if not isinstance(raw, str):
        return None
    normalized = raw.strip().lower()
    if normalized in _ALLOWED_CHALLENGE_FORMATS:
        return normalized
    return None


def _normalize_micro_job_kind(raw: Any) -> str | None:
    if not isinstance(raw, str):
        return None
    normalized = raw.strip().lower()
    if normalized in _ALLOWED_MICRO_JOB_KINDS:
        return normalized
    return None


def _normalize_micro_job_time_estimate(raw: Any) -> str | None:
    if not isinstance(raw, str):
        return None
    normalized = re.sub(r"\s+", " ", raw).strip()
    if not normalized:
        return None
    normalized = normalized.replace("--", "-").replace(">", "")
    return normalized[:80]


def _normalize_micro_job_collaboration_modes(raw: Any) -> list[str]:
    values = raw if isinstance(raw, list) else str(raw or "").split(",")
    normalized: list[str] = []
    seen: set[str] = set()
    for item in values:
        mode = str(item or "").strip().lower()
        if not mode or mode not in _ALLOWED_MICRO_JOB_COLLABORATION or mode in seen:
            continue
        seen.add(mode)
        normalized.append(mode)
    return normalized


def _normalize_micro_job_long_term_potential(raw: Any) -> str | None:
    if not isinstance(raw, str):
        return None
    normalized = raw.strip().lower()
    if normalized in _ALLOWED_MICRO_JOB_LONG_TERM_POTENTIAL:
        return normalized
    return None


def _normalize_micro_job_editor_state(editor_state: Any) -> dict[str, Any]:
    micro_job = _safe_dict(_safe_dict(editor_state).get("micro_job"))
    challenge_format = _normalize_challenge_format(micro_job.get("challenge_format") or micro_job.get("format")) or "standard"
    return {
        "challenge_format": challenge_format,
        "kind": _normalize_micro_job_kind(micro_job.get("kind")),
        "time_estimate": _normalize_micro_job_time_estimate(micro_job.get("time_estimate")),
        "collaboration_modes": _normalize_micro_job_collaboration_modes(micro_job.get("collaboration_modes")),
        "long_term_potential": _normalize_micro_job_long_term_potential(micro_job.get("long_term_potential")),
    }


def _extract_job_description_metadata(raw_description: Any) -> tuple[dict[str, Any], str]:
    description = str(raw_description or "")
    remaining = description
    metadata = {
        "hiring_stage": None,
        "challenge_format": "standard",
        "kind": None,
        "time_estimate": None,
        "collaboration_modes": [],
        "long_term_potential": None,
    }

    while remaining:
        match = _JOB_DESCRIPTION_METADATA_PATTERN.match(remaining)
        if not match:
            break
        key = str(match.group(1) or "").strip().lower()
        value = str(match.group(2) or "").strip()
        if key == "hiring_stage":
            metadata["hiring_stage"] = _normalize_hiring_stage(value)
        elif key == "challenge_format":
            metadata["challenge_format"] = _normalize_challenge_format(value) or metadata["challenge_format"]
        elif key == "micro_job_kind":
            metadata["kind"] = _normalize_micro_job_kind(value)
        elif key == "micro_time_estimate":
            metadata["time_estimate"] = _normalize_micro_job_time_estimate(value)
        elif key == "micro_collaboration":
            metadata["collaboration_modes"] = _normalize_micro_job_collaboration_modes(value)
        elif key == "micro_long_term":
            metadata["long_term_potential"] = _normalize_micro_job_long_term_potential(value)
        remaining = remaining[match.end():].lstrip()

    return metadata, remaining


def _extract_hiring_stage_from_description(raw_description: Any) -> tuple[str | None, str]:
    metadata, cleaned = _extract_job_description_metadata(raw_description)
    return metadata.get("hiring_stage"), cleaned


def _get_draft_hiring_stage(draft: dict) -> str | None:
    editor_state = draft.get("editor_state")
    if isinstance(editor_state, dict):
        stage = _normalize_hiring_stage(editor_state.get("hiring_stage"))
        if stage:
            return stage
    return _normalize_hiring_stage(draft.get("hiring_stage"))


def _get_draft_micro_job_state(draft: dict) -> dict[str, Any]:
    return _normalize_micro_job_editor_state(draft.get("editor_state"))


def _prepend_job_description_markers(description: str, draft: dict) -> str:
    markers: list[str] = []
    hiring_stage = _get_draft_hiring_stage(draft)
    if hiring_stage:
        markers.append(f"<!-- jobshaman:hiring_stage={hiring_stage} -->")
    micro_job = _get_draft_micro_job_state(draft)
    if micro_job.get("challenge_format") == "micro_job":
        markers.append("<!-- jobshaman:challenge_format=micro_job -->")
        if micro_job.get("kind"):
            markers.append(f"<!-- jobshaman:micro_job_kind={micro_job['kind']} -->")
        if micro_job.get("time_estimate"):
            markers.append(f"<!-- jobshaman:micro_time_estimate={micro_job['time_estimate']} -->")
        if micro_job.get("collaboration_modes"):
            markers.append(f"<!-- jobshaman:micro_collaboration={','.join(micro_job['collaboration_modes'])} -->")
        if micro_job.get("long_term_potential"):
            markers.append(f"<!-- jobshaman:micro_long_term={micro_job['long_term_potential']} -->")
    if not markers:
        return description
    prefix = "\n".join(markers)
    if not description:
        return prefix
    return f"{prefix}\n\n{description}"

@router.get("/")
async def root(request: Request):
    return {"status": "JobShaman API is running"}
