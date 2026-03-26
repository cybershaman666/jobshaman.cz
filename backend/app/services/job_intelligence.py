from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from ..ai_orchestration.client import (
    AIClientError,
    _extract_json,
    call_primary_with_fallback,
    get_default_fallback_model,
    get_default_primary_model,
)
from ..core import config
from ..matching_engine.role_taxonomy import DOMAIN_KEYWORDS, ROLE_FAMILY_KEYWORDS
from ..services.candidate_intent import resolve_candidate_intent_profile
from ..services.jobs_postgres_store import _connect, _ensure_schema, _json_dumps, jobs_postgres_enabled

_MODULE_DIR = Path(__file__).resolve().parent
_TAXONOMY_PATH = _MODULE_DIR / "job_intelligence_taxonomy.json"
_LANGUAGE_STOPWORDS: dict[str, tuple[str, ...]] = {
    "cs": ("zakaznik", "prace", "pozice", "hledame", "nabidka", "praxe", "tym"),
    "sk": ("zakaznik", "praca", "pozicia", "hladame", "ponuka", "praxe", "tim"),
    "de": ("und", "der", "die", "das", "mit", "fur", "stelle", "erfahrung"),
    "pl": ("praca", "stanowisko", "zespol", "klient", "doswiadczenie", "oraz"),
    "en": ("the", "and", "with", "experience", "role", "team", "customer"),
}
_COUNTRY_TO_MARKET = {
    "CZ": "cz",
    "SK": "sk",
    "PL": "pl",
    "DE": "de",
    "AT": "at",
}
_COUNTRY_TO_LANGUAGE = {
    "CZ": "cs",
    "SK": "sk",
    "PL": "pl",
    "DE": "de",
    "AT": "de",
}
_GLOBAL_LANGUAGE_ORDER = ("en", "cs", "sk", "de", "pl")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9\s/+.#-]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _tokenize(value: Any) -> list[str]:
    normalized = _normalize_text(value)
    if not normalized:
        return []
    return [token for token in normalized.split(" ") if len(token) >= 2]


@lru_cache(maxsize=1)
def _load_taxonomy() -> dict[str, Any]:
    payload = json.loads(_TAXONOMY_PATH.read_text(encoding="utf-8"))
    roles = payload.get("roles") if isinstance(payload.get("roles"), list) else []
    normalized_roles: list[dict[str, Any]] = []
    for raw_role in roles:
        if not isinstance(raw_role, dict):
            continue
        role_id = str(raw_role.get("id") or "").strip()
        canonical_label = str(raw_role.get("canonical_label") or "").strip()
        role_family = str(raw_role.get("role_family") or "").strip().lower()
        domain_key = str(raw_role.get("domain_key") or "").strip().lower()
        if not role_id or not canonical_label or not role_family or not domain_key:
            continue
        aliases_raw = raw_role.get("aliases") if isinstance(raw_role.get("aliases"), dict) else {}
        aliases: dict[str, list[str]] = {}
        for language, values in aliases_raw.items():
            code = str(language or "").strip().lower()
            if not code:
                continue
            entries = []
            seen: set[str] = set()
            for value in values or []:
                text = str(value or "").strip()
                normalized = _normalize_text(text)
                if not text or not normalized or normalized in seen:
                    continue
                seen.add(normalized)
                entries.append(text)
            if entries:
                aliases[code] = entries
        normalized_roles.append(
            {
                "id": role_id,
                "canonical_label": canonical_label,
                "role_family": role_family,
                "domain_key": domain_key,
                "default_seniority": str(raw_role.get("default_seniority") or "mid").strip().lower(),
                "metadata": raw_role.get("metadata") if isinstance(raw_role.get("metadata"), dict) else {},
                "aliases": aliases,
            }
        )
    return {
        "taxonomy_version": str(payload.get("taxonomy_version") or "job-intelligence-v1").strip(),
        "roles": normalized_roles,
    }


@lru_cache(maxsize=1)
def _roles_by_id() -> dict[str, dict[str, Any]]:
    return {str(role["id"]): role for role in _load_taxonomy()["roles"]}


@lru_cache(maxsize=1)
def _alias_index() -> dict[str, list[dict[str, Any]]]:
    index: dict[str, list[dict[str, Any]]] = {}
    for role in _load_taxonomy()["roles"]:
        role_id = str(role["id"])
        canonical_label = str(role["canonical_label"])
        index.setdefault(_normalize_text(canonical_label), []).append(
            {"role_id": role_id, "language_code": "en", "alias_display": canonical_label, "weight": 1.0}
        )
        for language, aliases in (role.get("aliases") or {}).items():
            for alias in aliases:
                normalized = _normalize_text(alias)
                if not normalized:
                    continue
                index.setdefault(normalized, []).append(
                    {"role_id": role_id, "language_code": language, "alias_display": alias, "weight": 1.0}
                )
    return index


