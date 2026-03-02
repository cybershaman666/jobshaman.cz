from __future__ import annotations

from typing import Dict, List

def _clamp(value: float) -> float:
    return max(0.0, min(100.0, value))


def _average(values: List[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def _pct(dimension_scores: List[dict], dim: str) -> float:
    row = next((item for item in dimension_scores if item.get("dimension") == dim), None)
    if not row:
        return 50.0
    raw = row.get("raw_score") or 0.0
    pct = row.get("percentile")
    if isinstance(pct, (int, float)):
        return float(_clamp(float(pct)))
    if dim.startswith("d7_") or dim.startswith("d8_") or dim.startswith("d9_") or dim.startswith("d10_") or dim.startswith("d11_") or dim.startswith("d12_"):
        return float(_clamp(float(raw)))
    return float(_clamp((float(raw) / 7.0) * 100.0))


def _match_subdims(subdimension_scores: List[dict], keywords: List[str]) -> List[float]:
    lowered = [key.lower() for key in keywords]
    matches: List[float] = []
    for row in subdimension_scores:
        subdim = str(row.get("subdimension") or "").lower()
        if not subdim:
            continue
        if any(key in subdim for key in lowered):
            value = row.get("normalized")
            if isinstance(value, (int, float)):
                matches.append(float(value))
    return matches


def compute_traits(dimension_scores: List[dict], subdimension_scores: List[dict]) -> Dict[str, Dict]:
    extraversion_signals = _match_subdims(
        subdimension_scores,
        ["leadership", "lead", "extern", "network", "komunik", "druž", "asertiv", "dominanc", "aktiv", "vzruš"],
    )
    agreeableness_signals = _match_subdims(
        subdimension_scores,
        ["empath", "empati", "etick", "moral", "fair", "férov", "důvěr", "altru", "tone", "feedback", "integrit"],
    )
    conscientiousness_signals = _match_subdims(
        subdimension_scores,
        ["strukt", "detail", "systemat", "poř", "organiz", "focus", "priorit", "decompos", "rozklad", "planning", "cílev", "discipl"],
    )
    openness_signals = _match_subdims(
        subdimension_scores,
        ["experiment", "innov", "nov", "změn", "kreat", "ambigu", "intuic", "big picture", "open", "ai", "tolerance"],
    )
    neuroticism_signals = _match_subdims(
        subdimension_scores,
        ["stres", "anx", "úzk", "neklid", "reakt", "impuls", "frustr", "tlak", "panic", "nerv", "hněv", "anger"],
    )

    extraversion = _clamp(_average(extraversion_signals or [_pct(dimension_scores, "d2_social"), _pct(dimension_scores, "d4_energy")]))
    agreeableness = _clamp(_average(agreeableness_signals or [_pct(dimension_scores, "d8_digital_eq"), _pct(dimension_scores, "d12_moral_compass"), _pct(dimension_scores, "d5_values")]))
    conscientiousness = _clamp(_average(conscientiousness_signals or [_pct(dimension_scores, "d1_cognitive"), _pct(dimension_scores, "d11_problem_decomposition"), _pct(dimension_scores, "d4_energy")]))
    openness = _clamp(_average(openness_signals or [_pct(dimension_scores, "d5_values"), _pct(dimension_scores, "d6_ai_readiness"), _pct(dimension_scores, "d10_ambiguity_interpretation")]))
    neuroticism_raw = _average(neuroticism_signals or [100.0 - _pct(dimension_scores, "d4_energy"), 100.0 - _pct(dimension_scores, "d6_ai_readiness")])
    neuroticism = _clamp(neuroticism_raw)

    dominance_signals = _match_subdims(subdimension_scores, ["leadership", "asertiv", "dominanc", "konfront", "assert", "lead"])
    reactivity_signals = _match_subdims(subdimension_scores, ["reakt", "stres", "impuls", "frustr", "tlak", "hněv", "anger", "urgent"])
    dominance_base = _average(dominance_signals or [extraversion, 100.0 - agreeableness])
    reactivity_base = _average(reactivity_signals or [neuroticism, 100.0 - _pct(dimension_scores, "d10_ambiguity_interpretation")])
    dominance = _clamp(dominance_base)
    reactivity = _clamp(reactivity_base)

    dominance_high = dominance >= 65.0
    reactivity_high = reactivity >= 65.0
    if dominance_high and reactivity_high:
        temperament_label = "cholerik"
    elif dominance_high and not reactivity_high:
        temperament_label = "sangvinik"
    elif not dominance_high and reactivity_high:
        temperament_label = "melancholik"
    else:
        temperament_label = "flegmatik"

    evidence_count = (
        len(extraversion_signals)
        + len(agreeableness_signals)
        + len(conscientiousness_signals)
        + len(openness_signals)
        + len(neuroticism_signals)
        + len(dominance_signals)
        + len(reactivity_signals)
    )
    signal_separation = (abs(dominance - 50.0) + abs(reactivity - 50.0)) / 2.0
    evidence_ratio = min(1.0, evidence_count / 12.0)
    confidence = _clamp((signal_separation * 0.55) + (evidence_ratio * 45.0))

    notes: List[str] = []
    if evidence_count < 4:
        notes.append("Temperament je odhad s nižší jistotou kvůli omezenému množství signálů.")
    elif evidence_count >= 8:
        notes.append("Temperament vychází z více shodných signálů napříč dimenzemi a subdimenzemi.")
    if 45.0 <= dominance <= 55.0 and 45.0 <= reactivity <= 55.0:
        notes.append("Profil leží blízko středu, proto je temperament spíše jemný než vyhraněný.")

    return {
        "big_five": {
            "openness": round(openness, 2),
            "conscientiousness": round(conscientiousness, 2),
            "extraversion": round(extraversion, 2),
            "agreeableness": round(agreeableness, 2),
            "neuroticism": round(neuroticism, 2),
            "derived": True,
        },
        "temperament": {
            "label": temperament_label,
            "dominance": round(dominance, 2),
            "reactivity": round(reactivity, 2),
            "confidence": round(confidence, 2),
            "notes": notes,
        },
    }
