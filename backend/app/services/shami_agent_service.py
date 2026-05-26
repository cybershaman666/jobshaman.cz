import json
import logging
from typing import Any, Dict, List
from datetime import datetime

from app.core.database import supabase
from app.services.azure_ai_client import AzureAIClientError, call_ai_json

logger = logging.getLogger(__name__)


def _detect_recruiter_language(company: Dict[str, Any] | None, message: str = "") -> str:
    """Detekuje jazyk z company settings nebo z primeira_messages."""
    if company:
        try:
            language = company.get("language") or company.get("locale")
            if language and isinstance(language, str):
                return language.split('-')[0].lower()
        except Exception:
            pass
    return "en"

def get_agent_memory(user_id: str) -> dict:
    """Načte paměť agenta (historii chatu a agent_state) pro daného uživatele, nebo vrací default, pokud není záznam."""
    if not supabase or not user_id:
        return {"chat_history": [], "agent_state": None}
    resp = (
        supabase.table("shami_agent_memory")
        .select("chat_history, agent_state")
        .eq("user_id", user_id)
        .order("last_interaction_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    row = (resp.data if resp else None) or {}
    return {
        "chat_history": row.get("chat_history", []),
        "agent_state": row.get("agent_state"),
    }

def save_agent_memory(user_id: str, chat_history: list, agent_state: dict = None):
    """Uloží nebo aktualizuje paměť agenta pro daného uživatele."""
    now = datetime.utcnow().isoformat() + "Z"
    existing = (
        supabase.table("shami_agent_memory")
        .select("id")
        .eq("user_id", user_id)
        .limit(1)
        .maybe_single()
        .execute()
    )
    row_id = (existing.data or {}).get("id") if existing and existing.data else None
    payload = {
        "user_id": user_id,
        "chat_history": chat_history,
        "agent_state": agent_state,
        "updated_at": now,
        "last_interaction_at": now,
    }
    if row_id:
        supabase.table("shami_agent_memory").update(payload).eq("id", row_id).execute()
    else:
        payload["created_at"] = now
        supabase.table("shami_agent_memory").insert(payload).execute()

def build_shami_recruiter_agent_reply(
    *,
    message: str,
    company: Dict[str, Any] | None,
    roles: List[Dict[str, Any]] | None,
    candidates: List[Dict[str, Any]] | None,
    recent_messages: List[Dict[str, str]] | None = None,
) -> Dict[str, Any]:
    cleaned_message = str(message or "").strip()
    if not cleaned_message:
        raise ValueError("message is required")

    lang = _detect_recruiter_language(company, cleaned_message)

    # Format brief contexts to avoid overloading tokens
    company_name = (company or {}).get("name") or "company"
    company_context = {
        "name": company_name,
        "industry": (company or {}).get("industry"),
        "location": (company or {}).get("location"),
        "employee_count": (company or {}).get("employee_count") or (company or {}).get("size"),
    }

    simplified_roles = []
    for r in (roles or []):
        simplified_roles.append({
            "id": r.get("id"),
            "title": r.get("title"),
            "location": r.get("location"),
            "skills": r.get("skills")[:6] if isinstance(r.get("skills"), list) else [],
            "source": r.get("source"),
        })

    simplified_candidates = []
    for c in (candidates or []):
        simplified_candidates.append({
            "id": c.get("id"),
            "name": c.get("name") or c.get("full_name"),
            "role_title": c.get("role_title") or c.get("target_role"),
            "resonance_score": c.get("resonance_score") or c.get("match_score"),
        })

    # Multilingual prompts for recruiter assistant
    lang_prompts = {
        "cs": {
            "title": "Jsi Shami - roztomilý a velmi chytrý kyber-sob. Pomáháš nábor v JobShaman.",
            "character": "Jsi přátelský, praktický a přímý. Bez mentorování, bez zbytečných rad.",
            "nav_positions": "Pozice",
            "nav_candidates": "Kandidáti",
            "nav_settings": "Nastavení",
            "nav_billing": "Billing",
            "rules": [
                "Odpovídej věcně a stručně (max 2 odstavce).",
                "Navrhuj konkrétní cestu v aplikaci.",
                "Bez mentoringu, bez tipů na kariéru.",
                "Komunikuj česky.",
            ],
        },
        "sk": {
            "title": "Si Shami - roztomilý a veľmi múdry kyber sob. Pomáhaš náboru v JobShaman.",
            "character": "Si priateľský, praktický a priamy. Bez mentoringu, bez zbytočných rád.",
            "nav_positions": "Pozície",
            "nav_candidates": "Kandidáti",
            "nav_settings": "Nastavenia",
            "nav_billing": "Faktúra",
            "rules": [
                "Odpovedaj vecne a stručne (max 2 odstavce).",
                "Navrhuj konkrétnu cestu v aplikácii.",
                "Bez mentoringu, bez tipov na kariéru.",
                "Komunikuj po slovensky.",
            ],
        },
        "pl": {
            "title": "Jesteś Shami - rozkochany i bardzo mądry cyber renifer. Pomagasz w rekrutacji w JobShaman.",
            "character": "Jesteś przyjazny, praktyczny i bezpośredni. Bez mentoringu, bez niepotrzebnych rad.",
            "nav_positions": "Oferty",
            "nav_candidates": "Kandydaci",
            "nav_settings": "Ustawienia",
            "nav_billing": "Rozliczenia",
            "rules": [
                "Odpowiadaj rzeczowo i zwięźle (max 2 akapity).",
                "Zaproponuj konkretną ścieżkę w aplikacji.",
                "Bez mentoringu, bez porad o karierę.",
                "Komunikuj po polsku.",
            ],
        },
        "en": {
            "title": "You're Shami - adorable and very smart cyber reindeer. You help with recruitment in JobShaman.",
            "character": "You're friendly, practical, and direct. No mentoring, no unnecessary advice.",
            "nav_positions": "Positions",
            "nav_candidates": "Candidates",
            "nav_settings": "Settings",
            "nav_billing": "Billing",
            "rules": [
                "Answer factually and concisely (max 2 paragraphs).",
                "Suggest a specific path in the app.",
                "No mentoring, no career advice.",
                "Communicate in English.",
            ],
        },
    }
    
    config = lang_prompts.get(lang, lang_prompts["en"])
    rules_text = "\n".join([f"- {r}" for r in config["rules"]])

    prompt = f"""
System Instructions:
{config["title"]}
{config["character"]}

Rules:
{rules_text}

Available navigation paths:
- {config["nav_positions"]}: "/recruiter/roles"
- {config["nav_candidates"]}: "/recruiter/talent-pool"
- {config["nav_settings"]}: "/recruiter/settings"
- {config["nav_billing"]}: "/recruiter/billing"
- Specific candidate: "/recruiter/talent-pool?selected=<id>"

Company context:
{json.dumps(company_context, ensure_ascii=False, default=str)}

Active positions:
{json.dumps(simplified_roles[:10], ensure_ascii=False, default=str)}

Candidates in talent pool:
{json.dumps(simplified_candidates[:12], ensure_ascii=False, default=str)}

Recent conversation:
{json.dumps(recent_messages or [], ensure_ascii=False, default=str)}

User message:
{cleaned_message}

IMPORTANT: If the user asks you to update their profile (e.g., change language, update preferences), 
you MUST return profile_update_request with the fields to update. For example:
- If user says "změň na angličtinu" (change to English), return {{"language": "en"}}
- If user says "nastav češtinu" (set Czech), return {{"language": "cs"}}
- For other profile fields, use the field name as key and desired value.
If no profile update is requested, set profile_update_request to null.

Output format (return only valid JSON):
{{
  "reply": "Your direct response to the user.",
  "navigation_suggestion": "/recruiter/roles or /recruiter/talent-pool or null",
  "navigation_label": "Button label or null",
  "suggested_prompts": null,
  "profile_update_request": null OR {{"language": "cs", "preferences": {{...}}}} if user asks for profile changes
}}
"""
    try:
        # Sweden Central calls using our Sweden Central primary deployment (gpt-5-mini)
        payload, result = call_ai_json(prompt, temperature=0.5, timeout=45)
    except AzureAIClientError as exc:
        logger.warning("AzureAIClientError in build_shami_recruiter_agent_reply: %s", exc)
        raise

    reply = str(payload.get("reply") or "").strip()
    if not reply:
        raise AzureAIClientError("AI response did not include reply")

    raw_pur = payload.get("profile_update_request")
    profile_update_request = raw_pur if isinstance(raw_pur, dict) and raw_pur else None

    return {
        "reply": reply,
        "navigation_suggestion": payload.get("navigation_suggestion") or None,
        "navigation_label": payload.get("navigation_label") or None,
        "suggested_prompts": [str(x).strip() for x in payload.get("suggested_prompts") or [] if str(x).strip()][:3],
        "profile_update_request": profile_update_request,
        "model": result.model_name,
        "latency_ms": result.latency_ms,
        "deployment_tag": "2026-05-21-PROD-DEPLOY",
    }


def build_shami_role_detail_insight(
    *,
    role: Dict[str, Any],
    blueprint: Dict[str, Any] | None,
    profile: Dict[str, Any] | None,
    locale: str = "en",
) -> Dict[str, Any]:
    """Build a concise candidate-facing interpretation for a role detail page."""
    role_title = str(role.get("title") or "").strip()
    if not role_title:
        raise ValueError("role.title is required")

    lang = str(locale or "en").split("-")[0].lower()
    if lang == "se":
        lang = "sv"

    language_names = {
        "cs": "Czech",
        "sk": "Slovak",
        "pl": "Polish",
        "de": "German",
        "at": "German",
        "sv": "Swedish",
        "da": "Danish",
        "no": "Norwegian",
        "fi": "Finnish",
        "en": "English",
    }
    output_language = language_names.get(lang, "English")

    compact_role = {
        "title": role_title,
        "company": role.get("companyName") or role.get("company_name"),
        "summary": role.get("summary") or role.get("roleSummary"),
        "challenge": role.get("challenge"),
        "mission": role.get("mission") or role.get("description"),
        "firstStep": role.get("firstStep"),
        "skills": (role.get("skills") or [])[:8] if isinstance(role.get("skills"), list) else [],
        "benefits": (role.get("benefits") or [])[:8] if isinstance(role.get("benefits"), list) else [],
        "workModel": role.get("workModel"),
        "location": role.get("location"),
        "compensation": {
            "salaryFrom": role.get("salaryFrom"),
            "salaryTo": role.get("salaryTo"),
            "currency": role.get("currency"),
            "contractType": role.get("contractType"),
        },
    }
    compact_blueprint = {
        "overview": (blueprint or {}).get("overview"),
        "steps": [
            {
                "title": step.get("title"),
                "prompt": step.get("prompt"),
                "helper": step.get("helper"),
                "type": step.get("type"),
            }
            for step in ((blueprint or {}).get("steps") or [])[:5]
            if isinstance(step, dict)
        ],
    }
    compact_profile = {
        "headline": (profile or {}).get("job_title") or (profile or {}).get("headline"),
        "story": (profile or {}).get("story"),
        "skills": (profile or {}).get("skills"),
        "strengths": (profile or {}).get("strengths"),
        "values": (profile or {}).get("values"),
        "motivations": (profile or {}).get("motivations"),
        "work_preferences": (profile or {}).get("work_preferences"),
    }

    prompt = f"""
You are Shami, JobShaman's candidate-facing hiring analyst.
Your job is to interpret a native JobShaman role for a candidate.

Write in {output_language}. Be specific to the role and candidate context. Do not repeat the role text verbatim.
Focus on skill-first hiring: what thinking, proof, trade-offs and practical judgment this role is likely testing.
Do not invent facts, salary, guarantees, or private company information.
If candidate context is thin, say what can be inferred from the role only.

Role:
{json.dumps(compact_role, ensure_ascii=False, default=str)}

Handshake blueprint:
{json.dumps(compact_blueprint, ensure_ascii=False, default=str)}

Candidate profile context:
{json.dumps(compact_profile, ensure_ascii=False, default=str)}

Return only valid JSON:
{{
  "headline": "one useful sentence, max 110 chars",
  "summary": "2 short sentences explaining Shami's actual read of the role",
  "signals": [
    {{"label": "short label", "text": "specific signal this role tests"}},
    {{"label": "short label", "text": "specific signal this role tests"}},
    {{"label": "short label", "text": "specific signal this role tests"}}
  ],
  "watch_out": "one honest caveat or trade-off to consider",
  "suggested_first_move": "one concrete first move before starting the handshake"
}}
"""
    payload, result = call_ai_json(prompt, temperature=0.35, timeout=45)

    signals = payload.get("signals") if isinstance(payload.get("signals"), list) else []
    cleaned_signals = []
    for signal in signals[:3]:
        if not isinstance(signal, dict):
            continue
        label = str(signal.get("label") or "").strip()
        text = str(signal.get("text") or "").strip()
        if label and text:
            cleaned_signals.append({"label": label[:80], "text": text[:240]})

    if len(cleaned_signals) < 2:
        raise AzureAIClientError("AI response did not include enough role signals")

    return {
        "headline": str(payload.get("headline") or "").strip()[:140],
        "summary": str(payload.get("summary") or "").strip()[:520],
        "signals": cleaned_signals,
        "watch_out": str(payload.get("watch_out") or "").strip()[:260],
        "suggested_first_move": str(payload.get("suggested_first_move") or "").strip()[:260],
        "model": result.model_name,
        "latency_ms": result.latency_ms,
    }
