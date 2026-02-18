import hashlib
import json
import math
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from ..core.database import supabase
from ..core.runtime_config import (
    get_active_action_prediction_model,
    get_active_model_config,
    get_release_flag,
    resolve_scoring_model_for_user,
)
from .demand import recompute_market_skill_demand
from .embeddings import EMBEDDING_VERSION
from .evaluation import run_offline_recommendation_evaluation
from .feature_store import extract_candidate_features, extract_job_features
from .retrieval import (
    ensure_candidate_embedding,
    ensure_job_embeddings,
    fetch_recent_jobs,
    read_cached_recommendations,
    write_recommendation_cache,
)
from .scoring import configure_scoring_weights, predict_action_probability, score_from_embeddings, score_job

MODEL_VERSION = "career-os-v2"
SHORTLIST_SIZE = 220
MIN_SCORE = 25
_JOBS_STATUS_COLUMN_AVAILABLE: Optional[bool] = None
_SEARCH_V2_RPC_AVAILABLE: Optional[bool] = None
_SEARCH_V2_RPC_WARNING_EMITTED = False
_JOBS_STATUS_WARNING_EMITTED = False


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


def _strip_accents(text: str) -> str:
    if not text:
        return ""
    return "".join(
        ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn"
    )


def _normalize_contract_text(value: Optional[str]) -> str:
    if not value:
        return ""
    raw = _strip_accents(str(value).lower())
    return re.sub(r"[^a-z0-9]+", " ", raw).strip()


def _contract_type_tags(value: Optional[str]) -> set:
    txt = _normalize_contract_text(value)
    if not txt:
        return set()
    haystack = f" {txt} "
    tags: set = set()

    if re.search(r"\b(ico|osvc|szco|b2b|freelanc|contractor|self employed|selfemployed|dzialalnosc|gospodarcza)\b", haystack) or "zivnost" in haystack or "zivnostensk" in haystack or "freiberuf" in haystack or "gewerbe" in haystack or "selbst" in haystack:
        tags.add("ico")

    if re.search(r"\b(hpp|plny uvazek|plny pracovn|pracovni pomer|pracovny pomer|full time|fulltime|vollzeit|umowa o prace|pelny etat|festanstell)\b", haystack):
        tags.add("hpp")

    if re.search(r"\b(part time|parttime|teilzeit|zkracen|skracen|castecn|skrat|polovicn|niepelny etat|czesc etatu)\b", haystack):
        tags.add("part_time")

    if re.search(r"\b(brigad|dpp|dpc|dohod|minijob|aushilfe|umowa zlecenie|umowa o dzielo|temporary|temp|seasonal|casual)\b", haystack):
        tags.add("brigada")

    if re.search(r"\b(intern|staz|staz|praktik|trainee)\b", haystack):
        tags.add("internship")

    return tags


def _normalize_contract_filters(values: List[str]) -> set:
    tags: set = set()
    for value in values:
        tags |= _contract_type_tags(value)
    return tags


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


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _parse_job_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _is_new_job(job: Dict, window_days: int = 7) -> bool:
    scraped = _parse_job_datetime(job.get("scraped_at"))
    if not scraped:
        return False
    age_days = (datetime.now(timezone.utc) - scraped).total_seconds() / 86400
    return age_days <= max(1, window_days)


def _company_key(job: Dict) -> str:
    return str(job.get("company_id") or job.get("company") or "unknown")


