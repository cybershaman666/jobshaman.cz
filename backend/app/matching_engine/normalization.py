from typing import Dict, Optional

from ..core.database import supabase

FX_TO_EUR = {
    "eur": 1.0,
    "czk": 0.040,
    "pln": 0.232,
    "usd": 0.92,
}


def _safe_float(value) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


def normalize_salary_index(job_features: Dict, candidate_country: str, candidate_city: str, seniority: Optional[str] = None) -> float:
    salary_from = _safe_float(job_features.get("salary_from"))
    salary_to = _safe_float(job_features.get("salary_to"))
    if salary_from <= 0 and salary_to <= 0:
        return 0.0

    base_salary = salary_to if salary_to > 0 else salary_from
    currency = (job_features.get("currency") or "czk").lower()
    eur_salary = base_salary * FX_TO_EUR.get(currency, 1.0)

    baseline = 2200.0
    if supabase:
        try:
            query = (
                supabase.table("salary_normalization")
                .select("normalized_index")
                .eq("country_code", (candidate_country or "").lower())
            )
            if candidate_city:
                query = query.eq("city", candidate_city)
            if seniority:
                query = query.eq("seniority", seniority)
            resp = query.order("updated_at", desc=True).limit(1).execute()
            row = (resp.data or [None])[0]
            if row and row.get("normalized_index"):
                baseline = max(1.0, float(row["normalized_index"]))
        except Exception as exc:
            print(f"⚠️ [Matching] salary normalization fallback due to error: {exc}")

    ratio = eur_salary / baseline
    score = max(0.0, min(1.0, ratio / 1.4))
    return score
