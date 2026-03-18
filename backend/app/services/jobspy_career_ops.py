from __future__ import annotations

import hashlib
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

from pymongo import ASCENDING, DESCENDING, MongoClient, UpdateOne
from pymongo.collection import Collection

try:
    import certifi

    _CA_FILE = certifi.where()
except Exception:
    _CA_FILE = None

try:
    from langdetect import detect
except Exception:
    detect = None

from ..core import config
from ..matching_engine.role_taxonomy import DOMAIN_KEYWORDS, ROLE_FAMILY_KEYWORDS, TAXONOMY_VERSION
from .candidate_intent import get_related_domains, resolve_candidate_intent_profile
from .recommendation_intelligence import get_candidate_recommendation_intelligence

_mongo_client: MongoClient | None = None
_indexes_ready = False


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _safe_str(value: Any) -> str:
    return str(value or "").strip()


def _parse_iso_datetime(value: Any) -> datetime | None:
    raw = _safe_str(value)
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _serialize_datetime(value: datetime | None) -> str | None:
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _tokenize(value: Any) -> list[str]:
    normalized = _normalize_text(value)
    if not normalized:
        return []
    return [part for part in re.split(r"[^a-z0-9+#./-]+", normalized) if len(part) >= 3]


def _keyword_hits(normalized_text: str, keywords: list[str]) -> int:
    hits = 0
    for keyword in keywords:
        normalized_keyword = _normalize_text(keyword)
        if normalized_keyword and normalized_keyword in normalized_text:
            hits += 1
    return hits


def _rank_keyword_map(normalized_text: str, key_to_keywords: dict[str, list[str]]) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    max_len: dict[str, int] = {}
    best = 0
    for key, keywords in key_to_keywords.items():
        hit_count = 0
        best_len = 0
        for keyword in keywords or []:
            normalized_keyword = _normalize_text(keyword)
            if not normalized_keyword:
                continue
            if normalized_keyword in normalized_text:
                hit_count += 1
                best_len = max(best_len, len(normalized_keyword))
        if hit_count <= 0:
            continue
        counts[key] = hit_count
        max_len[key] = best_len
        best = max(best, hit_count)
    if not counts:
        return []
    ranked = sorted(counts.items(), key=lambda item: (item[1], max_len.get(item[0], 0), item[0]), reverse=True)
    denominator = float(best or 1)
    return [{"key": key, "score": round(count / denominator, 4)} for key, count in ranked]


def _infer_seniority(*values: Any) -> str | None:
    text = _normalize_text(" ".join(str(value or "") for value in values))
    if not text:
        return None
    if any(token in text for token in ("lead", "principal", "head of", "director", "manager", "vedouci", "veduci")):
        return "lead"
    if any(token in text for token in ("senior", "expert", "staff", "architect", "architekt")):
        return "senior"
    if any(token in text for token in ("medior", "mid", "intermediate")):
        return "medior"
    if any(token in text for token in ("junior", "graduate", "absolvent")):
        return "junior"
    if any(token in text for token in ("intern", "internship", "trainee", "entry")):
        return "entry"
    return None


def _work_mode_from_job(raw_job: dict[str, Any]) -> str:
    source = " ".join(
        [
            _safe_str(raw_job.get("job_type")),
            _safe_str(raw_job.get("location")),
            _safe_str(raw_job.get("description")),
            "remote" if raw_job.get("is_remote") else "",
        ]
    )
    normalized = _normalize_text(source)
    if raw_job.get("is_remote") or "remote" in normalized:
        return "remote"
    if "hybrid" in normalized:
        return "hybrid"
    if normalized:
        return "onsite"
    return "unknown"


def _freshness_bucket(scraped_at: datetime | None) -> tuple[str, float]:
    if not isinstance(scraped_at, datetime):
        return ("unknown", 0.45)
    hours_old = max(0.0, (_utcnow() - scraped_at).total_seconds() / 3600.0)
    if hours_old <= 24:
        return ("hot", 1.0)
    if hours_old <= 72:
        return ("fresh", 0.88)
    if hours_old <= 168:
        return ("warm", 0.72)
    if hours_old <= 336:
        return ("aging", 0.5)
    return ("stale", 0.34)


