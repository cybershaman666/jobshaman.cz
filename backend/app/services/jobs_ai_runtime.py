import re
from typing import Any

from ..ai_orchestration.client import (
    call_primary_with_fallback,
    get_default_fallback_model,
    get_default_primary_model,
)
from ..core.database import supabase
from ..core.runtime_config import get_active_model_config
from .jobs_shared import _safe_dict, _safe_row, _safe_string_list, _trimmed_text


def _strip_html_tags(value: Any) -> str:
    text = str(value or "")
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p\s*>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _clip_text(value: Any, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    clipped = text[:limit].rsplit(" ", 1)[0].strip()
    return clipped or text[:limit].strip()


def _clip_words(text: str, max_words: int = 220) -> str:
    words = str(text or "").strip().split()
    if len(words) <= max_words:
        return " ".join(words)
    return " ".join(words[:max_words]).strip()


def _fetch_candidate_profile_for_draft(user_id: str) -> dict[str, Any]:
    if not supabase or not user_id:
        return {}
    try:
        resp = supabase.table("candidate_profiles").select("*").eq("id", user_id).maybe_single().execute()
        return _safe_dict(resp.data if resp else None)
    except Exception as exc:
        print(f"⚠️ Failed to fetch candidate profile for draft: {exc}")
        return {}


def _fetch_profile_identity(user_id: str) -> dict[str, Any]:
    if not supabase or not user_id:
        return {}
    try:
        resp = supabase.table("profiles").select("id,full_name,email,avatar_url").eq("id", user_id).maybe_single().execute()
        return _safe_dict(resp.data if resp else None)
    except Exception as exc:
        print(f"⚠️ Failed to fetch profile identity for mini challenge publisher: {exc}")
        return {}


def _fetch_cv_document_for_draft(user_id: str, cv_document_id: str | None) -> dict[str, Any] | None:
    if not supabase or not user_id or not cv_document_id:
        return None
    try:
        resp = (
            supabase
            .table("cv_documents")
            .select("*")
            .eq("id", cv_document_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return _safe_row(resp.data if resp else None)
    except Exception as exc:
        print(f"⚠️ Failed to fetch CV document for draft: {exc}")
        return None


def _resolve_application_draft_language(
    requested: str,
    candidate_profile: dict[str, Any],
    cv_document: dict[str, Any] | None,
    job: dict[str, Any],
) -> str:
    normalized = str(requested or "auto").strip().lower()
    if normalized and normalized != "auto":
        return normalized.split("-", 1)[0][:8]

    locale = str((cv_document or {}).get("locale") or "").strip().lower()
    if locale:
        return locale.split("-", 1)[0][:8]

    preferred_country = str(
        (_safe_dict(candidate_profile.get("preferences")).get("preferredCountryCode") or candidate_profile.get("preferred_country_code") or "")
    ).strip().upper()
    if preferred_country == "CZ":
        return "cs"
    if preferred_country == "SK":
        return "sk"
    if preferred_country in {"DE", "AT"}:
        return "de"
    if preferred_country == "PL":
        return "pl"

    explicit_job_language = str(job.get("language_code") or job.get("language") or "").strip().lower()
    if explicit_job_language:
        return explicit_job_language.split("-", 1)[0][:8]

    job_text = " ".join(
        [
            str(job.get("title") or ""),
            str(job.get("company") or ""),
            _strip_html_tags(job.get("description") or ""),
        ]
    ).lower()
    if re.search(r"[ěščřžýáíéůúťďň]", job_text):
        return "cs"
    return "en"


def _extract_candidate_cv_context(candidate_profile: dict[str, Any], cv_document: dict[str, Any] | None) -> tuple[str, str]:
    parsed = _safe_dict((cv_document or {}).get("parsed_data"))
    cv_ai_text = str(parsed.get("cvAiText") or parsed.get("cv_ai_text") or candidate_profile.get("cv_ai_text") or "").strip()
    cv_text = str(parsed.get("cvText") or parsed.get("cv_text") or candidate_profile.get("cv_text") or "").strip()
    return cv_text, cv_ai_text


def _derive_fit_signals(
    job: dict[str, Any],
    candidate_profile: dict[str, Any],
    recommendation: dict[str, Any] | None,
) -> tuple[float | None, list[str], list[str]]:
    if isinstance(recommendation, dict):
        score = recommendation.get("score")
        try:
            fit_score = round(float(score), 1) if score is not None else None
        except Exception:
            fit_score = None
        fit_reasons = _safe_string_list(recommendation.get("reasons"), limit=4)
        breakdown = _safe_dict(recommendation.get("breakdown"))
        fit_warnings = []
        if breakdown.get("missing_required_qualifications"):
            fit_warnings.append("Pozice pravděpodobně vyžaduje některé kvalifikace, které nejsou v profilu jasně doložené.")
        if breakdown.get("domain_mismatch"):
            fit_warnings.append("Role je částečně mimo dosavadní doménové zaměření profilu.")
        return fit_score, fit_reasons, fit_warnings[:3]

    fit_reasons: list[str] = []
    fit_warnings: list[str] = []
    skills = _safe_string_list(candidate_profile.get("skills"), limit=12)
    inferred_skills = _safe_string_list(candidate_profile.get("inferred_skills"), limit=8)
    known_skills = [item.lower() for item in (skills + inferred_skills) if item]
    job_text = " ".join(
        [
            str(job.get("title") or ""),
            str(job.get("company") or ""),
            _strip_html_tags(job.get("description") or ""),
        ]
    ).lower()
    matched_skills = []
    for skill in known_skills:
        if skill and skill not in matched_skills and skill in job_text:
            matched_skills.append(skill)
    if matched_skills:
        fit_reasons.append(f"Profil se potkává s požadavky v oblastech: {', '.join(matched_skills[:4])}.")

    candidate_title = str(candidate_profile.get("job_title") or "").strip()
    if candidate_title and candidate_title.lower() in job_text:
        fit_reasons.append("Současné nebo cílové zaměření kandidáta odpovídá názvu role.")

    if str(job.get("is_remote") or job.get("remote") or "").lower() in {"true", "1"}:
        fit_reasons.append("Role působí jako remote nebo remote-friendly.")

    salary_from = job.get("salary_from") or job.get("salary_min")
    salary_to = job.get("salary_to") or job.get("salary_max")
    desired_salary = _safe_dict(candidate_profile.get("preferences")).get("desiredSalary")
    try:
        desired_salary_value = float(desired_salary) if desired_salary is not None else None
    except Exception:
        desired_salary_value = None
    salary_raw = salary_to if salary_to is not None else salary_from
    try:
        salary_value = float(salary_raw) if salary_raw is not None else None
    except Exception:
        salary_value = None
    if desired_salary_value is not None and salary_value is not None and salary_value < desired_salary_value:
        fit_warnings.append("Nabízená mzda může být pod preferovanou úrovní kandidáta.")

    if not fit_reasons:
        fit_reasons.append("Role tematicky navazuje na dosavadní profil a cílové pracovní směřování kandidáta.")

    return None, fit_reasons[:4], fit_warnings[:3]


def _build_application_draft_prompt(
    *,
    job: dict[str, Any],
    candidate_profile: dict[str, Any],
    cv_text: str,
    cv_ai_text: str,
    fit_score: float | None,
    fit_reasons: list[str],
    fit_warnings: list[str],
    language: str,
    tone: str,
) -> str:
    language_label = {
        "cs": "Czech",
        "sk": "Slovak",
        "de": "German",
        "pl": "Polish",
    }.get(language, "English")
    summary = _clip_text(candidate_profile.get("story") or candidate_profile.get("job_title") or "", 1200)
    skills = ", ".join(_safe_string_list(candidate_profile.get("skills"), limit=10))
    strengths = ", ".join(_safe_string_list(candidate_profile.get("strengths"), limit=6))
    experience = _clip_text(cv_ai_text or cv_text, 5000)
    fit_score_line = "unknown" if fit_score is None else str(fit_score)
    return f"""
Write a concise job application message in {language_label}.
Return plain text only. No markdown, no bullets, no subject line.

Rules:
- Maximum 220 words.
- Use only facts supported by the candidate profile or CV context below.
- Do not invent years of experience, relocation plans, notice period, salary expectations, or availability.
- Keep the tone {tone}.
- Mention 1-2 concrete relevant strengths.
- Close with a calm invitation to continue the conversation.

Job:
- Title: {str(job.get("title") or "")}
- Company: {str(job.get("company") or "")}
- Location: {str(job.get("location") or "")}
- Salary: {str(job.get("salary_from") or job.get("salary_min") or "")} - {str(job.get("salary_to") or job.get("salary_max") or "")} {str(job.get("salary_currency") or "")}
- Description: {_clip_text(_strip_html_tags(job.get("description") or ""), 5000)}

Candidate:
- Current title: {str(candidate_profile.get("job_title") or "")}
- Summary: {summary}
- Skills: {skills}
- Strengths: {strengths}
- CV context: {experience}

Fit signals:
- Score: {fit_score_line}
- Reasons: {' | '.join(fit_reasons[:4])}
- Warnings: {' | '.join(fit_warnings[:3]) if fit_warnings else 'none'}
""".strip()


def _fallback_application_draft(
    *,
    job: dict[str, Any],
    candidate_profile: dict[str, Any],
    fit_reasons: list[str],
    language: str,
) -> str:
    title = str(job.get("title") or "tuto pozici").strip()
    company = str(job.get("company") or "vaši společnost").strip()
    candidate_title = str(candidate_profile.get("job_title") or "").strip()
    strengths = _safe_string_list(candidate_profile.get("strengths"), limit=2)
    primary_reason = fit_reasons[0] if fit_reasons else ""
    strength_text = ", ".join(strengths)
    if language in {"cs", "sk"}:
        opener = f"Dobrý den, reaguji na pozici {title} ve společnosti {company}."
        profile_line = f" V mém profilu navazuje tato role na zkušenosti v oblasti {candidate_title}." if candidate_title else ""
        reason_line = f" Zaujala mě hlavně tato shoda: {primary_reason}" if primary_reason else ""
        strength_line = f" Relevantní pro tuto roli jsou také moje silné stránky: {strength_text}." if strength_text else ""
        close = " Pokud bude dávat smysl krátký navazující kontakt, rád doplním konkrétní zkušenosti nebo ukázky práce."
    else:
        opener = f"Hello, I am reaching out about the {title} role at {company}."
        profile_line = f" The role aligns with my background in {candidate_title}." if candidate_title else ""
        reason_line = f" What stood out to me most is this fit signal: {primary_reason}" if primary_reason else ""
        strength_line = f" Relevant strengths I can bring include {strength_text}." if strength_text else ""
        close = " If useful, I would be glad to continue with a short follow-up conversation and share more concrete examples of my work."
    return _clip_words(f"{opener}{profile_line}{reason_line}{strength_line}{close}", 220)


def _generate_application_draft_text(prompt: str) -> tuple[str, dict[str, Any]]:
    default_primary = get_default_primary_model()
    default_fallback = get_default_fallback_model()
    cfg = get_active_model_config("ai_orchestration", "application_draft")
    primary_model = cfg.get("primary_model") or default_primary
    fallback_model = cfg.get("fallback_model") or default_fallback
    generation_config = {
        "temperature": cfg.get("temperature", 0.3),
        "top_p": cfg.get("top_p", 1),
        "top_k": cfg.get("top_k", 1),
    }
    result, fallback_used = call_primary_with_fallback(
        prompt,
        primary_model,
        fallback_model,
        generation_config=generation_config,
    )
    text = _clip_words(result.text or "", 220)
    return text, {
        "model_used": result.model_name,
        "fallback_used": fallback_used,
        "token_usage": {"input": result.tokens_in, "output": result.tokens_out},
        "latency_ms": result.latency_ms,
    }


def _coerce_job_analysis_payload(raw: dict[str, Any]) -> dict[str, Any]:
    summary = str(raw.get("summary") or "").strip()
    hidden = raw.get("hiddenRisks")
    if not isinstance(hidden, list):
        hidden = raw.get("hidden_risks")
    if not isinstance(hidden, list):
        hidden = []
    hidden = [str(item).strip() for item in hidden if str(item).strip()][:12]
    cultural = str(raw.get("culturalFit") or raw.get("cultural_fit") or "").strip()
    if not summary:
        raise ValueError("Missing summary in AI response")
    if not cultural:
        cultural = "Neutrální"
    return {
        "summary": summary[:2000],
        "hiddenRisks": hidden,
        "culturalFit": cultural[:200],
    }


def _job_analysis_prompt(description: str, title: str | None = None, language: str = "cs") -> str:
    normalized_lang = (language or "cs").strip().lower()
    output_lang = "Czech" if normalized_lang.startswith("cs") else "English"
    job_title = (title or "").strip()
    title_line = f"Job title: {job_title}\n" if job_title else ""
    return f"""
Analyze the following job posting as a pragmatic career advisor.
Output language: {output_lang}
Return STRICT JSON only with keys:
- summary: string
- hiddenRisks: string[]
- culturalFit: string

Rules:
- summary = one sentence of what the job actually is
- hiddenRisks = implied red flags or ambiguity
- culturalFit = one short label

{title_line}Description:
{description[:7000]}
""".strip()
