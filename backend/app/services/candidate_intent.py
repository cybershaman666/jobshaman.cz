from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional
import json
import unicodedata


def _normalize_text(value: Any) -> str:
    text = str(value or "").lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return " ".join(text.split())


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


@lru_cache(maxsize=1)
def _load_taxonomy() -> Dict[str, Any]:
    taxonomy_path = _repo_root() / "shared" / "candidate_intent_taxonomy.json"
    with taxonomy_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _domains() -> Dict[str, Dict[str, Any]]:
    return dict(_load_taxonomy().get("domains") or {})


def _candidate_profile_obj(candidate_profile: Any) -> Dict[str, Any]:
    if isinstance(candidate_profile, list):
        return candidate_profile[0] if candidate_profile and isinstance(candidate_profile[0], dict) else {}
    return candidate_profile if isinstance(candidate_profile, dict) else {}


def _collect_profile_chunks(candidate_profile: Any) -> List[str]:
    profile = _candidate_profile_obj(candidate_profile)
    preferences = profile.get("preferences") if isinstance(profile.get("preferences"), dict) else {}
    search_profile = preferences.get("searchProfile") if isinstance(preferences.get("searchProfile"), dict) else {}
    chunks: List[str] = [
        str(profile.get("job_title") or ""),
        str(profile.get("cv_text") or ""),
        str(profile.get("cv_ai_text") or ""),
        str(preferences.get("desired_role") or ""),
        str(search_profile.get("targetRole") or ""),
        str(search_profile.get("inferredTargetRole") or ""),
    ]
    for item in profile.get("skills") or []:
        chunks.append(str(item or ""))
    for item in profile.get("inferred_skills") or []:
        chunks.append(str(item or ""))
    return [chunk for chunk in chunks if str(chunk or "").strip()]


def _score_domains(chunks: List[str]) -> List[Dict[str, Any]]:
    joined = "\n".join(_normalize_text(chunk) for chunk in chunks if str(chunk or "").strip())
    if not joined:
        return []

    scores: List[Dict[str, Any]] = []
    for domain_key, definition in _domains().items():
        score = 0.0
        for keyword in definition.get("keywords") or []:
            normalized_keyword = _normalize_text(keyword)
            if not normalized_keyword:
                continue
            if normalized_keyword in joined:
                score += 3.0
                continue
            parts = [part for part in normalized_keyword.split(" ") if part]
            if len(parts) > 1 and all(part in joined for part in parts):
                score += 1.5
        if score > 0:
            scores.append({"domain": domain_key, "score": score})
    scores.sort(key=lambda item: item["score"], reverse=True)
    return scores


def _infer_seniority(*sources: Any) -> Optional[str]:
    text = _normalize_text(" ".join(str(source or "") for source in sources))
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


def _unique_domains(items: List[Optional[str]]) -> List[str]:
    output: List[str] = []
    seen: set[str] = set()
    for item in items:
        value = str(item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        output.append(value)
    return output


def get_domain_keywords(domain_key: Optional[str]) -> List[str]:
    key = str(domain_key or "").strip()
    if not key:
        return []
    return [str(item) for item in (_domains().get(key, {}) or {}).get("keywords") or [] if str(item or "").strip()]


def get_related_domains(domain_key: Optional[str]) -> List[str]:
    key = str(domain_key or "").strip()
    if not key:
        return []
    return [str(item) for item in (_domains().get(key, {}) or {}).get("related") or [] if str(item or "").strip()]


def resolve_candidate_intent_profile(candidate_profile: Any) -> Dict[str, Any]:
    profile = _candidate_profile_obj(candidate_profile)
    preferences = profile.get("preferences") if isinstance(profile.get("preferences"), dict) else {}
    search_profile = preferences.get("searchProfile") if isinstance(preferences.get("searchProfile"), dict) else {}
    chunks = _collect_profile_chunks(profile)
    inferred_domain_scores = _score_domains(chunks)
    inferred_primary_domain = str(search_profile.get("inferredPrimaryDomain") or inferred_domain_scores[0]["domain"] if inferred_domain_scores else "").strip() or None
    inferred_secondary = _unique_domains([item.get("domain") for item in inferred_domain_scores[1:3]])

    manual_primary = str(search_profile.get("primaryDomain") or "").strip() or None
    manual_secondary = _unique_domains(list(search_profile.get("secondaryDomains") or []))[:2]
    target_role = str(search_profile.get("targetRole") or profile.get("job_title") or preferences.get("desired_role") or "").strip()
    inferred_target_role = str(search_profile.get("inferredTargetRole") or profile.get("job_title") or preferences.get("desired_role") or "").strip()
    seniority = str(search_profile.get("seniority") or "").strip() or _infer_seniority(target_role, profile.get("cv_ai_text"), profile.get("cv_text"))

    primary_domain = manual_primary or inferred_primary_domain
    secondary_domains = manual_secondary or [domain for domain in inferred_secondary if domain != primary_domain][:2]
    include_adjacent_domains = bool(search_profile.get("includeAdjacentDomains", True))
    inference_confidence = search_profile.get("inferenceConfidence")
    if inference_confidence is None:
        inference_confidence = min(100, round(float(inferred_domain_scores[0]["score"]) * 10)) if inferred_domain_scores else None

    inference_source = str(search_profile.get("inferenceSource") or "").strip()
    if not inference_source:
        if profile.get("cv_ai_text") or profile.get("cv_text"):
            inference_source = "cv"
        elif profile.get("skills"):
            inference_source = "skills"
        elif profile.get("job_title"):
            inference_source = "profile"
        else:
            inference_source = "none"

    return {
        "primary_domain": primary_domain,
        "secondary_domains": secondary_domains,
        "target_role": target_role or inferred_target_role,
        "seniority": seniority or None,
        "include_adjacent_domains": include_adjacent_domains,
        "inferred_primary_domain": inferred_primary_domain,
        "inferred_target_role": inferred_target_role or None,
        "inference_source": inference_source,
        "inference_confidence": inference_confidence,
        "used_manual_domain": bool(manual_primary),
        "used_manual_role": bool(str(search_profile.get("targetRole") or "").strip()),
        "used_manual_seniority": bool(str(search_profile.get("seniority") or "").strip()),
    }
