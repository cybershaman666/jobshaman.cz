import time
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request

from ..core.database import supabase
from ..core.limiter import limiter
from ..core.security import get_current_user, verify_csrf_token_header, verify_supabase_token
from ..matching_engine import hybrid_search_jobs, hybrid_search_jobs_v2
from ..models.search_requests import (
    HybridJobSearchRequest,
    HybridJobSearchV2Request,
    JobInteractionRequest,
)

router = APIRouter()

_SEARCH_EXPOSURES_AVAILABLE: bool = True
_SEARCH_EXPOSURES_WARNING_EMITTED: bool = False
_SEARCH_FEEDBACK_AVAILABLE: bool = True
_SEARCH_FEEDBACK_WARNING_EMITTED: bool = False
_INTERACTIONS_CSRF_WARNING_LAST_AT: float = 0.0
_INTERACTIONS_CSRF_WARNING_INTERVAL_S: float = 30.0


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


@router.post("/jobs/hybrid-search")
@limiter.limit("60/minute")
async def jobs_hybrid_search(payload: HybridJobSearchRequest, request: Request):
    return hybrid_search_jobs(
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


@router.post("/jobs/hybrid-search-v2")
@limiter.limit("90/minute")
async def jobs_hybrid_search_v2(payload: HybridJobSearchV2Request, request: Request):
    user_id = _try_get_optional_user_id(request)
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
                    "filter_contract_types": payload.filter_contract_types,
                    "filter_benefits": payload.filter_benefits,
                    "filter_min_salary": payload.filter_min_salary,
                    "filter_date_posted": payload.filter_date_posted,
                    "filter_experience_levels": payload.filter_experience_levels,
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

    global _SEARCH_EXPOSURES_AVAILABLE, _SEARCH_EXPOSURES_WARNING_EMITTED
    if exposures and _SEARCH_EXPOSURES_AVAILABLE:
        try:
            supabase.table("search_exposures").upsert(exposures, on_conflict="request_id,job_id").execute()
        except Exception as exc:
            if _is_missing_table_error(exc, "search_exposures"):
                _SEARCH_EXPOSURES_AVAILABLE = False
                if not _SEARCH_EXPOSURES_WARNING_EMITTED:
                    print("⚠️ search_exposures table missing. Disabling search exposure writes.")
                    _SEARCH_EXPOSURES_WARNING_EMITTED = True
            else:
                print(f"⚠️ Failed to write search exposures: {exc}")

    meta = result.get("meta") or {}
    response = {
        "jobs": jobs,
        "has_more": result.get("has_more", False),
        "total_count": result.get("total_count", 0),
        "request_id": request_id,
        "meta": {
            "sort_mode": payload.sort_mode,
            "latency_ms": meta.get("latency_ms"),
            "fallback": meta.get("fallback"),
            "result_count": len(jobs),
        },
    }
    if payload.debug:
        response["meta"]["debug"] = {
            "user_id_present": bool(user_id),
            "engine_meta": meta,
        }
    return response


@router.post("/jobs/interactions")
@limiter.limit("120/minute")
async def log_job_interaction(
    payload: JobInteractionRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not verify_csrf_token_header(request, user):
        # Telemetry endpoint: do not block UX on CSRF token race/cooldown.
        global _INTERACTIONS_CSRF_WARNING_LAST_AT
        now = time.monotonic()
        if now - _INTERACTIONS_CSRF_WARNING_LAST_AT >= _INTERACTIONS_CSRF_WARNING_INTERVAL_S:
            print("⚠️ /jobs/interactions called without valid CSRF token; accepting authenticated telemetry request.")
            _INTERACTIONS_CSRF_WARNING_LAST_AT = now

    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    try:
        metadata = payload.metadata or {}
        request_id = payload.request_id or metadata.get("request_id")
        scoring_version = payload.scoring_version or metadata.get("scoring_version")
        model_version = payload.model_version or metadata.get("model_version")

        insert_data = {
            "user_id": user_id,
            "job_id": payload.job_id,
            "event_type": payload.event_type,
            "dwell_time_ms": payload.dwell_time_ms,
            "session_id": payload.session_id,
            "metadata": metadata,
        }
        res = supabase.table("job_interactions").insert(insert_data).execute()
        if not res.data:
            return {"status": "error", "message": "No data inserted"}

        feedback_rows = [
            {
                "request_id": request_id,
                "user_id": user_id,
                "job_id": payload.job_id,
                "signal_type": payload.event_type,
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

        try:
            supabase.table("recommendation_feedback_events").insert(feedback_rows).execute()
        except Exception as feedback_exc:
            print(f"⚠️ Failed to write recommendation feedback events: {feedback_exc}")

        search_feedback_rows = []
        for row in feedback_rows:
            search_feedback_rows.append(
                {
                    "request_id": row.get("request_id"),
                    "user_id": row.get("user_id"),
                    "job_id": row.get("job_id"),
                    "signal_type": row.get("signal_type"),
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

        return {"status": "success"}
    except Exception as exc:
        print(f"❌ Error logging job interaction: {exc}")
        raise HTTPException(status_code=500, detail="Failed to log interaction")