def _detect_language(job_row: dict[str, Any]) -> str:
    explicit = _normalize_text(job_row.get("language_code"))
    if explicit in {"cs", "sk", "de", "pl", "en"}:
        return explicit
    country_code = str(job_row.get("country_code") or "").strip().upper()
    text = _normalize_text(" ".join([str(job_row.get("title") or ""), str(job_row.get("description") or "")]))
    best_language = _COUNTRY_TO_LANGUAGE.get(country_code)
    best_score = 0
    for language, words in _LANGUAGE_STOPWORDS.items():
        score = sum(1 for word in words if word in text)
        if score > best_score:
            best_language = language
            best_score = score
    return best_language or "en"


def _infer_market_code(job_row: dict[str, Any], work_mode: str) -> str:
    country_code = str(job_row.get("country_code") or "").strip().upper()
    if country_code in _COUNTRY_TO_MARKET:
        return _COUNTRY_TO_MARKET[country_code]
    if work_mode == "remote":
        return "remote"
    return "global"


def _infer_work_mode(job_row: dict[str, Any]) -> str:
    text = _normalize_text(
        " ".join(
            [
                str(job_row.get("work_model") or ""),
                str(job_row.get("work_type") or ""),
                str(job_row.get("location") or ""),
                str(job_row.get("title") or ""),
                str(job_row.get("description") or ""),
            ]
        )
    )
    if any(term in text for term in ("remote", "home office", "work from home", "fully remote", "remote first")):
        return "remote"
    if "hybrid" in text:
        return "hybrid"
    return "onsite"


def _infer_seniority(text: Any, default: Optional[str] = None) -> str:
    normalized = _normalize_text(text)
    if any(token in normalized for token in ("head", "director", "principal", "team lead", "lead ")):
        return "lead"
    if any(token in normalized for token in ("senior", "staff", "expert")):
        return "senior"
    if any(token in normalized for token in ("junior", "associate", "entry", "trainee", "intern", "graduate")):
        return "junior"
    if any(token in normalized for token in ("manager", "owner", "specialist", "analyst", "developer", "engineer", "coordinator", "recruiter")):
        return default or "mid"
    return default or "mid"


def _language_priority(detected_language: str, market_code: str) -> list[str]:
    priority: list[str] = []
    if detected_language:
        priority.append(detected_language)
    if market_code == "at":
        priority.append("de")
    if market_code == "cz":
        priority.extend(["cs", "sk"])
    elif market_code == "sk":
        priority.extend(["sk", "cs"])
    elif market_code == "de":
        priority.append("de")
    elif market_code == "pl":
        priority.append("pl")
    priority.extend(_GLOBAL_LANGUAGE_ORDER)
    deduped: list[str] = []
    seen: set[str] = set()
    for item in priority:
        if item in seen:
            continue
        seen.add(item)
        deduped.append(item)
    return deduped


def _score_alias_candidate(
    *,
    title_text: str,
    body_text: str,
    normalized_title: str,
    alias_text: str,
    language_priority: list[str],
    alias_language: str,
) -> float:
    alias_normalized = _normalize_text(alias_text)
    if not alias_normalized:
        return 0.0
    score = 0.0
    if normalized_title == alias_normalized:
        score += 1.0
    elif normalized_title.startswith(alias_normalized) or normalized_title.endswith(alias_normalized):
        score += 0.92
    elif alias_normalized in normalized_title:
        score += 0.86
    elif alias_normalized in title_text:
        score += 0.74
    elif alias_normalized in body_text:
        score += 0.38

    alias_tokens = [token for token in alias_normalized.split(" ") if len(token) >= 2]
    if alias_tokens:
        overlap = sum(1 for token in alias_tokens if token in normalized_title)
        body_overlap = sum(1 for token in alias_tokens if token in body_text)
        score += min(0.34, overlap * 0.12)
        score += min(0.16, body_overlap * 0.04)

    if alias_language in language_priority:
        language_rank = language_priority.index(alias_language)
        score += max(0.0, 0.12 - (language_rank * 0.02))
    elif alias_language == "en":
        score += 0.02
    else:
        score -= 0.06
    return max(0.0, min(1.24, score))


