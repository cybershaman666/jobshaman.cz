from fastapi import APIRouter, Depends, HTTPException
from app.core.security import AccessControlService
from app.domains.identity.service import IdentityDomainService
from app.domains.handshake.service import HandshakeDomainService
from pydantic import BaseModel
from typing import Any, Optional

router = APIRouter()

class HandshakeAnswerRequest(BaseModel):
    step_id: str
    answer: Any
    stage: Optional[str] = None
    elapsed_ms: Optional[int] = None

class HandshakeFinalizeRequest(BaseModel):
    note: Optional[str] = None

class ExternalSubmissionRequest(BaseModel):
    provider: str
    external_url: str
    comment: Optional[str] = None
    evidence_required: bool = True
    visibility: str = "company_review"

@router.post("/initiate/{job_id}")
async def initiate_handshake(
    job_id: str,
    current_user: dict = Depends(AccessControlService.get_current_user)
):
    # 1. Mirror user
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"]
    )
    
    # 2. Start Handshake
    try:
        handshake = await HandshakeDomainService.initiate_handshake(
            user_id=domain_user["id"],
            job_id=job_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return handshake

@router.get("/my")
async def get_my_handshakes(
    current_user: dict = Depends(AccessControlService.get_current_user)
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"]
    )
    
    handshakes = await HandshakeDomainService.get_user_handshakes(domain_user["id"])
    
    return {
        "status": "success",
        "data": handshakes
    }

@router.get("/{handshake_id}")
async def get_my_handshake(
    handshake_id: str,
    current_user: dict = Depends(AccessControlService.get_current_user)
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    handshake = await HandshakeDomainService.get_user_handshake(domain_user["id"], handshake_id)
    if not handshake:
        raise HTTPException(status_code=404, detail="Handshake not found")
    return handshake

@router.patch("/{handshake_id}/answer")
async def patch_my_handshake_answer(
    handshake_id: str,
    payload: HandshakeAnswerRequest,
    current_user: dict = Depends(AccessControlService.get_current_user)
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    handshake = await HandshakeDomainService.patch_answer(
        domain_user["id"],
        handshake_id,
        payload.step_id,
        payload.answer,
        payload.stage,
        payload.elapsed_ms,
    )
    if not handshake:
        raise HTTPException(status_code=404, detail="Handshake not found")
    return handshake

@router.post("/{handshake_id}/finalize")
async def finalize_my_handshake(
    handshake_id: str,
    payload: HandshakeFinalizeRequest,
    current_user: dict = Depends(AccessControlService.get_current_user)
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    handshake = await HandshakeDomainService.finalize_handshake(domain_user["id"], handshake_id, payload.note)
    if not handshake:
        raise HTTPException(status_code=404, detail="Handshake not found")
    return handshake

@router.post("/{handshake_id}/external-submission")
async def add_my_external_submission(
    handshake_id: str,
    payload: ExternalSubmissionRequest,
    current_user: dict = Depends(AccessControlService.get_current_user)
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    handshake = await HandshakeDomainService.add_external_submission(
        domain_user["id"],
        handshake_id,
        payload.provider,
        payload.external_url,
        payload.comment,
        payload.evidence_required,
        payload.visibility,
    )
    if not handshake:
        raise HTTPException(status_code=404, detail="Handshake not found")
    return handshake

@router.get("/{handshake_id}/events")
async def get_my_handshake_events(
    handshake_id: str,
    current_user: dict = Depends(AccessControlService.get_current_user)
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )

    return {
        "status": "success",
        "data": await HandshakeDomainService.get_handshake_events(domain_user["id"], handshake_id),
    }
