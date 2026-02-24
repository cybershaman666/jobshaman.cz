from __future__ import annotations

from datetime import datetime, timedelta, timezone
import math
import re
from statistics import mean, median, pstdev
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query

from ..core.database import supabase
from ..core.security import require_company_access, verify_subscription

router = APIRouter()

DEFAULT_WINDOW_DAYS = 90
MIN_INTERNAL_SAMPLE = 30
MIN_VARIANCE_SAMPLE = 8
CONFIDENCE_LOW_THRESHOLD = 45
CONFIDENCE_MEDIUM_THRESHOLD = 70
MIN_PEER_COMPANIES = 8


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        v = float(value)
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    except Exception:
        return None


def _safe_int(value: Any) -> Optional[int]:
    v = _safe_float(value)
    if v is None:
        return None
    return int(round(v))


def _parse_job_id(raw: str) -> int:
    value = str(raw or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Missing job_id")
    match = re.search(r"(\d+)$", value)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid job_id")
    return int(match.group(1))


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        text = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _normalize_timeframe_to_monthly(amount: float, timeframe: Optional[str]) -> float:
    tf = str(timeframe or "").strip().lower()
    if tf in {"year", "yearly", "annual"}:
        return amount / 12.0
    if tf in {"hour", "hourly"}:
        return amount * 22.0 * 8.0
    if tf in {"day", "daily"}:
        return amount * 22.0
    if tf in {"week", "weekly"}:
        return amount * 4.345
    return amount


def _monthly_salary_from_row(row: Dict[str, Any]) -> Optional[float]:
    salary_from = _safe_float(row.get("salary_from"))
    salary_to = _safe_float(row.get("salary_to"))
    timeframe = row.get("salary_timeframe")

    candidates = [v for v in [salary_from, salary_to] if v and v > 0]
    if not candidates:
        return None

    base = mean(candidates)
    monthly = _normalize_timeframe_to_monthly(base, timeframe)
    if monthly <= 0:
        return None
    return monthly


def _infer_role_family(title: str) -> str:
    t = (title or "").lower()
    if any(k in t for k in ["developer", "engineer", "program", "software", "frontend", "backend", "devops", "qa", "data"]):
        return "engineering"
    if any(k in t for k in ["sales", "account", "obchod", "business development"]):
        return "sales"
    if any(k in t for k in ["marketing", "content", "seo", "growth"]):
        return "marketing"
    if any(k in t for k in ["finance", "accounting", "controller", "účto", "mzd"]):
        return "finance"
    if any(k in t for k in ["hr", "recruit", "talent", "people"]):
        return "hr"
    if any(k in t for k in ["support", "customer", "helpdesk"]):
        return "customer_support"
    if any(k in t for k in ["project", "product manager", "product owner", "analyst"]):
        return "product_project"
    return "general"


def _infer_seniority(title: str, description: str = "") -> str:
    text = f"{title or ''} {description or ''}".lower()
    if any(k in text for k in ["lead", "principal", "head", "director", "staff"]):
        return "lead"
    if any(k in text for k in ["senior", "sr.", "sr "]):
        return "senior"
    if any(k in text for k in ["junior", "jr.", "trainee", "graduate", "absolvent"]):
        return "junior"
    return "mid"


def _infer_employment_type(contract_type: str) -> str:
    t = (contract_type or "").lower()
    if any(k in t for k in ["ico", "ičo", "contractor", "freelance", "b2b", "osvč"]):
        return "contractor"
    return "employee"


def _infer_region_key(location: str, country_code: str) -> str:
    loc = (location or "").strip()
    if not loc:
        return f"{country_code.lower()}_national"
    parts = [p.strip().lower() for p in re.split(r",|/|\|", loc) if p.strip()]
    if not parts:
        return f"{country_code.lower()}_national"
    region = parts[0]
    region = re.sub(r"\s+", "_", region)
    region = re.sub(r"[^a-z0-9_\-]", "", region)
    if not region:
        return f"{country_code.lower()}_national"
    return region


def _quantile(sorted_values: List[float], q: float) -> float:
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    idx = (len(sorted_values) - 1) * q
    lo = math.floor(idx)
    hi = math.ceil(idx)
    if lo == hi:
        return sorted_values[lo]
    return sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * (idx - lo)


def _confidence_tier(score: float) -> str:
    if score < CONFIDENCE_LOW_THRESHOLD:
        return "low"
    if score < CONFIDENCE_MEDIUM_THRESHOLD:
        return "medium"
    return "high"


def _compute_confidence(values: List[float], recency_days: List[float], window_days: int) -> Tuple[float, str, Dict[str, float]]:
    n = len(values)
    if n == 0:
        return 0.0, "low", {
            "sample_size_component": 0.0,
            "variance_component": 0.0,
            "recency_component": 0.0,
        }

    sorted_vals = sorted(values)
    p50 = _quantile(sorted_vals, 0.50)
    p25 = _quantile(sorted_vals, 0.25)
    p75 = _quantile(sorted_vals, 0.75)
    iqr = max(0.0, p75 - p25)

    sample_component = min(1.0, n / 120.0)
    variance_ratio = min(1.0, iqr / max(abs(p50), 1.0))
    variance_component = 1.0 - variance_ratio

    avg_recency = mean(recency_days) if recency_days else float(window_days)
    recency_component = 1.0 - min(1.0, max(0.0, avg_recency / max(window_days, 1)))

    score = (sample_component * 45.0) + (variance_component * 35.0) + (recency_component * 20.0)
    tier = _confidence_tier(score)

    return score, tier, {
        "sample_size_component": round(sample_component, 4),
        "variance_component": round(variance_component, 4),
        "recency_component": round(recency_component, 4),
    }


def _salary_percentile(value: float, p25: float, p50: float, p75: float) -> float:
    if value <= p25:
        return 25.0 * (value / max(p25, 1.0))
    if value <= p50:
        span = max(p50 - p25, 1.0)
        return 25.0 + ((value - p25) / span) * 25.0
    if value <= p75:
        span = max(p75 - p50, 1.0)
        return 50.0 + ((value - p50) / span) * 25.0
    if p75 <= 0:
        return 75.0
    tail = min(1.0, (value - p75) / max(p75, 1.0))
    return min(99.0, 75.0 + tail * 24.0)


def _fetch_job(job_id: int) -> Dict[str, Any]:
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    resp = (
        supabase
        .table("jobs")
        .select("id,title,description,location,country_code,contract_type,salary_from,salary_to,salary_timeframe,currency,salary_currency,scraped_at")
        .eq("id", job_id)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Job not found")
    return rows[0]


def _fetch_internal_salary_population(country_code: str, window_days: int) -> List[Dict[str, Any]]:
    since = _to_iso(_utc_now() - timedelta(days=window_days))
    resp = (
        supabase
        .table("jobs")
        .select("id,title,description,location,country_code,contract_type,salary_from,salary_to,salary_timeframe,scraped_at")
        .eq("legality_status", "legal")
        .eq("status", "active")
        .eq("country_code", country_code)
        .gte("scraped_at", since)
        .limit(5000)
        .execute()
    )
    return resp.data or []


def _get_external_reference(
    country_code: str,
    role_family: str,
    seniority_band: str,
    employment_type: str,
    region_key: Optional[str],
) -> Optional[Dict[str, Any]]:
    if not supabase:
        return None

    queries = []
    if region_key:
        queries.append(("region", region_key))
    queries.append(("national", f"{country_code.lower()}_national"))

    for _, target_region in queries:
        resp = (
            supabase
            .table("salary_public_reference")
            .select("role_family,country_code,region_key,seniority_band,employment_type,currency,p25,p50,p75,sample_size,data_window_days,source_name,updated_at,method_version")
            .eq("country_code", country_code)
            .eq("role_family", role_family)
            .eq("seniority_band", seniority_band)
            .eq("employment_type", employment_type)
            .eq("region_key", target_region)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if rows:
            return rows[0]
    return None


@router.get("/benchmarks/salary")
async def get_salary_benchmark(job_id: str = Query(...), window_days: int = Query(DEFAULT_WINDOW_DAYS, ge=14, le=365)):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    parsed_job_id = _parse_job_id(job_id)
    job = _fetch_job(parsed_job_id)

    country_code = str(job.get("country_code") or "cz").lower()
    role_family = _infer_role_family(str(job.get("title") or ""))
    seniority_band = _infer_seniority(str(job.get("title") or ""), str(job.get("description") or ""))
    employment_type = _infer_employment_type(str(job.get("contract_type") or ""))
    region_key = _infer_region_key(str(job.get("location") or ""), country_code)

    offer_monthly = _monthly_salary_from_row(job)

    population = _fetch_internal_salary_population(country_code, window_days)

    strict_values: List[float] = []
    strict_recency_days: List[float] = []
    regional_values: List[float] = []
    regional_recency_days: List[float] = []

    now = _utc_now()
    for row in population:
        monthly = _monthly_salary_from_row(row)
        if monthly is None:
            continue

        row_role = _infer_role_family(str(row.get("title") or ""))
        row_seniority = _infer_seniority(str(row.get("title") or ""), str(row.get("description") or ""))
        row_emp = _infer_employment_type(str(row.get("contract_type") or ""))
        row_region = _infer_region_key(str(row.get("location") or ""), country_code)
        scraped = _parse_dt(row.get("scraped_at")) or now
        recency_days = max(0.0, (now - scraped).total_seconds() / 86400.0)

        if row_role == role_family and row_seniority == seniority_band and row_emp == employment_type:
            regional_values.append(monthly)
            regional_recency_days.append(recency_days)
            if row_region == region_key:
                strict_values.append(monthly)
                strict_recency_days.append(recency_days)

    used_values = strict_values
    used_recency = strict_recency_days
    source_mode = "internal_only"
    fallback_reason = None
    fallback_details = {
        "strict_region_sample": len(strict_values),
        "country_sample": len(regional_values),
        "external_sample": 0,
    }

    if len(used_values) < MIN_INTERNAL_SAMPLE and len(regional_values) >= MIN_INTERNAL_SAMPLE:
        used_values = regional_values
        used_recency = regional_recency_days
        fallback_reason = (
            f"Regionální vzorek nedostatečný (N={len(strict_values)}). "
            f"Použit národní interní benchmark (N={len(regional_values)})."
        )

    confidence_score, confidence_tier, components = _compute_confidence(used_values, used_recency, window_days)
    internal_valid = len(used_values) >= MIN_INTERNAL_SAMPLE and confidence_tier != "low"

    external_ref = _get_external_reference(
        country_code=country_code.upper(),
        role_family=role_family,
        seniority_band=seniority_band,
        employment_type=employment_type,
        region_key=region_key,
    )

    if not internal_valid:
        if external_ref:
            external_p25 = _safe_float(external_ref.get("p25")) or 0.0
            external_p50 = _safe_float(external_ref.get("p50")) or 0.0
            external_p75 = _safe_float(external_ref.get("p75")) or 0.0
            external_n = int(_safe_float(external_ref.get("sample_size")) or 0)
            fallback_details["external_sample"] = external_n

            if len(used_values) == 0:
                used_values = [external_p25, external_p50, external_p75]
                source_mode = "public_fallback"
                fallback_reason = (
                    "Interní segment nemá dost dat. "
                    f"Použit veřejný benchmark (N={external_n})."
                )
                confidence_score = 55.0 if external_n >= MIN_INTERNAL_SAMPLE else 40.0
                confidence_tier = "medium" if external_n >= MIN_INTERNAL_SAMPLE else "low"
                components = {
                    "sample_size_component": min(1.0, external_n / 120.0),
                    "variance_component": 0.7,
                    "recency_component": 0.6,
                }
            else:
                source_mode = "blended_internal_public"
                internal_n = len(used_values)
                total_n = internal_n + max(external_n, 1)
                w_int = internal_n / total_n
                w_ext = 1.0 - w_int

                in_sorted = sorted(used_values)
                i_p25 = _quantile(in_sorted, 0.25)
                i_p50 = _quantile(in_sorted, 0.50)
                i_p75 = _quantile(in_sorted, 0.75)

                blended_p25 = (i_p25 * w_int) + (external_p25 * w_ext)
                blended_p50 = (i_p50 * w_int) + (external_p50 * w_ext)
                blended_p75 = (i_p75 * w_int) + (external_p75 * w_ext)
                used_values = [blended_p25, blended_p50, blended_p75]

                fallback_reason = (
                    f"Interní segment má nízkou robustnost (N={internal_n}). "
                    f"Doplněno veřejným benchmarkem (N={external_n})."
                )
                confidence_score = min(95.0, confidence_score + 10.0)
                confidence_tier = _confidence_tier(confidence_score)
        else:
            source_mode = "internal_only"
            return {
                "job_id": parsed_job_id,
                "insufficient_data": True,
                "message": "Insufficient data for salary benchmark.",
                "transparency": {
                    "source_name": "jobshaman_jobs",
                    "source_mode": "internal_only",
                    "sample_size": len(used_values),
                    "data_window_days": window_days,
                    "updated_at": _to_iso(_utc_now()),
                    "confidence_score": round(confidence_score, 2),
                    "confidence_tier": confidence_tier,
                    "fallback_reason": (
                        f"Interní vzorek nedostatečný (N={len(used_values)}) a veřejný fallback není dostupný."
                    ),
                    "confidence_components": components,
                    "fallback_details": fallback_details,
                    "method_version": "salary-benchmark-v2",
                },
            }

    if not used_values:
        return {
            "job_id": parsed_job_id,
            "insufficient_data": True,
            "message": "Insufficient data for salary benchmark.",
            "transparency": {
                "source_name": "jobshaman_jobs",
                "source_mode": "internal_only",
                "sample_size": 0,
                "data_window_days": window_days,
                "updated_at": _to_iso(_utc_now()),
                "confidence_score": 0,
                "confidence_tier": "low",
                "fallback_reason": "Nedostatečný vzorek a chybí veřejný fallback.",
                "confidence_components": components,
            },
        }

    sorted_vals = sorted(used_values)
    p25 = _quantile(sorted_vals, 0.25)
    p50 = _quantile(sorted_vals, 0.50)
    p75 = _quantile(sorted_vals, 0.75)
    iqr = max(0.0, p75 - p25)

    offer_salary = offer_monthly or 0.0
    delta_vs_p50 = offer_salary - p50 if offer_salary else 0.0
    delta_vs_p50_pct = (delta_vs_p50 / p50 * 100.0) if p50 > 0 and offer_salary else 0.0
    percentile_in_segment = _salary_percentile(offer_salary, p25, p50, p75) if offer_salary else None

    updated_at = _to_iso(_utc_now())
    source_name = "jobshaman_jobs"
    external_source_name = external_ref.get("source_name") if external_ref else None
    if source_mode == "public_fallback" and external_source_name:
        source_name = str(external_source_name)
    elif source_mode == "blended_internal_public" and external_source_name:
        source_name = f"jobshaman_jobs + {external_source_name}"

    return {
        "job_id": parsed_job_id,
        "insufficient_data": False,
        "role_family": role_family,
        "region_key": region_key,
        "seniority_band": seniority_band,
        "employment_type": employment_type,
        "currency": str(job.get("salary_currency") or job.get("currency") or "CZK"),
        "offer_salary_monthly": round(offer_salary, 2) if offer_salary else None,
        "p25": round(p25, 2),
        "p50": round(p50, 2),
        "p75": round(p75, 2),
        "iqr": round(iqr, 2),
        "delta_vs_p50": round(delta_vs_p50, 2),
        "delta_vs_p50_pct": round(delta_vs_p50_pct, 2),
        "percentile_in_segment": round(percentile_in_segment, 2) if percentile_in_segment is not None else None,
        "transparency": {
            "source_name": source_name,
            "source_mode": source_mode,
            "sample_size": (
                len(used_values)
                if source_mode == "internal_only"
                else fallback_details["external_sample"]
                if source_mode == "public_fallback"
                else (fallback_details["country_sample"] + fallback_details["external_sample"])
            ),
            "data_window_days": int(external_ref.get("data_window_days") or window_days) if source_mode == "public_fallback" and external_ref else window_days,
            "updated_at": str(external_ref.get("updated_at")) if source_mode == "public_fallback" and external_ref else updated_at,
            "iqr": round(iqr, 2),
            "confidence_score": round(confidence_score, 2),
            "confidence_tier": confidence_tier,
            "fallback_reason": fallback_reason,
            "fallback_details": fallback_details,
            "confidence_components": components,
            "method_version": str((external_ref or {}).get("method_version") or "salary-benchmark-v2"),
        },
    }


def _confidence_for_rate(value: float, denominator: int, avg_recency_days: float, window_days: int) -> Tuple[float, str, Dict[str, float]]:
    if denominator <= 0:
        return 0.0, "low", {
            "sample_size_component": 0.0,
            "variance_component": 0.0,
            "recency_component": 0.0,
        }

    sample_component = min(1.0, denominator / 200.0)
    se = math.sqrt(max(value * (1.0 - value), 0.0) / max(denominator, 1))
    variance_component = 1.0 - min(1.0, se / 0.25)
    recency_component = 1.0 - min(1.0, max(0.0, avg_recency_days / max(window_days, 1)))

    score = (sample_component * 45.0) + (variance_component * 30.0) + (recency_component * 25.0)
    return score, _confidence_tier(score), {
        "sample_size_component": round(sample_component, 4),
        "variance_component": round(variance_component, 4),
        "recency_component": round(recency_component, 4),
    }


def _company_volume_band(applied_count: int) -> str:
    if applied_count < 50:
        return "small"
    if applied_count < 200:
        return "medium"
    return "large"


def _parse_status(value: Any) -> str:
    return str(value or "").strip().lower()


@router.get("/company/benchmarks/candidate")
async def get_company_candidate_benchmarks(
    company_id: str = Query(...),
    job_id: Optional[str] = Query(None),
    window_days: int = Query(DEFAULT_WINDOW_DAYS, ge=14, le=365),
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    require_company_access(user, company_id)
    parsed_job_id = _parse_job_id(job_id) if job_id else None
    since_iso = _to_iso(_utc_now() - timedelta(days=window_days))

    apps_query = (
        supabase
        .table("job_applications")
        .select("candidate_id,status,created_at,job_id,company_id")
        .eq("company_id", company_id)
        .gte("created_at", since_iso)
    )
    if parsed_job_id is not None:
        apps_query = apps_query.eq("job_id", parsed_job_id)
    apps_resp = apps_query.execute()
    applications = apps_resp.data or []

    ass_query = (
        supabase
        .table("assessment_results")
        .select("candidate_id,score_percent,score,completed_at,job_id,company_id")
        .eq("company_id", company_id)
        .gte("completed_at", since_iso)
    )
    if parsed_job_id is not None:
        ass_query = ass_query.eq("job_id", parsed_job_id)
    ass_resp = ass_query.execute()
    assessments = ass_resp.data or []

    now = _utc_now()

    total_candidates = len({str(a.get("candidate_id")) for a in applications if a.get("candidate_id")})
    assessed_candidates = len({str(a.get("candidate_id")) for a in assessments if a.get("candidate_id")})

    assessment_scores: List[float] = []
    assessment_recency: List[float] = []
    for row in assessments:
        score = _safe_float(row.get("score_percent"))
        if score is None:
            score = _safe_float(row.get("score"))
        if score is None:
            continue
        assessment_scores.append(score)
        dt = _parse_dt(row.get("completed_at")) or now
        assessment_recency.append(max(0.0, (now - dt).total_seconds() / 86400.0))

    assessment_avg = mean(assessment_scores) if assessment_scores else None
    assessment_med = median(assessment_scores) if assessment_scores else None

    app_statuses = [_parse_status(a.get("status")) for a in applications]
    applied_count = len(app_statuses)
    shortlisted_count = sum(1 for s in app_statuses if s in {"shortlisted", "hired"})
    hired_count = sum(1 for s in app_statuses if s == "hired")

    shortlist_rate = (shortlisted_count / applied_count) if applied_count > 0 else None
    hire_rate = (hired_count / applied_count) if applied_count > 0 else None

    app_recency_days: List[float] = []
    for a in applications:
        dt = _parse_dt(a.get("created_at")) or now
        app_recency_days.append(max(0.0, (now - dt).total_seconds() / 86400.0))
    avg_app_recency = mean(app_recency_days) if app_recency_days else float(window_days)
    avg_ass_recency = mean(assessment_recency) if assessment_recency else float(window_days)

    # Peer benchmark by hiring volume band
    all_apps_resp = (
        supabase
        .table("job_applications")
        .select("company_id,status,created_at")
        .gte("created_at", since_iso)
        .limit(10000)
        .execute()
    )
    all_apps = all_apps_resp.data or []

    company_counts: Dict[str, Dict[str, int]] = {}
    for row in all_apps:
        cid = str(row.get("company_id") or "")
        if not cid:
            continue
        st = _parse_status(row.get("status"))
        if cid not in company_counts:
            company_counts[cid] = {"applied": 0, "shortlisted": 0, "hired": 0}
        company_counts[cid]["applied"] += 1
        if st in {"shortlisted", "hired"}:
            company_counts[cid]["shortlisted"] += 1
        if st == "hired":
            company_counts[cid]["hired"] += 1

    target_band = _company_volume_band(applied_count)
    peer_shortlist_rates: List[float] = []
    peer_hire_rates: List[float] = []
    peer_company_count = 0
    for cid, counts in company_counts.items():
        if cid == company_id:
            continue
        band = _company_volume_band(counts["applied"])
        if band != target_band or counts["applied"] <= 0:
            continue
        peer_company_count += 1
        peer_shortlist_rates.append(counts["shortlisted"] / counts["applied"])
        peer_hire_rates.append(counts["hired"] / counts["applied"])

    peer_shortlist_median = median(peer_shortlist_rates) if peer_shortlist_rates else None
    peer_hire_median = median(peer_hire_rates) if peer_hire_rates else None

    # Peer assessment benchmark
    all_assess_resp = (
        supabase
        .table("assessment_results")
        .select("company_id,score_percent,score,completed_at")
        .gte("completed_at", since_iso)
        .limit(10000)
        .execute()
    )
    all_assess = all_assess_resp.data or []

    scores_by_company: Dict[str, List[float]] = {}
    for row in all_assess:
        cid = str(row.get("company_id") or "")
        if not cid:
            continue
        score = _safe_float(row.get("score_percent"))
        if score is None:
            score = _safe_float(row.get("score"))
        if score is None:
            continue
        scores_by_company.setdefault(cid, []).append(score)

    peer_assessment_avgs: List[float] = []
    for cid, values in scores_by_company.items():
        if cid == company_id:
            continue
        counts = company_counts.get(cid)
        if not counts:
            continue
        if _company_volume_band(counts["applied"]) != target_band:
            continue
        if len(values) >= 3:
            peer_assessment_avgs.append(mean(values))

    peer_assessment_median = median(peer_assessment_avgs) if peer_assessment_avgs else None

    peer_sample_sufficient = peer_company_count >= MIN_PEER_COMPANIES
    if not peer_sample_sufficient:
        peer_assessment_median = None
        peer_shortlist_median = None
        peer_hire_median = None

    ass_conf_score, ass_conf_tier, ass_conf_components = _compute_confidence(
        assessment_scores,
        assessment_recency,
        window_days,
    )
    short_conf_score, short_conf_tier, short_conf_components = _confidence_for_rate(
        shortlist_rate or 0.0,
        applied_count,
        avg_app_recency,
        window_days,
    )
    hire_conf_score, hire_conf_tier, hire_conf_components = _confidence_for_rate(
        hire_rate or 0.0,
        applied_count,
        avg_app_recency,
        window_days,
    )

    updated_at = _to_iso(now)

    def _metric_payload(
        name: str,
        value: Optional[float],
        peer_value: Optional[float],
        sample_size: int,
        confidence_score: float,
        confidence_tier: str,
        confidence_components: Dict[str, float],
        numerator: Optional[int] = None,
        denominator: Optional[int] = None,
        extra: Optional[Dict[str, Any]] = None,
        requires_peer: bool = True,
    ) -> Dict[str, Any]:
        insufficient_data = sample_size <= 0 or (requires_peer and peer_value is None)
        payload = {
            "metric": name,
            "value": round(value, 4) if value is not None else None,
            "peer_value": round(peer_value, 4) if peer_value is not None else None,
            "delta_vs_peer": round((value - peer_value), 4) if value is not None and peer_value is not None else None,
            "sample_size": sample_size,
            "source_name": "jobshaman_internal",
            "source_mode": "internal_only",
            "data_window_days": window_days,
            "updated_at": updated_at,
            "confidence_score": round(confidence_score, 2),
            "confidence_tier": confidence_tier,
            "confidence_components": confidence_components,
            "insufficient_data": insufficient_data,
            "fallback_reason": None if not requires_peer or peer_value is not None else (
                f"Peer sample nedostatečný (companies={peer_company_count}, minimum={MIN_PEER_COMPANIES})."
            ),
        }
        if numerator is not None:
            payload["numerator"] = numerator
        if denominator is not None:
            payload["denominator"] = denominator
        if extra:
            payload.update(extra)
        return payload

    coverage_ratio = (assessed_candidates / total_candidates) if total_candidates > 0 else None

    return {
        "company_id": company_id,
        "job_id": parsed_job_id,
        "peer_group": {
            "hiring_volume_band": target_band,
            "peer_company_count": peer_company_count,
        },
        "assessment": _metric_payload(
            name="assessment_avg",
            value=assessment_avg,
            peer_value=peer_assessment_median,
            sample_size=len(assessment_scores),
            confidence_score=ass_conf_score,
            confidence_tier=ass_conf_tier,
            confidence_components=ass_conf_components,
            extra={
                "median": round(assessment_med, 4) if assessment_med is not None else None,
                "coverage": {
                    "assessed_candidates": assessed_candidates,
                    "total_candidates": total_candidates,
                    "coverage_ratio": round(coverage_ratio, 4) if coverage_ratio is not None else None,
                },
            },
            requires_peer=True,
        ),
        "shortlist_rate": _metric_payload(
            name="shortlist_rate",
            value=shortlist_rate,
            peer_value=peer_shortlist_median,
            sample_size=applied_count,
            confidence_score=short_conf_score,
            confidence_tier=short_conf_tier,
            confidence_components=short_conf_components,
            numerator=shortlisted_count,
            denominator=applied_count,
            requires_peer=True,
        ),
        "hire_rate": _metric_payload(
            name="hire_rate",
            value=hire_rate,
            peer_value=peer_hire_median,
            sample_size=applied_count,
            confidence_score=hire_conf_score,
            confidence_tier=hire_conf_tier,
            confidence_components=hire_conf_components,
            numerator=hired_count,
            denominator=applied_count,
            requires_peer=True,
        ),
        "transparency": {
            "source_name": "jobshaman_internal",
            "source_mode": "internal_only",
            "data_window_days": window_days,
            "updated_at": updated_at,
            "note": "Oddělené metriky bez agregovaného quality indexu.",
        },
    }


@router.get("/benchmarks/methodology")
async def get_benchmark_methodology():
    return {
        "method_version": "benchmark-v2",
        "salary": {
            "primary_source": "JobShaman internal jobs",
            "fallback_source": "Validated public national statistics",
            "segmentation": ["role_family", "region", "seniority", "employment_type"],
            "metrics": ["p25", "p50", "p75", "iqr", "sample_size", "data_window_days"],
            "confidence_inputs": ["sample_size", "variance_iqr", "recency"],
            "fallback_policy": "Region -> national, internal -> blended/public fallback when quality thresholds fail",
        },
        "candidate": {
            "ui_policy": "No composite quality index in UI",
            "metrics": ["assessment_avg", "shortlist_rate", "hire_rate"],
            "coverage": "Assessment coverage shown as assessed/total",
            "peer_benchmark": "Peer groups by hiring volume band",
            "confidence_inputs": ["sample_size", "variance", "recency"],
        },
    }