def _domain_fallback_score(text: str, domain_key: str) -> float:
    keywords = DOMAIN_KEYWORDS.get(domain_key) or []
    if not keywords:
        return 0.0
    hits = sum(1 for keyword in keywords if _normalize_text(keyword) in text)
    if hits <= 0:
        return 0.0
    return min(0.48, 0.14 + (hits * 0.06))


def _family_fallback_score(text: str, role_family: str) -> float:
    keywords = ROLE_FAMILY_KEYWORDS.get(role_family) or []
    hits = sum(1 for keyword in keywords if _normalize_text(keyword) in text)
    if hits <= 0:
        return 0.0
    return min(0.42, 0.12 + (hits * 0.05))


def _metadata_keyword_score(text: str, keywords: list[str]) -> float:
    if not keywords:
        return 0.0
    hits = sum(1 for keyword in keywords if _normalize_text(keyword) in text)
    if hits <= 0:
        return 0.0
    return min(0.4, 0.12 + (hits * 0.06))


def _rank_role_candidates(job_row: dict[str, Any], *, detected_language: str, market_code: str) -> list[dict[str, Any]]:
    title_text = _normalize_text(job_row.get("title"))
    body_text = _normalize_text(
        " ".join(
            [
                str(job_row.get("description") or ""),
                str(job_row.get("role_summary") or ""),
                str(job_row.get("location") or ""),
                " ".join(str(item) for item in (job_row.get("tags") or [])),
            ]
        )
    )
    language_priority = _language_priority(detected_language, market_code)
    ranked: list[dict[str, Any]] = []
    for role in _load_taxonomy()["roles"]:
        best_score = 0.0
        best_alias = str(role["canonical_label"])
        best_language = "en"
        for language, aliases in (role.get("aliases") or {}).items():
            for alias in aliases:
                score = _score_alias_candidate(
                    title_text=title_text,
                    body_text=body_text,
                    normalized_title=title_text,
                    alias_text=alias,
                    language_priority=language_priority,
                    alias_language=language,
                )
                if score > best_score:
                    best_score = score
                    best_alias = alias
                    best_language = language
        score = best_score
        score += _family_fallback_score(f"{title_text}\n{body_text}", str(role.get("role_family") or ""))
        score += _domain_fallback_score(f"{title_text}\n{body_text}", str(role.get("domain_key") or ""))
        score += _metadata_keyword_score(
            f"{title_text}\n{body_text}",
            [str(item) for item in ((role.get("metadata") or {}).get("keywords") or []) if str(item).strip()],
        )
        if title_text == _normalize_text(role["canonical_label"]):
            score += 0.2
        if score <= 0:
            continue
        metadata_keywords = [
            _normalize_text(item)
            for item in ((role.get("metadata") or {}).get("keywords") or [])
            if _normalize_text(item)
        ]
        specificity = len(set(_tokenize(best_alias)))
        specificity += sum(1 for keyword in metadata_keywords if keyword and keyword in f"{title_text}\n{body_text}") * 0.2
        ranked.append(
            {
                "role_id": role["id"],
                "canonical_role": role["canonical_label"],
                "role_family": role["role_family"],
                "domain_key": role["domain_key"],
                "default_seniority": role["default_seniority"],
                "confidence": max(0.0, min(1.0, round(score, 4))),
                "specificity": round(float(specificity), 4),
                "matched_alias": best_alias,
                "matched_language": best_language,
            }
        )
    ranked.sort(
        key=lambda item: (float(item["confidence"]), float(item.get("specificity") or 0.0), item["canonical_role"]),
        reverse=True,
    )
    return ranked


def _ai_available() -> bool:
    return bool(config.MISTRAL_API_KEY or config.GEMINI_API_KEY)


