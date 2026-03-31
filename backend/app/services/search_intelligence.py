from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any, Dict, Optional

from ..ai_orchestration.client import (
    AIClientError,
    _extract_json,
    call_primary_with_fallback,
    get_default_fallback_model,
    get_default_primary_model,
)
from ..core.runtime_config import get_active_model_config, get_release_flag

_CACHE_TTL_SECONDS = 900
_CACHE: dict[str, tuple[datetime, dict[str, Any]]] = {}
_CACHE_LOCK = Lock()


def _normalize_search_term_for_backend(input: str) -> str:
    """Normalize search term by removing accents and converting to lowercase."""
    if not input:
        return ""
    normalized = unicodedata.normalize("NFD", input)
    without_accents = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return without_accents.lower().strip()


def _is_enabled(subject_id: Optional[str]) -> bool:
    flag = get_release_flag("search_ai_rewrite_enabled", subject_id=subject_id or "public", default=True)
    return bool(flag.get("effective_enabled", True))


def _cache_key(search_term: str, language: str) -> str:
    return json.dumps({"q": search_term.strip(), "lang": language.strip().lower()}, ensure_ascii=False, sort_keys=True)


def _build_prompt(search_term: str, language: str) -> str:
    return f"""
Rewrite this recruitment search query into the best compact backend query.

Return STRICT JSON only with this schema:
{{
  "normalized_query": "string",
  "intent_role": "string",
  "expanded_terms": ["string"],
  "must_terms": ["string"],
  "language": "{language}"
}}

Rules:
- Keep the original hiring intent exactly.
- Do not broaden to unrelated roles.
- normalized_query must stay short, concrete, and backend-friendly: max 6 tokens.
- Expand abbreviations only when highly likely.
- expanded_terms are optional helper aliases/synonyms, max 6 items.
- must_terms are only hard constraints from the query, max 4 items.
- Preserve licence or certification intent when present.
- Keep the same language as the user query whenever possible.

Query:
{search_term}
""".strip()


def enrich_search_query(search_term: str, language: str = "cs", subject_id: Optional[str] = None) -> Dict[str, Any]:
    raw = str(search_term or "").strip()
    if not raw:
        return {
            "original_query": "",
            "normalized_query": "",
            "backend_query": "",
            "expanded_terms": [],
            "must_terms": [],
            "intent_role": "",
            "used_ai": False,
        }

    if not _is_enabled(subject_id):
        normalized_raw = _normalize_search_term_for_backend(raw)
        backend_query_parts = [raw]
        if normalized_raw and normalized_raw != raw.lower():
            backend_query_parts.append(normalized_raw)
        backend_query = " ".join(backend_query_parts)
        return {
            "original_query": raw,
            "normalized_query": raw,
            "backend_query": backend_query,
            "expanded_terms": [],
            "must_terms": [],
            "intent_role": "",
            "used_ai": False,
            "disabled_by_flag": True,
        }

    key = _cache_key(raw, language)
    now = datetime.now(timezone.utc)
    with _CACHE_LOCK:
        cached = _CACHE.get(key)
        if cached and cached[0] > now:
            return cached[1]

    cfg = get_active_model_config("ai_orchestration", "search_query_rewrite")
    primary_model = cfg.get("primary_model") or get_default_primary_model()
    fallback_model = cfg.get("fallback_model") or get_default_fallback_model()
    generation_config = {
        "temperature": cfg.get("temperature", 0),
        "top_p": cfg.get("top_p", 1),
        "top_k": cfg.get("top_k", 1),
    }

    try:
        result, fallback_used = call_primary_with_fallback(
            _build_prompt(raw, language),
            primary_model,
            fallback_model,
            generation_config=generation_config,
        )
        parsed = _extract_json(result.text)
        normalized_query = str(parsed.get("normalized_query") or raw).strip()
        expanded_terms = [str(item).strip() for item in (parsed.get("expanded_terms") or []) if str(item).strip()][:6]
        must_terms = [str(item).strip() for item in (parsed.get("must_terms") or []) if str(item).strip()][:4]
        intent_role = str(parsed.get("intent_role") or "").strip()
        backend_query_parts = [raw]
        normalized_raw = _normalize_search_term_for_backend(raw)
        if normalized_raw and normalized_raw != raw.lower():
            backend_query_parts.append(normalized_raw)
        if normalized_query and normalized_query != raw and normalized_query not in backend_query_parts:
            backend_query_parts.append(normalized_query)
        backend_query = " ".join(backend_query_parts)
        payload = {
            "original_query": raw,
            "normalized_query": normalized_query or raw,
            "backend_query": backend_query,
            "expanded_terms": expanded_terms,
            "must_terms": must_terms,
            "intent_role": intent_role,
            "used_ai": True,
            "model_used": result.model_name,
            "fallback_used": fallback_used,
        }
    except (AIClientError, ValueError, TypeError, json.JSONDecodeError) as exc:
        normalized_raw = _normalize_search_term_for_backend(raw)
        backend_query_parts = [raw]
        if normalized_raw and normalized_raw != raw.lower():
            backend_query_parts.append(normalized_raw)
        backend_query = " ".join(backend_query_parts)
        payload = {
            "original_query": raw,
            "normalized_query": raw,
            "backend_query": backend_query,
            "expanded_terms": [],
            "must_terms": [],
            "intent_role": "",
            "used_ai": False,
            "error": str(exc),
        }

    with _CACHE_LOCK:
        _CACHE[key] = (now + timedelta(seconds=_CACHE_TTL_SECONDS), payload)
    return payload
