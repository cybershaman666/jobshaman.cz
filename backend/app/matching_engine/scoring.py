import math
import unicodedata
from typing import Dict, List, Tuple

from .demand import demand_weight_for_skills
from .embeddings import cosine_similarity
from .normalization import normalize_salary_index
from .role_taxonomy import (
    DOMAIN_KEYWORDS,
    REQUIRED_QUALIFICATION_RULES,
    ROLE_FAMILY_KEYWORDS,
    ROLE_FAMILY_RELATIONS,
    TAXONOMY_VERSION,
)

REMOTE_FLAGS = ["remote", "home office", "homeoffice", "hybrid", "remote-first", "work from home"]
SENIORITY_ORDER = ["intern", "junior", "mid", "senior", "lead", "principal"]

# Weighted normalized scoring (all components normalized 0..1)
_WEIGHTS = {
    "alpha_skill": 0.35,
    "beta_demand": 0.15,
    "gamma_seniority": 0.15,
    "delta_salary": 0.15,
    "epsilon_geo": 0.20,
}


def configure_scoring_weights(weights: Dict[str, float]) -> None:
    if not weights:
        return
    for key in _WEIGHTS.keys():
        if key in weights:
            try:
                _WEIGHTS[key] = float(weights[key])
            except Exception:
                continue

    total = sum(max(0.0, value) for value in _WEIGHTS.values())
    if total <= 0:
        return
    # Normalize to 1.0 to keep output scale stable
    for key in _WEIGHTS.keys():
        _WEIGHTS[key] = max(0.0, _WEIGHTS[key]) / total


def current_scoring_weights() -> Dict[str, float]:
    return dict(_WEIGHTS)


def _contains(text: str, term: str) -> bool:
    return bool(term and term in (text or ""))


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _normalize_text(value: str) -> str:
    text = (value or "").lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text


def _detect_domains(text: str) -> Dict[str, int]:
    normalized = _normalize_text(text)
    scores: Dict[str, int] = {}
    for domain, keywords in DOMAIN_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            if keyword in normalized:
                score += 1
        if score > 0:
            scores[domain] = score
    return scores


def _domain_alignment(candidate_text: str, job_text: str) -> tuple[float, bool, List[str], List[str]]:
    candidate_domains = _detect_domains(candidate_text)
    job_domains = _detect_domains(job_text)

    if not candidate_domains or not job_domains:
        return 0.6, False, sorted(candidate_domains.keys()), sorted(job_domains.keys())

    cand_set = set(candidate_domains.keys())
    job_set = set(job_domains.keys())
    overlap = cand_set.intersection(job_set)
    if overlap:
        return 1.0, False, sorted(cand_set), sorted(job_set)

    # Strong mismatch when both sides have at least one confident domain hit and no overlap.
    return 0.1, True, sorted(cand_set), sorted(job_set)


def _missing_required_qualifications(candidate_text: str, job_text: str) -> List[str]:
    missing: List[str] = []
    candidate_normalized = _normalize_text(candidate_text)
    job_normalized = _normalize_text(job_text)

    for rule in REQUIRED_QUALIFICATION_RULES:
        job_terms = rule.get("job_terms") or []
        candidate_terms = rule.get("candidate_terms") or []
        has_job_requirement = any(term in job_normalized for term in job_terms)
        if not has_job_requirement:
            continue
        has_candidate_signal = any(term in candidate_normalized for term in candidate_terms)
        if not has_candidate_signal:
            missing.append(str(rule.get("name") or "qualification"))

    return missing


def _detect_role_families(text: str) -> Dict[str, int]:
    normalized = _normalize_text(text)
    matches: Dict[str, int] = {}
    for family, keywords in ROLE_FAMILY_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            if keyword in normalized:
                score += 1
        if score > 0:
            matches[family] = score
    return matches


def _role_transfer_alignment(candidate_text: str, job_text: str) -> tuple[float, List[str], List[str], float]:
    candidate_families_map = _detect_role_families(candidate_text)
    job_families_map = _detect_role_families(job_text)
    candidate_families = sorted(candidate_families_map.keys())
    job_families = sorted(job_families_map.keys())

    if not candidate_families or not job_families:
        return 0.55, candidate_families, job_families, 0.0

    overlap = set(candidate_families).intersection(job_families)
    if overlap:
        return 1.0, candidate_families, job_families, 1.0

    best_relation = 0.0
    for c_family in candidate_families:
        relations = ROLE_FAMILY_RELATIONS.get(c_family, {})
        for j_family in job_families:
            relation = float(relations.get(j_family) or 0.0)
            if relation > best_relation:
                best_relation = relation
            reverse = float((ROLE_FAMILY_RELATIONS.get(j_family, {}) or {}).get(c_family) or 0.0)
            if reverse > best_relation:
                best_relation = reverse

    if best_relation > 0:
        # Related role families get medium-high alignment, but not as high as exact family match.
        return _clamp01(0.55 + (0.35 * best_relation)), candidate_families, job_families, best_relation

    return 0.2, candidate_families, job_families, 0.0