def _ai_exception_candidate(job_row: dict[str, Any], candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not _ai_available():
        return None
    candidate_rows = []
    for item in candidates[:8]:
        candidate_rows.append(
            {
                "role_id": item["role_id"],
                "canonical_role": item["canonical_role"],
                "role_family": item["role_family"],
                "domain_key": item["domain_key"],
                "confidence": item["confidence"],
            }
        )
    if not candidate_rows:
        return None
    prompt = f"""
Map this job to ONE canonical role from the provided shortlist.

Return STRICT JSON only:
{{
  "role_id": "string",
  "confidence": 0.0,
  "reason": "string"
}}

Rules:
- Choose only from the provided shortlist.
- Prefer title-first interpretation over generic manager words.
- Use description only to disambiguate.
- If the title suggests AI/product, do not collapse it into marketing.

Job:
{json.dumps({
    "title": job_row.get("title"),
    "description": str(job_row.get("description") or "")[:2400],
    "location": job_row.get("location"),
    "country_code": job_row.get("country_code"),
    "language_code": job_row.get("language_code"),
}, ensure_ascii=False)}

Shortlist:
{json.dumps(candidate_rows, ensure_ascii=False)}
""".strip()
    try:
        result, _ = call_primary_with_fallback(
            prompt,
            get_default_primary_model(),
            get_default_fallback_model(),
            generation_config={"temperature": 0, "top_p": 1, "top_k": 1},
        )
        parsed = _extract_json(result.text)
    except (AIClientError, ValueError, TypeError, json.JSONDecodeError):
        return None
    role_id = str(parsed.get("role_id") or "").strip()
    if role_id not in _roles_by_id():
        return None
    confidence = max(0.0, min(1.0, float(parsed.get("confidence") or 0.0)))
    if confidence <= 0:
        return None
    role = _roles_by_id()[role_id]
    return {
        "role_id": role_id,
        "canonical_role": role["canonical_label"],
        "role_family": role["role_family"],
        "domain_key": role["domain_key"],
        "default_seniority": role["default_seniority"],
        "confidence": confidence,
        "matched_alias": str(parsed.get("reason") or "ai_exception"),
        "matched_language": "ai",
    }


def _extract_skill_tokens(job_row: dict[str, Any]) -> list[str]:
    text = _normalize_text(
        " ".join(
            [
                str(job_row.get("title") or ""),
                str(job_row.get("description") or ""),
                " ".join(str(item) for item in (job_row.get("tags") or [])),
            ]
        )
    )
    tokens = []
    seen: set[str] = set()
    for token in text.split(" "):
        if len(token) < 4:
            continue
        if token in seen:
            continue
        if token in {"with", "your", "team", "work", "role", "jobs", "will", "have", "that"}:
            continue
        seen.add(token)
        tokens.append(token)
        if len(tokens) >= 16:
            break
    return tokens


def _cluster_key(*, market_code: str, domain_key: str, role_family: str, seniority: str, work_mode: str) -> str:
    parts = [
        _normalize_text(market_code or "global").replace(" ", "-") or "global",
        _normalize_text(domain_key or "unknown").replace(" ", "-") or "unknown",
        _normalize_text(role_family or "unknown").replace(" ", "-") or "unknown",
        _normalize_text(seniority or "mid").replace(" ", "-") or "mid",
        _normalize_text(work_mode or "onsite").replace(" ", "-") or "onsite",
    ]
    return "__".join(parts)


def map_job_to_intelligence(job_row: dict[str, Any]) -> dict[str, Any]:
    job_id = str(job_row.get("id") or "").strip()
    if not job_id:
        raise ValueError("job_row.id is required")
    detected_language = _detect_language(job_row)
    work_mode = _infer_work_mode(job_row)
    market_code = _infer_market_code(job_row, work_mode)
    ranked_candidates = _rank_role_candidates(job_row, detected_language=detected_language, market_code=market_code)
    top_candidate = ranked_candidates[0] if ranked_candidates else None
    mapping_source = "rules"

    if top_candidate and float(top_candidate.get("confidence") or 0.0) < float(config.JOB_INTELLIGENCE_AI_THRESHOLD or 0.56):
        ai_candidate = _ai_exception_candidate(job_row, ranked_candidates[:6])
        if ai_candidate and float(ai_candidate.get("confidence") or 0.0) >= float(top_candidate.get("confidence") or 0.0):
            top_candidate = ai_candidate
            mapping_source = "rules+ai_exception"

    if not top_candidate and ranked_candidates:
        top_candidate = ranked_candidates[0]

    if not top_candidate:
        normalized_title = _normalize_text(job_row.get("title"))
        fallback_role = {
            "role_id": "unknown",
            "canonical_role": str(job_row.get("title") or "Unknown role").strip() or "Unknown role",
            "role_family": "unknown",
            "domain_key": "operations",
            "default_seniority": "mid",
            "confidence": 0.22,
            "matched_alias": normalized_title or "fallback",
            "matched_language": detected_language,
        }
        top_candidate = fallback_role
        mapping_source = "fallback"

    seniority = _infer_seniority(
        " ".join(
            [
                str(job_row.get("title") or ""),
                str(job_row.get("description") or ""),
                str(job_row.get("role_summary") or ""),
            ]
        ),
        default=str(top_candidate.get("default_seniority") or "mid"),
    )
    secondary_candidates = [
        {
            "role_id": item["role_id"],
            "canonical_role": item["canonical_role"],
            "role_family": item["role_family"],
            "domain_key": item["domain_key"],
            "confidence": item["confidence"],
        }
        for item in ranked_candidates[:3]
    ]
    return {
        "job_id": job_id,
        "canonical_role_id": str(top_candidate.get("role_id") or ""),
        "canonical_role": str(top_candidate.get("canonical_role") or "").strip(),
        "role_family": str(top_candidate.get("role_family") or "unknown").strip(),
        "domain_key": str(top_candidate.get("domain_key") or "operations").strip(),
        "seniority": seniority,
        "work_mode": work_mode,
        "language_code": detected_language,
        "market_code": market_code,
        "cluster_key": _cluster_key(
            market_code=market_code,
            domain_key=str(top_candidate.get("domain_key") or "operations"),
            role_family=str(top_candidate.get("role_family") or "unknown"),
            seniority=seniority,
            work_mode=work_mode,
        ),
        "mapping_confidence": float(top_candidate.get("confidence") or 0.0),
        "mapping_source": mapping_source,
        "normalized_title": _normalize_text(job_row.get("title")),
        "extracted_keywords": _tokenize(
            " ".join(
                [
                    str(job_row.get("title") or ""),
                    str(job_row.get("role_summary") or ""),
                    str(job_row.get("location") or ""),
                    " ".join(str(item) for item in (job_row.get("tags") or [])),
                ]
            )
        )[:24],
        "extracted_skills": _extract_skill_tokens(job_row),
        "secondary_candidates": secondary_candidates,
        "taxonomy_version": str(_load_taxonomy()["taxonomy_version"]),
        "mapped_at": _utcnow(),
        "source_updated_at": job_row.get("updated_at") if isinstance(job_row.get("updated_at"), datetime) else _utcnow(),
        "mapping_notes": {
            "matched_alias": top_candidate.get("matched_alias"),
            "matched_language": top_candidate.get("matched_language"),
        },
    }


def _ensure_job_intelligence_schema() -> None:
    if not jobs_postgres_enabled():
        return
    _ensure_schema()
    conn = _connect()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {config.JOBS_POSTGRES_CANONICAL_ROLES_TABLE} (
                id TEXT PRIMARY KEY,
                canonical_label TEXT NOT NULL,
                role_family TEXT NOT NULL,
                domain_key TEXT NOT NULL,
                default_seniority TEXT,
                metadata JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                taxonomy_version TEXT NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {config.JOBS_POSTGRES_CANONICAL_ROLE_ALIASES_TABLE} (
                canonical_role_id TEXT NOT NULL,
                language_code TEXT NOT NULL,
                market_code TEXT,
                alias_display TEXT NOT NULL,
                alias_normalized TEXT NOT NULL,
                match_weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
                taxonomy_version TEXT NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (canonical_role_id, language_code, alias_normalized)
            )
            """
        )
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {config.JOBS_POSTGRES_JOB_INTELLIGENCE_TABLE} (
                job_id TEXT PRIMARY KEY,
                canonical_role_id TEXT,
                canonical_role TEXT NOT NULL,
                role_family TEXT NOT NULL,
                domain_key TEXT NOT NULL,
                seniority TEXT,
                work_mode TEXT,
                language_code TEXT,
                market_code TEXT,
                cluster_key TEXT,
                normalized_title TEXT,
                extracted_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
                extracted_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
                secondary_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
                mapping_confidence DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                mapping_source TEXT NOT NULL DEFAULT 'rules',
                mapping_notes JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                taxonomy_version TEXT NOT NULL,
                mapped_at TIMESTAMPTZ NOT NULL,
                source_updated_at TIMESTAMPTZ NOT NULL
            )
            """
        )
        cur.execute(
            f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_JOB_INTELLIGENCE_TABLE}_cluster_key ON {config.JOBS_POSTGRES_JOB_INTELLIGENCE_TABLE} (cluster_key)"
        )
        cur.execute(
            f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_JOB_INTELLIGENCE_TABLE}_domain_family ON {config.JOBS_POSTGRES_JOB_INTELLIGENCE_TABLE} (domain_key, role_family)"
        )
        cur.execute(
            f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_JOB_INTELLIGENCE_TABLE}_language_market ON {config.JOBS_POSTGRES_JOB_INTELLIGENCE_TABLE} (language_code, market_code)"
        )
        cur.execute(
            f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_JOB_INTELLIGENCE_TABLE}_confidence_mapped_at ON {config.JOBS_POSTGRES_JOB_INTELLIGENCE_TABLE} (mapping_confidence DESC, mapped_at DESC)"
        )


