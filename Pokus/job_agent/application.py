from __future__ import annotations

from .llm import OllamaClient
from .models import ApplicationDraft, ApplyResult, CandidateProfile, JobRecommendation, Preferences
from .sources.jobshaman import JobShamanSource


def build_draft(
    recommendation: JobRecommendation,
    profile: CandidateProfile,
    preferences: Preferences,
    llm: OllamaClient | None = None,
) -> ApplicationDraft:
    notes = preferences.notes_for_cover_letter + recommendation.reasons
    message = ""
    if llm:
        message = llm.draft_application(profile.raw_resume, recommendation.job.description, notes)
    if not message:
        message = _fallback_message(recommendation, profile)
    return ApplicationDraft(
        job_id=recommendation.job.id,
        source=recommendation.job.source,
        company=recommendation.job.company,
        title=recommendation.job.title,
        match_score=recommendation.match_score,
        subject=f"Reakce na pozici {recommendation.job.title}",
        message=message,
        apply_url=recommendation.job.apply_url,
    )


def apply_to_job(
    recommendation: JobRecommendation,
    draft: ApplicationDraft,
    profile: CandidateProfile,
    jobshaman: JobShamanSource,
) -> ApplyResult:
    if recommendation.job.source != "jobshaman":
        return ApplyResult(
            mode="unsupported",
            payload={"job_id": recommendation.job.id, "apply_url": recommendation.job.apply_url},
            notes=[
                "Automaticke podani je implementovane jen pro JobShaman.",
                "U We Work Remotely pouzij vygenerovanou odpoved a dokonci aplikaci pres jejich web.",
            ],
        )
    payload, response = jobshaman.apply(recommendation.job, draft.message, profile.raw_resume)
    return ApplyResult(
        mode="dry_run" if response is None else "submitted",
        payload=payload,
        response=response,
        notes=["Dry-run je zapnuty." if response is None else "Aplikace byla odeslana do JobShaman."],
    )


def _fallback_message(recommendation: JobRecommendation, profile: CandidateProfile) -> str:
    highlight = profile.highlights[0] if profile.highlights else profile.summary
    return (
        f"Dobrý den,\n\n"
        f"reaguji na pozici {recommendation.job.title} ve společnosti {recommendation.job.company}. "
        f"Zaujala mě hlavně shoda s mým profilem a stackem, který v inzerátu popisujete. "
        f"Relevantní pro tuto roli je zejména moje zkušenost: {highlight}\n\n"
        f"Pokud bude dávat smysl krátký call nebo doplnění konkrétních ukázek práce, rád navážu.\n\n"
        f"S pozdravem"
    )

