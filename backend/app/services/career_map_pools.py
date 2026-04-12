from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from threading import Lock
from typing import Any, Optional

from ..core import config
from .job_intelligence import _ensure_job_intelligence_schema_for_read
from .jobs_postgres_store import (
    _connect,
    _ensure_schema_for_read,
    _jobs_main_cutoff_sql,
    _json_load,
    count_active_main_jobs,
    jobs_postgres_main_enabled,
)

_DEFAULT_MARKETS = ("CZ", "SK", "PL", "DE", "AT")
_POOL_LIMIT_PER_MARKET = 2400
_POOL_LIMIT_GLOBAL = 4800
_POOL_STALE_AFTER = timedelta(hours=9)

_cache_lock = Lock()
_career_map_pool_cache: dict[str, dict[str, Any]] = {}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_country_code(value: Optional[str]) -> str:
    normalized = str(value or "").strip().upper()
    return normalized[:5]


def _safe_float(value: Any) -> Optional[float]:
    try:
        parsed = float(value)
    except Exception:
        return None
    if parsed != parsed:
        return None
    return parsed


def _normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def _infer_work_arrangement(job: dict[str, Any]) -> str:
    work_model = _normalize_text(job.get("work_model"))
    work_type = _normalize_text(job.get("work_type"))
    text = " ".join(
        [
            _normalize_text(job.get("title")),
            _normalize_text(job.get("location")),
            _normalize_text(job.get("description")),
        ]
    )

    if "hybrid" in work_model or "hybrid" in work_type or "hybrid" in text:
        return "hybrid"
    if (
        "remote" in work_model
        or "remote" in work_type
        or "home office" in text
        or "work from home" in text
        or "prace z domova" in text
    ):
        return "remote"
    return "onsite"


def _matches_work_arrangement(job: dict[str, Any], work_arrangement: str, remote_only: bool) -> bool:
    arrangement = _infer_work_arrangement(job)
    normalized = str(work_arrangement or "all").strip().lower()

    if remote_only:
        return arrangement == "remote"

    if normalized == "remote":
        return arrangement == "remote"
    if normalized == "hybrid":
        return arrangement == "hybrid"
    if normalized == "onsite":
        return arrangement == "onsite"

    # Default map scope should stay domestic and tangible, not silently drift into remote-only jobs.
    return arrangement != "remote"


def _matches_contract_types(job: dict[str, Any], contract_types: list[str]) -> bool:
    normalized_types = [str(item or "").strip().lower() for item in contract_types if str(item or "").strip()]
    if not normalized_types:
        return True

    haystack = " ".join(
        [
            _normalize_text(job.get("contract_type")),
            _normalize_text(job.get("title")),
            _normalize_text(job.get("description")),
        ]
    )

    def _is_employee() -> bool:
        return any(token in haystack for token in ("hpp", "full-time", "full time", "zamestnani", "employment"))

    def _is_contractor() -> bool:
        return any(token in haystack for token in ("ico", "contractor", "freelance", "contract", "b2b"))

    allowed = False
    if "employee" in normalized_types and _is_employee():
        allowed = True
    if "contractor" in normalized_types and _is_contractor():
        allowed = True
    return allowed


def _has_required_benefits(job: dict[str, Any], benefits: list[str]) -> bool:
    normalized = [str(item or "").strip().lower() for item in benefits if str(item or "").strip()]
    if not normalized:
        return True

    job_benefits = [str(item or "").strip().lower() for item in (job.get("benefits") or []) if str(item or "").strip()]
    text = " ".join(job_benefits)
    return all(benefit in text for benefit in normalized)


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_km = 6371.0
    delta_lat = radians(lat2 - lat1)
    delta_lng = radians(lng2 - lng1)
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    value = sin(delta_lat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lng / 2) ** 2
    return 2 * earth_radius_km * asin(sqrt(value))


def _matches_commute(job: dict[str, Any], user_lat: Optional[float], user_lng: Optional[float], radius_km: Optional[float]) -> bool:
    if user_lat is None or user_lng is None or radius_km is None or radius_km <= 0:
        return True

    lat = _safe_float(job.get("lat"))
    lng = _safe_float(job.get("lng"))
    if lat is None or lng is None:
        return False

    return _distance_km(user_lat, user_lng, lat, lng) <= radius_km


def _serialize_pool_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    serialized: list[dict[str, Any]] = []
    for row in rows:
        payload = _json_load((row or {}).get("payload_json"), {})
        if not isinstance(payload, dict) or not payload:
            continue

        copy = dict(payload)
        intelligence = {
            "canonical_role": row.get("canonical_role"),
            "role_family": row.get("role_family"),
            "domain_key": row.get("domain_key"),
            "market_code": row.get("market_code"),
            "mapping_confidence": row.get("mapping_confidence"),
        }
        if any(value not in (None, "", []) for value in intelligence.values()):
            copy["job_intelligence"] = intelligence
        serialized.append(copy)
    return serialized