def _infer_seniority(text: str) -> str:
    t = (text or "").lower()
    if "principal" in t:
        return "principal"
    if "lead" in t or "tech lead" in t:
        return "lead"
    if "senior" in t or "sr." in t or "sr " in t:
        return "senior"
    if "medior" in t or "middle" in t or "mid" in t:
        return "mid"
    if "junior" in t or "jr." in t or "jr " in t:
        return "junior"
    if "intern" in t or "trainee" in t:
        return "intern"
    return "mid"


def _seniority_alignment(candidate_seniority: str, job_seniority: str) -> tuple[float, float]:
    c = SENIORITY_ORDER.index(candidate_seniority) if candidate_seniority in SENIORITY_ORDER else 2
    j = SENIORITY_ORDER.index(job_seniority) if job_seniority in SENIORITY_ORDER else 2
    gap = j - c
    # Convert gap to 0..1 alignment (penalize bigger gaps)
    alignment = _clamp01(1.0 - (abs(gap) / 4.0))
    # Signed gap normalized to [-1, 1]
    signed_gap = max(-1.0, min(1.0, gap / 4.0))
    return alignment, signed_gap


def _exact_skill_ratio(candidate_skills: List[str], job_text: str) -> tuple[float, List[str], List[str]]:
    if not candidate_skills:
        return 0.0, [], []

    hits = []
    missing = []
    for skill in candidate_skills[:40]:
        if _contains(job_text, skill):
            hits.append(skill)
        else:
            missing.append(skill)

    ratio = len(hits) / max(1, min(20, len(candidate_skills)))
    return _clamp01(ratio), hits, missing


def _geography_weight(candidate_features: Dict, job_features: Dict) -> float:
    c_addr = candidate_features.get("address") or ""
    j_loc = job_features.get("location") or ""
    j_text = job_features.get("text") or ""

    score = 0.0
    if c_addr and j_loc and (c_addr in j_loc or j_loc in c_addr):
        score += 0.7
    if any(flag in j_text for flag in REMOTE_FLAGS):
        score += 0.3
    return _clamp01(score)


def _compose_reasons(components: Dict[str, float], missing_core_skills: List[str], seniority_gap: float) -> List[str]:
    labels = {
        "skill_match": "Silna shoda dovednosti",
        "demand_boost": "Dovednosti jsou trzne zadane",
        "seniority_alignment": "Seniority je v souladu s pozici",
        "salary_alignment": "Mzda je konkurenceschopna",
        "geography_weight": "Lokalita/rezim prace odpovida",
    }
    ranked = sorted(components.items(), key=lambda item: item[1], reverse=True)
    reasons = [labels[k] for k, v in ranked[:3] if v > 0]
    if missing_core_skills:
        reasons.append(f"Chybi klicove dovednosti: {', '.join(missing_core_skills[:2])}")
    if abs(seniority_gap) > 0.4:
        reasons.append("Vyssi seniority gap mezi profilem a pozici")
    return reasons[:4]