def _detect_language(title: str, description: str) -> str | None:
    if detect is None:
        return None
    sample = f"{title}. {description[:2000]}".strip()
    if len(sample) < 20:
        return None
    try:
        return detect(sample)
    except Exception:
        return None


def _company_key(company: str, country: str) -> str:
    raw = "|".join([_normalize_text(company), _normalize_text(country)])
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _excerpt(value: str, limit: int = 260) -> str:
    plain = re.sub(r"\s+", " ", str(value or "").strip())
    if len(plain) <= limit:
        return plain
    return plain[: max(1, limit - 1)].rstrip() + "…"


def _get_client() -> MongoClient:
    global _mongo_client
    if _mongo_client is None:
        if not config.MONGODB_URI:
            raise RuntimeError("MONGODB_URI missing")
        kwargs = {
            "serverSelectionTimeoutMS": 5000,
            "connectTimeoutMS": 10000,
            "retryWrites": True,
        }
        if _CA_FILE:
            kwargs["tlsCAFile"] = _CA_FILE
        _mongo_client = MongoClient(config.MONGODB_URI, **kwargs)
    return _mongo_client


def _raw_collection() -> Collection:
    return _get_client()[config.MONGODB_DB][config.MONGODB_JOBSPY_COLLECTION]


def _enriched_collection() -> Collection:
    global _indexes_ready
    collection = _get_client()[config.MONGODB_DB][config.MONGODB_JOBSPY_ENRICHED_COLLECTION]
    if not _indexes_ready:
        collection.create_index([("scraped_at", DESCENDING)])
        collection.create_index([("company_key", ASCENDING), ("scraped_at", DESCENDING)])
        collection.create_index([("primary_domain", ASCENDING), ("scraped_at", DESCENDING)])
        collection.create_index([("primary_role_family", ASCENDING), ("scraped_at", DESCENDING)])
        _company_collection().create_index([("open_jobs_count", DESCENDING), ("latest_scraped_at", DESCENDING)])
        _company_collection().create_index([("company_key", ASCENDING)], unique=True)
        _indexes_ready = True
    return collection


def _company_collection() -> Collection:
    return _get_client()[config.MONGODB_DB][config.MONGODB_JOBSPY_COMPANY_COLLECTION]


def _latest_collection_timestamp(collection: Collection, field_names: tuple[str, ...]) -> datetime | None:
    for field_name in field_names:
        doc = collection.find_one({field_name: {"$exists": True}}, sort=[(field_name, DESCENDING)], projection={field_name: 1})
        if not doc:
            continue
        value = doc.get(field_name)
        if isinstance(value, datetime):
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            return value
    return None


def _should_refresh_career_ops() -> bool:
    raw_collection = _raw_collection()
    enriched_collection = _enriched_collection()

    raw_count = raw_collection.count_documents({"expires_at": {"$gt": _utcnow()}})
    enriched_count = enriched_collection.count_documents({"expires_at": {"$gt": _utcnow()}})
    if raw_count <= 0:
        return False
    if enriched_count <= 0 or enriched_count < raw_count:
        return True

    latest_raw = _latest_collection_timestamp(raw_collection, ("updated_at", "scraped_at"))
    latest_enriched = _latest_collection_timestamp(enriched_collection, ("updated_at", "scraped_at"))
    if latest_raw and not latest_enriched:
        return True
    if latest_raw and latest_enriched and latest_raw > latest_enriched:
        return True
    return False


