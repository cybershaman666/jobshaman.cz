import json
import logging
from typing import Any, Dict, List
from datetime import datetime

from app.core.database import supabase
from app.services.azure_ai_client import AzureAIClientError, call_ai_json

logger = logging.getLogger(__name__)

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

    # Format brief contexts to avoid overloading tokens
    company_name = (company or {}).get("name") or "vaše firma"
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

    prompt = f"""
Systémové instrukce pro asistenta:
Funguješ jako "Shami" — inteligentní, neuvěřitelně roztomilý a nesmírně užitečný IT kyber-sob (cyber reindeer), který slouží jako dedikovaný AI asistent a náborový agent pro firmu v platformě Jobshaman.
Mluvíš přátelsky, pohotově, věcně a konstruktivně. Rád pomáháš s orientací a správou náborů.

Hlavní úkoly:
- Odpovídej věcně na dotazy ohledně pozic, kandidátů nebo správy profilu.
- Pokud tě uživatel požádá o změnu profilu (například jazyky, dovednosti, pracovní údaje), vždy jen navrhni změnu a uživatele se explicitně zeptej, jestli to chce opravdu provést (např. „Chcete opravdu upravit svůj profil?“). Nikdy neprováděj změnu automaticky bez souhlasu! Pokud uživatel souhlasí, výstup musí obsahovat JSON pole „profile_update_request“ s jasným popisem změn.
- Pokud tě uživatel požádá o vyhledání nebo zobrazení pozic/kandidátů, popiš je stručně v odpovědi a v poli "navigation_suggestion" uveď příslušnou cestu.
- Můžeš doporučovat rychlé navigace a akce v rozhraní. Například:
   - Zobrazení seznamu pozic: "/recruiter/roles"
   - Zobrazení talent poolu (kandidátů): "/recruiter/talent-pool"
   - Nastavení profilu firmy: "/recruiter/settings"
   - Předplatné / billing: "/recruiter/billing"
   - Zobrazení konkrétního kandidáta: "/recruiter/talent-pool?selected=<id_kandidata>"

Pravidla pro odpovědi:
- Odpovídej vždy konstruktivně, přátelsky a s respektem.
- Komunikuj v jazyce uživatele (většinou česky, pokud se uživatel nezeptá anglicky).
- Piš stručně a konkrétně, rozsah maximálně 3-4 kratší odstavce.
- Pokud navrhuješ změnu profilu, vždy použij pole "profile_update_request", kde jasně popiš návrh na úpravu profilu jako platný JSON (například {"languages": ["angličtina (pokročilá)"]}). Profil aktualizuj až na základě výslovného souhlasu uživatele.
- Pokud navrhuješ akci, uveď cestu v "navigation_suggestion" a popis tlačítka v "navigation_label".

Kontext firmy:
{json.dumps(company_context, ensure_ascii=False, default=str)}

Aktivní pozice firmy:
{json.dumps(simplified_roles[:10], ensure_ascii=False, default=str)}

Seznam kandidátů v Talent Poolu:
{json.dumps(simplified_candidates[:12], ensure_ascii=False, default=str)}

Poslední zprávy konverzace:
{json.dumps(recent_messages or [], ensure_ascii=False, default=str)}

Zpráva uživatele:
{cleaned_message}

Požadovaný formát výstupu (vrať pouze validní JSON objekt s těmito poli):
{{
  "reply": "Vaše odpověď v markdownu. Může obsahovat odrážky nebo zvýrazněný text.",
  "navigation_suggestion": "/recruiter/roles nebo /recruiter/talent-pool nebo /recruiter/talent-pool?selected=<id> nebo null",
  "navigation_label": "Nápis na tlačítku akce (např. Zobrazit kandidáty) nebo null",
  "suggested_prompts": ["doporučená otázka 1", "doporučená otázka 2", "doporučená otázka 3"]
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

    return {
        "reply": reply,
        "navigation_suggestion": payload.get("navigation_suggestion") or None,
        "navigation_label": payload.get("navigation_label") or None,
        "suggested_prompts": [str(x).strip() for x in payload.get("suggested_prompts") or [] if str(x).strip()][:3],
        "model": result.model_name,
        "latency_ms": result.latency_ms,
    }