def _read_pool_rows(country_code: Optional[str], *, limit: int) -> list[dict[str, Any]]:
    if not jobs_postgres_main_enabled():
        return []

    _ensure_schema_for_read()
    _ensure_job_intelligence_schema_for_read()
    conn = _connect()
    cutoff_sql, cutoff_params = _jobs_main_cutoff_sql()
    params: list[Any] = [*cutoff_params]
    country_filter_sql = ""
    normalized_country = _normalize_country_code(country_code)
    if normalized_country:
        country_filter_sql = "AND UPPER(COALESCE(j.country_code, '')) = %s"
        params.append(normalized_country)

    params.append(max(1, int(limit or _POOL_LIMIT_PER_MARKET)))
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                j.payload_json,
                ji.canonical_role,
                ji.role_family,
                ji.domain_key,
                ji.market_code,
                ji.mapping_confidence
            FROM {config.JOBS_POSTGRES_JOBS_TABLE} j
            LEFT JOIN {config.JOBS_POSTGRES_JOB_INTELLIGENCE_TABLE} ji
              ON ji.job_id = j.id
            WHERE COALESCE(j.legality_status, 'legal') = 'legal'
              AND COALESCE(j.status, 'active') = 'active'
              AND COALESCE(j.is_active, TRUE) = TRUE
              AND {cutoff_sql}
              {country_filter_sql}
            ORDER BY j.scraped_at DESC
            LIMIT %s
            """,
            params,
        )
        rows = cur.fetchall() or []
    return _serialize_pool_rows(rows)


def _cache_entry_stale(entry: Optional[dict[str, Any]]) -> bool:
    if not entry:
        return True
    generated_at = entry.get("generated_at")
    if not isinstance(generated_at, datetime):
        return True
    return (_utcnow() - generated_at) > _POOL_STALE_AFTER


def refresh_career_map_pools(*, country_codes: Optional[list[str]] = None) -> dict[str, Any]:
    if not jobs_postgres_main_enabled():
        return {"enabled": False, "markets": {}, "global": 0}

    target_markets = [_normalize_country_code(code) for code in (country_codes or list(_DEFAULT_MARKETS))]
    target_markets = [code for code in target_markets if code]
    generated_at = _utcnow()
    refreshed: dict[str, Any] = {}

    next_cache: dict[str, dict[str, Any]] = {}
    for country_code in target_markets:
        jobs = _read_pool_rows(country_code, limit=_POOL_LIMIT_PER_MARKET)
        next_cache[country_code] = {
            "generated_at": generated_at,
            "jobs": jobs,
            "scope": "domestic",
            "country_code": country_code,
        }
        refreshed[country_code] = len(jobs)

    global_jobs = _read_pool_rows(None, limit=_POOL_LIMIT_GLOBAL)
    next_cache["GLOBAL"] = {
        "generated_at": generated_at,
        "jobs": global_jobs,
        "scope": "all",
        "country_code": None,
    }

    with _cache_lock:
        _career_map_pool_cache.update(next_cache)

    return {
        "enabled": True,
        "generated_at": generated_at.isoformat(),
        "markets": refreshed,
        "global": len(global_jobs),
    }


def get_career_map_pool(
    *,
    country_code: Optional[str],
    scope: str = "domestic",
    limit: int = 1200,
    user_lat: Optional[float] = None,
    user_lng: Optional[float] = None,
    radius_km: Optional[float] = None,
    remote_only: bool = False,
    work_arrangement: str = "all",
    contract_types: Optional[list[str]] = None,
    min_salary: Optional[int] = None,
    benefits: Optional[list[str]] = None,
) -> dict[str, Any]:
    normalized_scope = "all" if str(scope or "").strip().lower() == "all" else "domestic"
    normalized_country = _normalize_country_code(country_code)
    cache_key = "GLOBAL" if normalized_scope == "all" or not normalized_country else normalized_country

    with _cache_lock:
        entry = _career_map_pool_cache.get(cache_key)

    if _cache_entry_stale(entry):
        refresh_career_map_pools(country_codes=None if cache_key == "GLOBAL" else [cache_key])
        with _cache_lock:
            entry = _career_map_pool_cache.get(cache_key)

    base_jobs = list((entry or {}).get("jobs") or [])
    filtered: list[dict[str, Any]] = []
    normalized_contract_types = [str(item or "").strip().lower() for item in (contract_types or []) if str(item or "").strip()]
    normalized_benefits = [str(item or "").strip().lower() for item in (benefits or []) if str(item or "").strip()]

    for job in base_jobs:
        if normalized_scope == "domestic" and normalized_country:
            if _normalize_country_code(job.get("country_code")) != normalized_country:
                continue
        if not _matches_work_arrangement(job, work_arrangement, remote_only):
            continue
        if not _matches_contract_types(job, normalized_contract_types):
            continue
        if min_salary and int(job.get("salary_from") or 0) < int(min_salary):
            continue
        if not _has_required_benefits(job, normalized_benefits):
            continue
        if radius_km and not remote_only and str(work_arrangement or "all").strip().lower() != "remote":
            if not _matches_commute(job, user_lat, user_lng, radius_km):
                continue
        filtered.append(job)
        if len(filtered) >= max(1, int(limit or 1200)):
            break

    generated_at = (entry or {}).get("generated_at")
    cache_age_seconds = None
    if isinstance(generated_at, datetime):
        cache_age_seconds = max(0, int((_utcnow() - generated_at).total_seconds()))

    return {
        "jobs": filtered,
        "meta": {
            "scope": normalized_scope,
            "country_code": normalized_country or None,
            "base_pool_count": len(base_jobs),
            "filtered_count": len(filtered),
            "generated_at": generated_at.isoformat() if isinstance(generated_at, datetime) else None,
            "cache_age_seconds": cache_age_seconds,
            "database_total_count": count_active_main_jobs() if jobs_postgres_main_enabled() else 0,
        },
    }
