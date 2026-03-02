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

AI_INTENSITY_BONUS = {
    "low": 0.0,
    "medium": 4.0,
    "high": 6.0,
}


def _passes_hard_gates(user: Dict[str, float], role: Dict[str, float], ai_intensity: str | None = None) -> bool:
    for dim in WEIGHTS.keys():
        u = float(user.get(dim, 0))
        r = float(role.get(dim, 0))
        if u >= HIGH_GATE_THRESHOLD and r < ROLE_HIGH_MIN:
            return False
        if u <= LOW_GATE_THRESHOLD and r > ROLE_LOW_MAX:
            return False
    return True


def _ai_intensity_bonus(user: Dict[str, float], ai_intensity: str | None) -> float:
    level = str(ai_intensity or "").strip().lower()
    base = AI_INTENSITY_BONUS.get(level, 0.0)
    d6 = float(user.get("d6_ai_readiness", 0))

    if d6 >= HIGH_GATE_THRESHOLD:
        if level == "high":
            return base
        if level == "medium":
            return base + 3.0
        return 1.0

    if d6 <= LOW_GATE_THRESHOLD:
        if level == "high":
            return -8.0
        if level == "medium":
            return -2.5
        return 2.0

    if level == "high":
        return base - 1.0
    return base


def _max_high_ai_roles(user: Dict[str, float], top_n: int) -> int:
    d6 = float(user.get("d6_ai_readiness", 0))
    if d6 >= HIGH_GATE_THRESHOLD:
        return max(2, math.ceil(top_n * 0.3))
    if d6 <= LOW_GATE_THRESHOLD:
        return max(1, math.ceil(top_n * 0.1))
    return max(2, math.ceil(top_n * 0.2))


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
        ai_intensity = str(role.get("ai_intensity") or "").strip().lower()
        role_profile = {
            "d1_cognitive": role.get("d1"),
            "d2_social": role.get("d2"),
            "d3_motivational": role.get("d3"),
            "d4_energy": role.get("d4"),
            "d5_values": role.get("d5"),
            "d6_ai_readiness": role.get("d6"),
        }
        if not _passes_hard_gates(user, role_profile, ai_intensity):
            continue
        score = fit_score(user, role_profile) + _ai_intensity_bonus(user, ai_intensity)
        ranked.append({
            "role_id": role.get("id"),
            "title": role.get("title"),
            "fit_score": round(max(0.0, min(100.0, score)), 2),
            "salary_range": role.get("salary_range"),
            "growth_potential": role.get("growth_potential"),
            "ai_impact": role.get("ai_impact"),
            "remote_friendly": role.get("remote_friendly"),
            "ai_intensity": ai_intensity,
        })
    ranked.sort(key=lambda r: r.get("fit_score", 0), reverse=True)

    max_high_ai = _max_high_ai_roles(user, top_n)
    selected: List[dict] = []
    deferred_high_ai: List[dict] = []
    high_ai_count = 0
    for role in ranked:
        is_high_ai = str(role.get("ai_intensity") or "").lower() == "high"
        if is_high_ai and high_ai_count >= max_high_ai:
            deferred_high_ai.append(role)
            continue
        selected.append(role)
        if is_high_ai:
            high_ai_count += 1
        if len(selected) >= top_n:
            return selected

    for role in deferred_high_ai:
        if len(selected) >= top_n:
            break
        selected.append(role)
    return selected[:top_n]
