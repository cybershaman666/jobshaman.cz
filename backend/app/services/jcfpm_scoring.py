from __future__ import annotations
from typing import Dict, List, Tuple

JCFPM_DIMENSIONS = [
    "d1_cognitive",
    "d2_social",
    "d3_motivational",
    "d4_energy",
    "d5_values",
    "d6_ai_readiness",
]

_DIMENSION_LABELS = {
    "d1_cognitive": {
        "low": "Silně intuitivní, improvizační",
        "mid_low": "Mírně intuitivní, flexibilní",
        "balanced": "Vyvážený, adaptabilní",
        "high": "Silně analytický, strukturovaný",
    },
    "d2_social": {
        "low": "Silně samostatný, introvertní",
        "mid_low": "Spíše samostatný, selektivní",
        "balanced": "Vyvážený mezi solo a týmovou prací",
        "high": "Silně týmový, vztahově orientovaný",
    },
    "d3_motivational": {
        "low": "Silně extrinsicky motivovaný",
        "mid_low": "Spíše výkonově orientovaný",
        "balanced": "Vyvážená motivace",
        "high": "Silně intrinsicky motivovaný",
    },
    "d4_energy": {
        "low": "Preferuje pomalejší tempo a stabilitu",
        "mid_low": "Spíše stabilní tempo",
        "balanced": "Vyvážený energetický pattern",
        "high": "Rychlé tempo a vysoká intenzita",
    },
    "d5_values": {
        "low": "Stabilita a tradice",
        "mid_low": "Spíše stabilita",
        "balanced": "Vyvážené hodnotové ukotvení",
        "high": "Impact a inovace",
    },
    "d6_ai_readiness": {
        "low": "Nízká otevřenost k AI změnám",
        "mid_low": "Opatrná adaptace",
        "balanced": "Vyvážená připravenost",
        "high": "Vysoká adaptabilita a AI readiness",
    },
}


def _apply_reverse(value: float, reverse: bool) -> float:
    return 8 - value if reverse else value


def _interp(score: float, src_min: float, src_max: float, dst_min: float, dst_max: float) -> float:
    if src_max <= src_min:
        return dst_min
    ratio = (score - src_min) / (src_max - src_min)
    ratio = max(0.0, min(1.0, ratio))
    return dst_min + ratio * (dst_max - dst_min)


def _percentile_band(score: float) -> Tuple[int, str]:
    if score < 2.5:
        pct = _interp(score, 1.0, 2.5, 0.0, 15.0)
        return int(round(pct)), "0–15"
    if score < 4.5:
        pct = _interp(score, 2.5, 4.5, 15.0, 50.0)
        return int(round(pct)), "15–50"
    if score < 5.5:
        pct = _interp(score, 4.5, 5.5, 50.0, 85.0)
        return int(round(pct)), "50–85"
    pct = _interp(score, 5.5, 7.0, 85.0, 100.0)
    return int(round(pct)), "85–100"


def score_dimensions(items: List[dict], responses: Dict[str, int]) -> List[dict]:
    by_dim: Dict[str, List[dict]] = {d: [] for d in JCFPM_DIMENSIONS}
    for item in items:
        dim = str(item.get("dimension") or "")
        if dim in by_dim:
            by_dim[dim].append(item)

    scores: List[dict] = []
    for dim in JCFPM_DIMENSIONS:
        dim_items = by_dim.get(dim) or []
        if not dim_items:
            raise ValueError(f"Missing items for dimension {dim}")
        values = []
        for item in dim_items:
            item_id = str(item.get("id"))
            if item_id not in responses:
                raise ValueError(f"Missing response for {item_id}")
            raw = float(responses[item_id])
            scored = _apply_reverse(raw, bool(item.get("reverse_scoring")))
            values.append(scored)
        raw_score = round(sum(values) / max(1, len(values)), 2)
        percentile, band = _percentile_band(raw_score)
        label_set = _DIMENSION_LABELS.get(dim, {})
        if raw_score < 2.5:
            label = label_set.get("low", "Nízké")
        elif raw_score < 4.5:
            label = label_set.get("mid_low", "Nižší")
        elif raw_score < 5.5:
            label = label_set.get("balanced", "Vyvážené")
        else:
            label = label_set.get("high", "Vysoké")
        scores.append(
            {
                "dimension": dim,
                "raw_score": raw_score,
                "percentile": percentile,
                "percentile_band": band,
                "label": label,
            }
        )

    return scores