def build_enriched_job_document(raw_job: dict[str, Any]) -> dict[str, Any]:
    title = _safe_str(raw_job.get("title"))
    company = _safe_str(raw_job.get("company"))
    description = _safe_str(raw_job.get("description"))
    location = _safe_str(raw_job.get("location"))
    country = _safe_str(raw_job.get("country") or raw_job.get("country_indeed"))
    normalized_blob = _normalize_text(" ".join([title, company, location, description]))
    role_families = _rank_keyword_map(normalized_blob, ROLE_FAMILY_KEYWORDS)[:6]
    domains = _rank_keyword_map(normalized_blob, DOMAIN_KEYWORDS)[:6]
    primary_role_family = role_families[0]["key"] if role_families else None
    primary_domain = domains[0]["key"] if domains else None
    scraped_at = _parse_iso_datetime(raw_job.get("scraped_at")) or _parse_iso_datetime(raw_job.get("updated_at"))
    freshness_bucket, freshness_score = _freshness_bucket(scraped_at)
    work_mode = _work_mode_from_job(raw_job)
    seniority = _infer_seniority(title, description, raw_job.get("job_type"))
    excerpt = _excerpt(description or title)
    company_key = _company_key(company, country)
    language_code = _detect_language(title, description)
    return {
        "_id": raw_job["_id"],
        "raw_job_id": _safe_str(raw_job.get("_id")),
        "provider": "jobspy",
        "company_key": company_key,
        "company": company,
        "title": title,
        "location": location,
        "country": country or None,
        "country_indeed": _safe_str(raw_job.get("country_indeed")) or None,
        "source_site": _safe_str(raw_job.get("source_site")).lower() or "unknown",
        "job_type": _safe_str(raw_job.get("job_type")) or None,
        "interval": _safe_str(raw_job.get("interval")) or None,
        "job_url": _safe_str(raw_job.get("job_url")) or None,
        "description_excerpt": excerpt,
        "description_present": bool(description),
        "is_remote": bool(raw_job.get("is_remote")),
        "work_mode_normalized": work_mode,
        "queried_sites": list(raw_job.get("queried_sites") or []),
        "search_term": _safe_str(raw_job.get("search_term")) or None,
        "location_query": _safe_str(raw_job.get("location_query")) or None,
        "hours_old": raw_job.get("hours_old"),
        "min_amount": raw_job.get("min_amount"),
        "max_amount": raw_job.get("max_amount"),
        "currency": _safe_str(raw_job.get("currency")) or None,
        "query_hash": _safe_str(raw_job.get("query_hash")),
        "scraped_at": scraped_at,
        "updated_at": _utcnow(),
        "expires_at": _parse_iso_datetime(raw_job.get("expires_at")),
        "freshness_bucket": freshness_bucket,
        "freshness_score": round(freshness_score, 4),
        "language_code": language_code,
        "inferred_seniority": seniority,
        "role_families": role_families,
        "primary_role_family": primary_role_family,
        "domains": domains,
        "primary_domain": primary_domain,
        "taxonomy_version": TAXONOMY_VERSION,
        "keywords": sorted(set(_tokenize(" ".join([title, company, description]))[:40])),
    }


def _serialize_enriched_job(document: dict[str, Any]) -> dict[str, Any]:
    payload = dict(document)
    payload.pop("_id", None)
    for key in ("scraped_at", "updated_at", "expires_at"):
        payload[key] = _serialize_datetime(payload.get(key))
    return payload


def _serialize_company_snapshot(document: dict[str, Any]) -> dict[str, Any]:
    payload = dict(document)
    payload.pop("_id", None)
    for key in ("latest_scraped_at", "updated_at"):
        payload[key] = _serialize_datetime(payload.get(key))
    return payload


def refresh_jobspy_career_ops_snapshots(limit: int = 600) -> dict[str, Any]:
    raw_jobs = list(
        _raw_collection()
        .find({"expires_at": {"$gt": _utcnow()}}, {"raw_payload": 0})
        .sort([("scraped_at", DESCENDING), ("updated_at", DESCENDING)])
        .limit(max(1, min(2000, int(limit or 600))))
    )
    enriched_docs = [build_enriched_job_document(doc) for doc in raw_jobs if isinstance(doc, dict) and doc.get("_id")]
    if enriched_docs:
        operations = [
            UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True)
            for doc in enriched_docs
        ]
        _enriched_collection().bulk_write(operations, ordered=False)
    company_docs = build_company_snapshot_documents(enriched_docs)
    if company_docs:
        company_ops = [
            UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True)
            for doc in company_docs
        ]
        _company_collection().bulk_write(company_ops, ordered=False)
    return {
        "raw_job_count": len(raw_jobs),
        "enriched_job_count": len(enriched_docs),
        "company_snapshot_count": len(company_docs),
        "collections": {
            "raw": config.MONGODB_JOBSPY_COLLECTION,
            "enriched": config.MONGODB_JOBSPY_ENRICHED_COLLECTION,
            "companies": config.MONGODB_JOBSPY_COMPANY_COLLECTION,
        },
        "generated_at": _serialize_datetime(_utcnow()),
    }


