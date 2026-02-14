from typing import Dict, List, Tuple

from .demand import demand_weight_for_skills
from .embeddings import cosine_similarity
from .normalization import normalize_salary_index

REMOTE_FLAGS = ["remote", "home office", "homeoffice", "hybrid", "remote-first", "work from home"]


def _contains(text: str, term: str) -> bool:
    return bool(term and term in (text or ""))


def score_job(
    candidate_features: Dict,
    job_features: Dict,
    semantic_similarity: float,
) -> Tuple[float, List[str], Dict[str, float]]:
    title = candidate_features.get("title") or ""
    job_title = job_features.get("title") or ""
    job_text = job_features.get("text") or ""

    candidate_skills = list(
        {
            *candidate_features.get("skills", []),
            *candidate_features.get("inferred", []),
            *candidate_features.get("strengths", []),
            *candidate_features.get("leadership", []),
        }
    )

    exact_hits = 0
    for skill in candidate_skills[:40]:
        if _contains(job_text, skill):
            exact_hits += 1

    exact_score = min(15.0, exact_hits * 1.9)
    semantic_score = max(0.0, min(35.0, semantic_similarity * 35.0))

    title_alignment = 0.0
    if title and (title in job_title or job_title in title):
        title_alignment = 10.0

    demand = demand_weight_for_skills(candidate_skills, job_features.get("country") or "", job_features.get("location") or "")
    demand_score = min(15.0, demand * 15.0)

    salary_fit = normalize_salary_index(
        job_features,
        candidate_country="",
        candidate_city="",
        seniority=None,
    )
    salary_score = min(15.0, salary_fit * 15.0)

    location_score = 0.0
    c_addr = candidate_features.get("address") or ""
    j_loc = job_features.get("location") or ""
    if c_addr and j_loc and (c_addr in j_loc or j_loc in c_addr):
        location_score += 6.0
    if any(flag in job_text for flag in REMOTE_FLAGS):
        location_score += 4.0

    pref_score = 0.0
    preferences = candidate_features.get("preferences", [])
    pref_hits = sum(1 for p in preferences[:10] if _contains(job_text, p))
    pref_score = min(10.0, pref_hits * 2.0)

    breakdown = {
        "skill_semantic": round(semantic_score, 2),
        "skill_exact": round(exact_score, 2),
        "title_alignment": round(title_alignment, 2),
        "demand_weight": round(demand_score, 2),
        "salary_fit": round(salary_score, 2),
        "location_fit": round(location_score, 2),
        "preference_fit": round(pref_score, 2),
    }
    total = min(100.0, round(sum(breakdown.values()), 2))
    breakdown["total"] = total

    reasons = _top_reasons(breakdown, candidate_skills)
    return total, reasons, breakdown


def _top_reasons(breakdown: Dict[str, float], candidate_skills: List[str]) -> List[str]:
    labels = {
        "skill_semantic": "Silna semanticka shoda dovednosti",
        "skill_exact": "Klicove dovednosti se objevuji v inzeratu",
        "title_alignment": "Shoda profesniho zamereni",
        "demand_weight": "Dovednosti maji vysokou trzni poptavku",
        "salary_fit": "Nabidka je konkurenceschopna v lokalnim trhu",
        "location_fit": "Lokalita nebo remote rezim odpovida",
        "preference_fit": "Pozice odpovida preferencim kandidata",
    }
    ranked = sorted(
        [(k, v) for k, v in breakdown.items() if k != "total"],
        key=lambda item: item[1],
        reverse=True,
    )[:3]
    out = [labels[k] for k, v in ranked if v > 0]
    if not out and candidate_skills:
        out.append(f"Relevantni profilove dovednosti: {candidate_skills[0]}")
    return out


def score_from_embeddings(candidate_embedding: List[float], job_embedding: List[float]) -> float:
    return cosine_similarity(candidate_embedding, job_embedding)
