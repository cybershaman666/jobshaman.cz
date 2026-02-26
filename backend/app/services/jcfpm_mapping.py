from __future__ import annotations
from typing import Dict, List
import math

WEIGHTS = {
    "d1_cognitive": 1.2,
    "d2_social": 1.5,
    "d3_motivational": 1.3,
    "d4_energy": 0.8,
    "d5_values": 1.0,
    "d6_ai_readiness": 1.1,
}

HIGH_GATE_THRESHOLD = 5.5  # user is very high on dimension
LOW_GATE_THRESHOLD = 2.5   # user is very low on dimension
ROLE_HIGH_MIN = 4.6        # role must not be too low if user is high
ROLE_LOW_MAX = 3.8         # role must not be too high if user is low


def _passes_hard_gates(user: Dict[str, float], role: Dict[str, float], ai_intensity: str | None = None) -> bool:
    for dim in WEIGHTS.keys():
        u = float(user.get(dim, 0))
        r = float(role.get(dim, 0))
        if u >= HIGH_GATE_THRESHOLD and r < ROLE_HIGH_MIN:
            return False
        if u <= LOW_GATE_THRESHOLD and r > ROLE_LOW_MAX:
            return False
    # Extra hard gate for high AI readiness
    if float(user.get("d6_ai_readiness", 0)) >= HIGH_GATE_THRESHOLD:
        if (ai_intensity or "").lower() != "high":
            return False
    return True


def _weighted_distance(user: Dict[str, float], role: Dict[str, float]) -> float:
    total_w = sum(WEIGHTS.values())
    if total_w <= 0:
        return 0.0
    acc = 0.0
    for dim, w in WEIGHTS.items():
        diff = float(user.get(dim, 0)) - float(role.get(dim, 0))
        acc += w * (diff ** 2)
    return math.sqrt(acc) / math.sqrt(total_w)


def fit_score(user: Dict[str, float], role: Dict[str, float]) -> float:
    max_distance = 6.0  # max diff on 1-7 scale
    dist = _weighted_distance(user, role)
    score = 100.0 * (1.0 - min(dist, max_distance) / max_distance)
    return max(0.0, min(100.0, score))


def rank_roles(user: Dict[str, float], roles: List[dict], top_n: int = 10) -> List[dict]:
    ranked: List[dict] = []
    for role in roles:
        role_profile = {
            "d1_cognitive": role.get("d1"),
            "d2_social": role.get("d2"),
            "d3_motivational": role.get("d3"),
            "d4_energy": role.get("d4"),
            "d5_values": role.get("d5"),
            "d6_ai_readiness": role.get("d6"),
        }
        if not _passes_hard_gates(user, role_profile, role.get("ai_intensity")):
            continue
        score = fit_score(user, role_profile)
        ranked.append({
            "role_id": role.get("id"),
            "title": role.get("title"),
            "fit_score": round(score, 2),
            "salary_range": role.get("salary_range"),
            "growth_potential": role.get("growth_potential"),
            "ai_impact": role.get("ai_impact"),
            "remote_friendly": role.get("remote_friendly"),
        })
    ranked.sort(key=lambda r: r.get("fit_score", 0), reverse=True)
    return ranked[:top_n]
