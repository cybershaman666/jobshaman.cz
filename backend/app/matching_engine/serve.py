import hashlib
import json
import math
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from ..core.database import supabase
from ..core.runtime_config import get_active_model_config, get_release_flag
from .demand import recompute_market_skill_demand
from .embeddings import EMBEDDING_VERSION
from .feature_store import extract_candidate_features, extract_job_features
from .retrieval import (
    ensure_candidate_embedding,
    ensure_job_embeddings,
    fetch_recent_jobs,
    read_cached_recommendations,
    write_recommendation_cache,
)
from .scoring import configure_scoring_weights, score_from_embeddings, score_job

MODEL_VERSION = "career-os-v2"
SHORTLIST_SIZE = 220
MIN_SCORE = 25


def _date_cutoff_iso(date_filter: Optional[str]) -> Optional[str]:
    now = datetime.now(timezone.utc)
    mapping = {"24h": 1, "3d": 3, "7d": 7, "14d": 14, "30d": 30}
    days = mapping.get((date_filter or "").lower())
    if not days:
        return None
    return (now - timedelta(days=days)).isoformat()


def _normalize_list(values: Optional[List[str]]) -> List[str]:
    if not values:
        return []
    return [str(v).strip().lower() for v in values if str(v).strip()]


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _benefits_match(job_benefits, requested: List[str]) -> bool:
    if not requested:
        return True
    if not job_benefits:
        return False
    if isinstance(job_benefits, str):
        haystack = job_benefits.lower()
    elif isinstance(job_benefits, list):
        haystack = " ".join(str(x).lower() for x in job_benefits)
    else:
        haystack = str(job_benefits).lower()
    return all(term in haystack for term in requested)


def _experience_match(job: Dict, requested: List[str]) -> bool:
    if not requested:
        return True
    txt = f"{job.get('title') or ''} {job.get('description') or ''}".lower()
    for level in requested:
        lvl = level.lower()
        if lvl in txt:
            return True
        if lvl == "medior" and ("mid" in txt or "middle" in txt):
            return True
    return False


def _lexical_score(text: str, tokens: List[str]) -> float:
    if not tokens:
        return 0.0
    haystack = (text or "").lower()
    hits = sum(1 for token in tokens if token and token in haystack)
    return min(1.0, hits / max(1, len(tokens)))


