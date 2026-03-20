import os
import re
import time
import json
import hashlib
from statistics import median
from typing import Any
from importlib import import_module
from fastapi import APIRouter, Request, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from threading import Lock
from ..core.limiter import limiter
from ..core.security import get_current_user, verify_subscription, verify_csrf_token_header, require_company_access, verify_supabase_token
from ..models.requests import JobCheckRequest, JobStatusUpdateRequest, JobInteractionRequest, JobInteractionStateSyncRequest, JobApplicationCreateRequest, JobApplicationDraftRequest, JobApplicationStatusUpdateRequest, DialogueSolutionSnapshotUpsertRequest, ApplicationMessageCreateRequest, HybridJobSearchRequest, HybridJobSearchV2Request, JobAnalyzeRequest, JobDraftUpsertRequest, JobDraftPublishRequest, JobLifecycleUpdateRequest
from ..models.responses import JobCheckResponse, JobApplicationDraftResponse
from ..services.legality import check_legality_rules
from ..services.asset_service import load_assets_metadata, serialize_asset_metadata
from ..services.subscription_access import fetch_latest_subscription_by, is_active_subscription, user_has_allowed_subscription
from ..matching_engine import recommend_jobs_for_user, hybrid_search_jobs, hybrid_search_jobs_v2
from ..matching_engine.feature_store import extract_candidate_features, extract_job_features
from ..matching_engine.retrieval import ensure_candidate_embedding, ensure_job_embeddings, fetch_recent_jobs
from ..matching_engine.scoring import score_from_embeddings, score_job
from ..services.email import send_application_notification_email, send_review_email, send_recruiter_legality_email
from ..services.dialogue_composer import build_dialogue_enrichment
from ..core.database import supabase
from ..core.runtime_config import get_active_model_config
from ..ai_orchestration.client import (
    AIClientError,
    call_primary_with_fallback,
    _extract_json,
    get_default_fallback_model,
    get_default_primary_model,
)
from ..services.search_intelligence import enrich_search_query
from ..services.jobspy_jobs import backfill_jobspy_postgres_from_mongo, get_jobspy_storage_health, import_jobspy_jobs, jobspy_mongo_enabled, search_jobspy_jobs
from ..services.jobspy_career_ops import build_career_ops_feed, refresh_jobspy_career_ops_snapshots
from ..services.jobs_migration import backfill_jobs_postgres_from_supabase
from ..services.jobs_postgres_store import count_active_main_jobs, delete_job_by_id, ensure_jobs_postgres_schema, get_job_by_id, get_jobs_postgres_health, jobs_postgres_enabled, jobs_postgres_main_enabled, list_company_jobs, read_external_cache_jobs, update_job_fields, upsert_external_cache_snapshot
from ..utils.helpers import now_iso
from ..utils.request_urls import get_request_base_url
from ..core import config
from ..core.config import SCRAPER_TOKEN


def _import_first(module_names: list[str]) -> Any:
    last_error: Exception | None = None
    for module_name in module_names:
        try:
            return import_module(module_name)
        except Exception as exc:
            last_error = exc
    if last_error is not None:
        raise last_error
    raise ImportError("No module names provided")


_scraper_api_sources = _import_first([
    "scraper.scraper_api_sources",
    "backend.scraper.scraper_api_sources",
])
search_jooble_jobs_live = _scraper_api_sources.search_jooble_jobs_live
search_arbeitnow_jobs_live = _scraper_api_sources.search_arbeitnow_jobs_live
search_weworkremotely_jobs_live = _scraper_api_sources.search_weworkremotely_jobs_live

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
_HYBRID_SEARCH_V2_HTTP_CACHE_TTL_SECONDS = 15
# Empty result sets are especially likely to be spammed by idle clients (same filters, same page).
# Use a longer TTL to avoid repeated Supabase RPC calls when the feed is empty.
_HYBRID_SEARCH_V2_HTTP_CACHE_EMPTY_TTL_SECONDS = 300
_HYBRID_SEARCH_V2_HTTP_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_HYBRID_SEARCH_V2_HTTP_CACHE_LOCK = Lock()

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
_EXTERNAL_LIVE_SEARCH_CACHE_TABLE = "external_live_search_cache"
_EXTERNAL_FEED_MAX_AGE_DAYS = 21
_EXTERNAL_LIVE_SEARCH_CACHE_TTL_SECONDS = max(60, int(os.getenv("LIVE_SEARCH_CACHE_TTL_SECONDS") or "900"))
_EXTERNAL_PROVIDER_FAILURE_THRESHOLD = max(2, int(os.getenv("EXTERNAL_PROVIDER_FAILURE_THRESHOLD") or "2"))
_EXTERNAL_PROVIDER_COOLDOWN_SECONDS = max(60, int(os.getenv("EXTERNAL_PROVIDER_COOLDOWN_SECONDS") or "300"))
_EXTERNAL_PROVIDER_HEALTH_LOCK = Lock()
_EXTERNAL_PROVIDER_HEALTH: dict[str, dict[str, Any]] = {
    "jooble": {"failures": 0, "circuit_open_until": None, "last_error": None, "last_failure_at": None, "last_success_at": None},
    "weworkremotely": {"failures": 0, "circuit_open_until": None, "last_error": None, "last_failure_at": None, "last_success_at": None},
    "arbeitnow": {"failures": 0, "circuit_open_until": None, "last_error": None, "last_failure_at": None, "last_success_at": None},
}


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


def _is_missing_table_error(exc: Exception, table_name: str) -> bool:
    msg = str(exc).lower()
    return ("pgrst205" in msg and table_name.lower() in msg) or f"table '{table_name.lower()}'" in msg


def _provider_health_snapshot() -> dict[str, dict[str, Any]]:
    now = datetime.now(timezone.utc)
    snapshot: dict[str, dict[str, Any]] = {}
    with _EXTERNAL_PROVIDER_HEALTH_LOCK:
        for provider, state in _EXTERNAL_PROVIDER_HEALTH.items():
            cooldown_until = state.get("circuit_open_until")
            is_open = isinstance(cooldown_until, datetime) and cooldown_until > now
            failure_count = int(state.get("failures") or 0)
            snapshot[provider] = {
                "state": "open" if is_open else ("degraded" if failure_count > 0 else "healthy"),
                "failure_count": failure_count,
                "cooldown_until": cooldown_until.isoformat() if isinstance(cooldown_until, datetime) else None,
                "last_error": state.get("last_error"),
                "last_failure_at": state.get("last_failure_at"),
                "last_success_at": state.get("last_success_at"),
            }
    return snapshot