def _seed_taxonomy_tables() -> None:
    if not jobs_postgres_enabled():
        return
    _ensure_job_intelligence_schema()
    taxonomy = _load_taxonomy()
    conn = _connect()
    role_rows = []
    alias_rows = []
    now = _utcnow()
    for role in taxonomy["roles"]:
        role_rows.append(
            {
                "id": role["id"],
                "canonical_label": role["canonical_label"],
                "role_family": role["role_family"],
                "domain_key": role["domain_key"],
                "default_seniority": role["default_seniority"],
                "metadata": _json_dumps(role.get("metadata") or {}),
                "taxonomy_version": taxonomy["taxonomy_version"],
                "updated_at": now,
            }
        )
        for language, aliases in (role.get("aliases") or {}).items():
            for alias in aliases:
                alias_rows.append(
                    {
                        "canonical_role_id": role["id"],
                        "language_code": language,
                        "market_code": None,
                        "alias_display": alias,
                        "alias_normalized": _normalize_text(alias),
                        "match_weight": 1.0,
                        "taxonomy_version": taxonomy["taxonomy_version"],
                        "updated_at": now,
                    }
                )
    with conn.cursor() as cur:
        cur.executemany(
            f"""
            INSERT INTO {config.JOBS_POSTGRES_CANONICAL_ROLES_TABLE}
                (id, canonical_label, role_family, domain_key, default_seniority, metadata, taxonomy_version, updated_at)
            VALUES (%(id)s, %(canonical_label)s, %(role_family)s, %(domain_key)s, %(default_seniority)s, %(metadata)s::jsonb, %(taxonomy_version)s, %(updated_at)s)
            ON CONFLICT (id) DO UPDATE SET
                canonical_label = EXCLUDED.canonical_label,
                role_family = EXCLUDED.role_family,
                domain_key = EXCLUDED.domain_key,
                default_seniority = EXCLUDED.default_seniority,
                metadata = EXCLUDED.metadata,
                taxonomy_version = EXCLUDED.taxonomy_version,
                updated_at = EXCLUDED.updated_at
            """,
            role_rows,
        )
        cur.executemany(
            f"""
            INSERT INTO {config.JOBS_POSTGRES_CANONICAL_ROLE_ALIASES_TABLE}
                (canonical_role_id, language_code, market_code, alias_display, alias_normalized, match_weight, taxonomy_version, updated_at)
            VALUES (%(canonical_role_id)s, %(language_code)s, %(market_code)s, %(alias_display)s, %(alias_normalized)s, %(match_weight)s, %(taxonomy_version)s, %(updated_at)s)
            ON CONFLICT (canonical_role_id, language_code, alias_normalized) DO UPDATE SET
                alias_display = EXCLUDED.alias_display,
                market_code = EXCLUDED.market_code,
                match_weight = EXCLUDED.match_weight,
                taxonomy_version = EXCLUDED.taxonomy_version,
                updated_at = EXCLUDED.updated_at
            """,
            alias_rows,
        )


