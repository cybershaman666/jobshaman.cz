import hashlib
import json
import os
import time
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Request

from ..core.limiter import limiter
from ..matching_engine import hybrid_search_jobs, hybrid_search_jobs_v2
from ..models.requests import HybridJobSearchRequest, HybridJobSearchV2Request
from ..services.jobs_interactions_runtime import (
    _HYBRID_SEARCH_V2_HTTP_CACHE,
    _HYBRID_SEARCH_V2_HTTP_CACHE_EMPTY_TTL_SECONDS,
    _HYBRID_SEARCH_V2_HTTP_CACHE_LOCK,
    _HYBRID_SEARCH_V2_HTTP_CACHE_TTL_SECONDS,
    _attach_job_dialogue_preview_metrics,
    _fetch_user_interaction_state,
    _filter_out_dismissed_jobs,
    _try_get_optional_user_id,
    _write_search_exposures,
)
from ..services.search_intelligence import enrich_search_query

router = APIRouter()


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
            "filter_challenge_format": payload.filter_challenge_format,
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
            "filter_challenge_format": payload.filter_challenge_format,
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
            "filter_challenge_format": payload.filter_challenge_format,
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
