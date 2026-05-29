from fastapi import APIRouter, Depends, HTTPException
import logging
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

from app.core.security import AccessControlService
from app.domains.identity.service import IdentityDomainService
from app.domains.recommendation.service import RecommendationDomainService
from app.domains.reality.service import RealityDomainService
from app.services.cybershaman_service import build_cybershaman_reply
from app.services.shami_agent_service import build_shami_recruiter_agent_reply, build_shami_role_detail_insight, get_agent_memory, save_agent_memory
from app.services.azure_ai_client import AzureAIClientError


router = APIRouter()
logger = logging.getLogger(__name__)


JOB_SEARCH_INTENT_TERMS = {
    "prace",
    "práce",
    "nabidka",
    "nabídka",
    "nabidky",
    "nabídky",
    "pozice",
    "role",
    "job",
    "jobs",
    "hledam",
    "hledám",
    "hledat",
    "najdi",
    "najít",
    "vyhledej",
    "doporuc",
    "doporuceni",
    "doporuč",
    "doporučení",
    "vhodna",
    "vhodná",
    "remote",
    "hybrid",
    "plat",
    "mzda",
    "firma",
    "polsk",
    "němec",
    "nemec",
    "slovensk",
    "rakous",
    "anglick",
    "english",
    "tricity",
    "trojměs",
    "trojmest",
    "trójmia",
    "gdansk",
    "gdańs",
    "gdynia",
    "sopot",
    "warsaw",
    "warsz",
    "krakow",
    "krakó",
    "prag",
    "praha",
    "brno",
    "bratislav",
    "berlin",
    "munich",
    "münch",
    "vienna",
    "wien",
}


def _has_job_search_intent(message: str) -> bool:
    normalized = str(message or "").lower()
    return any(term in normalized for term in JOB_SEARCH_INTENT_TERMS)


def _parse_search_params(message: str) -> Optional[Dict[str, Any]]:
    normalized = str(message or "").lower()
    params = {}
    
    # 1. Detect Country (including major cities / regions)
    pl_indicators = [
        "polsk", "polsc", "poland", "poľsk", "warsz", "warsaw", "krak", "wroc", "pozna", 
        "gdans", "gdyns", "sopot", "tricity", "trojměs", "trojmest", "trójmia", "katow", "lodz", "łódź"
    ]
    cz_indicators = [
        "česk", "cesk", "czech", "čechy", "prag", "praha", "brn", "ostrav", "plze", "liber", "olomo"
    ]
    sk_indicators = [
        "slovensk", "słowac", "slovak", "bratislav", "kosic", "košic", "zilin", "žilin", "nitr", "presov", "prešov"
    ]
    de_indicators = [
        "němec", "nemec", "niemiec", "german", "berlin", "munich", "münchen", "hamburg", "frankf", 
        "stuttg", "dussel", "düssel", "cologn", "köln"
    ]
    at_indicators = [
        "rakous", "austri", "wien", "vienna", "salzburg", "graz", "linz", "innsbr"
    ]

    if any(p in normalized for p in pl_indicators):
        params["country"] = "PL"
    elif any(p in normalized for p in cz_indicators):
        params["country"] = "CZ"
    elif any(p in normalized for p in sk_indicators):
        params["country"] = "SK"
    elif any(p in normalized for p in de_indicators):
        params["country"] = "DE"
    elif any(p in normalized for p in at_indicators):
        params["country"] = "AT"
        
    # 2. Detect English / Language
    if any(p in normalized for p in ["anglick", "angličtin", "angielsk", "english"]):
        params["language"] = "en"
        
    return params if params else None


def _salary_label(job: Dict[str, Any]) -> str:
    salary_from = job.get("salary_from")
    salary_to = job.get("salary_to")
    currency = str(job.get("currency") or "CZK").upper()
    if salary_from and salary_to and salary_from != salary_to:
        return f"{salary_from} - {salary_to} {currency}"
    if salary_from or salary_to:
        return f"{salary_from or salary_to} {currency}"
    return ""


