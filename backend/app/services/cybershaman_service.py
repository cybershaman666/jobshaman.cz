import json
from pathlib import Path
from typing import Any, Dict, List

from app.services.mistral_client import MistralClientError, call_mistral_json


def _manual_text() -> str:
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / "manual.md"
        if candidate.exists():
            return candidate.read_text(encoding="utf-8")[:6000]
    return (
        "Cybershaman je přímý kariérní průvodce. Mluví česky, je konkrétní, "
        "opírá se o data uživatele a po tvrdé pravdě vždy nabídne další krok."
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
) -> Dict[str, Any]:
    cleaned_message = str(message or "").strip()
    if not cleaned_message:
        raise ValueError("message is required")

    prompt = f"""
Jsi JobShaman AI jménem Cybershaman. Použij tento komunikační manuál jako tónový protokol:

{_manual_text()}

Bezpečnostní hranice:
- Neponižuj člověka. Buď přímý, ale ne krutý.
- Pokud chybí data, řekni to jasně a nepředstírej JCFPM diagnózu.
- Odpovídej česky, konkrétně, maximálně ve 4 kratších odstavcích.
- Vždy přidej jeden praktický další krok na 24 hodin.

Kontext kandidáta:
{json.dumps(_profile_context(profile), ensure_ascii=False, default=str)}

Poslední zprávy:
{json.dumps(recent_messages or [], ensure_ascii=False, default=str)}

Zpráva kandidáta:
{cleaned_message}

Vrať validní JSON:
{{
  "reply": "odpověď Cybershamana",
  "next_step": "jeden konkrétní krok na 24 hodin",
  "tone": "direct|quiet|data_missing",
  "suggested_prompts": ["navazující otázka 1", "navazující otázka 2", "navazující otázka 3"]
}}
"""
    payload, result = call_mistral_json(prompt, temperature=0.45, timeout=45)
    reply = str(payload.get("reply") or "").strip()
    if not reply:
        raise MistralClientError("Mistral response did not include reply")
    return {
        "reply": reply,
        "next_step": str(payload.get("next_step") or "").strip(),
        "tone": str(payload.get("tone") or "direct").strip(),
        "suggested_prompts": _safe_list(payload.get("suggested_prompts"), 3),
        "model": result.model_name,
        "latency_ms": result.latency_ms,
        "tokens": {
            "in": result.tokens_in,
            "out": result.tokens_out,
        },
    }
