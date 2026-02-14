from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Dict, List

from ..core.database import supabase


SKILL_STOPWORDS = {"and", "the", "for", "with", "from", "praxe", "junior", "senior"}


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
        query = (
            supabase.table("market_skill_demand")
            .select("demand_score")
            .eq("skill", skill.lower())
        )
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

    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    try:
        jobs_resp = (
            supabase.table("jobs")
            .select("description, country_code, location")
            .gte("scraped_at", cutoff)
            .limit(3000)
            .execute()
        )
    except Exception as exc:
        print(f"⚠️ [Matching] demand recompute failed to fetch jobs: {exc}")
        return 0

    jobs = jobs_resp.data or []
    total = len(jobs)
    if total == 0:
        return 0

    by_market = {}
    for job in jobs:
        key = ((job.get("country_code") or "").lower(), (job.get("location") or "").lower())
        c = by_market.setdefault(key, Counter())
        for token in (job.get("description") or "").lower().replace("/", " ").split():
            t = token.strip(".,:;()[]{}!?\"'")
            if len(t) < 3 or t in SKILL_STOPWORDS:
                continue
            c[t] += 1

    rows = []
    window_start = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
    window_end = datetime.now(timezone.utc).date().isoformat()
    for (country_code, city), counter in by_market.items():
        max_freq = max(counter.values()) if counter else 1
        for skill, freq in counter.most_common(120):
            demand_score = round(freq / max_freq, 4)
            rows.append(
                {
                    "skill": skill,
                    "country_code": country_code or None,
                    "city": city or None,
                    "demand_score": demand_score,
                    "window_start": window_start,
                    "window_end": window_end,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
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