def _compact_job_recommendations(feed: Dict[str, Any], limit: int = 4) -> List[Dict[str, Any]]:
    compact: List[Dict[str, Any]] = []
    for item in feed.get("items", [])[:limit]:
        job = item.get("job") or {}
        job_id = str(job.get("id") or "")
        if not job_id:
            continue
        reasons = item.get("reasons") if isinstance(item.get("reasons"), list) else []
        caveats = item.get("caveats") if isinstance(item.get("caveats"), list) else []
        compact.append(
            {
                "id": job_id,
                "title": job.get("title") or "Nabídka bez názvu",
                "company": job.get("company_name") or "Neznámá firma",
                "location": job.get("location") or "",
                "url": job.get("url") or job.get("source_url") or "",
                "fit_score": item.get("fit_score"),
                "intent": item.get("intent"),
                "work_model": job.get("recommendation_work_model") or job.get("work_model") or "",
                "salary": _salary_label(job),
                "reasons": [str(reason) for reason in reasons[:3]],
                "caveats": [str(caveat) for caveat in caveats[:2]],
                "why": str(reasons[0]) if reasons else "",
                "watch_out": str(caveats[0]) if caveats else "",
            }
        )
    return compact


class MentorMessage(BaseModel):
    role: str = Field(default="user", max_length=24)
    content: str = Field(default="", max_length=2000)


class MentorChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    recent_messages: List[MentorMessage] = Field(default_factory=list, max_length=8)


class RecruiterChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    recent_messages: List[MentorMessage] = Field(default_factory=list, max_length=8)


class RoleInsightRequest(BaseModel):
    role: Dict[str, Any] = Field(..., description="Frontend role snapshot")
    blueprint: Optional[Dict[str, Any]] = Field(default=None)
    locale: str = Field(default="en", max_length=8)


@router.post("/chat")
async def mentor_chat(
    payload: MentorChatRequest,
    current_user: dict = Depends(AccessControlService.get_current_user),
) -> Dict[str, object]:
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    profile = await IdentityDomainService.get_candidate_profile(domain_user["id"])
    try:
        job_recommendations: Optional[List[Dict[str, Any]]] = None
        if _has_job_search_intent(payload.message):
            try:
                search_params = _parse_search_params(payload.message)
                feed = await RecommendationDomainService.build_candidate_feed(
                    user_id=domain_user["id"],
                    limit=24,
                    search_params=search_params,
                )
                job_recommendations = _compact_job_recommendations(feed, limit=4)
            except Exception as recommendation_exc:
                logger.warning("Failed to load mentor job recommendations: %s", recommendation_exc)
        data = build_cybershaman_reply(
            message=payload.message,
            profile=profile,
            recent_messages=[item.model_dump() for item in payload.recent_messages],
            job_recommendations=job_recommendations,
        )
        logger.info(f"✅ Cybershaman reply built successfully: reply={data.get('reply', '')[:80]}")
    except ValueError as exc:
        logger.error(f"❌ ValueError in mentor_chat: {exc}")
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except AzureAIClientError as exc:
        logger.error(f"❌ AzureAIClientError in mentor_chat: {exc}")
        # SAFE FALLBACK odpověď pro frontend (nezhasne úplně chat, zobrazí info)
        data = {
            "reply": "Omlouvám se, AI agent je dočasně nedostupný. Můžeš to zkusit za chvíli, nebo kontaktovat podporu.",
            "tone": "data_missing",
            "suggested_prompts": [],
            "job_recommendations": [],
            "next_step": "",
        }
        logger.warning(f"🔄 Returning fallback response: {data}")
        return {"status": "success", "data": data}
    except Exception as exc:
        logger.exception(f"❌ Unhandled exception in mentor_chat: {exc}")
        data = {
            "reply": "Nastala neočekávaná chyba při zpracování dotazu. Dej vědět supportu nebo zkus později.",
            "tone": "data_missing",
            "suggested_prompts": [],
            "job_recommendations": [],
            "next_step": "",
        }
        logger.warning(f"🔄 Returning fallback response after exception: {data}")
        return {"status": "success", "data": data}
    return {"status": "success", "data": data}