def _jobs_needing_refresh(
    *,
    job_ids: Optional[list[str]] = None,
    limit: Optional[int] = None,
    force: bool = False,
) -> list[dict[str, Any]]:
    if not jobs_postgres_enabled():
        return []
    _ensure_job_intelligence_schema()
    conn = _connect()
    where_parts = []
    params: list[Any] = []
    if job_ids:
        where_parts.append("j.id = ANY(%s)")
        params.append([str(item).strip() for item in job_ids if str(item).strip()])
    if not force:
        where_parts.append("(ji.job_id IS NULL OR ji.source_updated_at < j.updated_at)")
    where_parts.append("COALESCE(j.status, 'active') = 'active'")
    where_parts.append("COALESCE(j.legality_status, 'legal') = 'legal'")
    where_sql = " AND ".join(where_parts) if where_parts else "TRUE"
    safe_limit = max(1, int(limit or config.JOB_INTELLIGENCE_BATCH_LIMIT or 4000))
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT j.id, j.title, j.company, j.location, j.description, j.role_summary, j.work_model, j.work_type,
                   j.country_code, j.language_code, j.tags, j.payload_json, j.updated_at
            FROM {config.JOBS_POSTGRES_JOBS_TABLE} j
            LEFT JOIN {config.JOBS_POSTGRES_JOB_INTELLIGENCE_TABLE} ji
              ON ji.job_id = j.id
            WHERE {where_sql}
            ORDER BY j.updated_at DESC
            LIMIT %s
            """,
            [*params, safe_limit],
        )
        rows = cur.fetchall() or []
    out: list[dict[str, Any]] = []
    for row in rows:
        payload = row.get("payload_json")
        if isinstance(payload, dict):
            doc = dict(payload)
        else:
            doc = {
                "id": row.get("id"),
                "title": row.get("title"),
                "company": row.get("company"),
                "location": row.get("location"),
                "description": row.get("description"),
                "role_summary": row.get("role_summary"),
                "work_model": row.get("work_model"),
                "work_type": row.get("work_type"),
                "country_code": row.get("country_code"),
                "language_code": row.get("language_code"),
                "tags": row.get("tags"),
                "updated_at": row.get("updated_at"),
            }
        doc["updated_at"] = row.get("updated_at")
        out.append(doc)
    return out


def _upsert_job_intelligence_rows(rows: list[dict[str, Any]]) -> int:
    if not rows or not jobs_postgres_enabled():
        return 0
    _ensure_job_intelligence_schema()
    conn = _connect()
    with conn.cursor() as cur:
        cur.executemany(
            f"""
            INSERT INTO {config.JOBS_POSTGRES_JOB_INTELLIGENCE_TABLE}
                (job_id, canonical_role_id, canonical_role, role_family, domain_key, seniority, work_mode, language_code, market_code,
                 cluster_key, normalized_title, extracted_keywords, extracted_skills, secondary_candidates, mapping_confidence,
                 mapping_source, mapping_notes, taxonomy_version, mapped_at, source_updated_at)
            VALUES (
                %(job_id)s, %(canonical_role_id)s, %(canonical_role)s, %(role_family)s, %(domain_key)s, %(seniority)s, %(work_mode)s,
                %(language_code)s, %(market_code)s, %(cluster_key)s, %(normalized_title)s, %(extracted_keywords)s::jsonb,
                %(extracted_skills)s::jsonb, %(secondary_candidates)s::jsonb, %(mapping_confidence)s, %(mapping_source)s,
                %(mapping_notes)s::jsonb, %(taxonomy_version)s, %(mapped_at)s, %(source_updated_at)s
            )
            ON CONFLICT (job_id) DO UPDATE SET
                canonical_role_id = EXCLUDED.canonical_role_id,
                canonical_role = EXCLUDED.canonical_role,
                role_family = EXCLUDED.role_family,
                domain_key = EXCLUDED.domain_key,
                seniority = EXCLUDED.seniority,
                work_mode = EXCLUDED.work_mode,
                language_code = EXCLUDED.language_code,
                market_code = EXCLUDED.market_code,
                cluster_key = EXCLUDED.cluster_key,
                normalized_title = EXCLUDED.normalized_title,
                extracted_keywords = EXCLUDED.extracted_keywords,
                extracted_skills = EXCLUDED.extracted_skills,
                secondary_candidates = EXCLUDED.secondary_candidates,
                mapping_confidence = EXCLUDED.mapping_confidence,
                mapping_source = EXCLUDED.mapping_source,
                mapping_notes = EXCLUDED.mapping_notes,
                taxonomy_version = EXCLUDED.taxonomy_version,
                mapped_at = EXCLUDED.mapped_at,
                source_updated_at = EXCLUDED.source_updated_at
            """,
            [
                {
                    **row,
                    "extracted_keywords": _json_dumps(row.get("extracted_keywords") or []),
                    "extracted_skills": _json_dumps(row.get("extracted_skills") or []),
                    "secondary_candidates": _json_dumps(row.get("secondary_candidates") or []),
                    "mapping_notes": _json_dumps(row.get("mapping_notes") or {}),
                }
                for row in rows
            ],
        )
    return len(rows)


def refresh_job_intelligence(
    *,
    job_ids: Optional[list[str]] = None,
    limit: Optional[int] = None,
    force: bool = False,
) -> dict[str, Any]:
    if not jobs_postgres_enabled():
        return {"processed": 0, "upserted": 0, "failed": 0, "taxonomy_version": _load_taxonomy()["taxonomy_version"]}
    _seed_taxonomy_tables()
    jobs = _jobs_needing_refresh(job_ids=job_ids, limit=limit, force=force)
    processed = 0
    failed = 0
    rows: list[dict[str, Any]] = []
    for job in jobs:
        processed += 1
        try:
            rows.append(map_job_to_intelligence(job))
        except Exception:
            failed += 1
    upserted = _upsert_job_intelligence_rows(rows)
    return {
        "processed": processed,
        "upserted": upserted,
        "failed": failed,
        "taxonomy_version": _load_taxonomy()["taxonomy_version"],
    }


def get_job_intelligence(job_ids: list[str]) -> dict[str, dict[str, Any]]:
    normalized_ids = [str(item).strip() for item in (job_ids or []) if str(item).strip()]
    if not normalized_ids or not jobs_postgres_enabled():
        return {}
    _ensure_job_intelligence_schema()
    conn = _connect()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT job_id, canonical_role_id, canonical_role, role_family, domain_key, seniority, work_mode,
                   language_code, market_code, cluster_key, normalized_title, extracted_keywords, extracted_skills,
                   secondary_candidates, mapping_confidence, mapping_source, mapping_notes, taxonomy_version, mapped_at, source_updated_at
            FROM {config.JOBS_POSTGRES_JOB_INTELLIGENCE_TABLE}
            WHERE job_id = ANY(%s)
            """,
            (normalized_ids,),
        )
        rows = cur.fetchall() or []
    return {str(row.get("job_id")): dict(row) for row in rows if row.get("job_id")}


