import os
from importlib import import_module

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from ..core import config
from ..core.config import SCRAPER_TOKEN
from ..core.limiter import limiter
from ..core.security import get_current_user
from ..services.jobs_ai_runtime import _fetch_candidate_profile_for_draft
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
    _attach_job_dialogue_preview_metrics,
    _fetch_user_interaction_state,
)
from ..services.jobspy_career_ops import build_career_ops_feed, refresh_jobspy_career_ops_snapshots
from ..services.jobspy_jobs import (
    backfill_jobspy_postgres_from_mongo,
    get_jobspy_storage_health,
    import_jobspy_jobs,
    jobspy_mongo_enabled,
    search_jobspy_jobs,
)
from ..services.jobs_migration import backfill_jobs_postgres_from_supabase
from ..services.jobs_postgres_store import ensure_jobs_postgres_schema, get_jobs_postgres_health, jobs_postgres_enabled

router = APIRouter()


def _import_first(module_names: list[str]):
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
    return {"jobs": jobs, "has_more": len(jobs) >= limit, "total_count": len(jobs), "source": "weworkremotely_live_rss"}


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
    return {"jobs": jobs, "has_more": len(jobs) >= limit, "total_count": len(jobs), "source": "jooble_live_api"}


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
    return {"jobs": jobs, "has_more": len(jobs) >= limit, "total_count": len(jobs), "source": "arbeitnow_live_api"}


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
    result = {"jobs": jobs, "has_more": end < total_count, "total_count": total_count}
    if jobs:
        cache_hit = True
        fallback_mode = "cache_only" if not (jobspy_result.get("jobs") or []) else "cache_plus_jobspy"

    if not jobs:
        seeded: list[dict] = []
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
            fallback_mode = "cache_seeded" if seeded else ("jobspy_only" if jobspy_result.get("jobs") else "cache_only")

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
    return {"status": "success", "provider": "jobspy", "collection": result.collection, "imported_count": result.imported_count, "upserted_count": result.upserted_count, "matched_count": result.matched_count, "query_hash": result.query_hash, "jobs": result.sampled_jobs}


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
        result = search_jobspy_jobs(page=page, page_size=page_size, search_term=search_term, location=location, source_sites=parsed_sites)
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
async def get_jobspy_health(request: Request):
    if not SCRAPER_TOKEN or request.headers.get("X-Admin-Token") != SCRAPER_TOKEN:
        raise HTTPException(status_code=403, detail="Unauthorized")
    health = get_jobspy_storage_health()
    status = 200 if health.get("ok") else 503
    return JSONResponse(status_code=status, content=health)


@router.post("/jobs/external/jobspy/postgres/init")
@limiter.limit("10/minute")
async def init_jobspy_postgres_schema(request: Request):
    if not SCRAPER_TOKEN or request.headers.get("X-Admin-Token") != SCRAPER_TOKEN:
        raise HTTPException(status_code=403, detail="Unauthorized")
    try:
        schema = ensure_jobs_postgres_schema()
        health = get_jobs_postgres_health()
        return {"status": "success", "provider": "jobs_postgres", "schema": schema, "health": health}
    except Exception as exc:
        message = str(exc)
        hint = None
        if "failed to resolve host" in message.lower():
            hint = "Configured Jobs Postgres hostname is not resolvable from this runtime. Verify that the backend service can reach the Northflank Postgres addon host."
        return JSONResponse(status_code=503, content={"status": "error", "provider": "jobs_postgres", "error": exc.__class__.__name__, "message": message, "hint": hint})


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
        result = backfill_jobspy_postgres_from_mongo(limit=limit, only_fresh=not include_stale)
        return {"status": "success", "provider": "jobspy", **result}
    except Exception as exc:
        return JSONResponse(status_code=503, content={"status": "error", "provider": "jobspy", "error": exc.__class__.__name__, "message": str(exc)})


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
        result = backfill_jobs_postgres_from_supabase(limit=limit, batch_size=batch_size, only_active=not include_inactive)
        return {"status": "success", "provider": "jobs_postgres", **result}
    except Exception as exc:
        return JSONResponse(status_code=503, content={"status": "error", "provider": "jobs_postgres", "error": exc.__class__.__name__, "message": str(exc)})


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
        return {**feed, "source": "jobspy_career_ops"}
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
