import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import List

from ..core.database import supabase

SKILL_STOPWORDS = {"and", "the", "for", "with", "from", "praxe", "junior", "senior"}
HALF_LIFE_DAYS = 21.0


def _exp_decay(age_days: float, half_life: float = HALF_LIFE_DAYS) -> float:
    if age_days <= 0:
        return 1.0
    return math.exp(-(math.log(2) * age_days) / max(1.0, half_life))


def demand_weight_for_skills(skills: List[str], country_code: str = "", city: str = "") -> float:
    if not skills:
        return 0.0

    score = 0.0
    counted = 0
    for skill in skills[:20]:
        d = _lookup_skill_demand(skill, country_code, city)
        if d is not None:
            score += d
            counted += 1

    if counted == 0:
        return 0.0
    return max(0.0, min(1.0, score / counted))


def _lookup_skill_demand(skill: str, country_code: str, city: str):
    if not supabase:
        return None

    try:
        query = supabase.table("market_skill_demand").select("demand_score").eq("skill", skill.lower())
        if country_code:
            query = query.eq("country_code", country_code.lower())
        if city:
            query = query.eq("city", city)
        resp = query.order("window_end", desc=True).limit(1).execute()
        row = (resp.data or [None])[0]
        if row and row.get("demand_score") is not None:
            base_score = float(row["demand_score"])
            seasonal = _seasonal_correction(skill, country_code, city)
            return max(0.0, min(1.0, base_score * seasonal))
    except Exception:
        return None
    return None


def _seasonal_correction(skill: str, country_code: str, city: str) -> float:
    if not supabase:
        return 1.0
    month = datetime.now(timezone.utc).month
    try:
        query = (
            supabase.table("seasonal_bias_corrections")
            .select("correction_factor")
            .eq("month", month)
        )
        if country_code:
            query = query.eq("country_code", country_code.lower())
        if city:
            query = query.eq("city", city.lower())
        query = query.eq("skill", skill.lower())
        resp = query.order("updated_at", desc=True).limit(1).execute()
        row = (resp.data or [None])[0]
        if row and row.get("correction_factor") is not None:
            return max(0.5, min(1.5, float(row["correction_factor"])))
    except Exception:
        return 1.0
    return 1.0


def recompute_market_skill_demand() -> int:
    if not supabase:
        return 0

    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=120)).isoformat()
    try:
        jobs_resp = (
            supabase.table("jobs")
            .select("description, country_code, location, scraped_at")
            .gte("scraped_at", cutoff)
            .limit(5000)
            .execute()
        )
    except Exception as exc:
        print(f"⚠️ [Matching] demand recompute failed to fetch jobs: {exc}")
        return 0

    jobs = jobs_resp.data or []
    if not jobs:
        return 0

    weighted_counts = defaultdict(Counter)
    market_totals = Counter()

    for job in jobs:
        scraped_at_raw = job.get("scraped_at")
        try:
            scraped_at = datetime.fromisoformat(str(scraped_at_raw).replace("Z", "+00:00")) if scraped_at_raw else now
        except Exception:
            scraped_at = now
        age_days = max(0.0, (now - scraped_at).total_seconds() / 86400.0)
        decay = _exp_decay(age_days)

        key = ((job.get("country_code") or "").lower(), (job.get("location") or "").lower())
        for token in (job.get("description") or "").lower().replace("/", " ").split():
            t = token.strip(".,:;()[]{}!?\"'")
            if len(t) < 3 or t in SKILL_STOPWORDS:
                continue
            weighted_counts[key][t] += decay
            market_totals[key] += decay

    rows = []
    window_start = (now - timedelta(days=120)).date().isoformat()
    window_end = now.date().isoformat()

    for (country_code, city), counter in weighted_counts.items():
        total_weight = max(1e-6, market_totals[(country_code, city)])
        for skill, weight in counter.most_common(180):
            # Regionally normalized weighted frequency in 0..1 range
            demand_score = round(min(1.0, weight / total_weight * 12.0), 4)
            rows.append(
                {
                    "skill": skill,
                    "country_code": country_code or None,
                    "city": city or None,
                    "demand_score": demand_score,
                    "window_start": window_start,
                    "window_end": window_end,
                    "updated_at": now.isoformat(),
                }
            )

    if not rows:
        return 0

    try:
        supabase.table("market_skill_demand").upsert(
            rows,
            on_conflict="skill,country_code,city,window_start,window_end",
        ).execute()
        return len(rows)
    except Exception as exc:
        print(f"⚠️ [Matching] demand upsert failed: {exc}")
        return 0


def recompute_seasonal_bias_corrections() -> int:
    if not supabase:
        return 0

    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=365)).isoformat()
    try:
        jobs_resp = (
            supabase.table("jobs")
            .select("description, country_code, location, scraped_at")
            .gte("scraped_at", cutoff)
            .limit(8000)
            .execute()
        )
    except Exception as exc:
        print(f"⚠️ [Matching] seasonal recompute failed to fetch jobs: {exc}")
        return 0

    jobs = jobs_resp.data or []
    if not jobs:
        return 0

    by_month_region_skill = defaultdict(Counter)
    overall_by_region_skill = defaultdict(float)

    for job in jobs:
        scraped_at_raw = job.get("scraped_at")
        try:
            scraped_at = datetime.fromisoformat(str(scraped_at_raw).replace("Z", "+00:00")) if scraped_at_raw else now
        except Exception:
            scraped_at = now
        month = int(scraped_at.month)
        region_key = ((job.get("country_code") or "").lower(), (job.get("location") or "").lower())
        for token in (job.get("description") or "").lower().replace("/", " ").split():
            t = token.strip(".,:;()[]{}!?\"'")
            if len(t) < 3 or t in SKILL_STOPWORDS:
                continue
            by_month_region_skill[(month, *region_key)][t] += 1
            overall_by_region_skill[(region_key[0], region_key[1], t)] += 1

    rows = []
    for (month, country_code, city), counter in by_month_region_skill.items():
        for skill, count in counter.items():
            overall = overall_by_region_skill.get((country_code, city, skill), 0.0)
            if overall <= 0:
                continue
            expected_monthly = overall / 12.0
            correction = max(0.5, min(1.5, count / max(1e-6, expected_monthly)))
            rows.append(
                {
                    "month": month,
                    "country_code": country_code or None,
                    "city": city or None,
                    "skill": skill,
                    "correction_factor": round(correction, 4),
                    "updated_at": now.isoformat(),
                }
            )

    if not rows:
        return 0

    try:
        supabase.table("seasonal_bias_corrections").upsert(
            rows,
            on_conflict="month,country_code,city,skill",
        ).execute()
        return len(rows)
    except Exception as exc:
        print(f"⚠️ [Matching] seasonal correction upsert failed: {exc}")
        return 0