def build_company_snapshot_documents(enriched_docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for doc in enriched_docs:
        grouped[str(doc.get("company_key") or "")].append(doc)

    snapshots: list[dict[str, Any]] = []
    for company_key, docs in grouped.items():
        docs = [doc for doc in docs if company_key]
        if not docs:
            continue
        docs.sort(key=lambda item: item.get("scraped_at") or datetime.fromtimestamp(0, tz=timezone.utc), reverse=True)
        latest = docs[0]
        role_counter = Counter(str(doc.get("primary_role_family") or "") for doc in docs if doc.get("primary_role_family"))
        domain_counter = Counter(str(doc.get("primary_domain") or "") for doc in docs if doc.get("primary_domain"))
        location_counter = Counter(str(doc.get("location") or "") for doc in docs if doc.get("location"))
        source_counter = Counter(str(doc.get("source_site") or "") for doc in docs if doc.get("source_site"))
        remote_count = sum(1 for doc in docs if str(doc.get("work_mode_normalized") or "") == "remote")
        hybrid_count = sum(1 for doc in docs if str(doc.get("work_mode_normalized") or "") == "hybrid")
        why_now_parts: list[str] = []
        if len(docs) >= 2:
            why_now_parts.append(f"{len(docs)} active openings")
        if role_counter:
            role_name, role_count = role_counter.most_common(1)[0]
            if role_name and role_count >= 1:
                why_now_parts.append(f"{role_name.replace('_', ' ')} hiring cluster")
        if remote_count:
            why_now_parts.append(f"{remote_count} remote-friendly")
        elif hybrid_count:
            why_now_parts.append(f"{hybrid_count} hybrid roles")
        snapshots.append(
            {
                "_id": company_key,
                "company_key": company_key,
                "company": latest.get("company"),
                "country": latest.get("country"),
                "open_jobs_count": len(docs),
                "latest_scraped_at": latest.get("scraped_at"),
                "primary_role_family": role_counter.most_common(1)[0][0] if role_counter else None,
                "primary_domain": domain_counter.most_common(1)[0][0] if domain_counter else None,
                "role_family_counts": dict(role_counter.most_common(5)),
                "domain_counts": dict(domain_counter.most_common(5)),
                "source_sites": [name for name, _ in source_counter.most_common(5)],
                "top_locations": [name for name, _ in location_counter.most_common(5)],
                "sample_job_ids": [str(doc.get("raw_job_id") or "") for doc in docs[:6]],
                "sample_titles": [_safe_str(doc.get("title")) for doc in docs[:4] if _safe_str(doc.get("title"))],
                "remote_ratio": round(remote_count / len(docs), 4) if docs else 0,
                "hybrid_ratio": round(hybrid_count / len(docs), 4) if docs else 0,
                "why_now": ", ".join(why_now_parts) if why_now_parts else "Fresh external openings",
                "updated_at": _utcnow(),
            }
        )
    snapshots.sort(key=lambda item: (int(item.get("open_jobs_count") or 0), item.get("latest_scraped_at") or datetime.fromtimestamp(0, tz=timezone.utc)), reverse=True)
    return snapshots


def _term_overlap_score(haystack: str, needles: list[str]) -> float:
    normalized_haystack = _normalize_text(haystack)
    normalized_needles = [_normalize_text(item) for item in needles if _normalize_text(item)]
    if not normalized_haystack or not normalized_needles:
        return 0.0
    hits = 0
    for needle in normalized_needles:
        if needle in normalized_haystack:
            hits += 1
            continue
        parts = [part for part in needle.split(" ") if len(part) >= 3]
        if parts and all(part in normalized_haystack for part in parts):
            hits += 1
    return min(1.0, hits / max(1, len(normalized_needles)))


def _seniority_alignment(candidate_seniority: str | None, job_seniority: str | None) -> float:
    order = {"entry": 0, "junior": 1, "medior": 2, "senior": 3, "lead": 4}
    if not candidate_seniority or not job_seniority:
        return 0.55
    if candidate_seniority not in order or job_seniority not in order:
        return 0.55
    distance = abs(order[candidate_seniority] - order[job_seniority])
    return {0: 1.0, 1: 0.78, 2: 0.52}.get(distance, 0.28)


def _work_mode_alignment(candidate_profile: dict[str, Any], recommendation_intelligence: dict[str, Any], job_mode: str) -> float:
    search_profile = ((candidate_profile.get("preferences") or {}).get("searchProfile") or {}) if isinstance((candidate_profile.get("preferences") or {}).get("searchProfile"), dict) else {}
    wants_remote = bool(search_profile.get("wantsRemoteRoles"))
    preferred_modes = [str(item or "").strip().lower() for item in recommendation_intelligence.get("preferred_work_modes") or [] if str(item or "").strip()]
    if wants_remote:
        if job_mode == "remote":
            return 1.0
        if job_mode == "hybrid":
            return 0.72
        return 0.28
    if preferred_modes:
        if any(mode in job_mode for mode in preferred_modes):
            return 1.0
        if job_mode == "hybrid":
            return 0.68
    return 0.6 if job_mode != "unknown" else 0.45


def score_enriched_job_for_candidate(
    enriched_job: dict[str, Any],
    *,
    candidate_profile: dict[str, Any],
    saved_job_ids: set[str],
) -> dict[str, Any]:
    intent = resolve_candidate_intent_profile(candidate_profile)
    recommendation = get_candidate_recommendation_intelligence(candidate_profile, user_id=str(candidate_profile.get("id") or ""))
    title = _safe_str(enriched_job.get("title"))
    excerpt = _safe_str(enriched_job.get("description_excerpt"))
    blob = " ".join([title, excerpt, _safe_str(enriched_job.get("company")), _safe_str(enriched_job.get("location"))])

    primary_domain = _safe_str(intent.get("primary_domain")).lower()
    secondary_domains = [str(item).lower() for item in (intent.get("secondary_domains") or []) if str(item).strip()]
    related_domains = get_related_domains(primary_domain)
    job_domain = _safe_str(enriched_job.get("primary_domain")).lower()
    domain_score = 0.24
    if primary_domain and job_domain == primary_domain:
        domain_score = 1.0
    elif job_domain and job_domain in secondary_domains:
        domain_score = 0.82
    elif job_domain and job_domain in related_domains:
        domain_score = 0.66

    role_score = max(
        _term_overlap_score(blob, recommendation.get("target_roles") or []),
        _term_overlap_score(blob, [intent.get("target_role") or ""]),
    )
    adjacent_role_score = _term_overlap_score(blob, recommendation.get("adjacent_roles") or [])
    keyword_score = _term_overlap_score(blob, recommendation.get("priority_keywords") or [])
    avoid_penalty = _term_overlap_score(blob, recommendation.get("avoid_keywords") or [])
    freshness_score = float(enriched_job.get("freshness_score") or 0)
    seniority_score = _seniority_alignment(_safe_str(intent.get("seniority")) or None, _safe_str(enriched_job.get("inferred_seniority")) or None)
    work_mode_score = _work_mode_alignment(candidate_profile, recommendation, _safe_str(enriched_job.get("work_mode_normalized")).lower())

    blended = (
        0.26 * domain_score
        + 0.23 * role_score
        + 0.10 * adjacent_role_score
        + 0.16 * keyword_score
        + 0.18 * freshness_score
        + 0.07 * seniority_score
        + 0.05 * work_mode_score
        - 0.10 * avoid_penalty
    )
    fit_score = round(max(0.0, min(1.0, blended)) * 100, 1)
    if fit_score >= 78:
        match_bucket = "best_fit"
    elif fit_score >= 58:
        match_bucket = "adjacent"
    else:
        match_bucket = "broader"

    reasons: list[str] = []
    if primary_domain and job_domain == primary_domain:
        reasons.append(f"Aligned with your primary domain: {primary_domain.replace('_', ' ')}")
    elif job_domain:
        reasons.append(f"Market signal in {job_domain.replace('_', ' ')}")
    if role_score >= 0.5:
        reasons.append("Title/description matches your target role direction")
    elif adjacent_role_score >= 0.5:
        reasons.append("Looks like a credible adjacent move")
    if keyword_score >= 0.25:
        reasons.append("Contains your priority keywords")
    if freshness_score >= 0.82:
        reasons.append("Freshly scraped opening")
    if work_mode_score >= 0.8:
        reasons.append("Matches your preferred work setup")
    if str(enriched_job.get("raw_job_id") or "") in saved_job_ids:
        reasons.append("Already saved, worth following up")

    action_type = "new_high_fit_job"
    if str(enriched_job.get("raw_job_id") or "") in saved_job_ids and str(enriched_job.get("freshness_bucket") or "") in {"aging", "stale"}:
        action_type = "stale_saved_followup"
    elif fit_score >= 74 and enriched_job.get("description_present"):
        action_type = "tailor_now"

    return {
        **_serialize_enriched_job(enriched_job),
        "fit_score": fit_score,
        "match_bucket": match_bucket,
        "fit_reasons": reasons[:4],
        "domain_score": round(domain_score, 4),
        "role_score": round(role_score, 4),
        "adjacent_role_score": round(adjacent_role_score, 4),
        "keyword_score": round(keyword_score, 4),
        "seniority_score": round(seniority_score, 4),
        "work_mode_score": round(work_mode_score, 4),
        "action_type": action_type,
    }


def build_career_ops_feed(
    *,
    candidate_profile: dict[str, Any],
    saved_job_ids: list[str] | None = None,
    dismissed_job_ids: list[str] | None = None,
    refresh: bool = False,
    job_limit: int = 24,
    company_limit: int = 10,
    action_limit: int = 14,
) -> dict[str, Any]:
    if refresh or _enriched_collection().count_documents({}) == 0 or _should_refresh_career_ops():
        refresh_jobspy_career_ops_snapshots(limit=800)

    saved_ids = {str(item or "").strip() for item in (saved_job_ids or []) if str(item or "").strip()}
    dismissed_ids = {str(item or "").strip() for item in (dismissed_job_ids or []) if str(item or "").strip()}

    docs = list(
        _enriched_collection()
        .find({"expires_at": {"$gt": _utcnow()}}, {"_id": 1, "company_key": 1, "company": 1, "title": 1, "location": 1, "country": 1, "source_site": 1, "job_type": 1, "interval": 1, "job_url": 1, "description_excerpt": 1, "description_present": 1, "is_remote": 1, "work_mode_normalized": 1, "queried_sites": 1, "search_term": 1, "location_query": 1, "hours_old": 1, "min_amount": 1, "max_amount": 1, "currency": 1, "query_hash": 1, "scraped_at": 1, "updated_at": 1, "expires_at": 1, "freshness_bucket": 1, "freshness_score": 1, "language_code": 1, "inferred_seniority": 1, "role_families": 1, "primary_role_family": 1, "domains": 1, "primary_domain": 1, "taxonomy_version": 1, "keywords": 1})
        .sort([("scraped_at", DESCENDING), ("updated_at", DESCENDING)])
        .limit(800)
    )
    scored_jobs = [
        score_enriched_job_for_candidate(doc, candidate_profile=candidate_profile, saved_job_ids=saved_ids)
        for doc in docs
        if str(doc.get("_id") or "") not in dismissed_ids
    ]
    scored_jobs.sort(key=lambda item: (float(item.get("fit_score") or 0), str(item.get("scraped_at") or "")), reverse=True)
    top_jobs = scored_jobs[: max(1, min(60, int(job_limit or 24)))]

    company_keys = [str(item.get("company_key") or "") for item in scored_jobs[:200] if str(item.get("company_key") or "")]
    company_docs_by_id = {
        str(doc.get("_id") or ""): doc
        for doc in _company_collection().find({"_id": {"$in": list(set(company_keys))}})
    }

    ranked_companies: list[dict[str, Any]] = []
    company_job_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for job in scored_jobs[:200]:
        company_job_map[str(job.get("company_key") or "")].append(job)
    for company_key, jobs in company_job_map.items():
        snapshot = company_docs_by_id.get(company_key)
        if not snapshot:
            continue
        avg_fit = sum(float(job.get("fit_score") or 0) for job in jobs[:6]) / max(1, min(6, len(jobs)))
        ranked_companies.append(
            {
                **_serialize_company_snapshot(snapshot),
                "avg_fit_score": round(avg_fit, 1),
                "top_jobs": [
                    {
                        "raw_job_id": job.get("raw_job_id"),
                        "title": job.get("title"),
                        "fit_score": job.get("fit_score"),
                        "action_type": job.get("action_type"),
                    }
                    for job in jobs[:4]
                ],
            }
        )
    ranked_companies.sort(key=lambda item: (float(item.get("avg_fit_score") or 0), int(item.get("open_jobs_count") or 0)), reverse=True)
    ranked_companies = ranked_companies[: max(1, min(30, int(company_limit or 10)))]

    actions: list[dict[str, Any]] = []
    for job in scored_jobs:
        if len(actions) >= max(1, min(50, int(action_limit or 14))):
            break
        if job.get("action_type") == "new_high_fit_job" and float(job.get("fit_score") or 0) >= 76:
            actions.append(
                {
                    "id": f"job:{job['raw_job_id']}",
                    "kind": "new_high_fit_job",
                    "title": f"{job.get('title')} at {job.get('company')}",
                    "subtitle": "Fresh high-fit external role",
                    "score": job.get("fit_score"),
                    "job_id": job.get("raw_job_id"),
                    "company_key": job.get("company_key"),
                    "reason_lines": job.get("fit_reasons") or [],
                    "source_url": job.get("job_url"),
                }
            )
        elif job.get("action_type") == "tailor_now" and float(job.get("fit_score") or 0) >= 72:
            actions.append(
                {
                    "id": f"tailor:{job['raw_job_id']}",
                    "kind": "tailor_now",
                    "title": f"Tailor for {job.get('title')}",
                    "subtitle": "Strong fit and enough detail to draft application",
                    "score": job.get("fit_score"),
                    "job_id": job.get("raw_job_id"),
                    "company_key": job.get("company_key"),
                    "reason_lines": job.get("fit_reasons") or [],
                    "source_url": job.get("job_url"),
                }
            )
        elif job.get("action_type") == "stale_saved_followup":
            actions.append(
                {
                    "id": f"followup:{job['raw_job_id']}",
                    "kind": "stale_saved_followup",
                    "title": f"Re-check saved role: {job.get('title')}",
                    "subtitle": "You saved this earlier and it may still be open",
                    "score": job.get("fit_score"),
                    "job_id": job.get("raw_job_id"),
                    "company_key": job.get("company_key"),
                    "reason_lines": job.get("fit_reasons") or [],
                    "source_url": job.get("job_url"),
                }
            )

    for company in ranked_companies:
        if len(actions) >= max(1, min(50, int(action_limit or 14))):
            break
        if int(company.get("open_jobs_count") or 0) >= 2:
            actions.append(
                {
                    "id": f"company:{company['company_key']}",
                    "kind": "company_cluster",
                    "title": f"{company.get('company')} is hiring across multiple roles",
                    "subtitle": company.get("why_now") or "Cluster of aligned openings",
                    "score": company.get("avg_fit_score"),
                    "company_key": company.get("company_key"),
                    "reason_lines": [
                        f"{company.get('open_jobs_count')} relevant external openings",
                        *(company.get("sample_titles") or [])[:2],
                    ],
                }
            )

    deduped_actions: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for action in actions:
        if action["id"] in seen_ids:
            continue
        seen_ids.add(action["id"])
        deduped_actions.append(action)

    return {
        "meta": {
            "generated_at": _serialize_datetime(_utcnow()),
            "candidate_intent": resolve_candidate_intent_profile(candidate_profile),
            "recommendation_intelligence": get_candidate_recommendation_intelligence(candidate_profile, user_id=str(candidate_profile.get("id") or "")),
            "collections": {
                "raw": config.MONGODB_JOBSPY_COLLECTION,
                "enriched": config.MONGODB_JOBSPY_ENRICHED_COLLECTION,
                "companies": config.MONGODB_JOBSPY_COMPANY_COLLECTION,
            },
            "counts": {
                "raw_jobs_seen": _raw_collection().count_documents({"expires_at": {"$gt": _utcnow()}}),
                "enriched_jobs_scored": len(scored_jobs),
                "companies_ranked": len(ranked_companies),
                "actions": len(deduped_actions[: max(1, min(50, int(action_limit or 14)))]),
                "saved_job_ids": len(saved_ids),
                "dismissed_job_ids": len(dismissed_ids),
            },
        },
        "jobs": top_jobs,
        "companies": ranked_companies,
        "actions": deduped_actions[: max(1, min(50, int(action_limit or 14)))],
    }