def _provider_circuit_open(provider: str) -> bool:
    now = datetime.now(timezone.utc)
    with _EXTERNAL_PROVIDER_HEALTH_LOCK:
        state = _EXTERNAL_PROVIDER_HEALTH.setdefault(provider, {})
        cooldown_until = state.get("circuit_open_until")
        if isinstance(cooldown_until, datetime) and cooldown_until > now:
            return True
        if isinstance(cooldown_until, datetime) and cooldown_until <= now:
            state["circuit_open_until"] = None
    return False


def _mark_provider_success(provider: str) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    with _EXTERNAL_PROVIDER_HEALTH_LOCK:
        state = _EXTERNAL_PROVIDER_HEALTH.setdefault(provider, {})
        state["failures"] = 0
        state["circuit_open_until"] = None
        state["last_error"] = None
        state["last_success_at"] = now_iso


def _mark_provider_failure(provider: str, error: Exception | str) -> None:
    now = datetime.now(timezone.utc)
    error_text = str(error)
    with _EXTERNAL_PROVIDER_HEALTH_LOCK:
        state = _EXTERNAL_PROVIDER_HEALTH.setdefault(provider, {})
        failures = int(state.get("failures") or 0) + 1
        is_host_scoped_jooble_forbidden = (
            provider == "jooble"
            and "forbidden" in error_text.lower()
            and "host" in error_text.lower()
            and "all candidate hosts" not in error_text.lower()
        )
        if "403" in error_text or "forbidden" in error_text.lower():
            failures = max(failures, _EXTERNAL_PROVIDER_FAILURE_THRESHOLD)
        if is_host_scoped_jooble_forbidden:
            failures = min(failures, max(1, _EXTERNAL_PROVIDER_FAILURE_THRESHOLD - 1))
        state["failures"] = failures
        state["last_error"] = error_text
        state["last_failure_at"] = now.isoformat()
        if failures >= _EXTERNAL_PROVIDER_FAILURE_THRESHOLD and not is_host_scoped_jooble_forbidden:
            state["circuit_open_until"] = now + timedelta(seconds=_EXTERNAL_PROVIDER_COOLDOWN_SECONDS)


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


def _parse_country_code_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip().upper() for part in value.split(",") if part and part.strip()]


def _normalize_external_job_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def _parse_external_job_datetime(value: Any) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        normalized = raw.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return None


def _is_external_job_fresh_enough(job: dict[str, Any]) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(days=_EXTERNAL_FEED_MAX_AGE_DAYS)
    for field in ("scraped_at", "posted_at", "postedAt", "fetched_at", "updated_at"):
        parsed = _parse_external_job_datetime(job.get(field))
        if parsed is not None:
            return parsed >= cutoff
    return True


def _external_job_dedup_keys(job: dict[str, Any]) -> list[str]:
    keys: set[str] = set()
    job_id = _normalize_external_job_text(job.get("id"))
    if job_id:
        keys.add(f"id:{job_id}")

    url = _normalize_external_job_text(job.get("url"))
    if url:
        keys.add(f"url:{url}")

    title = _normalize_external_job_text(job.get("title"))
    company = _normalize_external_job_text(job.get("company"))
    location = _normalize_external_job_text(job.get("location"))
    source = _normalize_external_job_text(job.get("source"))
    if title and company:
        keys.add(f"role:{title}|{company}|{location}")
        if source:
            keys.add(f"role-source:{title}|{company}|{location}|{source}")
    return list(keys)


def _read_cached_external_jobs(
    *,
    page: int,
    page_size: int,
    search_term: str = "",
    filter_city: str = "",
    country_codes: list[str] | None = None,
    exclude_country_codes: list[str] | None = None,
) -> dict[str, Any]:
    if jobs_postgres_enabled():
        try:
            rows = [{"payload_json": read_external_cache_jobs(limit_rows=120)}]
        except Exception as exc:
            print(f"⚠️ Failed to read Jobs Postgres external cache: {exc}")
            rows = []
    else:
        rows = []

    if not rows:
        if not supabase:
            return {"jobs": [], "total_count": 0, "has_more": False}

        try:
            response = (
                supabase.table(_EXTERNAL_LIVE_SEARCH_CACHE_TABLE)
                .select("provider,payload_json,expires_at,fetched_at")
                .gte("expires_at", datetime.now(timezone.utc).isoformat())
                .order("fetched_at", desc=True)
                .limit(120)
                .execute()
            )
            rows = response.data or []
        except Exception as exc:
            if not _is_missing_table_error(exc, _EXTERNAL_LIVE_SEARCH_CACHE_TABLE):
                print(f"⚠️ Failed to read external live cache: {exc}")
            return {"jobs": [], "total_count": 0, "has_more": False}

    normalized_search = _normalize_external_job_text(search_term)
    normalized_city = _normalize_external_job_text(filter_city)
    allowed_countries = {code.strip().upper() for code in (country_codes or []) if code.strip()}
    blocked_countries = {code.strip().upper() for code in (exclude_country_codes or []) if code.strip()}
    seen: set[str] = set()
    deduped_jobs: list[dict[str, Any]] = []
    search_tokens = [token for token in normalized_search.split(" ") if token]
    city_tokens = [token for token in normalized_city.split(" ") if token]

    for row in rows:
        payload = row.get("payload_json")
        if not isinstance(payload, list):
            continue
        for item in payload:
            if not isinstance(item, dict):
                continue
            if not _is_external_job_fresh_enough(item):
                continue

            job_country = str(item.get("country_code") or "").strip().upper()
            if allowed_countries and job_country not in allowed_countries:
                continue
            if job_country and job_country in blocked_countries:
                continue

            haystack = _normalize_external_job_text(
                " ".join(
                    [
                        str(item.get("title") or ""),
                        str(item.get("company") or ""),
                        str(item.get("location") or ""),
                        str(item.get("description") or ""),
                        " ".join(item.get("tags") or []) if isinstance(item.get("tags"), list) else "",
                        " ".join(item.get("benefits") or []) if isinstance(item.get("benefits"), list) else "",
                    ]
                )
            )
            if search_tokens and not all(token in haystack for token in search_tokens):
                continue
            if city_tokens and not all(token in haystack for token in city_tokens):
                continue

            dedup_keys = _external_job_dedup_keys(item)
            if any(key in seen for key in dedup_keys):
                continue
            for key in dedup_keys:
                seen.add(key)
            deduped_jobs.append(dict(item))

    deduped_jobs.sort(
        key=lambda job: str(job.get("scraped_at") or job.get("fetched_at") or ""),
        reverse=True,
    )

    total_count = len(deduped_jobs)
    start = max(0, page) * max(1, page_size)
    end = start + max(1, page_size)
    sliced = deduped_jobs[start:end]
    return {
        "jobs": sliced,
        "total_count": total_count,
        "has_more": end < total_count,
    }


