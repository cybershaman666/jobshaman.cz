from __future__ import annotations

from datetime import datetime, timedelta, timezone
import math
import re
from statistics import mean, median, pstdev
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query

from ..matching_engine.role_taxonomy import ROLE_FAMILY_KEYWORDS

from ..core.database import supabase
from ..core.security import require_company_access, verify_subscription
from ..models.requests import HappinessAuditSimulateRequest

router = APIRouter()

DEFAULT_WINDOW_DAYS = 90
MIN_INTERNAL_SAMPLE = 30
MIN_VARIANCE_SAMPLE = 8
CONFIDENCE_LOW_THRESHOLD = 45
CONFIDENCE_MEDIUM_THRESHOLD = 70
MIN_PEER_COMPANIES = 8


def _is_missing_location_public_column(error: Exception) -> bool:
    code = getattr(error, "code", "") or ""
    message = str(getattr(error, "message", "") or error)
    return str(code) == "42703" and "location_public" in message.lower()


@router.post("/audit/happiness/simulate")
async def simulate_happiness_audit(payload: HappinessAuditSimulateRequest):
    # Time ring penalizes long commute and low home-office flexibility.
    effective_commute = max(0, payload.commute_minutes_daily - (payload.home_office_days * 12))
    time_ring = min(100, round((effective_commute / 120) * 100))

    # Energy ring mixes subjective energy with financial friction.
    net_pressure = 0.0
    if payload.salary > 0:
        net_pressure = min(1.0, payload.commute_cost / payload.salary)
    energy_load = (100 - payload.subjective_energy) * 0.65 + (net_pressure * 100) * 0.35
    energy_ring = min(100, round(energy_load))

    sustainability_score = max(0, min(100, round(100 - (time_ring * 0.45 + energy_ring * 0.55))))
    drift_score = max(0, min(100, round((payload.role_shift * 0.6) + (time_ring * 0.25) + (energy_ring * 0.15))))

    recommendations: list[str] = []
    if time_ring >= 70:
        recommendations.append("Dojíždění výrazně zatěžuje časovou udržitelnost. Zvažte více home-office dní.")
    if energy_ring >= 70:
        recommendations.append("Energetická zátěž je vysoká. Ověřte rozsah povinností a tempo práce.")
    if drift_score >= 65:
        recommendations.append("Role drift je výrazný. Zaměřte se na roli bližší vašemu reálnému potenciálu.")
    if not recommendations:
        recommendations.append("Profil je stabilní. Sledujte trend v čase při změně podmínek práce.")

    return {
        "time_ring": time_ring,
        "energy_ring": energy_ring,
        "sustainability_score": sustainability_score,
        "drift_score": drift_score,
        "recommendations": recommendations,
        "advisory_disclaimer": "AI recommendation only. This is a decision support output, not an approval/rejection.",
    }


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


def _normalize_jcfpm_share_level(level: Any, payload: Any = None) -> str:
    normalized = str(level or "").strip().lower()
    if normalized in {"summary", "full_report", "do_not_share"}:
        return normalized
    if isinstance(payload, dict) and payload:
        return "summary"
    return "do_not_share"


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


def _infer_role_family_heuristic(title: str) -> str:
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


def _infer_role_family(title: str, description: str = "") -> str:
    text = f"{title or ''} {description or ''}".lower()
    best_family = None
    best_hits = 0
    for family, keywords in ROLE_FAMILY_KEYWORDS.items():
        hits = 0
        for kw in keywords:
            if kw and kw in text:
                hits += 1
        if hits > best_hits:
            best_hits = hits
            best_family = family
    if best_family:
        return str(best_family)
    return _infer_role_family_heuristic(title)


def _infer_role_group(role_family: str) -> str:
    rf = (role_family or "").lower()
    if any(k in rf for k in ["data", "devops", "cyber", "cloud", "software", "ai", "it"]):
        return "it"
    if any(k in rf for k in ["manufacturing", "production", "assembly", "electrical", "mechanical", "automation", "maintenance", "construction"]):
        return "manufacturing"
    if any(k in rf for k in ["food_service", "hospitality", "hotel", "catering", "restaurant", "kitchen"]):
        return "gastro_hospitality"
    if "sales" in rf or "account" in rf or "business" in rf:
        return "sales"
    if any(k in rf for k in ["healthcare", "medical", "dental", "clinical", "laboratory", "pharmacy", "care_social"]):
        return "healthcare"
    if any(k in rf for k in ["logistics", "warehouse", "driving_transport", "supply_chain", "maritime"]):
        return "logistics"
    if any(k in rf for k in ["education", "childcare", "training", "teacher"]):
        return "education"
    return "general"