def get_job_intelligence_for_jobs(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not jobs:
        return jobs
    intelligence_by_id = get_job_intelligence([str(job.get("id") or "") for job in jobs])
    enriched: list[dict[str, Any]] = []
    for job in jobs:
        copy = dict(job)
        job_id = str(copy.get("id") or "")
        if job_id and job_id in intelligence_by_id:
            copy["job_intelligence"] = intelligence_by_id[job_id]
        enriched.append(copy)
    return enriched


def _map_role_text_to_target(role_text: str, preferred_domain: Optional[str] = None) -> dict[str, Any] | None:
    normalized_text = _normalize_text(role_text)
    if not normalized_text:
        return None
    dummy_job = {
        "id": "candidate-target",
        "title": role_text,
        "description": role_text,
        "country_code": "",
        "language_code": "",
        "work_model": "",
        "work_type": "",
        "tags": [],
    }
    candidates = _rank_role_candidates(dummy_job, detected_language="en", market_code="global")
    if preferred_domain:
        candidates.sort(
            key=lambda item: (
                1 if str(item.get("domain_key") or "") == str(preferred_domain or "") else 0,
                float(item.get("confidence") or 0.0),
            ),
            reverse=True,
        )
    return candidates[0] if candidates else None


def resolve_candidate_job_targets(candidate_profile: dict[str, Any], intelligence: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    profile = candidate_profile if isinstance(candidate_profile, dict) else {}
    intent = resolve_candidate_intent_profile(profile)
    preferences = profile.get("preferences") if isinstance(profile.get("preferences"), dict) else {}
    search_profile = preferences.get("searchProfile") if isinstance(preferences.get("searchProfile"), dict) else {}
    target_roles = []
    for raw in (
        (intelligence or {}).get("target_roles") or []
    ):
        text = str(raw or "").strip()
        if text:
            target_roles.append(text)
    for raw in [
        intent.get("target_role"),
        intent.get("inferred_target_role"),
        profile.get("job_title"),
        preferences.get("desired_role"),
    ]:
        text = str(raw or "").strip()
        if text and text not in target_roles:
            target_roles.append(text)
    canonical_target_roles: list[str] = []
    canonical_role_families: list[str] = []
    canonical_domains: list[str] = []
    preferred_domain = str(intent.get("primary_domain") or "").strip() or None
    for role_text in target_roles[:6]:
        mapped = _map_role_text_to_target(role_text, preferred_domain=preferred_domain)
        if not mapped:
            continue
        canonical_role = str(mapped.get("canonical_role") or "")
        role_family = str(mapped.get("role_family") or "")
        domain_key = str(mapped.get("domain_key") or "")
        if canonical_role and canonical_role not in canonical_target_roles:
            canonical_target_roles.append(canonical_role)
        if role_family and role_family not in canonical_role_families:
            canonical_role_families.append(role_family)
        if domain_key and domain_key not in canonical_domains:
            canonical_domains.append(domain_key)
    preferred_languages = []
    for raw in list(search_profile.get("remoteLanguageCodes") or []):
        code = str(raw or "").strip().lower()
        if code and code not in preferred_languages:
            preferred_languages.append(code)
    if not preferred_languages:
        locale = str(profile.get("preferred_locale") or "").strip().lower()
        if locale:
            preferred_languages.append(locale.split("-", 1)[0])
    preferred_market = (
        str(search_profile.get("preferredCountryCode") or "").strip().lower()
        or str(profile.get("preferred_country_code") or "").strip().lower()
        or None
    )
    if preferred_market:
        preferred_market = preferred_market.replace("_", "-")
    return {
        "canonical_target_roles": canonical_target_roles[:4],
        "canonical_role_families": canonical_role_families[:6],
        "canonical_domains": canonical_domains[:4],
        "preferred_languages": preferred_languages[:4],
        "preferred_market": preferred_market,
    }