def _merge_external_job_lists(
    *job_lists: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    seen: set[str] = set()
    merged: list[dict[str, Any]] = []
    for job_list in job_lists:
        for item in job_list:
            if not isinstance(item, dict):
                continue
            if not _is_external_job_fresh_enough(item):
                continue
            dedup_keys = _external_job_dedup_keys(item)
            if dedup_keys and any(key in seen for key in dedup_keys):
                continue
            for key in dedup_keys:
                seen.add(key)
            merged.append(dict(item))

    merged.sort(
        key=lambda job: str(job.get("scraped_at") or job.get("updated_at") or job.get("fetched_at") or ""),
        reverse=True,
    )
    return merged


def _write_external_cache_snapshot(
    *,
    provider: str,
    jobs: list[dict[str, Any]],
    search_term: str,
    filter_city: str,
    country_codes: list[str] | None,
    exclude_country_codes: list[str] | None,
    page: int = 1,
) -> None:
    now = datetime.now(timezone.utc)
    snapshot = [dict(item) for item in jobs if isinstance(item, dict)]
    if not snapshot:
        return
    if jobs_postgres_enabled():
        try:
            persisted = upsert_external_cache_snapshot(
                cache_key=f"seed:{provider}:{uuid4()}",
                provider=provider,
                search_term=search_term,
                filter_city=filter_city,
                country_codes=country_codes,
                exclude_country_codes=exclude_country_codes,
                page=page,
                jobs=snapshot,
                fetched_at=now,
                expires_at=now + timedelta(seconds=_EXTERNAL_LIVE_SEARCH_CACHE_TTL_SECONDS),
            )
            if persisted:
                return
        except Exception as exc:
            print(f"⚠️ Failed to persist Jobs Postgres external cache snapshot ({provider}): {exc}")
    if not supabase:
        return
    try:
        supabase.table(_EXTERNAL_LIVE_SEARCH_CACHE_TABLE).upsert(
            {
                "cache_key": f"seed:{provider}:{uuid4()}",
                "provider": provider,
                "search_term": str(search_term or "").strip(),
                "filter_city": str(filter_city or "").strip(),
                "country_codes": [code.strip().upper() for code in (country_codes or []) if code and code.strip()],
                "exclude_country_codes": [code.strip().upper() for code in (exclude_country_codes or []) if code and code.strip()],
                "page": max(1, int(page or 1)),
                "result_count": len(snapshot),
                "payload_json": snapshot,
                "fetched_at": now.isoformat(),
                "expires_at": (now + timedelta(seconds=_EXTERNAL_LIVE_SEARCH_CACHE_TTL_SECONDS)).isoformat(),
                "updated_at": now.isoformat(),
            },
            on_conflict="cache_key",
        ).execute()
    except Exception as exc:
        print(f"⚠️ Failed to persist external cache snapshot ({provider}): {exc}")


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
    normalized_job_ids: list[int] = []
    for job in jobs:
        if not isinstance(job, dict):
            continue
        canonical = _canonical_job_id(job.get("id"))
        if not canonical:
            continue
        jobs_by_id.setdefault(canonical, []).append(job)
        # External live listings often use URL-like ids. dialogue metrics are stored for our
        # internal job_applications (job_id bigint), so only query when the id is numeric.
        normalized = _normalize_job_id(canonical)
        if isinstance(normalized, int) and normalized not in normalized_job_ids:
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

def _is_missing_relationship_error(exc: Exception, left_table: str, right_table: str) -> bool:
    msg = str(exc).lower()
    if "pgrst200" not in msg:
        return False
    left = left_table.lower()
    right = right_table.lower()
    return f"relationship between '{left}' and '{right}'" in msg or f"relationship between '{right}' and '{left}'" in msg


def _safe_dict(value) -> dict:
    return value if isinstance(value, dict) else {}


def _read_job_record(job_id: Any) -> dict[str, Any] | None:
    normalized_job_id = _normalize_job_id(str(job_id))
    pg_row = get_job_by_id(normalized_job_id)
    if isinstance(pg_row, dict) and pg_row:
        return pg_row
    if not supabase:
        return None
    try:
        resp = supabase.table("jobs").select("*").eq("id", normalized_job_id).maybe_single().execute()
        row = resp.data if resp else None
        return row if isinstance(row, dict) else None
    except Exception:
        return None


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


_NATIVE_JOB_SOURCE = "jobshaman.cz"
_JOB_PUBLIC_PERSON_MAX_RESPONDERS = 3


def _sync_main_job_to_jobs_postgres(job_row: dict[str, Any] | None, *, source_kind: str = "native") -> None:
    if not isinstance(job_row, dict) or not job_row:
        return
    payload = dict(job_row)
    payload["source_kind"] = source_kind
    payload.setdefault("source", _NATIVE_JOB_SOURCE)
    payload.setdefault("scraped_at", payload.get("updated_at") or payload.get("created_at") or now_iso())
    payload.setdefault("created_at", payload.get("scraped_at"))
    payload["updated_at"] = payload.get("updated_at") or now_iso()
    try:
        updated = update_job_fields(payload.get("id"), payload)
        if updated:
            return
    except Exception:
        pass
    from ..services.jobs_postgres_store import backfill_jobs_from_documents
    backfill_jobs_from_documents([payload])


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


def _trimmed_text(value: Any, limit: int = 240) -> str:
    return str(value or "").strip()[:limit]


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
        row = resp.data or {}
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
        return [row for row in (resp.data or []) if isinstance(row, dict)]
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
            for row in (resp.data or []):
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


def _first_non_empty_text(*values: Any, limit: int = 220) -> str:
    for value in values:
        text = _trimmed_text(value, limit)
        if text:
            return text
    return ""


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
    for row in (resp.data or []):
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
            .select("id", count="exact")
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
        application_rows = app_resp.data or []
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
        for row in (message_resp.data or []):
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
            .select("id,job_id,company_id,candidate_id,status,submitted_at,created_at,jobs(id,title,description),companies(id,name)")
            .eq("id", dialogue_id)
            .maybe_single()
            .execute()
        )
        row = resp.data if resp else None
        return row if isinstance(row, dict) else None
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
    row = base_resp.data if base_resp else None
    if not isinstance(row, dict):
        return None

    normalized_job_id = _normalize_job_id(row.get("job_id"))
    if isinstance(normalized_job_id, int):
        try:
            job_resp = (
                supabase
                .table("jobs")
                .select("id,title,description")
                .eq("id", normalized_job_id)
                .maybe_single()
                .execute()
            )
            row["jobs"] = job_resp.data if job_resp and isinstance(job_resp.data, dict) else {}
        except Exception:
            row["jobs"] = {}

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
            row["companies"] = company_resp.data if company_resp and isinstance(company_resp.data, dict) else {}
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
            .select("*,jobs(id,title),companies(id,name)")
            .eq("dialogue_id", dialogue_id)
            .maybe_single()
            .execute()
        )
        row = resp.data if resp else None
        return row if isinstance(row, dict) else None
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
    row = base_resp.data if base_resp else None
    if not isinstance(row, dict):
        return None

    normalized_job_id = _normalize_job_id(row.get("job_id"))
    if isinstance(normalized_job_id, int):
        try:
            job_resp = (
                supabase
                .table("jobs")
                .select("id,title")
                .eq("id", normalized_job_id)
                .maybe_single()
                .execute()
            )
            row["jobs"] = job_resp.data if job_resp and isinstance(job_resp.data, dict) else {}
        except Exception:
            row["jobs"] = {}

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
            row["companies"] = company_resp.data if company_resp and isinstance(company_resp.data, dict) else {}
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