ROLE_PROFESSION_KEYWORDS = {
    # IT
    "fullstack_developer": ["fullstack", "full-stack", "full stack"],
    "frontend_developer": ["frontend", "front-end", "front end", "react", "vue", "angular", "ui developer"],
    "backend_developer": ["backend", "back-end", "back end", "api developer", "server-side"],
    "devops_engineer": ["devops", "site reliability", "sre", "platform engineer", "kubernetes", "docker"],
    "data_engineer": ["data engineer", "etl", "data pipeline", "bigquery", "snowflake"],
    "qa_engineer": ["qa", "quality assurance", "tester", "test engineer"],
    # Manufacturing / trades
    "cnc_operator": ["cnc", "cnc operator", "cnc program", "cnc programmer"],
    "welder": ["welder", "welding", "svářeč", "svarec"],
    "machinist": ["machinist", "soustružník", "soustruznik", "frézař", "frezer", "obrabec"],
    "electrician": ["electrician", "elektrikář", "elektrikar"],
    # Gastro / hospitality
    "cook": ["cook", "kuchař", "kuchar", "chef", "sous chef"],
    "waiter": ["waiter", "waitress", "číšník", "cisnik", "servírka", "servirka"],
    "hotel_receptionist": ["receptionist", "recepční", "recepcni", "front desk"],
    # Sales
    "account_manager": ["account manager", "key account", "kam", "key account manager"],
    "sales_representative": ["sales representative", "sales rep", "obchodní zástupce", "obchodni zastupce"],
    "bdr_sdr": ["bdr", "sdr", "sales development", "business development representative"],
    # Healthcare
    "nurse": ["nurse", "zdravotní sestra", "zdravotni sestra", "sestra"],
    "doctor": ["doctor", "physician", "lékař", "lekar", "praktický lékař", "prakticky lekar"],
    "caregiver": ["caregiver", "pečovatel", "pecovatel", "social care", "ošetřovatel", "osetrovatel"],
    # Logistics
    "warehouse_worker": ["warehouse", "skladník", "skladnik", "picker", "packer"],
    "driver": ["driver", "řidič", "ridic", "truck driver", "delivery driver", "kurýr", "kuryr"],
    "logistics_coordinator": ["logistics coordinator", "logistics specialist", "disponent", "speditér", "speditor"],
    # Education
    "teacher": ["teacher", "učitel", "ucitel", "lecturer", "lektor", "vyučující", "vyucujici"],
}


def _infer_profession_key(title: str, description: str = "") -> Optional[str]:
    text = f"{title or ''} {description or ''}".lower()
    for key, keywords in ROLE_PROFESSION_KEYWORDS.items():
        for kw in keywords:
            if kw and kw in text:
                return key
    return None


def _infer_isco_major_key(role_profession: Optional[str], role_group: str) -> Optional[str]:
    if role_profession:
        profession_map = {
            "fullstack_developer": "isco_major_2",
            "frontend_developer": "isco_major_2",
            "backend_developer": "isco_major_2",
            "devops_engineer": "isco_major_2",
            "data_engineer": "isco_major_2",
            "qa_engineer": "isco_major_3",
            "cnc_operator": "isco_major_8",
            "welder": "isco_major_7",
            "machinist": "isco_major_7",
            "electrician": "isco_major_7",
            "cook": "isco_major_5",
            "waiter": "isco_major_5",
            "hotel_receptionist": "isco_major_5",
            "account_manager": "isco_major_5",
            "sales_representative": "isco_major_5",
            "bdr_sdr": "isco_major_5",
            "nurse": "isco_major_2",
            "doctor": "isco_major_2",
            "caregiver": "isco_major_5",
            "warehouse_worker": "isco_major_9",
            "driver": "isco_major_8",
            "logistics_coordinator": "isco_major_4",
            "teacher": "isco_major_2",
        }
        if role_profession in profession_map:
            return profession_map[role_profession]
    group_map = {
        "it": "isco_major_2",
        "manufacturing": "isco_major_7",
        "gastro_hospitality": "isco_major_5",
        "sales": "isco_major_5",
        "healthcare": "isco_major_2",
        "logistics": "isco_major_8",
        "education": "isco_major_2",
    }
    return group_map.get(role_group)


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


