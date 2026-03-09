import os
import re
from typing import Any
from fastapi import APIRouter, Request, Depends, HTTPException, Query, BackgroundTasks
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from ..core.limiter import limiter
from ..core.security import get_current_user, verify_subscription, verify_csrf_token_header, require_company_access, verify_supabase_token
from ..models.requests import JobCheckRequest, JobStatusUpdateRequest, JobInteractionRequest, JobInteractionStateSyncRequest, JobApplicationCreateRequest, JobApplicationDraftRequest, JobApplicationStatusUpdateRequest, ApplicationMessageCreateRequest, HybridJobSearchRequest, HybridJobSearchV2Request, JobAnalyzeRequest, JobDraftUpsertRequest, JobDraftPublishRequest, JobLifecycleUpdateRequest
from ..models.responses import JobCheckResponse, JobApplicationDraftResponse
from ..services.legality import check_legality_rules
from ..services.asset_service import load_assets_metadata, serialize_asset_metadata
from ..services.subscription_access import fetch_latest_subscription_by, is_active_subscription, user_has_allowed_subscription
from ..matching_engine import recommend_jobs_for_user, hybrid_search_jobs, hybrid_search_jobs_v2
from ..matching_engine.feature_store import extract_candidate_features, extract_job_features
from ..matching_engine.retrieval import ensure_candidate_embedding, ensure_job_embeddings
from ..matching_engine.scoring import score_from_embeddings, score_job
from ..services.email import send_application_notification_email, send_review_email, send_recruiter_legality_email
from ..services.dialogue_composer import build_dialogue_enrichment
from ..core.database import supabase
from ..core.runtime_config import get_active_model_config
from ..ai_orchestration.client import AIClientError, call_primary_with_fallback, _extract_json
from ..utils.helpers import now_iso
from ..utils.request_urls import get_request_base_url
from ...scraper.scraper_api_sources import search_jooble_jobs_live, search_weworkremotely_jobs_live

router = APIRouter()
_SEARCH_EXPOSURES_AVAILABLE: bool = True
_SEARCH_EXPOSURES_WARNING_EMITTED: bool = False
_SEARCH_FEEDBACK_AVAILABLE: bool = True
_SEARCH_FEEDBACK_WARNING_EMITTED: bool = False
_INTERACTIONS_CSRF_WARNING_LAST_EMITTED: datetime | None = None
_INTERACTION_STATE_CACHE_TTL_SECONDS = 20
_INTERACTION_STATE_CACHE: dict[tuple[str, int], tuple[datetime, tuple[list[str], list[str]]]] = {}
_MY_DIALOGUES_CACHE_TTL_SECONDS = 20
_MY_DIALOGUES_CACHE: dict[tuple[str, int], tuple[datetime, dict[str, Any]]] = {}

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
    normalized = str(user_id or "").strip()
    if not normalized:
        return
    stale_keys = [key for key in _INTERACTION_STATE_CACHE.keys() if key[0] == normalized]
    for key in stale_keys:
        _INTERACTION_STATE_CACHE.pop(key, None)


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


def _user_has_allowed_subscription(user: dict, allowed_tiers: set[str]) -> bool:
    return user_has_allowed_subscription(user, allowed_tiers)


def _fetch_latest_subscription_by(column: str, value: str) -> dict | None:
    return fetch_latest_subscription_by(column, value)


def _is_active_subscription(sub: dict | None) -> bool:
    return is_active_subscription(sub)


def _user_has_direct_premium(user: dict) -> bool:
    user_tier = (user.get("subscription_tier") or "").lower()
    if user.get("is_subscription_active") and user_tier == "premium":
        return True
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        return False
    user_sub = _fetch_latest_subscription_by("user_id", user_id)
    return bool(user_sub and is_active_subscription(user_sub) and (user_sub.get("tier") or "").lower() == "premium")


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


def _require_company_tier(user: dict, company_id: str, allowed_tiers: set[str]) -> str:
    fast_tier = (user.get("subscription_tier") or "").lower()
    if company_id == str(user.get("company_id") or "") and user.get("is_subscription_active") and fast_tier in allowed_tiers:
        return fast_tier

    company_sub = _fetch_latest_subscription_by("company_id", company_id)
    if not company_sub or not _is_active_subscription(company_sub):
        if "free" in allowed_tiers:
            return "free"
        raise HTTPException(status_code=403, detail="Active subscription required")

    tier = (company_sub.get("tier") or "free").lower()
    if tier not in allowed_tiers:
        raise HTTPException(status_code=403, detail="Current plan does not include this feature")
    return tier