def _safe_int(value: Any) -> int | None:
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
            for row in resp.data or []:
                if isinstance(row, dict):
                    rows.append(row)
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

    raw_rows = [row for row in (resp.data or []) if isinstance(row, dict)]
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
        int(row.get("id")): row
        for row in _fetch_rows_by_ids("jobs", "id,title,location,country_code,description", job_ids)
        if _safe_int(row.get("id")) is not None
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
            int(row.get("id")): row
            for row in _fetch_rows_by_ids("jobs", "id,title,location,country_code,description", job_ids)
            if _safe_int(row.get("id")) is not None
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
    default_primary = get_default_primary_model()
    default_fallback = get_default_fallback_model()
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
    try:
        update_job_fields(job_id, {"status": update.status})
    except Exception:
        pass
    return {"status": "success"}

@router.delete("/{job_id}")
async def delete_job(job_id: str, request: Request, user: dict = Depends(get_current_user)):
    print(f"🗑️ [REQUEST] Delete job {job_id}")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    _require_job_access(user, job_id)
    supabase.table("jobs").delete().eq("id", job_id).execute()
    try:
        delete_job_by_id(job_id)
    except Exception:
        pass
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

            resp = base_resp
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
            .select("*,jobs(id,title),profiles(id,full_name,email,avatar_url)")
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
        jobs_by_id: dict[int, dict[str, Any]] = {}
        companies_by_id: dict[str, dict[str, Any]] = {}

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
        "company_goal": company_goal,
        "contract_type": None if is_micro_job else draft.get("contract_type"),
        "work_type": draft.get("work_model"),
        "source": "jobshaman.cz",
        "source_kind": "native",
        "scraped_at": now_iso(),
    }

    existing_job_id = _normalize_job_id(draft.get("job_id"))
    if not existing_job_id:
        _enforce_company_role_open_limit(company_id, user)
    _enforce_company_job_publish_limit(company_id, user, existing_job_id=existing_job_id)
    job_id = existing_job_id
    if job_id:
        _require_job_access(user, str(job_id))
        try:
            job_resp = supabase.table("jobs").update(job_payload).eq("id", job_id).execute()
        except Exception as exc:
            if _is_missing_column_error(exc, "company_goal"):
                fallback_payload = dict(job_payload)
                fallback_payload.pop("company_goal", None)
                job_resp = supabase.table("jobs").update(fallback_payload).eq("id", job_id).execute()
            else:
                raise
        job_row = (job_resp.data or [None])[0] or {"id": job_id}
    else:
        try:
            job_resp = supabase.table("jobs").insert(job_payload).execute()
        except Exception as exc:
            if _is_missing_column_error(exc, "company_goal"):
                fallback_payload = dict(job_payload)
                fallback_payload.pop("company_goal", None)
                job_resp = supabase.table("jobs").insert(fallback_payload).execute()
            else:
                raise
        job_row = (job_resp.data or [None])[0]
        if not job_row:
            raise HTTPException(status_code=500, detail="Failed to publish draft")
        job_id = _normalize_job_id(job_row.get("id"))

    if isinstance(job_row, dict):
        sync_row = dict(job_row)
        sync_row.update(job_payload)
        sync_row["id"] = job_id
        sync_row["company_id"] = company_id
        _sync_main_job_to_jobs_postgres(sync_row, source_kind="native")

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


@router.get("/jobs/{job_id}/human-context")
@limiter.limit("120/minute")
async def get_job_human_context(
    job_id: str,
    request: Request,
):
    normalized_job_id = _normalize_job_id(job_id)
    job_row = _read_job_record(normalized_job_id)
    if not job_row:
        raise HTTPException(status_code=404, detail="Job not found")

    company_id = str(job_row.get("company_id") or "").strip()
    source = str(job_row.get("source") or "").strip().lower()
    if not company_id or source != _NATIVE_JOB_SOURCE:
        return _empty_job_human_context_payload()

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
        "trust": _compute_company_human_context_trust(company_id),
    }