def _normalize_country_code(value: str) -> str:
    raw = (value or "").strip().lower()
    if not raw:
        return "cz"
    if raw in {"cz", "cs", "cze", "czk", "czech", "czechia", "czech republic"}:
        return "cz"
    if raw in {"sk", "svk", "slovakia", "slovensko"}:
        return "sk"
    if raw in {"pl", "pol", "poland", "polska"}:
        return "pl"
    if raw in {"de", "deu", "ger", "germany", "deutschland"}:
        return "de"
    if raw in {"at", "aut", "austria", "osterreich", "österreich"}:
        return "at"
    return raw


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


def _fetch_internal_salary_population(country_codes: List[str], window_days: int) -> List[Dict[str, Any]]:
    since = _to_iso(_utc_now() - timedelta(days=window_days))
    resp = (
        supabase
        .table("jobs")
        .select("id,title,description,location,country_code,contract_type,salary_from,salary_to,salary_timeframe,scraped_at")
        .eq("legality_status", "legal")
        .eq("status", "active")
        .in_("country_code", country_codes)
        .gte("scraped_at", since)
        .limit(5000)
        .execute()
    )
    return resp.data or []


def _get_external_reference(
    country_codes: List[str],
    role_family: str,
    seniority_band: str,
    employment_type: str,
    region_key: Optional[str],
    isco_major_key: Optional[str],
) -> Optional[Dict[str, Any]]:
    if not supabase:
        return None

    queries = []
    if region_key:
        queries.append(("region", region_key))
    normalized_country = str(country_codes[0]).lower() if country_codes else "cz"
    queries.append(("national", f"{normalized_country}_national"))

    preferred_measures = ["median", "average"]
    role_family_candidates = [r for r in [isco_major_key, role_family, "general"] if r]
    fallback_candidates = []
    for rf in role_family_candidates:
        fallback_candidates.extend([
            (rf, seniority_band, employment_type),
            (rf, "mid", employment_type),
        ])
    fallback_candidates.extend([
        ("general", seniority_band, employment_type),
        ("general", "mid", "employee"),
    ])
    for _, target_region in queries:
        for measure in preferred_measures:
            for rf, sb, et in fallback_candidates:
                resp = (
                    supabase
                    .table("salary_public_reference")
                    .select("role_family,country_code,region_key,seniority_band,employment_type,currency,p25,p50,p75,sample_size,data_window_days,source_name,source_url,period_label,measure_type,gross_net,employment_scope,updated_at,method_version")
                    .in_("country_code", country_codes)
                    .eq("role_family", rf)
                    .eq("seniority_band", sb)
                    .eq("employment_type", et)
                    .eq("region_key", target_region)
                    .eq("gross_net", "gross")
                    .eq("measure_type", measure)
                    .limit(1)
                    .execute()
                )
            rows = resp.data or []
            if rows:
                return rows[0]
            # Final fallback: ignore role/seniority/employment but keep country/region.
            resp = (
                supabase
                .table("salary_public_reference")
                .select("role_family,country_code,region_key,seniority_band,employment_type,currency,p25,p50,p75,sample_size,data_window_days,source_name,source_url,period_label,measure_type,gross_net,employment_scope,updated_at,method_version")
                .in_("country_code", country_codes)
                .eq("region_key", target_region)
                .eq("gross_net", "gross")
                .eq("measure_type", measure)
                .limit(1)
                .execute()
            )
            rows = resp.data or []
            if rows:
                return rows[0]
        # Ultimate fallback: ignore region as well.
        for measure in preferred_measures:
            resp = (
                supabase
                .table("salary_public_reference")
                .select("role_family,country_code,region_key,seniority_band,employment_type,currency,p25,p50,p75,sample_size,data_window_days,source_name,source_url,period_label,measure_type,gross_net,employment_scope,updated_at,method_version")
                .in_("country_code", country_codes)
                .eq("gross_net", "gross")
                .eq("measure_type", measure)
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

    country_code_raw = str(job.get("country_code") or "cz")
    country_code = _normalize_country_code(country_code_raw)
    country_codes = sorted({country_code, country_code.upper()})
    role_family = _infer_role_family(str(job.get("title") or ""), str(job.get("description") or ""))
    role_group = _infer_role_group(role_family)
    role_profession = _infer_profession_key(str(job.get("title") or ""), str(job.get("description") or ""))
    isco_major_key = _infer_isco_major_key(role_profession, role_group)
    seniority_band = _infer_seniority(str(job.get("title") or ""), str(job.get("description") or ""))
    employment_type = _infer_employment_type(str(job.get("contract_type") or ""))
    region_key = _infer_region_key(str(job.get("location") or ""), country_code)

    offer_monthly = _monthly_salary_from_row(job)

    population = _fetch_internal_salary_population(country_codes, window_days)

    strict_values: List[float] = []
    strict_recency_days: List[float] = []
    profession_values: List[float] = []
    profession_recency_days: List[float] = []
    family_values: List[float] = []
    family_recency_days: List[float] = []
    group_values: List[float] = []
    group_recency_days: List[float] = []

    now = _utc_now()
    for row in population:
        monthly = _monthly_salary_from_row(row)
        if monthly is None:
            continue

        row_role = _infer_role_family(str(row.get("title") or ""), str(row.get("description") or ""))
        row_group = _infer_role_group(row_role)
        row_profession = _infer_profession_key(str(row.get("title") or ""), str(row.get("description") or ""))
        row_seniority = _infer_seniority(str(row.get("title") or ""), str(row.get("description") or ""))
        row_emp = _infer_employment_type(str(row.get("contract_type") or ""))
        row_region = _infer_region_key(str(row.get("location") or ""), country_code)
        scraped = _parse_dt(row.get("scraped_at")) or now
        recency_days = max(0.0, (now - scraped).total_seconds() / 86400.0)

        if row_profession and role_profession and row_profession == role_profession and row_seniority == seniority_band and row_emp == employment_type:
            profession_values.append(monthly)
            profession_recency_days.append(recency_days)
            if row_region == region_key:
                strict_values.append(monthly)
                strict_recency_days.append(recency_days)
        if row_role == role_family and row_seniority == seniority_band and row_emp == employment_type:
            family_values.append(monthly)
            family_recency_days.append(recency_days)
            if row_region == region_key:
                strict_values.append(monthly)
                strict_recency_days.append(recency_days)
        if row_group == role_group and row_seniority == seniority_band and row_emp == employment_type:
            group_values.append(monthly)
            group_recency_days.append(recency_days)

    used_values = strict_values
    used_recency = strict_recency_days
    source_mode = "internal_only"
    fallback_reason = None
    fallback_details = {
        "strict_region_sample": len(strict_values),
        "profession_sample": len(profession_values),
        "family_sample": len(family_values),
        "group_sample": len(group_values),
        "external_sample": 0,
    }

    if len(used_values) < MIN_INTERNAL_SAMPLE and len(profession_values) >= MIN_INTERNAL_SAMPLE:
        used_values = profession_values
        used_recency = profession_recency_days
        fallback_reason = (
            f"Regionální vzorek nedostatečný (N={len(strict_values)}). "
            f"Použit profesní benchmark (N={len(profession_values)})."
        )
    if len(used_values) < MIN_INTERNAL_SAMPLE and len(family_values) >= MIN_INTERNAL_SAMPLE:
        used_values = family_values
        used_recency = family_recency_days
        fallback_reason = (
            f"Profesní vzorek nedostatečný (N={len(profession_values)}). "
            f"Použit role benchmark (N={len(family_values)})."
        )
    if len(used_values) < MIN_INTERNAL_SAMPLE and len(group_values) >= MIN_INTERNAL_SAMPLE:
        used_values = group_values
        used_recency = group_recency_days
        fallback_reason = (
            f"Role vzorek nedostatečný (N={len(family_values)}). "
            f"Použit skupinový benchmark (N={len(group_values)})."
        )

    confidence_score, confidence_tier, components = _compute_confidence(used_values, used_recency, window_days)
    internal_valid = len(used_values) >= MIN_INTERNAL_SAMPLE and confidence_tier != "low"

    external_ref = _get_external_reference(
        country_codes=country_codes,
        role_family=role_family,
        seniority_band=seniority_band,
        employment_type=employment_type,
        region_key=region_key,
        isco_major_key=isco_major_key,
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
            if len(used_values) == 0 and offer_monthly:
                used_values = [offer_monthly, offer_monthly, offer_monthly]
                source_mode = "offer_only"
                fallback_reason = "Použit plat z nabídky (externí benchmark nedostupný)."
                confidence_score = 35.0
                confidence_tier = "low"
                components = {
                    "sample_size_component": 0.1,
                    "variance_component": 0.5,
                    "recency_component": 0.5,
                }
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
    elif source_mode == "offer_only":
        source_name = "job_offer"

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
                else 1
                if source_mode == "offer_only"
                else (
                    fallback_details.get("profession_sample", 0)
                    or fallback_details.get("family_sample", 0)
                    or fallback_details.get("group_sample", 0)
                    or 0
                ) + fallback_details.get("external_sample", 0)
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
            "source_url": str(external_ref.get("source_url")) if external_ref else None,
            "period_label": str(external_ref.get("period_label")) if external_ref else None,
            "measure_type": str(external_ref.get("measure_type")) if external_ref else None,
            "gross_net": str(external_ref.get("gross_net")) if external_ref else None,
            "employment_scope": str(external_ref.get("employment_scope")) if external_ref else None,
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


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _months_between(start: datetime, end: datetime) -> float:
    if end < start:
        return 0.0
    return max(0.0, (end - start).total_seconds() / (86400.0 * 30.4375))


def _extract_interval_months(item: Dict[str, Any], now: datetime) -> Optional[float]:
    start_candidates = ["start_date", "start", "from", "date_from", "since"]
    end_candidates = ["end_date", "end", "to", "date_to", "until"]

    start_dt = None
    end_dt = None

    for key in start_candidates:
        start_dt = _parse_dt(item.get(key))
        if start_dt:
            break
    for key in end_candidates:
        end_dt = _parse_dt(item.get(key))
        if end_dt:
            break

    if not start_dt:
        return None

    if not end_dt:
        end_dt = now

    return _months_between(start_dt, end_dt)


def _flight_risk_from_features(
    candidate_profile: Dict[str, Any],
    apps_90d: int,
    hired_365d: int,
    assessments_365d: int,
    now: datetime,
) -> Dict[str, Any]:
    score = 50.0
    factors: List[Dict[str, Any]] = []

    def apply(delta: float, reason: str) -> None:
        nonlocal score
        score += delta
        factors.append({
            "reason": reason,
            "impact_points": round(delta, 2),
        })

    cv_text = str(candidate_profile.get("cv_text") or "").strip()
    cv_url = str(candidate_profile.get("cv_url") or "").strip()
    has_cv = bool(cv_text or cv_url)
    apply(-10.0 if has_cv else 10.0, "CV dostupné (text nebo soubor)" if has_cv else "Chybí CV")

    skills = candidate_profile.get("skills")
    skills_count = len(skills) if isinstance(skills, list) else 0
    if skills_count >= 8:
        apply(-8.0, f"Silný profil dovedností ({skills_count})")
    elif skills_count >= 4:
        apply(-4.0, f"Střední profil dovedností ({skills_count})")
    elif skills_count <= 1:
        apply(6.0, f"Nízký počet dovedností ({skills_count})")

    work_history = candidate_profile.get("work_history")
    history_items = work_history if isinstance(work_history, list) else []
    if not history_items:
        apply(10.0, "Chybí pracovní historie")
    else:
        tenures: List[float] = []
        for item in history_items:
            if isinstance(item, dict):
                months = _extract_interval_months(item, now)
                if months is not None:
                    tenures.append(months)
        if len(history_items) >= 3:
            apply(-4.0, f"Dostatečná pracovní historie ({len(history_items)} rolí)")
        if tenures:
            avg_tenure = mean(tenures)
            if avg_tenure < 12:
                apply(18.0, f"Krátká průměrná délka angažmá ({avg_tenure:.1f} měs.)")
            elif avg_tenure < 24:
                apply(8.0, f"Spíše kratší délka angažmá ({avg_tenure:.1f} měs.)")
            elif avg_tenure >= 36:
                apply(-8.0, f"Dlouhodobější stabilita ({avg_tenure:.1f} měs.)")

    job_title = str(candidate_profile.get("job_title") or "").strip()
    apply(-4.0 if job_title else 3.0, "Vyplněný profesní titul" if job_title else "Chybí profesní titul")

    phone = str(candidate_profile.get("phone") or "").strip()
    if phone:
        apply(-2.0, "Vyplněný kontaktní telefon")

    if apps_90d >= 30:
        apply(18.0, f"Velmi vysoká aktivita přihlášek za 90 dní ({apps_90d})")
    elif apps_90d >= 15:
        apply(10.0, f"Vysoká aktivita přihlášek za 90 dní ({apps_90d})")
    elif apps_90d >= 8:
        apply(5.0, f"Zvýšená aktivita přihlášek za 90 dní ({apps_90d})")
    elif apps_90d <= 2:
        apply(-4.0, f"Nízká aktivita přihlášek za 90 dní ({apps_90d})")

    if hired_365d > 0:
        apply(-6.0, f"Historie dokončeného náboru za 365 dní ({hired_365d})")

    if assessments_365d > 0:
        apply(-3.0, f"Dokončené assessmenty za 365 dní ({assessments_365d})")

    clamped = _clamp(score, 0.0, 100.0)
    if clamped <= 33:
        tier = "Low"
    elif clamped <= 66:
        tier = "Medium"
    else:
        tier = "High"

    # Keep strongest contributors for compact UI.
    top_factors = sorted(factors, key=lambda f: abs(float(f["impact_points"])), reverse=True)[:5]

    return {
        "score": round(clamped, 1),
        "tier": tier,
        "breakdown": top_factors,
        "method_version": "flight-risk-v1",
    }


@router.get("/company/benchmarks/candidate")
@router.get("/benchmarks/company/candidate")
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
    try:
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
    except Exception:
        applications = []

    try:
        ass_query = (
            supabase
            .table("assessment_results")
            .select("candidate_id,journey_quality_index,journey_payload,decision_pattern,energy_balance,cultural_orientation,completed_at,job_id,company_id")
            .eq("company_id", company_id)
            .gte("completed_at", since_iso)
        )
        if parsed_job_id is not None:
            ass_query = ass_query.eq("job_id", parsed_job_id)
        ass_resp = ass_query.execute()
        assessments = ass_resp.data or []
    except Exception:
        try:
            fallback_ass_query = (
                supabase
                .table("assessment_results")
                .select("candidate_id,journey_quality_index,journey_payload,decision_pattern,energy_balance,cultural_orientation,completed_at,job_id")
                .gte("completed_at", since_iso)
            )
            if parsed_job_id is not None:
                fallback_ass_query = fallback_ass_query.eq("job_id", parsed_job_id)
            ass_resp = fallback_ass_query.execute()
            assessments = ass_resp.data or []
        except Exception:
            assessments = []

    now = _utc_now()

    total_candidates = len({str(a.get("candidate_id")) for a in applications if a.get("candidate_id")})
    assessed_candidates = len({str(a.get("candidate_id")) for a in assessments if a.get("candidate_id")})

    assessment_scores: List[float] = []
    assessment_recency: List[float] = []
    for row in assessments:
        score = _safe_float(row.get("journey_quality_index"))
        if score is None:
            payload = row.get("journey_payload") if isinstance(row.get("journey_payload"), dict) else {}
            decision = payload.get("decision_pattern") if isinstance(payload.get("decision_pattern"), dict) else (row.get("decision_pattern") if isinstance(row.get("decision_pattern"), dict) else {})
            energy = payload.get("energy_balance") if isinstance(payload.get("energy_balance"), dict) else (row.get("energy_balance") if isinstance(row.get("energy_balance"), dict) else {})
            culture = payload.get("cultural_orientation") if isinstance(payload.get("cultural_orientation"), dict) else (row.get("cultural_orientation") if isinstance(row.get("cultural_orientation"), dict) else {})
            decision_avg = mean([
                _safe_float(decision.get("structured_vs_improv"), 50.0),
                _safe_float(decision.get("risk_tolerance"), 50.0),
                _safe_float(decision.get("sequential_vs_parallel"), 50.0),
                _safe_float(decision.get("stakeholder_orientation"), 50.0),
            ])
            energy_component = min(100.0, _safe_float(energy.get("monthly_energy_hours_left"), 80.0))
            culture_component = float(sum(1 for key in ["transparency", "conflict_response", "hierarchy_vs_autonomy", "process_vs_outcome", "stability_vs_dynamics"] if str(culture.get(key) or "").strip()) * 20)
            score = round((decision_avg * 0.5) + (energy_component * 0.3) + (culture_component * 0.2), 2)
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
    try:
        all_apps_resp = (
            supabase
            .table("job_applications")
            .select("company_id,status,created_at")
            .gte("created_at", since_iso)
            .limit(10000)
            .execute()
        )
        all_apps = all_apps_resp.data or []
    except Exception:
        all_apps = []

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
    try:
        all_assess_resp = (
            supabase
            .table("assessment_results")
            .select("company_id,journey_quality_index,journey_payload,decision_pattern,energy_balance,cultural_orientation,completed_at")
            .gte("completed_at", since_iso)
            .limit(10000)
            .execute()
        )
        all_assess = all_assess_resp.data or []
    except Exception:
        all_assess = []

    scores_by_company: Dict[str, List[float]] = {}
    for row in all_assess:
        cid = str(row.get("company_id") or "")
        if not cid:
            continue
        score = _safe_float(row.get("journey_quality_index"))
        if score is None:
            payload = row.get("journey_payload") if isinstance(row.get("journey_payload"), dict) else {}
            decision = payload.get("decision_pattern") if isinstance(payload.get("decision_pattern"), dict) else (row.get("decision_pattern") if isinstance(row.get("decision_pattern"), dict) else {})
            energy = payload.get("energy_balance") if isinstance(payload.get("energy_balance"), dict) else (row.get("energy_balance") if isinstance(row.get("energy_balance"), dict) else {})
            culture = payload.get("cultural_orientation") if isinstance(payload.get("cultural_orientation"), dict) else (row.get("cultural_orientation") if isinstance(row.get("cultural_orientation"), dict) else {})
            decision_avg = mean([
                _safe_float(decision.get("structured_vs_improv"), 50.0),
                _safe_float(decision.get("risk_tolerance"), 50.0),
                _safe_float(decision.get("sequential_vs_parallel"), 50.0),
                _safe_float(decision.get("stakeholder_orientation"), 50.0),
            ])
            energy_component = min(100.0, _safe_float(energy.get("monthly_energy_hours_left"), 80.0))
            culture_component = float(sum(1 for key in ["transparency", "conflict_response", "hierarchy_vs_autonomy", "process_vs_outcome", "stability_vs_dynamics"] if str(culture.get(key) or "").strip()) * 20)
            score = round((decision_avg * 0.5) + (energy_component * 0.3) + (culture_component * 0.2), 2)
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


@router.get("/company/candidates")
@router.get("/benchmarks/company/candidates")
async def get_company_candidates(
    company_id: str = Query(...),
    limit: int = Query(500, ge=1, le=2000),
    user: dict = Depends(verify_subscription),
):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    require_company_access(user, company_id)

    def _load_candidates(include_location_public: bool = True):
        select_fields = [
            "id",
            "full_name",
            "email",
            "avatar_url",
            "location_public" if include_location_public else None,
            "role",
            "created_at",
            "candidate_profiles(job_title,skills,work_history,values,cv_text,cv_url,phone)",
        ]
        return (
            supabase
            .table("profiles")
            .select(",".join([field for field in select_fields if field]))
            .eq("role", "candidate")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

    try:
        resp = _load_candidates(include_location_public=True)
    except Exception as exc:
        if _is_missing_location_public_column(exc):
            resp = _load_candidates(include_location_public=False)
        else:
            raise
    rows = resp.data or []
    candidate_ids = [str(r.get("id")) for r in rows if r.get("id")]

    now = _utc_now()
    since_90_dt = now - timedelta(days=90)
    since_90 = _to_iso(since_90_dt)
    since_365 = _to_iso(now - timedelta(days=365))

    apps_by_candidate: Dict[str, Dict[str, int]] = {}
    assessments_by_candidate: Dict[str, int] = {}
    shared_jcfpm_by_candidate: Dict[str, Dict[str, Any]] = {}

    def _chunk(values: List[str], size: int) -> List[List[str]]:
        return [values[i:i + size] for i in range(0, len(values), size)]

    for chunk_ids in _chunk(candidate_ids, 100):
        apps_resp = (
            supabase
            .table("job_applications")
            .select("candidate_id,created_at,status")
            .in_("candidate_id", chunk_ids)
            .gte("created_at", since_365)
            .limit(10000)
            .execute()
        )
        for app in (apps_resp.data or []):
            cid = str(app.get("candidate_id") or "")
            if not cid:
                continue
            stat = apps_by_candidate.setdefault(cid, {
                "apps_90d": 0,
                "apps_365d": 0,
                "hired_365d": 0,
            })
            stat["apps_365d"] += 1
            status = _parse_status(app.get("status"))
            if status == "hired":
                stat["hired_365d"] += 1
            created = _parse_dt(app.get("created_at"))
            if created and created >= since_90_dt:
                stat["apps_90d"] += 1

        ass_resp = (
            supabase
            .table("assessment_results")
            .select("candidate_id,completed_at")
            .in_("candidate_id", chunk_ids)
            .gte("completed_at", since_365)
            .limit(10000)
            .execute()
        )
        for ass in (ass_resp.data or []):
            cid = str(ass.get("candidate_id") or "")
            if not cid:
                continue
            assessments_by_candidate[cid] = assessments_by_candidate.get(cid, 0) + 1

        company_apps_resp = (
            supabase
            .table("job_applications")
            .select("candidate_id,jcfpm_share_level,shared_jcfpm_payload,submitted_at,updated_at,created_at")
            .eq("company_id", company_id)
            .in_("candidate_id", chunk_ids)
            .limit(10000)
            .execute()
        )
        for app in (company_apps_resp.data or []):
            cid = str(app.get("candidate_id") or "")
            if not cid:
                continue
            share_level = _normalize_jcfpm_share_level(app.get("jcfpm_share_level"), app.get("shared_jcfpm_payload"))
            shared_payload = app.get("shared_jcfpm_payload") if isinstance(app.get("shared_jcfpm_payload"), dict) else {}
            has_jcfpm = share_level != "do_not_share" and bool(shared_payload)
            if not has_jcfpm:
                continue

            current = shared_jcfpm_by_candidate.get(cid)
            current_rank = 2 if current and current.get("jcfpm_share_level") == "full_report" else 1 if current and current.get("has_jcfpm") else 0
            next_rank = 2 if share_level == "full_report" else 1
            if current and current_rank > next_rank:
                continue

            shared_jcfpm_by_candidate[cid] = {
                "has_jcfpm": True,
                "jcfpm_share_level": share_level,
                "jcfpm_shared_at": str(app.get("updated_at") or app.get("submitted_at") or app.get("created_at") or ""),
                "comparison_signals": [
                    {
                        "key": str(item.get("key") or "").strip()[:64],
                        "label": str(item.get("label") or "").strip()[:120],
                        "score": int(item.get("score") or 0),
                    }
                    for item in (shared_payload.get("comparison_signals") or [])[:6]
                    if isinstance(item, dict)
                ],
            }

    def _name_from_row(row: Dict[str, Any]) -> str:
        full = str(row.get("full_name") or "").strip()
        if full:
            return full
        email = str(row.get("email") or "").strip()
        if "@" in email:
            return email.split("@")[0]
        return "Candidate"

    candidates: List[Dict[str, Any]] = []
    for row in rows:
        cp = row.get("candidate_profiles")
        candidate_profile = cp[0] if isinstance(cp, list) and cp else (cp or {})
        work_history = candidate_profile.get("work_history")
        skills = candidate_profile.get("skills")
        values = candidate_profile.get("values")

        mapped = {
            "id": str(row.get("id") or ""),
            "name": _name_from_row(row),
            "role": str(candidate_profile.get("job_title") or "Uchazeč"),
            "avatar_url": _trimmed_text(row.get("avatar_url"), 500) or None,
            "email": _trimmed_text(row.get("email"), 240) or None,
            "location_public": _trimmed_text(row.get("location_public"), 500) or None,
            "experienceYears": len(work_history) if isinstance(work_history, list) else 0,
            "salaryExpectation": 0,
            "skills": skills if isinstance(skills, list) else [],
            "bio": "Registrovaný uchazeč na JobShaman.",
            "flightRisk": "Medium",
            "values": values if isinstance(values, list) else [],
            "createdAt": str(row.get("created_at") or ""),
        }
        cid = mapped["id"]
        app_stats = apps_by_candidate.get(cid, {"apps_90d": 0, "hired_365d": 0})
        risk = _flight_risk_from_features(
            candidate_profile=candidate_profile,
            apps_90d=int(app_stats.get("apps_90d", 0)),
            hired_365d=int(app_stats.get("hired_365d", 0)),
            assessments_365d=int(assessments_by_candidate.get(cid, 0)),
            now=now,
        )
        mapped["flightRisk"] = risk["tier"]
        mapped["flightRiskScore"] = risk["score"]
        mapped["flightRiskBreakdown"] = risk["breakdown"]
        mapped["flightRiskMethodVersion"] = risk["method_version"]
        shared_jcfpm = shared_jcfpm_by_candidate.get(cid)
        mapped["hasJcfpm"] = bool(shared_jcfpm and shared_jcfpm.get("has_jcfpm"))
        mapped["jcfpmShareLevel"] = str(shared_jcfpm.get("jcfpm_share_level") or "do_not_share") if shared_jcfpm else "do_not_share"
        if shared_jcfpm and shared_jcfpm.get("jcfpm_shared_at"):
            mapped["jcfpmSharedAt"] = shared_jcfpm.get("jcfpm_shared_at")
        if shared_jcfpm and shared_jcfpm.get("comparison_signals"):
            mapped["jcfpmComparisonSignals"] = shared_jcfpm.get("comparison_signals")
        if mapped["id"]:
            candidates.append(mapped)

    return {
        "company_id": company_id,
        "total": len(candidates),
        "candidates": candidates,
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
            "internal_index_note": "Assessment benchmark uses internal journey_quality_index derived from Journey payload. It is not shown as candidate personality score.",
        },
    }
