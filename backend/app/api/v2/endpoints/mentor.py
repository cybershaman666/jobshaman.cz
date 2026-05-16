from fastapi import APIRouter, Depends, HTTPException
import logging
from pydantic import BaseModel, Field
from typing import Dict, List

from app.core.security import AccessControlService
from app.domains.identity.service import IdentityDomainService
from app.services.cybershaman_service import build_cybershaman_reply
from app.services.azure_ai_client import AzureAIClientError


router = APIRouter()
logger = logging.getLogger(__name__)


class MentorMessage(BaseModel):
    role: str = Field(default="user", max_length=24)
    content: str = Field(default="", max_length=2000)


class MentorChatRequest(BaseModel):
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
        # Known upstream AI problems -> map to 503 so clients can retry later
        logger.warning("AzureAIClientError in mentor_chat: %s", exc)
        raise HTTPException(status_code=503, detail=f"AI mentor is unavailable: {str(exc)}") from exc
    except Exception as exc:  # pragma: no cover - defensive catch to log unexpected errors
        # Log full exception so we can debug 500s in production (App Insights / container logs)
        logger.exception("Unhandled exception in mentor_chat")
        # Return a safe 500 to caller without leaking internals
        raise HTTPException(status_code=500, detail="Internal server error") from exc
    return {"status": "success", "data": data}