@router.get("/jobs/{job_id}/related")
@limiter.limit("120/minute")
async def get_related_job_challenges(
    job_id: str,
    request: Request,
    limit: int = Query(4, ge=1, le=8),
):
    normalized_job_id = _normalize_job_id(job_id)
    source_job = _read_job_record(normalized_job_id)
    if not source_job:
        raise HTTPException(status_code=404, detail="Job not found")

    recent_jobs = fetch_recent_jobs(limit=300, days=120)
    source_job_id = str(source_job.get("id") or normalized_job_id)
    candidate_rows: list[dict[str, Any]] = []
    seen_ids: set[str] = {source_job_id}

    for row in recent_jobs:
        candidate_id = str((row or {}).get("id") or "").strip()
        if not candidate_id or candidate_id in seen_ids:
            continue
        seen_ids.add(candidate_id)
        candidate_rows.append(row)

    if not candidate_rows:
        return {"items": []}

    embeddings = ensure_job_embeddings([source_job, *candidate_rows], persist=False)
    source_embedding = embeddings.get(source_job_id) or []
    if not source_embedding:
        return {"items": []}

    source_work_model = str(source_job.get("work_model") or source_job.get("type") or "").strip().lower()
    source_location = str(source_job.get("location") or "").strip().lower()
    source_company_id = str(source_job.get("company_id") or "").strip()

    scored_items: list[dict[str, Any]] = []
    for row in candidate_rows:
        candidate_id = str((row or {}).get("id") or "").strip()
        candidate_embedding = embeddings.get(candidate_id) or []
        if not candidate_embedding:
            continue

        similarity_score = float(score_from_embeddings(source_embedding, candidate_embedding))
        work_model = str((row or {}).get("work_model") or (row or {}).get("type") or "").strip().lower()
        location = str((row or {}).get("location") or "").strip().lower()
        company_id = str((row or {}).get("company_id") or "").strip()

        if source_work_model and work_model and source_work_model == work_model:
            similarity_score += 0.06
        if source_location and location and source_location == location:
            similarity_score += 0.04
        if source_company_id and company_id and source_company_id == company_id:
            similarity_score += 0.03

        preview = _first_non_empty_text(
            (row or {}).get("role_summary"),
            (row or {}).get("description"),
            limit=220,
        )
        if not preview:
            preview = _first_non_empty_text((row or {}).get("title"), limit=220)

        scored_items.append(
            {
                "id": candidate_id,
                "title": _first_non_empty_text((row or {}).get("title"), limit=160) or "Untitled role",
                "company": _first_non_empty_text((row or {}).get("company"), limit=160) or "Unknown company",
                "location": _first_non_empty_text((row or {}).get("location"), limit=120),
                "work_model": _trimmed_text((row or {}).get("work_model"), 80) or None,
                "source": _trimmed_text((row or {}).get("source"), 80) or None,
                "preview": preview,
                "similarity_score": round(similarity_score, 4),
            }
        )

    scored_items.sort(key=lambda item: item.get("similarity_score") or 0.0, reverse=True)
    return {"items": scored_items[:limit]}


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
    try:
        update_job_fields(_normalize_job_id(job_id), {"status": payload.status})
    except Exception:
        pass

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
    language = (request.headers.get("accept-language") or "cs").split(",")[0].strip() or "cs"
    rewritten = enrich_search_query(payload.search_term or "", language=language, subject_id=user_id)
    dismissed_job_ids: set[str] = set()
    if user_id:
        _, dismissed = _fetch_user_interaction_state(user_id, limit=12000)
        dismissed_job_ids = set(dismissed)

    result = hybrid_search_jobs(
        {
            "search_term": rewritten.get("backend_query") or payload.search_term,
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
    meta = dict(result.get("meta") or {})
    meta["ai_query_rewrite"] = rewritten
    result["meta"] = meta
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
    language = (request.headers.get("accept-language") or "cs").split(",")[0].strip() or "cs"
    rewritten = enrich_search_query(payload.search_term or "", language=language, subject_id=user_id)
    request_id = str(uuid4())
    cache_key = ""
    cache_sig = ""
    try:
        cache_payload = {
            "user_id": user_id or "public",
            "page": payload.page,
            "page_size": payload.page_size,
            "sort_mode": payload.sort_mode,
            "search_term": (rewritten.get("backend_query") or payload.search_term or "").strip(),
            "user_lat": payload.user_lat,
            "user_lng": payload.user_lng,
            "radius_km": payload.radius_km,
            "filter_city": payload.filter_city,
            "filter_contract_types": payload.filter_contract_types or None,
            "filter_benefits": payload.filter_benefits or None,
            "filter_min_salary": payload.filter_min_salary,
            "filter_date_posted": payload.filter_date_posted,
            "filter_experience_levels": payload.filter_experience_levels or None,
            "filter_country_codes": payload.filter_country_codes or None,
            "exclude_country_codes": payload.exclude_country_codes or None,
            "filter_language_codes": payload.filter_language_codes or None,
        }
        cache_key = json.dumps(cache_payload, sort_keys=True, default=str)
        cache_sig = hashlib.sha256(cache_key.encode("utf-8")).hexdigest()[:10]
    except Exception:
        cache_key = ""
        cache_sig = ""

    try:
        client_host = request.client.host if request.client else None
    except Exception:
        client_host = None
    forwarded_for = request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip") or ""
    user_agent = request.headers.get("user-agent") or ""
    origin = request.headers.get("origin") or ""
    referer = request.headers.get("referer") or ""
    # Keep this log compact; it is crucial for diagnosing unexpected background callers.
    instance = os.getenv("HOSTNAME") or "-"
    try:
        pid = os.getpid()
    except Exception:
        pid = -1
    print(
        "📥 [Hybrid Search V2] http_request "
        f"request_id={request_id} sig={cache_sig or '-'} user_id={user_id or 'public'} "
        f"instance={instance} pid={pid} "
        f"client={client_host or '-'} forwarded_for={forwarded_for or '-'} "
        f"ua={(user_agent[:140] + '…') if len(user_agent) > 140 else user_agent or '-'} "
        f"origin={origin or '-'} referer={referer or '-'} "
        f"page={payload.page} page_size={payload.page_size}"
    )

    if cache_key:
        now = time.monotonic()
        with _HYBRID_SEARCH_V2_HTTP_CACHE_LOCK:
            cached = _HYBRID_SEARCH_V2_HTTP_CACHE.get(cache_key)
            if cached:
                cached_at, cached_response = cached
                age_seconds = max(0.0, now - cached_at)
                cached_jobs = cached_response.get("jobs") or []
                ttl = _HYBRID_SEARCH_V2_HTTP_CACHE_EMPTY_TTL_SECONDS if len(cached_jobs) == 0 else _HYBRID_SEARCH_V2_HTTP_CACHE_TTL_SECONDS
                if age_seconds <= ttl:
                    print(f"🧊 [Hybrid Search V2] cache_hit sig={cache_sig or '-'} age_ms={int(age_seconds * 1000)} ttl_s={ttl} jobs={len(cached_jobs)}")
                    response_copy = dict(cached_response)
                    meta = dict((response_copy.get("meta") or {}))
                    meta["cache_hit"] = True
                    meta["cache_age_ms"] = int(age_seconds * 1000)
                    meta.setdefault("provider_status", {})
                    meta.setdefault("fallback_mode", "internal_only")
                    meta.setdefault("degraded_reasons", [])
                    response_copy["meta"] = meta
                    return response_copy
                _HYBRID_SEARCH_V2_HTTP_CACHE.pop(cache_key, None)

    dismissed_job_ids: set[str] = set()
    if user_id:
        _, dismissed = _fetch_user_interaction_state(user_id, limit=12000)
        dismissed_job_ids = set(dismissed)

    result = hybrid_search_jobs_v2(
        {
            "search_term": rewritten.get("backend_query") or payload.search_term,
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
    meta = dict(result.get("meta") or {})
    meta["ai_query_rewrite"] = rewritten
    result["meta"] = meta
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
            "provider_status": meta.get("provider_status") or {},
            "fallback_mode": meta.get("fallback_mode") or "internal_only",
            "cache_hit": bool(meta.get("cache_hit")),
            "degraded_reasons": meta.get("degraded_reasons") or [],
            "ai_query_rewrite": meta.get("ai_query_rewrite") or {},
        },
    }
    if payload.debug:
        response["meta"]["debug"] = {
            "user_id_present": bool(user_id),
            "engine_meta": meta,
        }
    if cache_key:
        with _HYBRID_SEARCH_V2_HTTP_CACHE_LOCK:
            _HYBRID_SEARCH_V2_HTTP_CACHE[cache_key] = (time.monotonic(), response)
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


@router.get("/jobs/external/arbeitnow/search")
@limiter.limit("30/minute")
async def search_arbeitnow_live(
    request: Request,
    search_term: str = Query(default="", max_length=200),
    filter_city: str = Query(default="", max_length=120),
    limit: int = Query(default=12, ge=1, le=40),
    page: int = Query(default=1, ge=1, le=20),
    country_codes: str | None = Query(default=None),
    exclude_country_codes: str | None = Query(default=None),
):
    def _parse_csv(value: str | None) -> list[str]:
        if not value:
            return []
        return [part.strip().upper() for part in value.split(",") if part and part.strip()]

    try:
        jobs = search_arbeitnow_jobs_live(
            limit=limit,
            page=page,
            search_term=search_term,
            filter_city=filter_city,
            country_codes=_parse_csv(country_codes),
            exclude_country_codes=_parse_csv(exclude_country_codes),
        )
    except Exception as exc:
        print(f"⚠️ Arbeitnow live search failed: {exc}")
        jobs = []
    _attach_job_dialogue_preview_metrics(jobs)
    return {
        "jobs": jobs,
        "has_more": len(jobs) >= limit,
        "total_count": len(jobs),
        "source": "arbeitnow_live_api",
    }


@router.get("/jobs/external/cached-feed")
@limiter.limit("60/minute")
async def get_cached_external_feed(
    request: Request,
    search_term: str = Query(default="", max_length=200),
    filter_city: str = Query(default="", max_length=120),
    page: int = Query(default=0, ge=0, le=20),
    page_size: int = Query(default=24, ge=1, le=80),
    country_codes: str | None = Query(default=None),
    exclude_country_codes: str | None = Query(default=None),
):
    parsed_country_codes = _parse_country_code_csv(country_codes)
    parsed_exclude_codes = _parse_country_code_csv(exclude_country_codes)
    degraded_reasons: list[str] = []
    fallback_mode = "empty"
    cache_hit = False
    start = max(0, page) * max(1, page_size)
    end = start + max(1, page_size)

    supabase_result = _read_cached_external_jobs(
        page=page,
        page_size=page_size,
        search_term=search_term,
        filter_city=filter_city,
        country_codes=parsed_country_codes,
        exclude_country_codes=parsed_exclude_codes,
    )
    try:
        jobspy_result = search_jobspy_jobs(
            page=0,
            page_size=max(80, max(1, page_size) * 4),
            search_term=search_term,
            location=filter_city,
            country_codes=parsed_country_codes,
            exclude_country_codes=parsed_exclude_codes,
        )
    except Exception as exc:
        print(f"⚠️ Failed to read JobSpy Mongo cache: {exc}")
        degraded_reasons.append(f"jobspy_unavailable:{type(exc).__name__}")
        jobspy_result = {"jobs": [], "total_count": 0, "has_more": False}
    merged_cached_jobs = _merge_external_job_lists(
        supabase_result.get("jobs") or [],
        jobspy_result.get("jobs") or [],
    )
    total_count = max(
        len(merged_cached_jobs),
        int(supabase_result.get("total_count") or 0),
        int(jobspy_result.get("total_count") or 0),
    )
    jobs = merged_cached_jobs[start:end]
    result = {
        "jobs": jobs,
        "has_more": end < total_count,
        "total_count": total_count,
    }
    if jobs:
        cache_hit = True
        fallback_mode = "cache_only" if not (jobspy_result.get("jobs") or []) else "cache_plus_jobspy"

    # Self-seed: cached feed is only useful if something has populated the cache table.
    # When it's empty (fresh deployments, cleared DB), fetch a small snapshot from
    # sources that don't require keywords (WWR RSS) and write via the live cache path.
    if not jobs:
        seeded: list[dict[str, Any]] = []
        seed_limit = max(12, min(40, int(page_size or 24)))

        if _provider_circuit_open("arbeitnow"):
            degraded_reasons.append("provider_circuit_open:arbeitnow")
        else:
            try:
                arbeitnow_jobs = search_arbeitnow_jobs_live(
                    limit=seed_limit,
                    page=1,
                    search_term=search_term,
                    filter_city=filter_city,
                    country_codes=parsed_country_codes,
                    exclude_country_codes=parsed_exclude_codes,
                )
                if isinstance(arbeitnow_jobs, list):
                    seeded.extend([item for item in arbeitnow_jobs if isinstance(item, dict)])
                _write_external_cache_snapshot(
                    provider="arbeitnow",
                    jobs=arbeitnow_jobs or [],
                    search_term=search_term,
                    filter_city=filter_city,
                    country_codes=parsed_country_codes,
                    exclude_country_codes=parsed_exclude_codes,
                    page=1,
                )
                _mark_provider_success("arbeitnow")
            except Exception as exc:
                _mark_provider_failure("arbeitnow", exc)
                degraded_reasons.append(f"provider_error:arbeitnow:{type(exc).__name__}")
                print(f"⚠️ External cached feed seeding failed for arbeitnow: {exc}")

        if _provider_circuit_open("weworkremotely"):
            degraded_reasons.append("provider_circuit_open:weworkremotely")
        else:
            try:
                wwr_jobs = search_weworkremotely_jobs_live(
                    limit=seed_limit,
                    search_term=search_term,
                    filter_city=filter_city,
                    country_codes=parsed_country_codes,
                    exclude_country_codes=parsed_exclude_codes,
                )
                if isinstance(wwr_jobs, list):
                    seeded.extend([item for item in wwr_jobs if isinstance(item, dict)])
                _write_external_cache_snapshot(
                    provider="weworkremotely",
                    jobs=wwr_jobs or [],
                    search_term=search_term,
                    filter_city=filter_city,
                    country_codes=parsed_country_codes,
                    exclude_country_codes=parsed_exclude_codes,
                    page=1,
                )
                _mark_provider_success("weworkremotely")
            except Exception as exc:
                _mark_provider_failure("weworkremotely", exc)
                degraded_reasons.append(f"provider_error:weworkremotely:{type(exc).__name__}")
                print(f"⚠️ External cached feed seeding failed for weworkremotely: {exc}")

        if str(search_term or "").strip():
            if not str(os.getenv("JOOBLE_API_KEY") or "").strip():
                degraded_reasons.append("provider_not_configured:jooble")
            elif _provider_circuit_open("jooble"):
                degraded_reasons.append("provider_circuit_open:jooble")
            else:
                try:
                    jooble_jobs = search_jooble_jobs_live(
                        limit=seed_limit,
                        page=1,
                        search_term=search_term,
                        filter_city=filter_city,
                        country_codes=parsed_country_codes,
                        exclude_country_codes=parsed_exclude_codes,
                    )
                    if isinstance(jooble_jobs, list):
                        seeded.extend([item for item in jooble_jobs if isinstance(item, dict)])
                    _write_external_cache_snapshot(
                        provider="jooble",
                        jobs=jooble_jobs or [],
                        search_term=search_term,
                        filter_city=filter_city,
                        country_codes=parsed_country_codes,
                        exclude_country_codes=parsed_exclude_codes,
                        page=1,
                    )
                    _mark_provider_success("jooble")
                except Exception as exc:
                    _mark_provider_failure("jooble", exc)
                    degraded_reasons.append(f"provider_error:jooble:{type(exc).__name__}")
                    print(f"⚠️ External cached feed seeding failed for jooble: {exc}")

        supabase_result = _read_cached_external_jobs(
            page=page,
            page_size=page_size,
            search_term=search_term,
            filter_city=filter_city,
            country_codes=parsed_country_codes,
            exclude_country_codes=parsed_exclude_codes,
        )
        merged_cached_jobs = _merge_external_job_lists(
            supabase_result.get("jobs") or [],
            jobspy_result.get("jobs") or [],
            seeded,
        )
        total_count = max(
            len(merged_cached_jobs),
            int(supabase_result.get("total_count") or 0),
            int(jobspy_result.get("total_count") or 0),
        )
        jobs = merged_cached_jobs[start:end]
        result = {"jobs": jobs, "has_more": end < total_count, "total_count": total_count}
        if jobs:
            cache_hit = True
            if seeded:
                fallback_mode = "cache_seeded"
            elif jobspy_result.get("jobs"):
                fallback_mode = "jobspy_only"
            else:
                fallback_mode = "cache_only"

        # If DB cache is still empty/unavailable, return the live snapshot directly
        # so users can see external results even during cache failures.
        if not jobs and seeded:
            deduped = _merge_external_job_lists(jobspy_result.get("jobs") or [], seeded)
            total_count = len(deduped)
            jobs = deduped[start:end]
            result = {"jobs": jobs, "has_more": end < total_count, "total_count": total_count}
            fallback_mode = "live_seeded"
            cache_hit = bool(jobspy_result.get("jobs"))
        elif not jobs and degraded_reasons:
            fallback_mode = "degraded"

    _attach_job_dialogue_preview_metrics(jobs)
    return {
        "jobs": jobs,
        "has_more": bool(result.get("has_more")),
        "total_count": int(result.get("total_count") or 0),
        "source": "external_live_search_cache",
        "meta": {
            "provider_status": _provider_health_snapshot(),
            "fallback_mode": fallback_mode,
            "cache_hit": cache_hit,
            "degraded_reasons": degraded_reasons,
            "jobspy_total_count": int(jobspy_result.get("total_count") or 0),
        },
    }


@router.post("/jobs/external/jobspy/run")
@limiter.limit("5/minute")
async def run_jobspy_external_import(
    request: Request,
    search_term: str = Query(..., min_length=1, max_length=200),
    location: str = Query(default="", max_length=120),
    google_search_term: str = Query(default="", max_length=240),
    site_name: str | None = Query(default=None),
    results_wanted: int = Query(default=20, ge=1, le=100),
    hours_old: int | None = Query(default=None, ge=1, le=720),
    country_indeed: str = Query(default="Austria", max_length=80),
    job_type: str = Query(default="", max_length=40),
    is_remote: bool = Query(default=False),
    linkedin_fetch_description: bool = Query(default=False),
    offset: int = Query(default=0, ge=0, le=1000),
):
    if not SCRAPER_TOKEN or request.headers.get("X-Admin-Token") != SCRAPER_TOKEN:
        raise HTTPException(status_code=403, detail="Unauthorized")

    parsed_sites = [part.strip() for part in (site_name or "").split(",") if part and part.strip()]
    result = import_jobspy_jobs(
        site_name=parsed_sites or None,
        search_term=search_term,
        google_search_term=google_search_term,
        location=location,
        results_wanted=results_wanted,
        hours_old=hours_old,
        country_indeed=country_indeed,
        job_type=job_type,
        is_remote=is_remote,
        linkedin_fetch_description=linkedin_fetch_description,
        offset=offset,
    )
    return {
        "status": "success",
        "provider": "jobspy",
        "collection": result.collection,
        "imported_count": result.imported_count,
        "upserted_count": result.upserted_count,
        "matched_count": result.matched_count,
        "query_hash": result.query_hash,
        "jobs": result.sampled_jobs,
    }


@router.get("/jobs/external/jobspy/search")
@limiter.limit("60/minute")
async def get_jobspy_external_jobs(
    request: Request,
    search_term: str = Query(default="", max_length=200),
    location: str = Query(default="", max_length=120),
    source_sites: str | None = Query(default=None),
    page: int = Query(default=0, ge=0, le=50),
    page_size: int = Query(default=24, ge=1, le=100),
):
    parsed_sites = [part.strip() for part in (source_sites or "").split(",") if part and part.strip()]
    try:
        result = search_jobspy_jobs(
            page=page,
            page_size=page_size,
            search_term=search_term,
            location=location,
            source_sites=parsed_sites,
        )
        jobs = result.get("jobs") or []
        _attach_job_dialogue_preview_metrics(jobs)
        return {
            "jobs": jobs,
            "has_more": bool(result.get("has_more")),
            "total_count": int(result.get("total_count") or 0),
            "source": "jobspy_cache",
            "meta": {
                "collection": result.get("collection"),
                "provider": "jobspy",
                "storage": result.get("storage") or ("jobs_postgres" if jobs_postgres_enabled() else ("mongo" if jobspy_mongo_enabled() else "disabled")),
            },
        }
    except Exception as exc:
        print(f"⚠️ JobSpy external search unavailable: {exc}")
        return {
            "jobs": [],
            "has_more": False,
            "total_count": 0,
            "source": "jobspy_cache",
            "meta": {
                "collection": config.JOBS_POSTGRES_JOBSPY_TABLE if jobs_postgres_enabled() else config.MONGODB_JOBSPY_COLLECTION,
                "provider": "jobspy",
                "degraded": True,
                "error": exc.__class__.__name__,
                "mongodb_configured": bool(config.MONGODB_URI),
                "mongodb_enabled": jobspy_mongo_enabled(),
                "storage": "jobs_postgres" if jobs_postgres_enabled() else ("mongo" if jobspy_mongo_enabled() else "disabled"),
            },
        }


@router.post("/jobs/external/jobspy/career-ops/refresh")
@limiter.limit("5/minute")
async def refresh_jobspy_career_ops(
    request: Request,
    limit: int = Query(default=600, ge=1, le=2000),
):
    if not SCRAPER_TOKEN or request.headers.get("X-Admin-Token") != SCRAPER_TOKEN:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return refresh_jobspy_career_ops_snapshots(limit=limit)


@router.get("/jobs/external/jobspy/health")
@limiter.limit("20/minute")
async def get_jobspy_health(
    request: Request,
):
    if not SCRAPER_TOKEN or request.headers.get("X-Admin-Token") != SCRAPER_TOKEN:
        raise HTTPException(status_code=403, detail="Unauthorized")
    health = get_jobspy_storage_health()
    status = 200 if health.get("ok") else 503
    return JSONResponse(status_code=status, content=health)


@router.post("/jobs/external/jobspy/postgres/init")
@limiter.limit("10/minute")
async def init_jobspy_postgres_schema(
    request: Request,
):
    if not SCRAPER_TOKEN or request.headers.get("X-Admin-Token") != SCRAPER_TOKEN:
        raise HTTPException(status_code=403, detail="Unauthorized")

    try:
        schema = ensure_jobs_postgres_schema()
        health = get_jobs_postgres_health()
        return {
            "status": "success",
            "provider": "jobs_postgres",
            "schema": schema,
            "health": health,
        }
    except Exception as exc:
        message = str(exc)
        hint = None
        if "failed to resolve host" in message.lower():
            hint = (
                "Configured Jobs Postgres hostname is not resolvable from this runtime. "
                "Verify that the backend service can reach the Northflank Postgres addon host."
            )
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "provider": "jobs_postgres",
                "error": exc.__class__.__name__,
                "message": message,
                "hint": hint,
            },
        )


