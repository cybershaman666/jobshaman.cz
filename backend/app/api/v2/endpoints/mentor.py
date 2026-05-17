from fastapi import APIRouter, Depends, HTTPException
import logging
from pydantic import BaseModel, Field
from typing import Dict, List

from app.core.security import AccessControlService
from app.domains.identity.service import IdentityDomainService
from app.domains.reality.service import RealityDomainService
from app.services.cybershaman_service import build_cybershaman_reply
from app.services.shami_agent_service import build_shami_recruiter_agent_reply
from app.services.azure_ai_client import AzureAIClientError


router = APIRouter()
logger = logging.getLogger(__name__)


class MentorMessage(BaseModel):
    role: str = Field(default="user", max_length=24)
    content: str = Field(default="", max_length=2000)


class MentorChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    recent_messages: List[MentorMessage] = Field(default_factory=list, max_length=8)


class RecruiterChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    recent_messages: List[MentorMessage] = Field(default_factory=list, max_length=8)


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
        data = build_cybershaman_reply(
            message=payload.message,
            profile=profile,
            recent_messages=[item.model_dump() for item in payload.recent_messages],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except AzureAIClientError as exc:
        logger.warning("AzureAIClientError in mentor_chat: %s", exc)
        raise HTTPException(status_code=503, detail=f"AI mentor is unavailable: {str(exc)}") from exc
    except Exception as exc:
        logger.exception("Unhandled exception in mentor_chat")
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
        data = build_shami_recruiter_agent_reply(
            message=payload.message,
            company=company,
            roles=roles,
            candidates=candidates,
            recent_messages=[item.model_dump() for item in payload.recent_messages],
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