@router.post("/role-insight")
async def role_insight(
    payload: RoleInsightRequest,
    current_user: dict = Depends(AccessControlService.get_current_user),
) -> Dict[str, object]:
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    profile = await IdentityDomainService.get_candidate_profile(domain_user["id"])
    try:
        data = build_shami_role_detail_insight(
            role=payload.role,
            blueprint=payload.blueprint,
            profile=profile,
            locale=payload.locale,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except AzureAIClientError as exc:
        logger.warning("AzureAIClientError in role_insight: %s", exc)
        raise HTTPException(status_code=503, detail="Shami role insight is unavailable") from exc
    except Exception as exc:
        logger.exception("Unhandled exception in role_insight")
        raise HTTPException(status_code=500, detail="Internal server error") from exc
    return {"status": "success", "data": data}


@router.post("/recruiter-chat")
async def recruiter_chat(
    payload: RecruiterChatRequest,
    current_user: dict = Depends(AccessControlService.get_current_user),
) -> Dict[str, object]:
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    
    # 1. Fetch company, roles, and candidates context for the Shami Agent
    company = await RealityDomainService.get_company_for_user(domain_user["id"])
    roles = []
    candidates = []
    
    if company:
        try:
            roles = await RealityDomainService.list_company_challenges(domain_user["id"])
        except Exception:
            roles = []
        try:
            candidates = await IdentityDomainService.list_registered_candidates(
                limit=100,
                exclude_user_id=domain_user["id"],
                public_view=True,
            )
        except Exception:
            candidates = []

    try:
        # 0. Načti persistentní paměť agenta (historii chatu)
        memory = get_agent_memory(domain_user["id"])
        persisted_messages = memory.get("chat_history", []) or []
        # Nový payload upřednostňuje inline recent_messages > persistentní, ale lze je sloučit
        incoming_messages = [item.model_dump() for item in payload.recent_messages] if payload.recent_messages else []
        combined_history = persisted_messages[-4:] + incoming_messages  # krátká historie až 8 zpráv (omezení pro tok)

        data = build_shami_recruiter_agent_reply(
            message=payload.message,
            company=company,
            roles=roles,
            candidates=candidates,
            recent_messages=combined_history,
        )
        # 1. Pokud agent vrátil schválené změny profilu, ulož je do databáze
        profile_update = data.get("profile_update_request")
        if profile_update and isinstance(profile_update, dict):
            try:
                await IdentityDomainService.update_candidate_profile(domain_user["id"], profile_update)
                logger.info("Shami agent applied profile_update_request for user %s: %s", domain_user["id"], list(profile_update.keys()))
            except Exception as profile_exc:
                logger.warning("Failed to apply Shami profile_update_request for user %s: %s", domain_user["id"], profile_exc)

        # 2. Ulož rozšířenou konverzaci do persistentní storage
        # Append uživatelova zpráva + odpověď agenta
        save_agent_memory(
            domain_user["id"],
            chat_history=(combined_history + [
                {"role": "user", "message": payload.message},
                {"role": "agent", "message": data["reply"]},
            ])[-20:],  # Omezit délku na max 20 posledních zpráv
            agent_state=None
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except AzureAIClientError as exc:
        logger.warning("AzureAIClientError in recruiter_chat: %s", exc)
        raise HTTPException(status_code=503, detail=f"Shami AI Agent is unavailable: {str(exc)}") from exc
    except Exception as exc:
        logger.exception("Unhandled exception in recruiter_chat")
        raise HTTPException(status_code=500, detail="Internal server error") from exc
    return {"status": "success", "data": data}