def hybrid_search_jobs(filters: Dict, page: int = 0, page_size: int = 50) -> Dict:
    if not supabase:
        return {"jobs": [], "has_more": False, "total_count": 0}

    flag = get_release_flag("matching_engine_v2", subject_id="public_hybrid", default=True)
    if not flag.get("effective_enabled", True):
        return {"jobs": [], "has_more": False, "total_count": 0}

    search_term = (filters.get("search_term") or "").strip()
    user_lat = filters.get("user_lat")
    user_lng = filters.get("user_lng")
    radius_km = filters.get("radius_km")
    filter_city = (filters.get("filter_city") or "").strip().lower()
    min_salary = filters.get("filter_min_salary")
    contract_types = set(_normalize_list(filters.get("filter_contract_types")))
    required_benefits = _normalize_list(filters.get("filter_benefits"))
    experience_levels = _normalize_list(filters.get("filter_experience_levels"))
    country_codes = set(_normalize_list(filters.get("filter_country_codes")))
    exclude_country_codes = set(_normalize_list(filters.get("exclude_country_codes")))
    language_codes = set(_normalize_list(filters.get("filter_language_codes")))
    cutoff_iso = _date_cutoff_iso(filters.get("filter_date_posted"))

    try:
        query = (
            supabase.table("jobs")
            .select("*")
            .eq("status", "active")
            .eq("legality_status", "legal")
            .order("scraped_at", desc=True)
            .limit(1200)
        )
        if cutoff_iso:
            query = query.gte("scraped_at", cutoff_iso)
        if country_codes:
            query = query.in_("country_code", list(country_codes))
        if language_codes:
            query = query.in_("language_code", list(language_codes))
        if min_salary:
            query = query.gte("salary_from", min_salary)
        if contract_types:
            query = query.in_("contract_type", list(contract_types))
        rows = query.execute().data or []
    except Exception as exc:
        print(f"⚠️ [Hybrid Search] base query failed: {exc}")
        return {"jobs": [], "has_more": False, "total_count": 0}

    filtered = []
    for job in rows:
        cc = (job.get("country_code") or "").lower()
        if exclude_country_codes and cc in exclude_country_codes:
            continue
        if filter_city and filter_city not in (job.get("location") or "").lower():
            continue
        if not _benefits_match(job.get("benefits"), required_benefits):
            continue
        if not _experience_match(job, experience_levels):
            continue

        if radius_km and user_lat is not None and user_lng is not None:
            try:
                lat = float(job.get("lat"))
                lng = float(job.get("lng"))
                distance = _haversine_km(float(user_lat), float(user_lng), lat, lng)
                if distance > float(radius_km):
                    continue
                job["distance_km"] = round(distance, 2)
            except Exception:
                continue

        filtered.append(job)

    if not filtered:
        return {"jobs": [], "has_more": False, "total_count": 0}

    # Build semantic ranking over the already filtered candidate set.
    cfg = get_active_model_config("matching", "recommendations")
    ranking_cfg = cfg.get("config_json") or {}
    semantic_weight = float(ranking_cfg.get("hybrid_semantic_weight", 0.55))
    lexical_weight = float(ranking_cfg.get("hybrid_lexical_weight", 0.35))
    recency_weight = float(ranking_cfg.get("hybrid_recency_weight", 0.10))

    embedding_vector = None
    tokens = [token for token in search_term.lower().split() if len(token) > 1]
    if search_term:
        from .embeddings import embed_text

        embedding_vector = embed_text(search_term)

    job_embeddings = ensure_job_embeddings(filtered)

    now = datetime.now(timezone.utc)
    ranked = []
    for job in filtered:
        text = f"{job.get('title') or ''} {job.get('description') or ''}"
        lexical = _lexical_score(text, tokens)
        semantic = 0.0
        if embedding_vector is not None:
            semantic = score_from_embeddings(embedding_vector, job_embeddings.get(str(job.get("id"))) or [])
            semantic = max(0.0, min(1.0, semantic))

        scraped_at = job.get("scraped_at")
        try:
            age_days = (now - datetime.fromisoformat(str(scraped_at).replace("Z", "+00:00"))).total_seconds() / 86400
        except Exception:
            age_days = 30.0
        recency = max(0.0, min(1.0, 1.0 - (age_days / 30.0)))

        if search_term:
            score = (semantic_weight * semantic) + (lexical_weight * lexical) + (recency_weight * recency)
        else:
            score = (0.25 * lexical) + (0.75 * recency)

        ranked.append((score, semantic, lexical, recency, job))

    ranked.sort(key=lambda item: item[0], reverse=True)
    total_count = len(ranked)
    start = page * page_size
    end = start + page_size
    page_rows = ranked[start:end]

    out_jobs = []
    for total, semantic, lexical, recency, job in page_rows:
        enriched = dict(job)
        enriched["hybrid_score"] = round(float(total), 4)
        enriched["semantic_score"] = round(float(semantic), 4)
        enriched["lexical_score"] = round(float(lexical), 4)
        enriched["recency_score"] = round(float(recency), 4)
        out_jobs.append(enriched)

    return {
        "jobs": out_jobs,
        "has_more": end < total_count,
        "total_count": total_count,
    }


def _get_candidate_profile(user_id: str):
    if not supabase:
        return None
    try:
        resp = supabase.table("candidate_profiles").select("*").eq("id", user_id).maybe_single().execute()
        return resp.data
    except Exception as exc:
        print(f"⚠️ [Matching] failed to fetch candidate profile: {exc}")
        return None