@router.post("/jobs/external/jobspy/postgres/backfill")
@limiter.limit("5/minute")
async def backfill_jobspy_postgres(
    request: Request,
    limit: int = Query(default=2000, ge=1, le=20000),
    include_stale: bool = Query(default=False),
):
    if not SCRAPER_TOKEN or request.headers.get("X-Admin-Token") != SCRAPER_TOKEN:
        raise HTTPException(status_code=403, detail="Unauthorized")

    try:
        result = backfill_jobspy_postgres_from_mongo(
            limit=limit,
            only_fresh=not include_stale,
        )
        return {
            "status": "success",
            "provider": "jobspy",
            **result,
        }
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "provider": "jobspy",
                "error": exc.__class__.__name__,
                "message": str(exc),
            },
        )


@router.post("/jobs/postgres/backfill")
@limiter.limit("3/minute")
async def backfill_jobs_postgres(
    request: Request,
    limit: int = Query(default=5000, ge=1, le=50000),
    batch_size: int = Query(default=500, ge=1, le=2000),
    include_inactive: bool = Query(default=False),
):
    if not SCRAPER_TOKEN or request.headers.get("X-Admin-Token") != SCRAPER_TOKEN:
        raise HTTPException(status_code=403, detail="Unauthorized")

    try:
        result = backfill_jobs_postgres_from_supabase(
            limit=limit,
            batch_size=batch_size,
            only_active=not include_inactive,
        )
        return {
            "status": "success",
            "provider": "jobs_postgres",
            **result,
        }
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "provider": "jobs_postgres",
                "error": exc.__class__.__name__,
                "message": str(exc),
            },
        )


