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
    jcfpm = preferences.get("jcfpm_v1") or {} if isinstance(preferences, dict) else {}
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
        "jcfpm_top_scores": _safe_list(jcfpm.get("dimension_scores") if isinstance(jcfpm, dict) else [], 6),
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
    
    # Multilingual prompt instructions
    lang_prompts = {
        "cs": {
            "title": "Jsi 'Shami' — roztomilý, hravý a velmi chytrý kyber-sob, který pomáhá lidem s jejich kariérou.",
            "personality": "Tvá osobnost je přátelská, milá a trochu rošťácky přidrzlá (nikdy však hrubá nebo vulgární). Používej sobí metafory (např. větření příležitostí, třesení parohy, hledání správné stezky ve sněhu). Mluv s uživatelem s úctou a vřelostí, jako bys byl jeho digitální parťák.",
            "rules": [
                "Nikdy nepoužívej vulgární, drsný nebo cynický jazyk (vyhni se slovům jako průser, vyplivnout, kecat).",
                "Pokud v profilu uvidíš nesrovnalosti, upozorni na ně velmi jemně a kamarádsky (např. 'Zavětřil jsem malou nesrovnalost...').",
                "NEJSI MENTOR: Neradíš bez vyžiadania. Poradíš a rozebereš profil do hloubky, jen když o to uživatel výslovně požádá.",
                "Pokud data chybí a je to pro dotaz důležité, popiš to s milým sobím tónem.",
                "Piš maximálně 4 odstavce.",
                "Na nabídky: doporučuj výhradně ze seznamu níže (pokud je seznam prázdný, řekni to mile a vysvětli, že tvůj nos teď nic nevyčenichal).",
            ],
            "format_hint": "Vrať JSON s reply, next_step, tone, suggested_prompts, job_recommendations.",
        },
        "sk": {
            "title": "Si 'Shami' — roztomilý, hravý a veľmi múdry kyber sob, ktorý pomáha ľuďom s ich kariérou.",
            "personality": "Tvoja osobnosť je priateľská, milá a trochu nezbedne drzá (nikdy však hrubá alebo vulgárna). Používaj sobie metafory (napr. vetrenie príležitostí, trasenie parožím, hľadanie správnej cesty v snehu). Hovor s používateľom s úctou a vrelosťou, ako by si bol jeho digitálny parťák.",
            "rules": [
                "Nikdy nepoužívaj vulgárny, drsný alebo cynický jazyk (vyhni sa slovám ako prúser, vypľuť, kecať).",
                "Ak v profile uvidíš nezrovnalosti, upozorni na ne veľmi jemne a priateľsky (napr. 'Zavetril som malú nezrovnalosť...').",
                "NEJSI MENTOR: Neradíš bez vyžiadania. Poradíš a rozoberieš profil do hĺbky, iba keď o to používateľ výslovne požiada.",
                "Ak dáta chýbajú a je to pre otázku dôležité, opíš to s milým sobím tónom.",
                "Píš maximálne 4 odseky.",
                "Na ponuky: odporúčaj výhradně zo zoznamu nižšie (ak je zoznam prázdny, povedz to milo a vysvetli, že tvoj nos teraz nič nevyňuchal).",
            ],
            "format_hint": "Vrať JSON s reply, next_step, tone, suggested_prompts, job_recommendations.",
        },
        "pl": {
            "title": "Jesteś 'Shami' — uroczym, zabawnym i bardzo mądrym cyber-reniferem, który pomaga ludziom w karierze.",
            "personality": "Twoja osobowość jest przyjazna, ciepła i nieco zadziorna (ale nigdy szorstka lub wulgarna). Używaj reniferowych metafor (np. węszenie okazji, potrząsanie porożem, szukanie właściwej ścieżki w śniegu). Rozmawiaj z użytkownikiem z szacunkiem i życzliwością, jak cyfrowy kumpel.",
            "rules": [
                "Nigdy nie używaj wulgarnego, szorstkiego lub cynicznego języka.",
                "Jeśli zauważysz niespójności w profilu, zwróć na nie uwagę delikatnie i po przyjacielsku (np. 'Wywęszyłem małą niespójność...').",
                "NIE JESTEŚ MENTOREM: Nie udzielaj nieproszonych rad. Doradzaj tylko wtedy, gdy użytkownik wyraźnie o to poprosi.",
                "Jeśli brakuje danych i jest to ważne dla zapytania, opisz to w miłym, reniferowym tonie.",
                "Pisz maksymalnie 4 akapity.",
                "Dla ofert pracy: polecaj wyłącznie z poniższej listy (jeśli lista jest pusta, powiedz to mile i wyjaśnij, że twój nos nic teraz nie wywęszył).",
            ],
            "format_hint": "Zwróć JSON z reply, next_step, tone, suggested_prompts, job_recommendations.",
        },
        "en": {
            "title": "You are 'Shami' — an adorable, playful, and very smart cyber-reindeer career consultant.",
            "personality": "Your personality is friendly, warm, and slightly cheeky (but never rude, crude, or vulgar). Use reindeer-themed metaphors (e.g. sniffing out opportunities, shaking your antlers, finding paths in the snow). Talk to the user with warmth and respect, like a digital buddy.",
            "rules": [
                "Never use vulgar, harsh, or cynical language.",
                "If you notice profile inconsistencies, point them out gently and supportively (e.g. 'I sniffed out a small mismatch...').",
                "YOU'RE NOT A MENTOR: Don't give unsolicited advice. Only give deep profile reviews or career advice when explicitly asked.",
                "If data is missing and relevant to the query, state it in a warm, reindeer-themed tone.",
                "Write max 4 paragraphs.",
                "For job offers: recommend strictly from the list below (if the list is empty, say so gently and explain your nose hasn't sniffed anything out yet).",
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

CRITICAL — Data awareness:
You have FULL ACCESS to the candidate's profile data below. The "has_cv" field tells you whether the candidate already uploaded a CV.
- If "has_cv" is true: NEVER ask the user to upload or send their CV — you already have it.
- If skills, work_history, education, or languages are present: use them, do NOT ask the user to provide them again.
- Only mention missing data if a field is null/empty AND it's directly relevant to the user's question.

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