def _hash_01(subject: str) -> float:
    if not subject:
        return 0.0
    digest = hashlib.sha256(subject.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def _apply_diversity_guardrails(ranked: List[Dict], limit: int, user_id: str, cfg: Dict) -> List[Dict]:
    if not ranked or limit <= 0:
        return []

    base = sorted(ranked, key=lambda item: (item.get("action_probability") or 0.0, item.get("score") or 0.0), reverse=True)
    company_cap = max(1, min(10, int(cfg.get("max_per_company") or 3)))
    new_window_days = max(1, min(30, int(cfg.get("new_job_window_days") or 7)))
    min_new_share = max(0.0, min(0.5, _safe_float(cfg.get("min_new_job_share"), 0.15)))
    exploration_rate = max(0.0, min(0.4, _safe_float(cfg.get("exploration_rate"), 0.12)))
    min_long_tail_share = max(0.0, min(0.4, _safe_float(cfg.get("min_long_tail_share"), 0.10)))
    long_tail_company_threshold = max(1, min(10, int(cfg.get("long_tail_company_threshold") or 2)))

    target_new = min(limit, int(math.ceil(limit * min_new_share)))
    target_exploration = min(limit, int(math.ceil(limit * exploration_rate)))
    target_long_tail = min(limit, int(math.ceil(limit * min_long_tail_share)))

    company_freq: Dict[str, int] = {}
    for row in base:
        ck = _company_key(row.get("job") or {})
        company_freq[ck] = company_freq.get(ck, 0) + 1

    selected: List[Dict] = []
    selected_job_ids = set()
    per_company_counts: Dict[str, int] = {}

    def _try_add(item: Dict, strategy: str, enforce_cap: bool = True) -> bool:
        job = item.get("job") or {}
        job_id = str(job.get("id") or "")
        if not job_id or job_id in selected_job_ids:
            return False
        ck = _company_key(job)
        if enforce_cap and per_company_counts.get(ck, 0) >= company_cap:
            return False

        breakdown = item.get("breakdown") or {}
        breakdown["selection_strategy"] = strategy
        breakdown["is_new_job"] = _is_new_job(job, new_window_days)
        breakdown["is_long_tail_company"] = company_freq.get(ck, 0) <= long_tail_company_threshold
        item["breakdown"] = breakdown
        selected.append(item)
        selected_job_ids.add(job_id)
        per_company_counts[ck] = per_company_counts.get(ck, 0) + 1
        return True

    # 1) Ensure fresh/new jobs in top list
    added_new = 0
    for item in base:
        if added_new >= target_new:
            break
        if not _is_new_job(item.get("job") or {}, new_window_days):
            continue
        if _try_add(item, "new_job"):
            added_new += 1

    # 2) Ensure long-tail company presence
    added_long_tail = 0
    for item in base:
        if added_long_tail >= target_long_tail:
            break
        ck = _company_key(item.get("job") or {})
        if company_freq.get(ck, 0) > long_tail_company_threshold:
            continue
        if _try_add(item, "long_tail"):
            added_long_tail += 1

    # 3) Exploration slots (deterministic by user/job hash + recency)
    exploration_candidates = []
    for item in base:
        job = item.get("job") or {}
        job_id = str(job.get("id") or "")
        if not job_id:
            continue
        deterministic = _hash_01(f"{user_id}:{job_id}")
        recency = _safe_float((item.get("action_features") or {}).get("recency_score"), 0.0)
        exploration_score = (0.6 * deterministic) + (0.4 * recency)
        exploration_candidates.append((exploration_score, item))

    exploration_candidates.sort(key=lambda row: row[0], reverse=True)
    added_exploration = 0
    for _, item in exploration_candidates:
        if added_exploration >= target_exploration:
            break
        if _try_add(item, "exploration"):
            added_exploration += 1

    # 4) Fill remainder with strongest action probability
    for item in base:
        if len(selected) >= limit:
            break
        _try_add(item, "core")

    # 5) If caps are too restrictive, relax company cap to avoid under-filling.
    if len(selected) < limit:
        for item in base:
            if len(selected) >= limit:
                break
            _try_add(item, "core_relaxed", enforce_cap=False)

    return selected[:limit]


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


def _normalize_sort_mode(value: Optional[str]) -> str:
    mode = (value or "default").strip().lower()
    if mode in {"default", "newest", "jhi_desc", "jhi_asc", "recommended"}:
        return mode
    return "default"


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
    contract_filter_tags = _normalize_contract_filters(list(contract_types)) if contract_types else set()
    required_benefits = _normalize_list(filters.get("filter_benefits"))
    experience_levels = _normalize_list(filters.get("filter_experience_levels"))
    country_codes = set(_normalize_list(filters.get("filter_country_codes")))
    exclude_country_codes = set(_normalize_list(filters.get("exclude_country_codes")))
    language_codes = set(_normalize_list(filters.get("filter_language_codes")))
    cutoff_iso = _date_cutoff_iso(filters.get("filter_date_posted"))
    safe_page_size = max(1, min(200, int(page_size or 50)))
    candidate_limit = max(250, min(900, safe_page_size * 6))

    def _run_base_query(with_status_filter: bool):
        query = (
            supabase.table("jobs")
            .select(
                "id,title,company,location,description,benefits,contract_type,salary_from,salary_to,"
                "work_type,work_model,scraped_at,source,education_level,url,lat,lng,country_code,"
                "language_code,legality_status,verification_notes,status"
            )
            .eq("legality_status", "legal")
            .order("scraped_at", desc=True)
            .limit(candidate_limit)
        )
        if with_status_filter:
            query = query.eq("status", "active")
        if cutoff_iso:
            query = query.gte("scraped_at", cutoff_iso)
        if country_codes:
            query = query.in_("country_code", list(country_codes))
        if language_codes:
            query = query.in_("language_code", list(language_codes))
        if min_salary:
            query = query.gte("salary_from", min_salary)
        # Contract type filtering handled in-memory with normalization.
        return query.execute().data or []

    global _JOBS_STATUS_COLUMN_AVAILABLE, _JOBS_STATUS_WARNING_EMITTED
    try:
        use_status = _JOBS_STATUS_COLUMN_AVAILABLE is not False
        rows = _run_base_query(with_status_filter=use_status)
        if use_status:
            _JOBS_STATUS_COLUMN_AVAILABLE = True
    except Exception as exc:
        msg = str(exc).lower()
        missing_status_col = "column jobs.status does not exist" in msg
        if missing_status_col:
            _JOBS_STATUS_COLUMN_AVAILABLE = False
            if not _JOBS_STATUS_WARNING_EMITTED:
                print("⚠️ [Hybrid Search] jobs.status column missing; using legality_status-only filter.")
                _JOBS_STATUS_WARNING_EMITTED = True
            try:
                rows = _run_base_query(with_status_filter=False)
            except Exception as retry_exc:
                print(f"⚠️ [Hybrid Search] base query failed (retry): {retry_exc}")
                return {"jobs": [], "has_more": False, "total_count": 0}
        else:
            print(f"⚠️ [Hybrid Search] base query failed: {exc}")
            return {"jobs": [], "has_more": False, "total_count": 0}

    filtered = []
    for job in rows:
        cc = (job.get("country_code") or "").lower()
        if exclude_country_codes and cc in exclude_country_codes:
            continue
        if filter_city and filter_city not in (job.get("location") or "").lower():
            continue
        if contract_filter_tags:
            job_tags = _contract_type_tags(job.get("contract_type") or "")
            if not job_tags.intersection(contract_filter_tags):
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
    start = page * safe_page_size
    end = start + safe_page_size
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


def hybrid_search_jobs_v2(filters: Dict, page: int = 0, page_size: int = 50, user_id: Optional[str] = None) -> Dict:
    if not supabase:
        return {"jobs": [], "has_more": False, "total_count": 0, "meta": {"fallback": "no_supabase"}}

    flag = get_release_flag("search_v2_enabled", subject_id=user_id or "public", default=True)
    if not flag.get("effective_enabled", True):
        fallback = hybrid_search_jobs(filters, page=page, page_size=page_size)
        fallback["meta"] = {"fallback": "release_flag_disabled", "sort_mode": _normalize_sort_mode(filters.get("sort_mode"))}
        return fallback

    sort_mode = _normalize_sort_mode(filters.get("sort_mode"))
    started = datetime.now(timezone.utc)

    rpc_payload = {
        "p_search_term": (filters.get("search_term") or "").strip(),
        "p_page": max(0, int(page or 0)),
        "p_page_size": max(1, min(200, int(page_size or 50))),
        "p_user_id": user_id,
        "p_user_lat": filters.get("user_lat"),
        "p_user_lng": filters.get("user_lng"),
        "p_radius_km": filters.get("radius_km"),
        "p_filter_city": filters.get("filter_city"),
        "p_filter_contract_types": filters.get("filter_contract_types"),
        "p_filter_benefits": filters.get("filter_benefits"),
        "p_filter_min_salary": filters.get("filter_min_salary"),
        "p_filter_date_posted": filters.get("filter_date_posted") or "all",
        "p_filter_experience_levels": filters.get("filter_experience_levels"),
        "p_filter_country_codes": filters.get("filter_country_codes"),
        "p_exclude_country_codes": filters.get("exclude_country_codes"),
        "p_filter_language_codes": filters.get("filter_language_codes"),
        "p_sort_mode": sort_mode,
    }

    global _SEARCH_V2_RPC_AVAILABLE, _SEARCH_V2_RPC_WARNING_EMITTED
    if _SEARCH_V2_RPC_AVAILABLE is False:
        fallback = hybrid_search_jobs(filters, page=page, page_size=page_size)
        fallback["meta"] = {"fallback": "rpc_unavailable", "sort_mode": sort_mode}
        return fallback

    try:
        resp = supabase.rpc("search_jobs_v2", rpc_payload).execute()
        rows = resp.data or []
        _SEARCH_V2_RPC_AVAILABLE = True
    except Exception as exc:
        msg = str(exc).lower()
        rpc_missing = "pgrst202" in msg or "could not find the function public.search_jobs_v2" in msg
        if rpc_missing:
            _SEARCH_V2_RPC_AVAILABLE = False
            if not _SEARCH_V2_RPC_WARNING_EMITTED:
                print("⚠️ [Hybrid Search V2] search_jobs_v2 RPC missing in DB schema cache; falling back to v1.")
                _SEARCH_V2_RPC_WARNING_EMITTED = True
        else:
            print(f"⚠️ [Hybrid Search V2] RPC failed, falling back to v1: {exc}")
        fallback = hybrid_search_jobs(filters, page=page, page_size=page_size)
        fallback["meta"] = {"fallback": "rpc_failed", "sort_mode": sort_mode}
        return fallback

    if not rows:
        latency_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
        return {
            "jobs": [],
            "has_more": False,
            "total_count": 0,
            "meta": {
                "sort_mode": sort_mode,
                "fallback": None,
                "latency_ms": latency_ms,
            },
        }

    cfg = get_active_model_config("matching", "recommendations")
    ranking_cfg = cfg.get("config_json") or {}
    company_cap = max(1, min(10, int(ranking_cfg.get("search_v2_max_per_company") or 4)))
    new_window_days = max(1, min(30, int(ranking_cfg.get("new_job_window_days") or 7)))
    min_new_share = max(0.0, min(0.5, _safe_float(ranking_cfg.get("search_v2_min_new_share"), 0.1)))

    ranked_input = []
    for row in rows:
        ranked_input.append(
            {
                "job": row,
                "score": _safe_float(row.get("hybrid_score")),
                "action_probability": _safe_float(row.get("behavior_prior_score")),
                "action_features": {"recency_score": _safe_float(row.get("recency_score"))},
                "breakdown": {
                    "hybrid_score": _safe_float(row.get("hybrid_score")),
                    "fts_score": _safe_float(row.get("fts_score")),
                    "trigram_score": _safe_float(row.get("trigram_score")),
                    "profile_fit_score": _safe_float(row.get("profile_fit_score")),
                    "recency_score": _safe_float(row.get("recency_score")),
                    "behavior_prior_score": _safe_float(row.get("behavior_prior_score")),
                },
            }
        )

    # Apply company/new-job guardrails for relevance-based sorts only.
    if sort_mode in {"default", "recommended"}:
        target_new = max(1, int(math.ceil(len(ranked_input) * min_new_share)))
        selected = []
        selected_ids = set()
        per_company: Dict[str, int] = {}

        def _is_new(row: Dict) -> bool:
            return _is_new_job(row.get("job") or {}, window_days=new_window_days)

        for item in ranked_input:
            if len([x for x in selected if _is_new(x)]) >= target_new:
                break
            job = item.get("job") or {}
            job_id = str(job.get("id") or "")
            company_key = str(job.get("company_id") or job.get("company") or "unknown")
            if not job_id or job_id in selected_ids:
                continue
            if per_company.get(company_key, 0) >= company_cap:
                continue
            if not _is_new(item):
                continue
            selected.append(item)
            selected_ids.add(job_id)
            per_company[company_key] = per_company.get(company_key, 0) + 1

        for item in ranked_input:
            if len(selected) >= len(ranked_input):
                break
            job = item.get("job") or {}
            job_id = str(job.get("id") or "")
            company_key = str(job.get("company_id") or job.get("company") or "unknown")
            if not job_id or job_id in selected_ids:
                continue
            if per_company.get(company_key, 0) >= company_cap:
                continue
            selected.append(item)
            selected_ids.add(job_id)
            per_company[company_key] = per_company.get(company_key, 0) + 1

        if len(selected) < len(ranked_input):
            for item in ranked_input:
                if len(selected) >= len(ranked_input):
                    break
                job = item.get("job") or {}
                job_id = str(job.get("id") or "")
                if not job_id or job_id in selected_ids:
                    continue
                selected.append(item)
                selected_ids.add(job_id)

        ranked_input = selected

    total_count = int((rows[0] or {}).get("total_count") or len(rows))
    out_rows = []
    for idx, item in enumerate(ranked_input):
        row = dict(item.get("job") or {})
        row["hybrid_score"] = round(_safe_float(row.get("hybrid_score")), 4)
        row["fts_score"] = round(_safe_float(row.get("fts_score")), 4)
        row["trigram_score"] = round(_safe_float(row.get("trigram_score")), 4)
        row["profile_fit_score"] = round(_safe_float(row.get("profile_fit_score")), 4)
        row["recency_score"] = round(_safe_float(row.get("recency_score")), 4)
        row["behavior_prior_score"] = round(_safe_float(row.get("behavior_prior_score")), 4)
        row["rank_position"] = idx + 1 + (max(0, int(page)) * max(1, int(page_size)))
        out_rows.append(row)

    latency_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
    return {
        "jobs": out_rows,
        "has_more": ((page + 1) * page_size) < total_count,
        "total_count": total_count,
        "meta": {
            "sort_mode": sort_mode,
            "fallback": None,
            "latency_ms": latency_ms,
        },
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
    db_scoring = resolve_scoring_model_for_user(user_id=user_id, feature="recommendations")
    scoring_version = db_scoring.get("version") or "scoring-v1"
    action_model = get_active_action_prediction_model("job_apply_probability")
    action_coefficients = action_model.get("coefficients_json") or {}
    action_model_version = action_model.get("version") or "v1"
    weights = db_scoring.get("weights") if isinstance(db_scoring.get("weights"), dict) else None
    if not weights:
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
        recency_score = 0.0
        scraped_at = job.get("scraped_at")
        if scraped_at:
            try:
                age_days = (datetime.now(timezone.utc) - datetime.fromisoformat(str(scraped_at).replace("Z", "+00:00"))).total_seconds() / 86400
                recency_score = max(0.0, min(1.0, 1.0 - (age_days / 30.0)))
            except Exception:
                recency_score = 0.0

        distance_km = 999.0
        c_lat = candidate.get("lat")
        c_lng = candidate.get("lng")
        j_lat = job.get("lat")
        j_lng = job.get("lng")
        if c_lat is not None and c_lng is not None and j_lat is not None and j_lng is not None:
            try:
                distance_km = _haversine_km(float(c_lat), float(c_lng), float(j_lat), float(j_lng))
            except Exception:
                distance_km = 999.0

        action_features = {
            "similarity_score": _safe_float(semantic),
            "skill_match": _safe_float(breakdown.get("skill_match")),
            "salary_alignment": _safe_float(breakdown.get("salary_alignment")),
            "seniority_alignment": _safe_float(breakdown.get("seniority_alignment")),
            "recency_score": _safe_float(recency_score),
            "location_distance_km": _safe_float(distance_km),
        }
        action_probability = predict_action_probability(action_features, action_coefficients)
        breakdown["action_probability"] = round(action_probability, 6)
        breakdown["action_model_version"] = action_model_version
        breakdown["action_features"] = action_features
        ranked.append(
            {
                "job": job,
                "score": total,
                "reasons": reasons,
                "breakdown": breakdown,
                "action_probability": round(action_probability, 6),
                "action_model_version": action_model_version,
                "action_features": action_features,
                "model_version": model_version,
                "scoring_version": scoring_version,
            }
        )

    ranked.sort(key=lambda item: (item.get("action_probability") or 0.0, item["score"]), reverse=True)
    top = _apply_diversity_guardrails(ranked, limit=limit, user_id=user_id, cfg=cfg)
    for idx, item in enumerate(top):
        item["position"] = idx + 1

    write_recommendation_cache(user_id, top, ttl_minutes=60)
    strategy_counts: Dict[str, int] = {}
    for item in top:
        strategy = (item.get("breakdown") or {}).get("selection_strategy") or "unknown"
        strategy_counts[strategy] = strategy_counts.get(strategy, 0) + 1
    print(
        f"📊 [Matching] {json.dumps({'event': 'computed', 'user_hash': user_hash, 'limit': limit, 'results': len(top), 'model_version': model_version, 'scoring_version': scoring_version, 'scoring_assignment_source': db_scoring.get('assignment_source'), 'bucket': db_scoring.get('bucket'), 'action_model_version': action_model_version, 'selection_strategies': strategy_counts})}"
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
    evaluation = run_offline_recommendation_evaluation(window_days=30)
    print(
        f"🧠 [Matching Batch Daily] started={started} demand_rows={layers['demand_rows']} seasonal_rows={layers.get('seasonal_rows', 0)} salary_rows={layers['salary_rows']} eval_sample={evaluation.get('sample_size', 0)} eval_auc={evaluation.get('auc')}"
    )
