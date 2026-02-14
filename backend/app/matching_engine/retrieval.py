import json
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple

from ..core.database import supabase
from .embeddings import EMBEDDING_MODEL, EMBEDDING_VERSION, embed_text


def _vector_literal(values: List[float]) -> str:
    return "[" + ",".join(f"{v:.6f}" for v in values) + "]"


def _parse_vector(raw) -> List[float]:
    if not raw:
        return []
    if isinstance(raw, list):
        return [float(x) for x in raw]
    if isinstance(raw, str):
        txt = raw.strip()
        if txt.startswith("[") and txt.endswith("]"):
            try:
                return [float(x) for x in txt.strip("[]").split(",") if x.strip()]
            except Exception:
                return []
        try:
            parsed = json.loads(txt)
            if isinstance(parsed, list):
                return [float(x) for x in parsed]
        except Exception:
            return []
    return []


def ensure_candidate_embedding(candidate_id: str, text: str) -> List[float]:
    vector = embed_text(text)
    if not supabase:
        return vector

    payload = {
        "candidate_id": candidate_id,
        "embedding": _vector_literal(vector),
        "embedding_model": EMBEDDING_MODEL,
        "embedding_version": EMBEDDING_VERSION,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        supabase.table("candidate_embeddings").upsert(payload, on_conflict="candidate_id").execute()
    except Exception as exc:
        print(f"⚠️ [Matching] candidate embedding upsert failed: {exc}")
    return vector


def ensure_job_embeddings(jobs: List[Dict]) -> Dict[str, List[float]]:
    out: Dict[str, List[float]] = {}
    if not jobs:
        return out

    for job in jobs:
        job_id = str(job.get("id"))
        text = "\n".join([job.get("title") or "", job.get("description") or "", job.get("location") or ""]).strip()
        out[job_id] = embed_text(text)

    if not supabase:
        return out

    rows = []
    now_iso = datetime.now(timezone.utc).isoformat()
    for job_id, vec in out.items():
        try:
            rows.append(
                {
                    "job_id": int(job_id),
                    "embedding": _vector_literal(vec),
                    "embedding_model": EMBEDDING_MODEL,
                    "embedding_version": EMBEDDING_VERSION,
                    "updated_at": now_iso,
                }
            )
        except Exception:
            continue

    if rows:
        try:
            supabase.table("job_embeddings").upsert(rows, on_conflict="job_id").execute()
        except Exception as exc:
            print(f"⚠️ [Matching] job embeddings upsert failed: {exc}")

    return out


def fetch_recent_jobs(limit: int = 500, days: int = 30) -> List[Dict]:
    if not supabase:
        return []

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    try:
        resp = (
            supabase.table("jobs")
            .select("*")
            .eq("status", "active")
            .gte("scraped_at", cutoff)
            .order("scraped_at", desc=True)
            .limit(limit)
            .execute()
        )
        if resp.data:
            return resp.data
    except Exception:
        # fallback for environments where status is not populated
        resp = (
            supabase.table("jobs")
            .select("*")
            .gte("scraped_at", cutoff)
            .order("scraped_at", desc=True)
            .limit(limit)
            .execute()
        )
        return resp.data or []
    return []


def read_cached_recommendations(user_id: str, limit: int) -> List[Dict]:
    if not supabase:
        return []
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        resp = (
            supabase.table("recommendation_cache")
            .select("job_id, score, breakdown_json, reasons_json, model_version, scoring_version, jobs(*)")
            .eq("user_id", user_id)
            .gte("expires_at", now_iso)
            .order("score", desc=True)
            .limit(limit)
            .execute()
        )
        rows = resp.data or []
        out = []
        for row in rows:
            breakdown = row.get("breakdown_json") or {}
            out.append(
                {
                    "job": row.get("jobs") or {"id": row.get("job_id")},
                    "score": float(row.get("score") or 0),
                    "reasons": row.get("reasons_json") or [],
                    "breakdown": breakdown,
                    "action_probability": breakdown.get("action_probability"),
                    "action_model_version": breakdown.get("action_model_version"),
                    "model_version": row.get("model_version") or "v1",
                    "scoring_version": row.get("scoring_version") or "scoring-v1",
                }
            )
        return out
    except Exception as exc:
        print(f"⚠️ [Matching] recommendation cache read failed: {exc}")
        return []


def write_recommendation_cache(user_id: str, rows: List[Dict], ttl_minutes: int = 60) -> None:
    if not supabase or not rows:
        return

    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)).isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()
    payload = []
    for row in rows:
        job = row.get("job") or {}
        job_id = job.get("id")
        if not job_id:
            continue
        try:
            payload.append(
                {
                    "user_id": user_id,
                    "job_id": int(job_id),
                    "score": float(row.get("score") or 0),
                    "breakdown_json": row.get("breakdown") or {},
                    "reasons_json": row.get("reasons") or [],
                    "model_version": row.get("model_version") or "career-os-v1",
                    "scoring_version": row.get("scoring_version") or "scoring-v1",
                    "computed_at": now_iso,
                    "expires_at": expires_at,
                }
            )
        except Exception:
            continue

    if not payload:
        return

    try:
        supabase.table("recommendation_cache").upsert(payload, on_conflict="user_id,job_id,model_version").execute()
    except Exception as exc:
        print(f"⚠️ [Matching] recommendation cache write failed: {exc}")