@router.get("/jobs/external/jobspy/career-ops")
@limiter.limit("30/minute")
async def get_jobspy_career_ops_feed(
    request: Request,
    refresh: bool = Query(default=False),
    job_limit: int = Query(default=24, ge=1, le=60),
    company_limit: int = Query(default=10, ge=1, le=30),
    action_limit: int = Query(default=14, ge=1, le=50),
    user: dict = Depends(get_current_user),
):
    user_id = str(user.get("id") or user.get("auth_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    candidate_profile = _fetch_candidate_profile_for_draft(user_id)
    if not candidate_profile:
        raise HTTPException(status_code=404, detail="Candidate profile not found")

    saved_job_ids, dismissed_job_ids = _fetch_user_interaction_state(user_id, limit=12000)
    try:
        feed = build_career_ops_feed(
            candidate_profile={**candidate_profile, "id": user_id},
            saved_job_ids=saved_job_ids,
            dismissed_job_ids=dismissed_job_ids,
            refresh=refresh,
            job_limit=job_limit,
            company_limit=company_limit,
            action_limit=action_limit,
        )
        return {
            **feed,
            "source": "jobspy_career_ops",
        }
    except Exception as exc:
        print(f"⚠️ JobSpy career-ops unavailable: {exc}")
        return {
            "source": "jobspy_career_ops",
            "jobs": [],
            "companies": [],
            "actions": [],
            "meta": {
                "fallback_mode": "degraded_empty",
                "counts": {
                    "raw_jobs_seen": 0,
                    "enriched_jobs_scored": 0,
                    "companies_ranked": 0,
                    "actions": 0,
                },
                "error": exc.__class__.__name__,
                "mongodb_configured": bool(config.MONGODB_URI),
                "mongodb_enabled": jobspy_mongo_enabled(),
            },
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

    default_primary = get_default_primary_model()
    default_fallback = get_default_fallback_model()
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
            if not update_job_fields(normalized_job_id, {"ai_analysis": analysis}) and supabase:
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
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    if not _user_has_allowed_subscription(user, {"premium"}):
        raise HTTPException(status_code=403, detail="Premium subscription required")

    normalized_job_id = _normalize_job_id(job_id)
    if normalized_job_id is None:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    job = _read_job_record(normalized_job_id)
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
    job = _read_job_record(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

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
