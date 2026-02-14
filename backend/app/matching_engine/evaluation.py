import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from ..core.database import supabase


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _auc_roc(pairs: List[Tuple[float, int]]) -> Optional[float]:
    if not pairs:
        return None

    positives = sum(1 for _, y in pairs if y == 1)
    negatives = len(pairs) - positives
    if positives == 0 or negatives == 0:
        return None

    ranked = sorted(pairs, key=lambda item: item[0])
    rank_sum_pos = 0.0
    rank = 1
    i = 0
    while i < len(ranked):
        j = i
        score = ranked[i][0]
        while j < len(ranked) and ranked[j][0] == score:
            j += 1
        avg_rank = (rank + (rank + (j - i) - 1)) / 2.0
        pos_in_group = sum(1 for _, y in ranked[i:j] if y == 1)
        rank_sum_pos += avg_rank * pos_in_group
        rank += (j - i)
        i = j

    auc = (rank_sum_pos - (positives * (positives + 1) / 2.0)) / (positives * negatives)
    return max(0.0, min(1.0, auc))


def _log_loss(pairs: List[Tuple[float, int]]) -> Optional[float]:
    if not pairs:
        return None
    eps = 1e-15
    total = 0.0
    for p, y in pairs:
        p = min(max(p, eps), 1.0 - eps)
        total += y * math.log(p) + (1 - y) * math.log(1 - p)
    return -total / len(pairs)


def _precision_at_k(exposures: List[Dict], positive_keys: set, k: int) -> Optional[float]:
    if k <= 0:
        return None

    by_request = defaultdict(list)
    for row in exposures:
        req = row.get("request_id")
        if not req:
            continue
        by_request[req].append(row)

    if not by_request:
        return None

    request_scores = []
    for rows in by_request.values():
        rows.sort(key=lambda r: int(r.get("position") or 9999))
        top = rows[:k]
        if not top:
            continue
        hits = 0
        for r in top:
            key = (str(r.get("request_id") or ""), str(r.get("user_id") or ""), str(r.get("job_id") or ""))
            if key in positive_keys:
                hits += 1
        request_scores.append(hits / max(1, len(top)))

    if not request_scores:
        return None
    return sum(request_scores) / len(request_scores)


def _insert_eval_row(model_key: str, model_version: str, scoring_version: Optional[str], window_days: int, sample_size: int, auc: Optional[float], log_loss: Optional[float], p5: Optional[float], p10: Optional[float], notes: str = "") -> None:
    if not supabase:
        return
    payload = {
        "model_key": model_key,
        "model_version": model_version,
        "scoring_version": scoring_version,
        "window_days": window_days,
        "sample_size": sample_size,
        "auc": auc,
        "log_loss": log_loss,
        "precision_at_5": p5,
        "precision_at_10": p10,
        "notes": notes,
    }
    supabase.table("model_offline_evaluations").insert(payload).execute()


def run_offline_recommendation_evaluation(window_days: int = 30) -> Dict:
    if not supabase:
        return {"sample_size": 0}

    start_iso = (datetime.now(timezone.utc) - timedelta(days=window_days)).isoformat()

    try:
        exposure_rows = (
            supabase.table("recommendation_exposures")
            .select("request_id,user_id,job_id,position,score,predicted_action_probability,action_model_version,scoring_version,shown_at")
            .gte("shown_at", start_iso)
            .order("shown_at", desc=True)
            .limit(30000)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        print(f"⚠️ [Evaluation] failed to load exposures: {exc}")
        return {"sample_size": 0}

    if not exposure_rows:
        return {"sample_size": 0}

    try:
        feedback_rows = (
            supabase.table("recommendation_feedback_events")
            .select("request_id,user_id,job_id,signal_type,created_at")
            .gte("created_at", start_iso)
            .eq("signal_type", "apply_click")
            .limit(30000)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        print(f"⚠️ [Evaluation] failed to load feedback rows: {exc}")
        feedback_rows = []

    positive_with_request = {
        (str(row.get("request_id") or ""), str(row.get("user_id") or ""), str(row.get("job_id") or ""))
        for row in feedback_rows
        if row.get("user_id") and row.get("job_id")
    }
    positive_without_request = {
        (str(row.get("user_id") or ""), str(row.get("job_id") or ""))
        for row in feedback_rows
        if row.get("user_id") and row.get("job_id")
    }

    pairs: List[Tuple[float, int]] = []
    by_scoring: Dict[str, List[Tuple[float, int]]] = defaultdict(list)

    for row in exposure_rows:
        req_id = str(row.get("request_id") or "")
        user_id = str(row.get("user_id") or "")
        job_id = str(row.get("job_id") or "")
        if not user_id or not job_id:
            continue

        y = 1 if ((req_id, user_id, job_id) in positive_with_request or (user_id, job_id) in positive_without_request) else 0
        pred = row.get("predicted_action_probability")
        if pred is None:
            pred = _safe_float(row.get("score"), 0.0) / 100.0
        p = min(max(_safe_float(pred, 0.0), 0.000001), 0.999999)

        pairs.append((p, y))
        scoring = str(row.get("scoring_version") or "unknown")
        by_scoring[scoring].append((p, y))

    auc = _auc_roc(pairs)
    ll = _log_loss(pairs)
    p5 = _precision_at_k(exposure_rows, positive_with_request, 5)
    p10 = _precision_at_k(exposure_rows, positive_with_request, 10)

    model_version = str((exposure_rows[0] or {}).get("action_model_version") or "v1")
    try:
        _insert_eval_row(
            model_key="job_apply_probability",
            model_version=model_version,
            scoring_version=None,
            window_days=window_days,
            sample_size=len(pairs),
            auc=auc,
            log_loss=ll,
            p5=p5,
            p10=p10,
            notes="overall",
        )
    except Exception as exc:
        print(f"⚠️ [Evaluation] failed writing overall eval: {exc}")

    per_scoring = []
    for scoring_version, scoring_pairs in by_scoring.items():
        s_auc = _auc_roc(scoring_pairs)
        s_ll = _log_loss(scoring_pairs)
        per_scoring.append(
            {
                "scoring_version": scoring_version,
                "sample_size": len(scoring_pairs),
                "auc": round(s_auc, 6) if s_auc is not None else None,
                "log_loss": round(s_ll, 6) if s_ll is not None else None,
            }
        )
        try:
            _insert_eval_row(
                model_key="job_apply_probability",
                model_version=model_version,
                scoring_version=scoring_version,
                window_days=window_days,
                sample_size=len(scoring_pairs),
                auc=s_auc,
                log_loss=s_ll,
                p5=None,
                p10=None,
                notes="per_scoring_version",
            )
        except Exception as exc:
            print(f"⚠️ [Evaluation] failed writing per-scoring eval ({scoring_version}): {exc}")

    per_scoring.sort(key=lambda row: row.get("auc") if row.get("auc") is not None else -1, reverse=True)

    return {
        "sample_size": len(pairs),
        "auc": round(auc, 6) if auc is not None else None,
        "log_loss": round(ll, 6) if ll is not None else None,
        "precision_at_5": round(p5, 6) if p5 is not None else None,
        "precision_at_10": round(p10, 6) if p10 is not None else None,
        "per_scoring": per_scoring,
    }
