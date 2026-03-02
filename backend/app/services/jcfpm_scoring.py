from __future__ import annotations
from typing import Dict, List, Tuple

JCFPM_DIMENSIONS = [
    "d1_cognitive",
    "d2_social",
    "d3_motivational",
    "d4_energy",
    "d5_values",
    "d6_ai_readiness",
    "d7_cognitive_reflection",
    "d8_digital_eq",
    "d9_systems_thinking",
    "d10_ambiguity_interpretation",
    "d11_problem_decomposition",
    "d12_moral_compass",
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
    "d7_cognitive_reflection": {
        "low": "Silně intuitivní, rychlé odpovědi bez ověření",
        "mid_low": "Spíše intuitivní, občas přemýšlíš do hloubky",
        "balanced": "Vyvážený poměr intuice a logiky",
        "high": "Silná schopnost odhalit chybnou intuici",
    },
    "d8_digital_eq": {
        "low": "Nízká citlivost na tón a emoce v textu",
        "mid_low": "Základní digitální empatie",
        "balanced": "Vyvážené čtení emocí v textu",
        "high": "Vysoká digitální empatie a důvěryhodnost",
    },
    "d9_systems_thinking": {
        "low": "Spíše lineární uvažování",
        "mid_low": "Částečné vnímání vztahů v systému",
        "balanced": "Vyvážený systémový pohled",
        "high": "Silné mapování zpětných vazeb a sítí",
    },
    "d10_ambiguity_interpretation": {
        "low": "Silná orientace na rizika",
        "mid_low": "Spíše opatrný výklad",
        "balanced": "Vyvážené vnímání rizik a příležitostí",
        "high": "Silná orientace na příležitosti",
    },
    "d11_problem_decomposition": {
        "low": "Obtížný rozklad velkých úkolů",
        "mid_low": "Základní strukturování",
        "balanced": "Vyvážený rozklad a pořadí kroků",
        "high": "Silná schopnost rozložit a prioritizovat",
    },
    "d12_moral_compass": {
        "low": "Pragmatická orientace na výkon",
        "mid_low": "Mírná etická stabilita",
        "balanced": "Vyvážený etický kompas",
        "high": "Silná integrita a etické rozhodování",
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


def _percentile_band_100(score: float) -> Tuple[int, str]:
    pct = int(round(max(0.0, min(100.0, score))))
    return pct, "0–100"


def _time_factor(time_ms: object) -> float:
    # Keep timing as a weak signal only. Device lag or short interruptions should
    # not heavily distort a cognitive/behavioral profile.
    if not isinstance(time_ms, (int, float)) or time_ms <= 0:
        return 1.0
    if time_ms <= 20000:
        return 1.0
    if time_ms <= 90000:
        ratio = (float(time_ms) - 20000.0) / 70000.0
        return max(0.85, min(1.0, 1.0 - ratio * 0.15))
    return 0.75


def _ordering_similarity(correct: List[object], selected: List[object]) -> float:
    if not correct:
        return 0.0
    if len(correct) == 1:
        return 1.0 if selected[:1] == correct[:1] else 0.0
    max_shift = len(correct) - 1
    index_map = {value: idx for idx, value in enumerate(selected)}
    acc = 0.0
    for idx, value in enumerate(correct):
        selected_idx = index_map.get(value)
        if selected_idx is None:
            continue
        distance = abs(selected_idx - idx)
        acc += max(0.0, 1.0 - (distance / max_shift))
    return acc


def _pair_match_score(correct_pairs: List[dict], selected_pairs: List[dict]) -> float:
    correct_set = {f"{pair.get('source')}->{pair.get('target')}" for pair in correct_pairs if isinstance(pair, dict)}
    selected_set = {f"{pair.get('source')}->{pair.get('target')}" for pair in selected_pairs if isinstance(pair, dict)}
    if not correct_set:
        return 0.0
    true_positive = len(correct_set.intersection(selected_set))
    false_positive = max(0, len(selected_set) - true_positive)
    score = true_positive - (false_positive * 0.35)
    return max(0.0, float(score))


def _score_interactive(item: dict, response: object) -> Tuple[float, float]:
    item_type = (item.get("item_type") or "likert").lower()
    payload = item.get("payload") or {}
    if isinstance(payload, str):
        try:
            payload = __import__("json").loads(payload)
        except Exception:
            payload = {}
    if item_type in {"likert", ""}:
        if isinstance(payload, dict):
            if isinstance(payload.get("correct_order"), list):
                item_type = "ordering"
            elif isinstance(payload.get("correct_pairs"), list):
                item_type = "drag_drop"
            elif isinstance(payload.get("options"), list):
                has_images = any(isinstance(opt, dict) and opt.get("image_url") for opt in payload.get("options"))
                item_type = "image_choice" if has_images else "mcq"
        raw_id = str(item.get("pool_key") or item.get("id") or "")
        if raw_id:
            base = raw_id.split("_v")[0].upper()
            if base.startswith("D10."):
                item_type = "image_choice"
            elif base.startswith("D8.") or base.startswith("D12."):
                item_type = "scenario_choice"
            elif base.startswith("D7."):
                item_type = "mcq"
            elif base in {"D9.1", "D9.4", "D11.2", "D11.5"}:
                item_type = "drag_drop"
            elif base in {"D9.3", "D11.1", "D11.3", "D11.6"}:
                item_type = "ordering"
            elif base in {"D9.2", "D9.5", "D9.6", "D11.4"}:
                item_type = "mcq"
    if item_type == "likert":
        raw = float(response) if response is not None else 0.0
        scored = _apply_reverse(raw, bool(item.get("reverse_scoring")))
        return scored, 7.0

    time_ms = response.get("time_ms") if isinstance(response, dict) else None
    time_factor = _time_factor(time_ms)

    # MCQ / scenario / image choice
    if item_type in {"mcq", "scenario_choice", "image_choice"}:
        correct_id = payload.get("correct_id")
        selected = None
        if isinstance(response, dict):
            selected = response.get("choice_id")
        elif isinstance(response, str):
            selected = response
        score = 1.0 if selected and correct_id and selected == correct_id else 0.0
        score *= time_factor
        return score, 1.0

    # Ordering
    if item_type == "ordering":
        correct = payload.get("correct_order") or []
        selected = []
        if isinstance(response, dict):
            selected = response.get("order") or []
        if not isinstance(correct, list) or not isinstance(selected, list):
            return 0.0, float(len(correct) or 1)
        max_score = max(1, len(correct))
        score = _ordering_similarity(correct, selected)
        score = float(score) * time_factor
        return float(score), float(max_score)

    # Drag & drop (pairs)
    if item_type == "drag_drop":
        correct_pairs = payload.get("correct_pairs") or []
        selected_pairs = []
        if isinstance(response, dict):
            selected_pairs = response.get("pairs") or []
        if not isinstance(correct_pairs, list) or not isinstance(selected_pairs, list):
            return 0.0, float(len(correct_pairs) or 1)
        correct_set = [pair for pair in correct_pairs if isinstance(pair, dict)]
        selected_set = [pair for pair in selected_pairs if isinstance(pair, dict)]
        score = _pair_match_score(correct_set, selected_set)
        score = float(score) * time_factor
        return float(score), float(max(1, len(correct_set)))

    return 0.0, 1.0


def score_dimensions(items: List[dict], responses: Dict[str, object]) -> List[dict]:
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
        scores.append(_score_single_dimension(dim, dim_items, responses))

    return scores


def score_dimensions_partial(items: List[dict], responses: Dict[str, object]) -> List[dict]:
    by_dim: Dict[str, List[dict]] = {}
    for item in items:
        dim = str(item.get("dimension") or "")
        if dim not in JCFPM_DIMENSIONS:
            continue
        by_dim.setdefault(dim, []).append(item)

    dims_in_payload = [dim for dim in JCFPM_DIMENSIONS if dim in by_dim]
    scores: List[dict] = []
    for dim in dims_in_payload:
        dim_items = by_dim.get(dim) or []
        if not dim_items:
            continue
        scores.append(_score_single_dimension(dim, dim_items, responses))

    return scores


def _score_single_dimension(dim: str, dim_items: List[dict], responses: Dict[str, object]) -> dict:
    values = []
    max_scores = []
    for item in dim_items:
        item_id = str(item.get("id"))
        if item_id not in responses:
            raise ValueError(f"Missing response for {item_id}")
        scored, max_score = _score_interactive(item, responses[item_id])
        values.append(scored)
        max_scores.append(max_score)

    if dim in {"d7_cognitive_reflection", "d8_digital_eq", "d9_systems_thinking", "d10_ambiguity_interpretation", "d11_problem_decomposition", "d12_moral_compass"}:
        total = sum(values)
        max_total = max(1.0, sum(max_scores))
        raw_score = round((total / max_total) * 100, 2)
        percentile, band = _percentile_band_100(raw_score)
        if raw_score < 40:
            label = _DIMENSION_LABELS.get(dim, {}).get("low", "Nízké")
        elif raw_score < 60:
            label = _DIMENSION_LABELS.get(dim, {}).get("mid_low", "Nižší")
        elif raw_score < 80:
            label = _DIMENSION_LABELS.get(dim, {}).get("balanced", "Vyvážené")
        else:
            label = _DIMENSION_LABELS.get(dim, {}).get("high", "Vysoké")
    else:
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
    return {
        "dimension": dim,
        "raw_score": raw_score,
        "percentile": percentile,
        "percentile_band": band,
        "label": label,
        "item_count": len(dim_items),
    }


def score_subdimensions(items: List[dict], responses: Dict[str, object]) -> List[dict]:
    buckets: Dict[Tuple[str, str], Dict[str, object]] = {}
    for item in items:
        subdimension = str(item.get("subdimension") or "").strip()
        if not subdimension:
            continue
        item_id = str(item.get("id"))
        if item_id not in responses:
            continue
        scored, max_score = _score_interactive(item, responses[item_id])
        dim = str(item.get("dimension") or "")
        key = (dim, subdimension)
        bucket = buckets.get(key)
        if not bucket:
            bucket = {
                "dimension": dim,
                "subdimension": subdimension,
                "total": 0.0,
                "max_total": 0.0,
                "count": 0,
                "max_scores": [],
            }
            buckets[key] = bucket
        bucket["total"] = float(bucket["total"]) + float(scored)
        bucket["max_total"] = float(bucket["max_total"]) + float(max_score)
        bucket["count"] = int(bucket["count"]) + 1
        bucket["max_scores"].append(float(max_score))

    output: List[dict] = []
    for bucket in buckets.values():
        max_total = float(bucket["max_total"] or 0.0)
        total = float(bucket["total"] or 0.0)
        count = int(bucket["count"] or 0)
        max_scores = bucket["max_scores"] or []
        normalized = 0.0 if max_total <= 0 else round((total / max_total) * 100.0, 2)
        all_likert = max_scores and all(abs(value - 7.0) < 0.01 for value in max_scores)
        if all_likert and count > 0:
            raw_score = round(total / count, 2)
        else:
            raw_score = normalized
        output.append(
            {
                "dimension": bucket["dimension"],
                "subdimension": bucket["subdimension"],
                "raw_score": raw_score,
                "normalized": normalized,
            }
        )
    return output


def compute_profile_confidence(items: List[dict], responses: Dict[str, object], dimension_scores: List[dict]) -> int:
    if not items:
        return 0

    item_ids = {str(item.get("id")) for item in items if item.get("id") is not None}
    answered = sum(1 for item_id in item_ids if item_id in responses)
    coverage_ratio = answered / max(1, len(item_ids))

    dims_with_evidence = sum(1 for row in dimension_scores if float(row.get("item_count") or 0) > 0)
    dimension_ratio = dims_with_evidence / max(1, len(JCFPM_DIMENSIONS))

    avg_items_per_dim = answered / max(1, dims_with_evidence)
    density_ratio = min(1.0, avg_items_per_dim / 4.0)

    score = (coverage_ratio * 0.5) + (dimension_ratio * 0.3) + (density_ratio * 0.2)
    return int(round(max(0.0, min(1.0, score)) * 100.0))
