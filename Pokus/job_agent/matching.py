from __future__ import annotations

import re

from .llm import OllamaClient
from .models import CandidateProfile, JobPosting, JobRecommendation, MatchBreakdown, Preferences


WORD_RE = re.compile(r"[a-zA-Z0-9+#.-]{2,}")


def rank_jobs(
    jobs: list[JobPosting],
    profile: CandidateProfile,
    preferences: Preferences,
    llm: OllamaClient | None = None,
) -> list[JobRecommendation]:
    recommendations: list[JobRecommendation] = []
    for job in jobs:
        breakdown = MatchBreakdown()
        reasons: list[str] = []
        warnings: list[str] = []

        text = " ".join([job.title, job.company, job.location or "", job.description]).lower()
        words = set(WORD_RE.findall(text))

        req_hits = sum(1 for keyword in preferences.required_keywords if keyword.lower() in words or keyword.lower() in text)
        opt_hits = sum(1 for keyword in preferences.optional_keywords if keyword.lower() in words or keyword.lower() in text)
        if preferences.required_keywords:
            breakdown.keyword_score += 35.0 * (req_hits / len(preferences.required_keywords))
        if preferences.optional_keywords:
            breakdown.keyword_score += 15.0 * (opt_hits / len(preferences.optional_keywords))
        if req_hits:
            reasons.append(f"Sedí {req_hits} z povinných klíčových slov.")

        title_hits = sum(1 for title in profile.desired_titles + preferences.desired_titles if title.lower() in text)
        if profile.desired_titles or preferences.desired_titles:
            breakdown.title_score = min(20.0, title_hits * 8.0)
            if title_hits:
                reasons.append("Název role odpovídá cílovému směru.")

        if preferences.remote_only:
            breakdown.remote_score = 10.0 if job.remote else -20.0
            if not job.remote:
                warnings.append("Pozice nepůsobí jako remote.")
        elif job.remote:
            breakdown.remote_score = 5.0

        if preferences.locations:
            matches_location = any(location.lower() in text for location in preferences.locations)
            breakdown.location_score = 10.0 if matches_location else 0.0
            if matches_location:
                reasons.append("Lokace odpovídá preferencím.")

        if preferences.min_salary:
            if job.salary_max and job.salary_max >= preferences.min_salary:
                breakdown.salary_score = 10.0
                reasons.append("Mzda splňuje minimum.")
            elif job.salary_max or job.salary_min:
                breakdown.salary_score = -8.0
                warnings.append("Mzda je pod preferovaným minimem.")

        excluded_hits = [keyword for keyword in preferences.excluded_keywords if keyword.lower() in text]
        if excluded_hits:
            breakdown.penalties -= min(30.0, 10.0 * len(excluded_hits))
            warnings.append(f"Obsahuje vyloučené výrazy: {', '.join(excluded_hits[:3])}.")

        raw_score = (
            breakdown.keyword_score
            + breakdown.title_score
            + breakdown.location_score
            + breakdown.salary_score
            + breakdown.remote_score
            + breakdown.llm_score
            + breakdown.penalties
        )
        match_score = max(0.0, min(100.0, raw_score))
        recommendations.append(
            JobRecommendation(
                job=job,
                match_score=round(match_score, 1),
                breakdown=breakdown,
                reasons=reasons[:4],
                warnings=warnings[:3],
            )
        )

    recommendations.sort(key=lambda item: item.match_score, reverse=True)
    if llm and recommendations:
        llm_budget = min(8, len(recommendations))
        for item in recommendations[:llm_budget]:
            text = " ".join([item.job.title, item.job.company, item.job.location or "", item.job.description]).lower()
            llm_score, llm_reasons = llm.maybe_fit_score(profile.raw_resume, text)
            item.breakdown.llm_score = llm_score * 0.2
            item.reasons = (item.reasons + llm_reasons[:2])[:4]
            raw_score = (
                item.breakdown.keyword_score
                + item.breakdown.title_score
                + item.breakdown.location_score
                + item.breakdown.salary_score
                + item.breakdown.remote_score
                + item.breakdown.llm_score
                + item.breakdown.penalties
            )
            item.match_score = round(max(0.0, min(100.0, raw_score)), 1)
        recommendations.sort(key=lambda item: item.match_score, reverse=True)
    return recommendations
