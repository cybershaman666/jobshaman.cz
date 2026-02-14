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
            return float(row["demand_score"])
    except Exception:
        return None
    return None


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