def recommend_jobs_for_user(user_id: str, limit: int = 50, allow_cache: bool = True) -> List[Dict]:
    flag = get_release_flag("matching_engine_v2", subject_id=user_id, default=True)
    if not flag.get("effective_enabled", True):
        return []

    model_cfg = get_active_model_config("matching", "recommendations")
    model_version = model_cfg.get("version") or MODEL_VERSION
    cfg = model_cfg.get("config_json") or {}
    shortlist_size = int(cfg.get("shortlist_size") or SHORTLIST_SIZE)
    min_score = float(cfg.get("min_score") or MIN_SCORE)
    weights = cfg.get("weights") if isinstance(cfg.get("weights"), dict) else {}
    configure_scoring_weights(weights)

    user_hash = hashlib.sha256((user_id or "").encode("utf-8")).hexdigest()[:16]
    if allow_cache:
        cached = read_cached_recommendations(user_id, limit)
        if cached:
            print(
                f"📊 [Matching] {json.dumps({'event': 'cache_hit', 'user_hash': user_hash, 'limit': limit, 'results': len(cached), 'model_version': model_version})}"
            )
            return cached

    candidate = _get_candidate_profile(user_id)
    if not candidate:
        return []

    candidate_features = extract_candidate_features(candidate)
    candidate_embedding = ensure_candidate_embedding(user_id, candidate_features.get("text") or "")

    jobs = fetch_recent_jobs(limit=500, days=30)
    if not jobs:
        return []

    job_embeddings = ensure_job_embeddings(jobs)

    ranked = []
    shortlist = []
    for job in jobs:
        job_id = str(job.get("id"))
        semantic = score_from_embeddings(candidate_embedding, job_embeddings.get(job_id) or [])
        shortlist.append((semantic, job))

    shortlist.sort(key=lambda x: x[0], reverse=True)
    shortlisted_jobs = [job for _, job in shortlist[:shortlist_size]]

    for job in shortlisted_jobs:
        job_id = str(job.get("id"))
        semantic = score_from_embeddings(candidate_embedding, job_embeddings.get(job_id) or [])
        job_features = extract_job_features(job)
        total, reasons, breakdown = score_job(candidate_features, job_features, semantic)
        if total < min_score:
            continue
        ranked.append(
            {
                "job": job,
                "score": total,
                "reasons": reasons,
                "breakdown": breakdown,
                "model_version": model_version,
            }
        )

    ranked.sort(key=lambda item: item["score"], reverse=True)
    top = ranked[:limit]

    write_recommendation_cache(user_id, top, ttl_minutes=60)
    print(
        f"📊 [Matching] {json.dumps({'event': 'computed', 'user_hash': user_hash, 'limit': limit, 'results': len(top), 'model_version': model_version})}"
    )
    return top


def batch_refresh_job_embeddings() -> int:
    jobs = fetch_recent_jobs(limit=3000, days=30)
    if not jobs:
        return 0
    ensure_job_embeddings(jobs)
    return len(jobs)


def batch_refresh_candidate_embeddings() -> int:
    if not supabase:
        return 0
    try:
        resp = supabase.table("candidate_profiles").select("id, job_title, cv_text, cv_ai_text, story, skills, inferred_skills, strengths, leadership").limit(2000).execute()
    except Exception as exc:
        print(f"⚠️ [Matching] batch candidate embeddings fetch failed: {exc}")
        return 0

    profiles = resp.data or []
    updated = 0
    for profile in profiles:
        features = extract_candidate_features(profile)
        ensure_candidate_embedding(profile.get("id"), features.get("text") or "")
        updated += 1
    return updated


def batch_refresh_recommendations() -> int:
    if not supabase:
        return 0
    try:
        resp = supabase.table("candidate_profiles").select("id").limit(1500).execute()
    except Exception as exc:
        print(f"⚠️ [Matching] batch recommendation fetch failed: {exc}")
        return 0

    profiles = resp.data or []
    generated = 0
    for row in profiles:
        user_id = row.get("id")
        if not user_id:
            continue
        recs = recommend_jobs_for_user(user_id, limit=80, allow_cache=False)
        if recs:
            generated += 1
    return generated


def batch_refresh_market_layers() -> Dict[str, int]:
    demand_rows = recompute_market_skill_demand()
    from .demand import recompute_seasonal_bias_corrections
    seasonal_rows = recompute_seasonal_bias_corrections()
    # salary normalization currently managed by data table updates, no recompute function yet
    return {"demand_rows": demand_rows, "seasonal_rows": seasonal_rows, "salary_rows": 0}


def run_hourly_batch_jobs() -> None:
    started = datetime.now(timezone.utc).isoformat()
    jobs = batch_refresh_job_embeddings()
    candidates = batch_refresh_candidate_embeddings()
    rec_users = batch_refresh_recommendations()
    print(
        f"🧠 [Matching Batch Hourly] started={started} embedding_version={EMBEDDING_VERSION} jobs={jobs} candidates={candidates} recommendation_users={rec_users}"
    )


def run_daily_batch_jobs() -> None:
    started = datetime.now(timezone.utc).isoformat()
    layers = batch_refresh_market_layers()
    print(
        f"🧠 [Matching Batch Daily] started={started} demand_rows={layers['demand_rows']} seasonal_rows={layers.get('seasonal_rows', 0)} salary_rows={layers['salary_rows']}"
    )
