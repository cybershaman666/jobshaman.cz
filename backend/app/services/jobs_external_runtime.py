import os
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any
from uuid import uuid4

from ..core.database import supabase
from ..services.jobs_postgres_store import (
    jobs_postgres_enabled,
    read_external_cache_jobs,
    upsert_external_cache_snapshot,
)
from .jobs_shared import (
    _is_missing_table_error,
    _safe_rows,
    _string_list_from_json,
)

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


def _parse_country_code_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip().upper() for part in value.split(",") if part and part.strip()]


def _normalize_external_job_text(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().split())


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
            rows = _safe_rows(response.data if response else None)
        except Exception as exc:
            if not _is_missing_table_error(exc, _EXTERNAL_LIVE_SEARCH_CACHE_TABLE):
                print(f"⚠️ Failed to read external live cache: {exc}")
            return {"jobs": [], "total_count": 0, "has_more": False}

    normalized_search = _normalize_external_job_text(search_term)
    normalized_city = _normalize_external_job_text(filter_city)
    allowed_countries = {code.strip().upper() for code in (country_codes or []) if code.strip()}
    blocked_countries = {code.strip().upper() for code in (exclude_country_codes or []) if code.strip()}
    search_tokens = [token for token in normalized_search.split(" ") if token]
    city_tokens = [token for token in normalized_city.split(" ") if token]

    seen: set[str] = set()
    deduped_jobs: list[dict[str, Any]] = []
    for row in rows:
        payload = row.get("payload_json")
        if not isinstance(payload, list):
            continue
        for item in payload:
            if not isinstance(item, dict) or not _is_external_job_fresh_enough(item):
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
                        " ".join(_string_list_from_json(item.get("tags"))),
                        " ".join(_string_list_from_json(item.get("benefits"))),
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
    return {
        "jobs": deduped_jobs[start:end],
        "total_count": total_count,
        "has_more": end < total_count,
    }


def _merge_external_job_lists(*job_lists: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    merged: list[dict[str, Any]] = []
    for job_list in job_lists:
        for item in job_list:
            if not isinstance(item, dict) or not _is_external_job_fresh_enough(item):
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