def _count_company_active_jobs(company_id: str, exclude_job_id=None) -> int:
    if not supabase or not company_id:
        return 0
    resp = supabase.table("jobs").select("id,status").eq("company_id", company_id).execute()
    rows = resp.data or []
    normalized_exclude = _normalize_job_id(exclude_job_id) if exclude_job_id is not None else None
    total = 0
    for row in rows:
        row_id = _normalize_job_id(row.get("id"))
        if normalized_exclude is not None and row_id == normalized_exclude:
            continue
        status = str(row.get("status") or "active").lower()
        if status in {"closed", "paused", "archived"}:
            continue
        total += 1
    return total


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
        if usage_resp.data:
            supabase.table("subscription_usage").update({"active_jobs_count": active_jobs}).eq("id", usage_resp.data[0]["id"]).execute()
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
        return usage_resp.data[0] if usage_resp.data else None
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

    update_payload: dict[str, Any] = {}
    if status is not None:
        update_payload["status"] = status
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
            if status is None:
                return False
            status_payload = {"status": status}
            try:
                try:
                    supabase.table("job_applications").update({
                        "status": status,
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
        for row in resp.data or []:
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
        for row in resp.data or []:
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

def _normalize_job_id(job_id: str):
    return int(job_id) if str(job_id).isdigit() else job_id


def _canonical_job_id(job_id) -> str:
    if job_id is None:
        return ""
    value = str(job_id).strip()
    if not value:
        return ""
    return value


def _safe_int(value: Any, fallback: int) -> int:
    try:
        parsed = int(value)
    except Exception:
        return fallback
    return parsed if parsed > 0 else fallback


def _resolve_role_dialogue_limit(job: dict) -> int:
    for key in (
        "dialogue_capacity_limit",
        "dialogue_slots_limit",
        "dialogue_limit",
        "max_dialogues",
        "max_active_dialogues",
    ):
        raw = job.get(key)
        if raw is not None and str(raw).strip() != "":
            return _safe_int(raw, _ROLE_DIALOGUE_PREVIEW_LIMIT)
    return _ROLE_DIALOGUE_PREVIEW_LIMIT


def _resolve_reaction_window_hours(job: dict) -> int:
    for key in ("reaction_window_hours", "dialogue_timeout_hours", "dialogue_response_timeout_hours"):
        raw = job.get(key)
        if raw is not None and str(raw).strip() != "":
            return _safe_int(raw, _DIALOGUE_RESPONSE_TIMEOUT_HOURS)
    return _DIALOGUE_RESPONSE_TIMEOUT_HOURS


def _attach_job_dialogue_preview_metrics(jobs: list[dict]) -> list[dict]:
    if not jobs:
        return jobs

    jobs_by_id: dict[str, list[dict]] = {}
    normalized_job_ids: list[Any] = []
    for job in jobs:
        if not isinstance(job, dict):
            continue
        canonical = _canonical_job_id(job.get("id"))
        if not canonical:
            continue
        jobs_by_id.setdefault(canonical, []).append(job)
        normalized = _normalize_job_id(canonical)
        if normalized not in normalized_job_ids:
            normalized_job_ids.append(normalized)

    open_counts: dict[str, int] = {key: 0 for key in jobs_by_id.keys()}
    if supabase and normalized_job_ids:
        try:
            app_rows_resp = (
                supabase
                .table("job_applications")
                .select("job_id,status")
                .in_("job_id", normalized_job_ids)
                .limit(5000)
                .execute()
            )
            for row in (app_rows_resp.data or []):
                if not isinstance(row, dict):
                    continue
                if not _is_active_dialogue_status(row.get("status")):
                    continue
                row_key = _canonical_job_id(row.get("job_id"))
                if row_key in open_counts:
                    open_counts[row_key] = open_counts.get(row_key, 0) + 1
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
    payload = (saved_job_ids, dismissed_job_ids)
    _set_cached_user_interaction_state(user_id, limit, payload)
    return payload


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


def _fetch_candidate_profile_for_draft(user_id: str) -> dict[str, Any]:
    if not supabase or not user_id:
        return {}
    try:
        resp = supabase.table("candidate_profiles").select("*").eq("id", user_id).maybe_single().execute()
        return resp.data if isinstance(resp.data, dict) else {}
    except Exception as exc:
        print(f"⚠️ Failed to fetch candidate profile for draft: {exc}")
        return {}


def _fetch_cv_document_for_draft(user_id: str, cv_document_id: str | None) -> dict[str, Any] | None:
    if not supabase or not user_id or not cv_document_id:
        return None
    try:
        resp = (
            supabase
            .table("cv_documents")
            .select("*")
            .eq("id", cv_document_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return resp.data if isinstance(resp.data, dict) else None
    except Exception as exc:
        print(f"⚠️ Failed to fetch CV document for draft: {exc}")
        return None


def _resolve_application_draft_language(requested: str, candidate_profile: dict[str, Any], cv_document: dict[str, Any] | None, job: dict[str, Any]) -> str:
    normalized = str(requested or "auto").strip().lower()
    if normalized and normalized != "auto":
        return normalized.split("-", 1)[0][:8]

    locale = str((cv_document or {}).get("locale") or "").strip().lower()
    if locale:
        return locale.split("-", 1)[0][:8]

    preferred_country = str((_safe_dict(candidate_profile.get("preferences")).get("preferredCountryCode") or candidate_profile.get("preferred_country_code") or "")).strip().upper()
    if preferred_country == "CZ":
        return "cs"
    if preferred_country == "SK":
        return "sk"
    if preferred_country in {"DE", "AT"}:
        return "de"
    if preferred_country == "PL":
        return "pl"

    explicit_job_language = str(job.get("language_code") or job.get("language") or "").strip().lower()
    if explicit_job_language:
        return explicit_job_language.split("-", 1)[0][:8]

    job_text = " ".join(
        [
            str(job.get("title") or ""),
            str(job.get("company") or ""),
            _strip_html_tags(job.get("description") or ""),
        ]
    ).lower()
    if re.search(r"[ěščřžýáíéůúťďň]", job_text):
        return "cs"
    return "en"


def _extract_candidate_cv_context(candidate_profile: dict[str, Any], cv_document: dict[str, Any] | None) -> tuple[str, str]:
    parsed = _safe_dict((cv_document or {}).get("parsed_data"))
    cv_ai_text = str(parsed.get("cvAiText") or parsed.get("cv_ai_text") or candidate_profile.get("cv_ai_text") or "").strip()
    cv_text = str(parsed.get("cvText") or parsed.get("cv_text") or candidate_profile.get("cv_text") or "").strip()
    return cv_text, cv_ai_text


def _derive_fit_signals(job: dict[str, Any], candidate_profile: dict[str, Any], recommendation: dict[str, Any] | None) -> tuple[float | None, list[str], list[str]]:
    if isinstance(recommendation, dict):
        score = recommendation.get("score")
        try:
            fit_score = round(float(score), 1) if score is not None else None
        except Exception:
            fit_score = None
        fit_reasons = _safe_string_list(recommendation.get("reasons"), limit=4)
        breakdown = _safe_dict(recommendation.get("breakdown"))
        fit_warnings = []
        if breakdown.get("missing_required_qualifications"):
            fit_warnings.append("Pozice pravděpodobně vyžaduje některé kvalifikace, které nejsou v profilu jasně doložené.")
        if breakdown.get("domain_mismatch"):
            fit_warnings.append("Role je částečně mimo dosavadní doménové zaměření profilu.")
        return fit_score, fit_reasons, fit_warnings[:3]

    fit_reasons: list[str] = []
    fit_warnings: list[str] = []
    skills = _safe_string_list(candidate_profile.get("skills"), limit=12)
    inferred_skills = _safe_string_list(candidate_profile.get("inferred_skills"), limit=8)
    known_skills = [item.lower() for item in (skills + inferred_skills) if item]
    job_text = " ".join(
        [
            str(job.get("title") or ""),
            str(job.get("company") or ""),
            _strip_html_tags(job.get("description") or ""),
        ]
    ).lower()
    matched_skills = []
    for skill in known_skills:
        if skill and skill not in matched_skills and skill in job_text:
            matched_skills.append(skill)
    if matched_skills:
        fit_reasons.append(f"Profil se potkává s požadavky v oblastech: {', '.join(matched_skills[:4])}.")

    candidate_title = str(candidate_profile.get("job_title") or "").strip()
    if candidate_title and candidate_title.lower() in job_text:
        fit_reasons.append("Současné nebo cílové zaměření kandidáta odpovídá názvu role.")

    if str(job.get("is_remote") or job.get("remote") or "").lower() in {"true", "1"}:
        fit_reasons.append("Role působí jako remote nebo remote-friendly.")

    salary_from = job.get("salary_from") or job.get("salary_min")
    salary_to = job.get("salary_to") or job.get("salary_max")
    desired_salary = _safe_dict(candidate_profile.get("preferences")).get("desiredSalary")
    try:
        desired_salary_value = float(desired_salary) if desired_salary is not None else None
    except Exception:
        desired_salary_value = None
    try:
        salary_value = float(salary_to or salary_from) if (salary_to or salary_from) is not None else None
    except Exception:
        salary_value = None
    if desired_salary_value is not None and salary_value is not None and salary_value < desired_salary_value:
        fit_warnings.append("Nabízená mzda může být pod preferovanou úrovní kandidáta.")

    if not fit_reasons:
        fit_reasons.append("Role tematicky navazuje na dosavadní profil a cílové pracovní směřování kandidáta.")

    return None, fit_reasons[:4], fit_warnings[:3]


def _build_application_draft_prompt(
    *,
    job: dict[str, Any],
    candidate_profile: dict[str, Any],
    cv_text: str,
    cv_ai_text: str,
    fit_score: float | None,
    fit_reasons: list[str],
    fit_warnings: list[str],
    language: str,
    tone: str,
) -> str:
    language_label = {
        "cs": "Czech",
        "sk": "Slovak",
        "de": "German",
        "pl": "Polish",
    }.get(language, "English")
    summary = _clip_text(candidate_profile.get("story") or candidate_profile.get("job_title") or "", 1200)
    skills = ", ".join(_safe_string_list(candidate_profile.get("skills"), limit=10))
    strengths = ", ".join(_safe_string_list(candidate_profile.get("strengths"), limit=6))
    experience = _clip_text(cv_ai_text or cv_text, 5000)
    fit_score_line = "unknown" if fit_score is None else str(fit_score)
    prompt = f"""
Write a concise job application message in {language_label}.
Return plain text only. No markdown, no bullets, no subject line.

Rules:
- Maximum 220 words.
- Use only facts supported by the candidate profile or CV context below.
- Do not invent years of experience, relocation plans, notice period, salary expectations, or availability.
- Keep the tone {tone}.
- Mention 1-2 concrete relevant strengths.
- Close with a calm invitation to continue the conversation.

Job:
- Title: {str(job.get("title") or "")}
- Company: {str(job.get("company") or "")}
- Location: {str(job.get("location") or "")}
- Salary: {str(job.get("salary_from") or job.get("salary_min") or "")} - {str(job.get("salary_to") or job.get("salary_max") or "")} {str(job.get("salary_currency") or "")}
- Description: {_clip_text(_strip_html_tags(job.get("description") or ""), 5000)}

Candidate:
- Current title: {str(candidate_profile.get("job_title") or "")}
- Summary: {summary}
- Skills: {skills}
- Strengths: {strengths}
- CV context: {experience}

Fit signals:
- Score: {fit_score_line}
- Reasons: {' | '.join(fit_reasons[:4])}
- Warnings: {' | '.join(fit_warnings[:3]) if fit_warnings else 'none'}
""".strip()
    return prompt


def _fallback_application_draft(
    *,
    job: dict[str, Any],
    candidate_profile: dict[str, Any],
    fit_reasons: list[str],
    language: str,
) -> str:
    title = str(job.get("title") or "tuto pozici").strip()
    company = str(job.get("company") or "vaši společnost").strip()
    candidate_title = str(candidate_profile.get("job_title") or "").strip()
    strengths = _safe_string_list(candidate_profile.get("strengths"), limit=2)
    primary_reason = fit_reasons[0] if fit_reasons else ""
    strength_text = ", ".join(strengths)
    if language in {"cs", "sk"}:
        opener = f"Dobrý den, reaguji na pozici {title} ve společnosti {company}."
        profile_line = f" V mém profilu navazuje tato role na zkušenosti v oblasti {candidate_title}." if candidate_title else ""
        reason_line = f" Zaujala mě hlavně tato shoda: {primary_reason}" if primary_reason else ""
        strength_line = f" Relevantní pro tuto roli jsou také moje silné stránky: {strength_text}." if strength_text else ""
        close = " Pokud bude dávat smysl krátký navazující kontakt, rád doplním konkrétní zkušenosti nebo ukázky práce."
    else:
        opener = f"Hello, I am reaching out about the {title} role at {company}."
        profile_line = f" The role aligns with my background in {candidate_title}." if candidate_title else ""
        reason_line = f" What stood out to me most is this fit signal: {primary_reason}" if primary_reason else ""
        strength_line = f" Relevant strengths I can bring include {strength_text}." if strength_text else ""
        close = " If useful, I would be glad to continue with a short follow-up conversation and share more concrete examples of my work."
    return _clip_words(f"{opener}{profile_line}{reason_line}{strength_line}{close}", 220)


def _generate_application_draft_text(prompt: str) -> tuple[str, dict[str, Any]]:
    default_primary = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    default_fallback = os.getenv("OPENAI_FALLBACK_MODEL", "gpt-4.1-nano")
    cfg = get_active_model_config("ai_orchestration", "application_draft")
    primary_model = cfg.get("primary_model") or default_primary
    fallback_model = cfg.get("fallback_model") or default_fallback
    generation_config = {
        "temperature": cfg.get("temperature", 0.3),
        "top_p": cfg.get("top_p", 1),
        "top_k": cfg.get("top_k", 1),
    }
    result, fallback_used = call_primary_with_fallback(
        prompt,
        primary_model,
        fallback_model,
        generation_config=generation_config,
    )
    text = _clip_words(result.text or "", 220)
    return text, {
        "model_used": result.model_name,
        "fallback_used": fallback_used,
        "token_usage": {"input": result.tokens_in, "output": result.tokens_out},
        "latency_ms": result.latency_ms,
    }


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
    })
    base.update(dialogue_runtime)
    return base


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
        attachment = {
            "name": name[:255],
            "url": url[:2000],
        }
        path = str(item.get("path") or "").strip()
        if path:
            attachment["path"] = path[:500]
        try:
            size = int(item.get("size")) if item.get("size") is not None else None
        except Exception:
            size = None
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


def _serialize_dialogue_message(row: dict | None) -> dict:
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
    handshake = _safe_dict(_safe_dict(draft.get("editor_state")).get("handshake"))
    first_reply_prompt = str(draft.get("first_reply_prompt") or handshake.get("first_reply_prompt") or "").strip()
    company_truth_hard = str(draft.get("company_truth_hard") or handshake.get("company_truth_hard") or "").strip()
    company_truth_fail = str(draft.get("company_truth_fail") or handshake.get("company_truth_fail") or "").strip()

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
    if not company_truth_hard:
        blocking.append("Missing the company truth: what is actually hard about this role.")
    if not company_truth_fail:
        blocking.append("Missing the company truth: who typically struggles in this role.")

    if salary_from is None or salary_to is None:
        warnings.append("Salary is not fully transparent.")
    elif float(salary_to or 0) < float(salary_from or 0):
        blocking.append("Salary max cannot be lower than salary min.")

    if len(requirements) < 120:
        warnings.append("Requirements section is still very short.")
    if len(benefits) < 2:
        warnings.append("Benefits are likely too vague or too thin.")
    if not first_reply_prompt:
        warnings.append("Add a first-reply prompt so candidates know how to start the handshake.")
    if len(role_summary) < 80:
        suggestions.append("Expand the role summary to make the opportunity clearer.")
    if len(responsibilities) < 180:
        suggestions.append("Add more concrete day-to-day responsibilities.")
    if len(requirements) < 180:
        suggestions.append("Clarify must-have skills and expected experience.")
    if company_truth_hard and len(company_truth_hard) < 60:
        suggestions.append("Make the 'what is hard' truth prompt more concrete.")
    if company_truth_fail and len(company_truth_fail) < 60:
        suggestions.append("Clarify what type of person usually struggles here.")

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
    handshake = _safe_dict(_safe_dict(draft.get("editor_state")).get("handshake"))
    first_reply_prompt = str(draft.get("first_reply_prompt") or handshake.get("first_reply_prompt") or "").strip()
    company_truth_hard = str(draft.get("company_truth_hard") or handshake.get("company_truth_hard") or "").strip()
    company_truth_fail = str(draft.get("company_truth_fail") or handshake.get("company_truth_fail") or "").strip()
    if first_reply_prompt:
        sections.append(f"### First Reply\n{first_reply_prompt}")
    if company_truth_hard:
        sections.append(f"### Company Truth: What Is Actually Hard?\n{company_truth_hard}")
    if company_truth_fail:
        sections.append(f"### Company Truth: Who Typically Struggles?\n{company_truth_fail}")
    benefits = _safe_string_list(draft.get("benefits_structured"), limit=20)
    if benefits:
        sections.append("### Benefits\n" + "\n".join([f"- {item}" for item in benefits]))
    return _prepend_hiring_stage_marker("\n\n".join(sections).strip(), draft)


_HIRING_STAGE_PATTERN = re.compile(r"^\s*<!--\s*jobshaman:hiring_stage=([a-z_]+)\s*-->\s*", re.IGNORECASE)
_ALLOWED_HIRING_STAGES = {
    "collecting_cvs",
    "reviewing_first_10",
    "shortlisting",
    "final_interviews",
    "offer_stage",
}


def _normalize_hiring_stage(raw: Any) -> str | None:
    if not isinstance(raw, str):
        return None
    normalized = raw.strip().lower()
    if normalized in _ALLOWED_HIRING_STAGES:
        return normalized
    return None


def _extract_hiring_stage_from_description(raw_description: Any) -> tuple[str | None, str]:
    description = str(raw_description or "")
    match = _HIRING_STAGE_PATTERN.match(description)
    if not match:
        return None, description
    stage = _normalize_hiring_stage(match.group(1))
    cleaned = description[match.end():].lstrip()
    return stage, cleaned


def _get_draft_hiring_stage(draft: dict) -> str | None:
    editor_state = draft.get("editor_state")
    if isinstance(editor_state, dict):
        stage = _normalize_hiring_stage(editor_state.get("hiring_stage"))
        if stage:
            return stage
    return _normalize_hiring_stage(draft.get("hiring_stage"))


def _prepend_hiring_stage_marker(description: str, draft: dict) -> str:
    hiring_stage = _get_draft_hiring_stage(draft)
    if not hiring_stage:
        return description
    marker = f"<!-- jobshaman:hiring_stage={hiring_stage} -->"
    if not description:
        return marker
    return f"{marker}\n\n{description}"

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
async def log_job_interaction(
    payload: JobInteractionRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
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
            _invalidate_user_interaction_state_cache(user_id)
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
        job_resp = supabase.table("jobs").select("company_id").eq("id", job_id).maybe_single().execute()
        company_id = (job_resp.data or {}).get("company_id") if job_resp else None
    except Exception as exc:
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

    # Candidate dialogue hub should degrade to an empty state instead of 500
    # when older environments are missing optional columns.
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
        print(f"⚠️ Failed to load candidate dialogues for {user_id}: {last_error}")
        payload = {
            "applications": [],
            "candidate_capacity": _serialize_candidate_dialogue_capacity(user_id, user=user),
        }
        _set_cached_my_dialogues(user_id, limit, payload)
        return payload

    rows = [_expire_dialogue_if_needed(row) for row in (resp.data or []) if isinstance(row, dict)]
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
            .select("*,jobs(id,title),profiles(id,full_name,email)")
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

    rows = [_expire_dialogue_if_needed(row) for row in (resp.data or []) if isinstance(row, dict)]
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
            .select("*,jobs(id,title),profiles(id,full_name,email)")
            .eq("id", application_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
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


# Compatibility aliases during the route-handler transition.
create_job_application = create_dialogue_legacy
list_my_job_applications = list_my_dialogues_legacy
get_my_job_application_detail = get_my_dialogue_detail_legacy
withdraw_my_job_application = withdraw_my_dialogue_legacy
list_my_application_messages = list_my_dialogue_messages_legacy
create_my_application_message = create_my_dialogue_message_legacy
list_company_applications = list_company_dialogues_legacy
get_company_application_detail = get_company_dialogue_detail_legacy
list_company_application_messages = list_company_dialogue_messages_legacy
create_company_application_message = create_company_dialogue_message_legacy
update_company_application_status = update_company_dialogue_status_legacy


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
    dialogues: list[dict[str, Any]] = []
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
    if not existing_job_id:
        _enforce_company_role_open_limit(company_id, user)
    _enforce_company_job_publish_limit(company_id, user, existing_job_id=existing_job_id)
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
        payload=_build_role_activity_payload(
            job_id=str(job_id),
            job_title=str(job_payload.get("title") or ""),
            version_number=next_version,
            next_status="active",
        ),
        actor_user_id=user.get("id") or user.get("auth_id"),
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
    source_resp = supabase.table("jobs").select("*").eq("id", _normalize_job_id(job_id)).maybe_single().execute()
    source = source_resp.data if source_resp else None
    if not source:
        raise HTTPException(status_code=404, detail="Job not found")
    extracted_hiring_stage, cleaned_description = _extract_hiring_stage_from_description(source.get("description"))
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
        "salary_timeframe": source.get("salary_timeframe") or "month",
        "contract_type": source.get("contract_type"),
        "work_model": source.get("work_type") or source.get("work_model"),
        "workplace_address": source.get("workplace_address") or source.get("location"),
        "location_public": source.get("location"),
        "contact_email": source.get("contact_email"),
        "editor_state": {
            "selected_section": "role_summary",
            "hiring_stage": extracted_hiring_stage or "collecting_cvs",
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
    source_resp = supabase.table("jobs").select("*").eq("id", _normalize_job_id(job_id)).maybe_single().execute()
    source = source_resp.data if source_resp else None
    if not source:
        raise HTTPException(status_code=404, detail="Job not found")
    company_id = str(source.get("company_id") or "")
    extracted_hiring_stage, cleaned_description = _extract_hiring_stage_from_description(source.get("description"))
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
        "salary_timeframe": source.get("salary_timeframe") or "month",
        "contract_type": source.get("contract_type"),
        "work_model": source.get("work_type") or source.get("work_model"),
        "workplace_address": source.get("workplace_address") or source.get("location"),
        "location_public": source.get("location"),
        "contact_email": source.get("contact_email"),
        "editor_state": {
            "selected_section": "role_summary",
            "hiring_stage": extracted_hiring_stage or "collecting_cvs",
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
        payload=_build_role_activity_payload(
            job_id=str(job_row.get("id") or job_id),
            job_title=str(job_row.get("title") or ""),
            previous_status=str(job_row.get("status") or "active"),
            next_status=payload.status,
        ),
        actor_user_id=user.get("id") or user.get("auth_id"),
        subject_type="job",
        subject_id=str(job_row.get("id") or job_id),
    )
    _sync_company_active_jobs_usage(str(job_row.get("company_id") or ""))
    return {"status": "success"}


@router.get("/jobs/recommendations")
@limiter.limit("30/minute")
async def get_job_recommendations(
    request: Request,
    background_tasks: BackgroundTasks,
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

    _attach_job_dialogue_preview_metrics(
        [item.get("job") for item in enriched_matches if isinstance(item.get("job"), dict)]
    )

    if exposure_rows:
        background_tasks.add_task(_write_recommendation_exposures, exposure_rows)

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
    _attach_job_dialogue_preview_metrics(result.get("jobs") or [])
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
    background_tasks: BackgroundTasks,
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
    _attach_job_dialogue_preview_metrics(jobs)
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
    if exposures:
        background_tasks.add_task(_write_search_exposures, request_id, exposures)

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


@router.get("/jobs/external/weworkremotely/search")
@limiter.limit("20/minute")
async def search_weworkremotely_live(
    request: Request,
    search_term: str = Query(default="", max_length=200),
    filter_city: str = Query(default="", max_length=120),
    limit: int = Query(default=12, ge=1, le=40),
    country_codes: str | None = Query(default=None),
    exclude_country_codes: str | None = Query(default=None),
):
    def _parse_csv(value: str | None) -> list[str]:
        if not value:
            return []
        return [part.strip().upper() for part in value.split(",") if part and part.strip()]

    jobs = search_weworkremotely_jobs_live(
        limit=limit,
        search_term=search_term,
        filter_city=filter_city,
        country_codes=_parse_csv(country_codes),
        exclude_country_codes=_parse_csv(exclude_country_codes),
    )
    _attach_job_dialogue_preview_metrics(jobs)
    return {
        "jobs": jobs,
        "has_more": len(jobs) >= limit,
        "total_count": len(jobs),
        "source": "weworkremotely_live_rss",
    }


@router.get("/jobs/external/jooble/search")
@limiter.limit("30/minute")
async def search_jooble_live(
    request: Request,
    search_term: str = Query(default="", max_length=200),
    filter_city: str = Query(default="", max_length=120),
    limit: int = Query(default=12, ge=1, le=40),
    page: int = Query(default=1, ge=1, le=10),
    country_codes: str | None = Query(default=None),
    exclude_country_codes: str | None = Query(default=None),
):
    def _parse_csv(value: str | None) -> list[str]:
        if not value:
            return []
        return [part.strip().upper() for part in value.split(",") if part and part.strip()]

    jobs = search_jooble_jobs_live(
        limit=limit,
        page=page,
        search_term=search_term,
        filter_city=filter_city,
        country_codes=_parse_csv(country_codes),
        exclude_country_codes=_parse_csv(exclude_country_codes),
    )
    _attach_job_dialogue_preview_metrics(jobs)
    return {
        "jobs": jobs,
        "has_more": len(jobs) >= limit,
        "total_count": len(jobs),
        "source": "jooble_live_api",
    }

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


@router.post("/jobs/{job_id}/application-draft", response_model=JobApplicationDraftResponse)
@limiter.limit("12/minute")
async def generate_job_application_draft(
    job_id: str,
    payload: JobApplicationDraftRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    if not _user_has_allowed_subscription(user, {"premium"}):
        raise HTTPException(status_code=403, detail="Premium subscription required")

    normalized_job_id = _normalize_job_id(job_id)
    if normalized_job_id is None:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    try:
        job_resp = supabase.table("jobs").select("*").eq("id", normalized_job_id).maybe_single().execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load job: {exc}")
    job = job_resp.data if job_resp and isinstance(job_resp.data, dict) else None
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    candidate_profile = _fetch_candidate_profile_for_draft(user_id)
    cv_document = None
    if payload.cv_document_id:
        cv_document = _fetch_cv_document_for_draft(user_id, payload.cv_document_id)
        if not cv_document:
            raise HTTPException(status_code=404, detail="CV document not found")

    recommendation = None
    try:
        recommendations = recommend_jobs_for_user(user_id=user_id, limit=120, allow_cache=True)
        recommendation = next(
            (
                item
                for item in recommendations
                if str(_safe_dict(item.get("job")).get("id") or "") == str(normalized_job_id)
            ),
            None,
        )
    except Exception as exc:
        print(f"⚠️ Failed to compute draft recommendation context: {exc}")

    fit_score, fit_reasons, fit_warnings = _derive_fit_signals(job, candidate_profile, recommendation)
    language = _resolve_application_draft_language(payload.language, candidate_profile, cv_document, job)
    cv_text, cv_ai_text = _extract_candidate_cv_context(candidate_profile, cv_document)

    used_fallback = False
    model_meta: dict[str, Any]
    try:
        prompt = _build_application_draft_prompt(
            job=job,
            candidate_profile=candidate_profile,
            cv_text=cv_text,
            cv_ai_text=cv_ai_text,
            fit_score=fit_score,
            fit_reasons=fit_reasons,
            fit_warnings=fit_warnings,
            language=language,
            tone=payload.tone,
        )
        draft_text, model_meta = _generate_application_draft_text(prompt)
        if not draft_text.strip():
            raise ValueError("Empty application draft")
    except Exception as exc:
        used_fallback = True
        draft_text = _fallback_application_draft(
            job=job,
            candidate_profile=candidate_profile,
            fit_reasons=fit_reasons,
            language=language,
        )
        model_meta = {
            "mode": "deterministic_fallback",
            "error": str(exc),
            "model_used": None,
            "fallback_used": False,
            "token_usage": {"input": 0, "output": 0},
            "latency_ms": 0,
        }

    _write_analytics_event(
        event_type="application_draft_regenerated" if payload.regenerate else "application_draft_generated",
        user_id=user_id,
        company_id=str(job.get("company_id") or "") or None,
        feature="candidate_copilot",
        tier=(user.get("subscription_tier") or "").lower() or "premium",
        metadata={
            "job_id": normalized_job_id,
            "cv_document_id": payload.cv_document_id,
            "tone": payload.tone,
            "language": language,
            "used_fallback": used_fallback,
            "fit_score": fit_score,
        },
    )

    return JobApplicationDraftResponse(
        draft_text=draft_text,
        fit_score=fit_score,
        fit_reasons=fit_reasons,
        fit_warnings=fit_warnings,
        language=language,
        tone=payload.tone,
        used_fallback=used_fallback,
        model_meta=model_meta,
    )


@router.post("/match-candidates")
@limiter.limit("10/minute")
async def match_candidates_service(request: Request, job_id: str = Query(...), user: dict = Depends(verify_subscription)):
    job_row = _require_job_access(user, job_id)
    company_id = str(job_row.get("company_id") or "")
    _require_company_tier(user, company_id, {"growth", "professional", "enterprise"})
    job_res = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    if not job_res.data: raise HTTPException(status_code=404, detail="Job not found")
    job = job_res.data

    cand_res = supabase.table("candidate_profiles").select("*").execute()
    candidates = cand_res.data or []
    job_features = extract_job_features(job)
    job_embeddings = ensure_job_embeddings([job], persist=False)
    job_embedding = job_embeddings.get(str(job.get("id") or job_id)) or []

    matches = []
    for cand in candidates:
        candidate_id = str(cand.get("id") or "")
        if not candidate_id:
            continue
        candidate_features = extract_candidate_features(cand)
        candidate_embedding = ensure_candidate_embedding(
            candidate_id,
            candidate_features.get("text") or "",
            persist=False,
        )
        semantic = score_from_embeddings(candidate_embedding, job_embedding)
        score, reasons, breakdown = score_job(candidate_features, job_features, semantic)
        if score >= 25:
            matches.append(
                {
                    "candidate_id": candidate_id,
                    "score": score,
                    "reasons": reasons,
                    "breakdown": breakdown,
                }
            )

    return {"job_id": job_id, "matches": sorted(matches, key=lambda x: x["score"], reverse=True)[:10]}
