from typing import Dict, List, Tuple

from .demand import demand_weight_for_skills
from .embeddings import cosine_similarity
from .normalization import normalize_salary_index

REMOTE_FLAGS = ["remote", "home office", "homeoffice", "hybrid", "remote-first", "work from home"]
SENIORITY_ORDER = ["intern", "junior", "mid", "senior", "lead", "principal"]

# Weighted normalized scoring (all components normalized 0..1)
ALPHA_SKILL = 0.35
BETA_DEMAND = 0.15
GAMMA_SENIORITY = 0.15
DELTA_SALARY = 0.15
EPSILON_GEO = 0.20


def _contains(text: str, term: str) -> bool:
    return bool(term and term in (text or ""))


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


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

    exact_ratio, exact_hits, missing_skills = _exact_skill_ratio(candidate_skills, job_text)
    skill_similarity = _clamp01((0.65 * _clamp01(semantic_similarity)) + (0.35 * exact_ratio))

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
            ALPHA_SKILL * weighted["skill_match"]
            + BETA_DEMAND * weighted["demand_boost"]
            + GAMMA_SENIORITY * weighted["seniority_alignment"]
            + DELTA_SALARY * weighted["salary_alignment"]
            + EPSILON_GEO * weighted["geography_weight"]
        ),
        2,
    )

    breakdown = {
        **{k: round(v, 4) for k, v in weighted.items()},
        "missing_core_skills": missing_skills[:8],
        "seniority_gap": round(seniority_gap, 4),
        "component_scores": {
            "alpha_skill": round(ALPHA_SKILL * weighted["skill_match"], 4),
            "beta_demand": round(BETA_DEMAND * weighted["demand_boost"], 4),
            "gamma_seniority": round(GAMMA_SENIORITY * weighted["seniority_alignment"], 4),
            "delta_salary": round(DELTA_SALARY * weighted["salary_alignment"], 4),
            "epsilon_geo": round(EPSILON_GEO * weighted["geography_weight"], 4),
        },
        "total": max(0.0, min(100.0, total)),
    }

    reasons = _compose_reasons(weighted, missing_skills, seniority_gap)
    return breakdown["total"], reasons, breakdown


def score_from_embeddings(candidate_embedding: List[float], job_embedding: List[float]) -> float:
    return cosine_similarity(candidate_embedding, job_embedding)
