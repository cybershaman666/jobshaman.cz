import hashlib
import json
from datetime import datetime, timezone
from typing import Dict, List

from ..core.database import supabase
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
from .scoring import score_from_embeddings, score_job

MODEL_VERSION = "career-os-v1"


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
    user_hash = hashlib.sha256((user_id or "").encode("utf-8")).hexdigest()[:16]
    if allow_cache:
        cached = read_cached_recommendations(user_id, limit)
        if cached:
            print(
                f"📊 [Matching] {json.dumps({'event': 'cache_hit', 'user_hash': user_hash, 'limit': limit, 'results': len(cached), 'model_version': MODEL_VERSION})}"
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
    for job in jobs:
        job_id = str(job.get("id"))
        job_features = extract_job_features(job)
        semantic = score_from_embeddings(candidate_embedding, job_embeddings.get(job_id) or [])
        total, reasons, breakdown = score_job(candidate_features, job_features, semantic)
        if total < 25:
            continue
        ranked.append(
            {
                "job": job,
                "score": total,
                "reasons": reasons,
                "breakdown": breakdown,
                "model_version": MODEL_VERSION,
            }
        )

    ranked.sort(key=lambda item: item["score"], reverse=True)
    top = ranked[:limit]

    write_recommendation_cache(user_id, top, ttl_minutes=60)
    print(
        f"📊 [Matching] {json.dumps({'event': 'computed', 'user_hash': user_hash, 'limit': limit, 'results': len(top), 'model_version': MODEL_VERSION})}"
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
    # salary normalization currently managed by data table updates, no recompute function yet
    return {"demand_rows": demand_rows, "salary_rows": 0}


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
    print(f"🧠 [Matching Batch Daily] started={started} demand_rows={layers['demand_rows']} salary_rows={layers['salary_rows']}")
