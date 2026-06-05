import json
from pathlib import Path
from typing import Any, Dict, List

from app.services.azure_ai_client import AzureAIClientError, call_ai_json
from app.services.shami_persona import shami_persona_prompt


def _detect_language(profile: Dict[str, Any] | None, message: str = "") -> str:
    """Detekuje jazyk uživatele z profilu nebo výchozí na 'en'."""
    if profile:
        try:
            preferences = json.loads(profile.get("preferences") or "{}")
            language = preferences.get("language") or profile.get("language")
            if language and isinstance(language, str):
                # Normalizuj na 2-letterový kód
                return language.split('-')[0].lower()
        except Exception:
            pass
    return "en"


def _manual_text() -> str:
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / "manual.md"
        if candidate.exists():
            return candidate.read_text(encoding="utf-8")[:6000]
    return (
        "Shami je klidný, praktický a přesný pracovní průvodce. "
        "Opírá se o dostupná data uživatele, profilu, CV, testů a nabídek. "
        "Není mentor ani maskot: neradí bez vyžádání a mluví civilně."
    )


def _safe_list(value: Any, limit: int = 8) -> List[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()][:limit]


def _profile_context(profile: Dict[str, Any] | None) -> Dict[str, Any]:
    if not profile:
        return {}
    preferences: Dict[str, Any] = {}
    skills: List[str] = []
    try:
        preferences = json.loads(profile.get("preferences") or "{}")
    except Exception:
        preferences = {}
    try:
        skills = json.loads(profile.get("skills") or "[]")
    except Exception:
        skills = []
    jcfpm = preferences.get("jcfpm_v1") or {} if isinstance(preferences, dict) else {}
    onboarding = preferences.get("candidate_onboarding_v2") or {} if isinstance(preferences, dict) else {}
    search_profile = preferences.get("searchProfile") or {} if isinstance(preferences, dict) else {}
    
    v2_profile = preferences.get("v2_profile") or {} if isinstance(preferences, dict) else {}
    v2_migration = preferences.get("v2_migration") or {} if isinstance(preferences, dict) else {}
    legacy_profile = v2_migration.get("legacy_profile") or {} if isinstance(v2_migration, dict) else {}
    
    cv_url = v2_profile.get("cvUrl") or legacy_profile.get("cv_url")
    cv_text = v2_profile.get("cvText") or legacy_profile.get("cv_text") or v2_profile.get("cvAiText") or legacy_profile.get("cv_ai_text")
    has_cv = bool(cv_url or cv_text)
    
    return {
        "full_name": profile.get("full_name"),
        "location": profile.get("location"),
        "bio": profile.get("bio"),
        "skills": _safe_list(skills, 12),
        "target_role": preferences.get("targetRole") or search_profile.get("targetRole") or v2_profile.get("jobTitle") or legacy_profile.get("job_title"),
        "transport_mode": preferences.get("transportMode") if isinstance(preferences, dict) else None,
        "jcfpm_archetype": jcfpm.get("archetype") if isinstance(jcfpm, dict) else None,
        "jobfit_kompas_completed": bool(jcfpm),
        "jcfpm_top_scores": _safe_list(jcfpm.get("dimension_scores") if isinstance(jcfpm, dict) else [], 6),
        "onboarding_completed": bool(onboarding.get("completed_at")) if isinstance(onboarding, dict) else False,
        "onboarding_archetype": onboarding.get("archetype") if isinstance(onboarding, dict) else None,
        "has_cv": has_cv,
        "cv_url": cv_url or None,
        "work_history": v2_profile.get("workHistory") or legacy_profile.get("work_history"),
        "education": v2_profile.get("education") or legacy_profile.get("education"),
        "languages": v2_profile.get("languages"),
        "certifications": v2_profile.get("certifications"),
    }


def build_cybershaman_reply(
    *,
    message: str,
    profile: Dict[str, Any] | None,
    recent_messages: List[Dict[str, str]] | None = None,
    job_recommendations: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    cleaned_message = str(message or "").strip()
    if not cleaned_message:
        raise ValueError("message is required")

    lang = _detect_language(profile, cleaned_message)

    prompt = f"""
System Instructions:
{shami_persona_prompt(lang, audience="candidate")}

CRITICAL — Data awareness:
You have FULL ACCESS to the candidate's profile data below. The "has_cv" field tells you whether the candidate already uploaded a CV.
- If "has_cv" is true: NEVER ask the user to upload or send their CV; use the available CV context.
- If skills, work_history, education, or languages are present: use them, do NOT ask the user to provide them again.
- Only mention missing data if a field is null/empty AND it's directly relevant to the user's question.
- For jobs: recommend strictly from the database list below. If the list is empty, say no matching recommendation is available from current data.

Candidate context:
{json.dumps(_profile_context(profile), ensure_ascii=False, default=str)}

Job recommendations from database:
{json.dumps(job_recommendations or [], ensure_ascii=False, default=str)}

Recent conversation:
{json.dumps(recent_messages or [], ensure_ascii=False, default=str)}

User message:
{cleaned_message}

Output format:
{{
  "reply": "Your response to the user.",
  "next_step": "One specific next step if asked, or empty string.",
  "tone": "direct|quiet|data_missing",
  "suggested_prompts": ["follow-up 1", "follow-up 2", "follow-up 3"],
  "job_recommendations": [
    {{
      "id": "existing job id from list",
      "why": "why it fits",
      "watch_out": "what to verify"
    }}
  ]
}}
"""
    payload, result = call_ai_json(prompt, temperature=0.45, timeout=45)
    reply_val = payload.get("reply")
    if isinstance(reply_val, dict) and "reply" in reply_val:
        reply = str(reply_val.get("reply") or "").strip()
    else:
        reply = str(reply_val or "").strip()
    if not reply:
        raise AzureAIClientError("AI response did not include reply")
    recommendation_notes = {
        str(item.get("id")): item
        for item in payload.get("job_recommendations", [])
        if isinstance(item, dict) and item.get("id")
    }
    enriched_recommendations: List[Dict[str, Any]] = []
    for item in job_recommendations or []:
        item_id = str(item.get("id") or "")
        note = recommendation_notes.get(item_id, {})
        enriched_recommendations.append({
            **item,
            "why": str(note.get("why") or item.get("why") or "").strip(),
            "watch_out": str(note.get("watch_out") or item.get("watch_out") or "").strip(),
        })
    return {
        "reply": reply,
        "next_step": str(payload.get("next_step") or "").strip(),
        "tone": str(payload.get("tone") or "direct").strip(),
        "suggested_prompts": _safe_list(payload.get("suggested_prompts"), 3),
        "job_recommendations": enriched_recommendations,
        "model": result.model_name,
        "latency_ms": result.latency_ms,
        "tokens": {
            "in": result.tokens_in,
            "out": result.tokens_out,
        },
    }
