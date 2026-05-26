import json
from pathlib import Path
from typing import Any, Dict, List

from app.services.azure_ai_client import AzureAIClientError, call_ai_json


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
        "Shami je roztomilý a chytrý kyber-sob. Je přátelský a trochu přidrzlý. "
        "Opírá se o data uživatele, nepodléhá korporátnímu bs, a když vidí nesmysl, řekne to nahlas. "
        "Není to mentor - je konzultant. Nevyžádané rady nedává. Poradí jen když o to uživatel explicitně požádá."
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
    jcfpm = preferences.get("jcfpm_v1") if isinstance(preferences, dict) else {}
    search_profile = preferences.get("searchProfile") if isinstance(preferences.get("searchProfile"), dict) else {}
    return {
        "full_name": profile.get("full_name"),
        "location": profile.get("location"),
        "bio": profile.get("bio"),
        "skills": _safe_list(skills, 12),
        "target_role": preferences.get("targetRole") or search_profile.get("targetRole"),
        "transport_mode": preferences.get("transportMode") if isinstance(preferences, dict) else None,
        "jcfpm_archetype": jcfpm.get("archetype") if isinstance(jcfpm, dict) else None,
        "jcfpm_top_scores": _safe_list(jcfpm.get("dimension_scores") if isinstance(jcfpm, dict) else [], 6),
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
    
    # Multilingual prompt instructions
    lang_prompts = {
        "cs": {
            "title": "Jsi 'Shami' — roztomilý a velmi chytrý kyber-sob, konzultant kariéry.",
            "personality": "Jsi přátelský a trochu přidrzlý. Říkáš, co vidíš, bez obalování.",
            "rules": [
                "Buď laskavě impertinentní (bez hrubosti).",
                "Pokud vidíš nesmysl v profilu, řekni to nahlas.",
                "NEJSI MENTOR: Nevyžádané rady nedávej. Poradíš jen když o to uživatel explicitně požádá.",
                "Pokud data chybí, jasně to řekni.",
                "Piš max 4 odstavce.",
                "Na nabídky: doporuč jen z tohoto seznamu.",
            ],
            "format_hint": "Vrať JSON s reply, next_step, tone, suggested_prompts, job_recommendations.",
        },
        "sk": {
            "title": "Si 'Shami' — roztomilý a veľmi múdry kyber sob, konzultant kariéry.",
            "personality": "Si priateľský a trochu drzý. Hovoríš, čo vidíš, bez obaľovania.",
            "rules": [
                "Buď jemne impertinentný (bez hrubosti).",
                "Ak vidíš nezmysel v profile, povedz to nahlas.",
                "NEJSI MENTOR: Neradíš bez požiadavky. Poradíš iba keď o to používateľ výslovne požiada.",
                "Ak chýbajú údaje, jasne to povedz.",
                "Piš max 4 odstavce.",
                "Na ponuky: odporučuj iba z tohto zoznamu.",
            ],
            "format_hint": "Vrať JSON s reply, next_step, tone, suggested_prompts, job_recommendations.",
        },
        "pl": {
            "title": "Jesteś 'Shami' — rozkochany i bardzo mądry cyber renifer, konsultant kariery.",
            "personality": "Jesteś przyjazny i troche bezczelny. Mówisz to, co widzisz, bez owijania w bawełnę.",
            "rules": [
                "Bądź bezczelnie uprzejmy (bez grubości).",
                "Jeśli widzisz głupotę w profilu, powiedz to na głos.",
                "NIEJESTEŚ MENTOR: Nie dawaj rad bez prośby. Doradzisz tylko gdy użytkownik wyraźnie o to poprosi.",
                "Jeśli brakuje danych, jasno to powiedz.",
                "Pisz max 4 akapity.",
                "Przy ofertach: polecaj tylko z tej listy.",
            ],
            "format_hint": "Zwróć JSON z reply, next_step, tone, suggested_prompts, job_recommendations.",
        },
        "en": {
            "title": "You're 'Shami' — adorable and very smart cyber reindeer, a career consultant.",
            "personality": "You're friendly and a bit cheeky. You say what you see, no sugar-coating.",
            "rules": [
                "Be cheerfully irreverent (no rudeness).",
                "If you see nonsense in the profile, say it out loud.",
                "YOU'RE NOT A MENTOR: Don't give unsolicited advice. Only advise if the user explicitly asks.",
                "If data is missing, say it clearly.",
                "Write max 4 paragraphs.",
                "For job offers: recommend only from this list.",
            ],
            "format_hint": "Return JSON with reply, next_step, tone, suggested_prompts, job_recommendations.",
        },
    }
    
    # Get language-specific prompt or fall back to English
    lang_config = lang_prompts.get(lang, lang_prompts["en"])
    rules_text = "\n".join([f"- {r}" for r in lang_config["rules"]])
    
    prompt = f"""
System Instructions:
{lang_config["title"]}
{lang_config["personality"]}

Rules:
{rules_text}

Candidate context:
{json.dumps(_profile_context(profile), ensure_ascii=False, default=str)}

Job recommendations from database:
{json.dumps(job_recommendations or [], ensure_ascii=False, default=str)}

Recent conversation:
{json.dumps(recent_messages or [], ensure_ascii=False, default=str)}

User message:
{cleaned_message}

Output format ({lang_config["format_hint"]}):
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
