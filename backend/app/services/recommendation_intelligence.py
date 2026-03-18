from __future__ import annotations

import hashlib
import json
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
from .candidate_intent import get_domain_keywords, resolve_candidate_intent_profile

_CACHE_TTL_SECONDS = 3600
_CACHE: dict[str, tuple[datetime, dict[str, Any]]] = {}
_CACHE_LOCK = Lock()


def _norm(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def _clip_list(values: Any, limit: int) -> list[str]:
    if not isinstance(values, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in values:
        text = _norm(item).lower()
        if not text or text in seen:
            continue
        seen.add(text)
        out.append(text)
    return out[:limit]


def _fallback(candidate_profile: Dict[str, Any]) -> Dict[str, Any]:
    intent = resolve_candidate_intent_profile(candidate_profile)
    primary_domain = str(intent.get("primary_domain") or "").strip()
    target_role = _norm(intent.get("target_role") or candidate_profile.get("job_title") or "")
    search_profile = (
        (candidate_profile.get("preferences") or {}).get("searchProfile")
        if isinstance((candidate_profile.get("preferences") or {}).get("searchProfile"), dict)
        else {}
    )

    priority_keywords = _clip_list(
        [
            target_role,
            *(candidate_profile.get("skills") or []),
            *(candidate_profile.get("inferred_skills") or candidate_profile.get("inferredSkills") or []),
            *(get_domain_keywords(primary_domain) if primary_domain else []),
        ],
        10,
    )

    return {
        "target_roles": _clip_list([target_role, intent.get("inferred_target_role")], 4),
        "adjacent_roles": _clip_list(search_profile.get("adjacentRoles") or [], 6),
        "priority_keywords": priority_keywords,
        "avoid_keywords": _clip_list(search_profile.get("avoidKeywords") or [], 8),
        "preferred_work_modes": _clip_list(search_profile.get("preferredWorkModes") or candidate_profile.get("work_preferences") or [], 4),
        "seniority": _norm(intent.get("seniority") or ""),
        "primary_domain": primary_domain.lower(),
        "secondary_domains": _clip_list(intent.get("secondary_domains") or [], 3),
        "used_ai": False,
        "source": "deterministic_fallback",
    }


def _is_enabled(subject_id: Optional[str]) -> bool:
    flag = get_release_flag("recommendation_ai_intent_enabled", subject_id=subject_id or "public", default=True)
    return bool(flag.get("effective_enabled", True))


def _build_prompt(candidate_profile: Dict[str, Any]) -> str:
    preferences = candidate_profile.get("preferences") if isinstance(candidate_profile.get("preferences"), dict) else {}
    payload = {
        "job_title": candidate_profile.get("job_title"),
        "cv_ai_text": candidate_profile.get("cv_ai_text"),
        "cv_text": candidate_profile.get("cv_text"),
        "story": candidate_profile.get("story"),
        "skills": candidate_profile.get("skills") or [],
        "inferred_skills": candidate_profile.get("inferred_skills") or candidate_profile.get("inferredSkills") or [],
        "strengths": candidate_profile.get("strengths") or [],
        "work_history": candidate_profile.get("work_history") or candidate_profile.get("workHistory") or [],
        "preferences": preferences,
    }
    return f"""
Read this candidate profile and infer a recommendation/search intent.

Return STRICT JSON only with this schema:
{{
  "target_roles": ["string"],
  "adjacent_roles": ["string"],
  "priority_keywords": ["string"],
  "avoid_keywords": ["string"],
  "preferred_work_modes": ["string"],
  "seniority": "string",
  "primary_domain": "string",
  "secondary_domains": ["string"]
}}

Rules:
- target_roles: exact role directions the candidate should most likely see, max 4
- adjacent_roles: sensible nearby roles, max 6
- priority_keywords: concrete recruiting keywords/tools/contexts for matching, max 10
- avoid_keywords: obvious irrelevant directions to suppress, max 8
- preferred_work_modes: remote/hybrid/on-site/field etc., max 4
- Keep it conservative. Do not invent unrelated ambitions.
- Use concise lowercase strings.

Candidate profile:
{json.dumps(payload, ensure_ascii=False)}
""".strip()


def _cache_key(candidate_profile: Dict[str, Any], user_id: Optional[str]) -> str:
    relevant = {
        "user_id": user_id or "public",
        "job_title": candidate_profile.get("job_title"),
        "cv_text": candidate_profile.get("cv_text"),
        "cv_ai_text": candidate_profile.get("cv_ai_text"),
        "story": candidate_profile.get("story"),
        "skills": candidate_profile.get("skills") or [],
        "inferred_skills": candidate_profile.get("inferred_skills") or candidate_profile.get("inferredSkills") or [],
        "strengths": candidate_profile.get("strengths") or [],
        "work_history": candidate_profile.get("work_history") or candidate_profile.get("workHistory") or [],
        "preferences": candidate_profile.get("preferences") or {},
    }
    return hashlib.sha256(json.dumps(relevant, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")).hexdigest()


def get_candidate_recommendation_intelligence(candidate_profile: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
    if not isinstance(candidate_profile, dict) or not candidate_profile:
        return _fallback({})

    if not _is_enabled(user_id):
        return _fallback(candidate_profile)

    cache_key = _cache_key(candidate_profile, user_id)
    now = datetime.now(timezone.utc)
    with _CACHE_LOCK:
        cached = _CACHE.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]

    cfg = get_active_model_config("ai_orchestration", "recommendation_intent")
    primary_model = cfg.get("primary_model") or get_default_primary_model()
    fallback_model = cfg.get("fallback_model") or get_default_fallback_model()
    generation_config = {
        "temperature": cfg.get("temperature", 0),
        "top_p": cfg.get("top_p", 1),
        "top_k": cfg.get("top_k", 1),
    }

    fallback_payload = _fallback(candidate_profile)
    try:
        result, fallback_used = call_primary_with_fallback(
            _build_prompt(candidate_profile),
            primary_model,
            fallback_model,
            generation_config=generation_config,
        )
        parsed = _extract_json(result.text)
        payload = {
            "target_roles": _clip_list(parsed.get("target_roles") or [], 4) or fallback_payload["target_roles"],
            "adjacent_roles": _clip_list(parsed.get("adjacent_roles") or [], 6),
            "priority_keywords": _clip_list(parsed.get("priority_keywords") or [], 10) or fallback_payload["priority_keywords"],
            "avoid_keywords": _clip_list(parsed.get("avoid_keywords") or [], 8) or fallback_payload["avoid_keywords"],
            "preferred_work_modes": _clip_list(parsed.get("preferred_work_modes") or [], 4) or fallback_payload["preferred_work_modes"],
            "seniority": _norm(parsed.get("seniority") or fallback_payload.get("seniority")).lower(),
            "primary_domain": _norm(parsed.get("primary_domain") or fallback_payload.get("primary_domain")).lower(),
            "secondary_domains": _clip_list(parsed.get("secondary_domains") or [], 3) or fallback_payload["secondary_domains"],
            "used_ai": True,
            "source": "ai_recommendation_intent",
            "model_used": result.model_name,
            "fallback_used": fallback_used,
        }
    except (AIClientError, ValueError, TypeError, json.JSONDecodeError) as exc:
        payload = {
            **fallback_payload,
            "error": str(exc),
        }

    with _CACHE_LOCK:
        _CACHE[cache_key] = (now + timedelta(seconds=_CACHE_TTL_SECONDS), payload)
    return payload