def score_job(
    candidate_features: Dict,
    job_features: Dict,
    semantic_similarity: float,
) -> Tuple[float, List[str], Dict]:
    candidate_skills = list(
        {
            *candidate_features.get("skills", []),
            *candidate_features.get("inferred", []),
            *candidate_features.get("strengths", []),
            *candidate_features.get("leadership", []),
        }
    )

    job_text = job_features.get("text") or ""
    candidate_text = "\n".join(
        [
            candidate_features.get("title") or "",
            candidate_features.get("text") or "",
            " ".join(candidate_skills),
        ]
    )

    exact_ratio, exact_hits, missing_skills = _exact_skill_ratio(candidate_skills, job_text)
    role_transfer_alignment, candidate_role_families, job_role_families, role_relation_strength = _role_transfer_alignment(candidate_text, job_text)
    base_similarity = _clamp01((0.65 * _clamp01(semantic_similarity)) + (0.35 * exact_ratio))
    skill_similarity = _clamp01((0.8 * base_similarity) + (0.2 * role_transfer_alignment))
    domain_alignment, strong_domain_mismatch, candidate_domains, job_domains = _domain_alignment(candidate_text, job_text)
    if strong_domain_mismatch and role_transfer_alignment < 0.5:
        # Hard gate: semantic similarity can still be high for generic language, but domain mismatch should dominate.
        skill_similarity *= 0.3

    demand_alignment = _clamp01(
        demand_weight_for_skills(
            exact_hits if exact_hits else candidate_skills,
            job_features.get("country") or "",
            job_features.get("location") or "",
        )
    )

    candidate_seniority = _infer_seniority(candidate_features.get("title") or "")
    job_seniority = _infer_seniority(job_features.get("title") or "")
    seniority_alignment, seniority_gap = _seniority_alignment(candidate_seniority, job_seniority)

    salary_alignment = _clamp01(
        normalize_salary_index(
            job_features,
            candidate_country=job_features.get("country") or "",
            candidate_city=job_features.get("location") or "",
            seniority=job_seniority,
            role=job_features.get("role"),
            industry=job_features.get("industry"),
        )
    )

    geography_weight = _clamp01(_geography_weight(candidate_features, job_features))

    weighted = {
        "skill_match": skill_similarity,
        "demand_boost": demand_alignment,
        "seniority_alignment": seniority_alignment,
        "salary_alignment": salary_alignment,
        "geography_weight": geography_weight,
    }

    total = round(
        100
        * (
            _WEIGHTS["alpha_skill"] * weighted["skill_match"]
            + _WEIGHTS["beta_demand"] * weighted["demand_boost"]
            + _WEIGHTS["gamma_seniority"] * weighted["seniority_alignment"]
            + _WEIGHTS["delta_salary"] * weighted["salary_alignment"]
            + _WEIGHTS["epsilon_geo"] * weighted["geography_weight"]
        ),
        2,
    )
    missing_required_qualifications = _missing_required_qualifications(candidate_text, job_text)
    hard_cap = 100.0
    if strong_domain_mismatch and exact_ratio <= 0.1:
        hard_cap = min(hard_cap, 15.0)
    if missing_required_qualifications:
        # Regulated/specialized roles without explicit profile evidence should stay near the floor.
        hard_cap = min(hard_cap, 10.0)
    total = min(total, hard_cap)

    breakdown = {
        **{k: round(v, 4) for k, v in weighted.items()},
        "missing_core_skills": missing_skills[:8],
        "missing_required_qualifications": missing_required_qualifications,
        "seniority_gap": round(seniority_gap, 4),
        "component_scores": {
            "alpha_skill": round(_WEIGHTS["alpha_skill"] * weighted["skill_match"], 4),
            "beta_demand": round(_WEIGHTS["beta_demand"] * weighted["demand_boost"], 4),
            "gamma_seniority": round(_WEIGHTS["gamma_seniority"] * weighted["seniority_alignment"], 4),
            "delta_salary": round(_WEIGHTS["delta_salary"] * weighted["salary_alignment"], 4),
            "epsilon_geo": round(_WEIGHTS["epsilon_geo"] * weighted["geography_weight"], 4),
        },
        "domain_alignment": round(domain_alignment, 4),
        "domain_mismatch": bool(strong_domain_mismatch),
        "candidate_domains": candidate_domains[:5],
        "job_domains": job_domains[:5],
        "role_transfer_alignment": round(role_transfer_alignment, 4),
        "role_relation_strength": round(role_relation_strength, 4),
        "candidate_role_families": candidate_role_families[:4],
        "job_role_families": job_role_families[:4],
        "taxonomy_version": TAXONOMY_VERSION,
        "hard_cap": round(hard_cap, 2),
        "total": max(0.0, min(100.0, total)),
    }

    reasons = _compose_reasons(weighted, missing_skills, seniority_gap)
    if strong_domain_mismatch:
        reasons.insert(0, "Silny oborovy nesoulad mezi profilem a pozici")
    if missing_required_qualifications:
        reasons.insert(0, "Chybi povinna kvalifikace nebo zkusenost pro tuto roli")
    if role_transfer_alignment >= 0.95:
        reasons.insert(0, "Profese je ve velmi silne shode")
    elif role_transfer_alignment >= 0.68:
        reasons.insert(0, "Profese je pribuzna a dobre prenositelna")
    reasons = reasons[:4]
    return breakdown["total"], reasons, breakdown


def score_from_embeddings(candidate_embedding: List[float], job_embedding: List[float]) -> float:
    return cosine_similarity(candidate_embedding, job_embedding)


def predict_action_probability(features: Dict[str, float], coefficients: Dict[str, float]) -> float:
    """
    Baseline logistic model:
      p(action) = sigmoid(intercept + sum(feature_i * coef_i))
    """
    if not coefficients:
        return 0.0

    score = float(coefficients.get("intercept") or 0.0)
    for key, value in features.items():
        if key == "intercept":
            continue
        try:
            score += float(value) * float(coefficients.get(key) or 0.0)
        except Exception:
            continue

    # Keep exp numerically stable for larger magnitudes.
    score = max(-50.0, min(50.0, score))
    return 1.0 / (1.0 + math.exp(-score))
