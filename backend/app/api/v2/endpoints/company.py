from fastapi import APIRouter, Depends, HTTPException
from app.core.security import AccessControlService
from app.domains.identity.service import IdentityDomainService
from app.domains.handshake.service import HandshakeDomainService
from app.domains.reality.service import RealityDomainService
from fastapi import Query
from pydantic import BaseModel
from typing import Any, Dict, Optional

router = APIRouter()

class ChallengeUpsertRequest(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    role_family: Optional[str] = None
    skills: Optional[list[str]] = None
    salary_from: Optional[int] = None
    salary_to: Optional[int] = None
    salary_currency: Optional[str] = None
    work_model: Optional[str] = None
    location: Optional[str] = None
    location_public: Optional[str] = None
    first_reply_prompt: Optional[str] = None
    company_goal: Optional[str] = None
    assessment_tasks: Optional[list[Dict[str, Any]]] = None
    handshake_blueprint_v1: Optional[Dict[str, Any]] = None
    capacity_policy: Optional[Dict[str, Any]] = None
    editor_state: Optional[Dict[str, Any]] = None
    status: Optional[str] = None

class ChallengeAiAssistRequest(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    candidate_task: Optional[str] = None
    first_reply_prompt: Optional[str] = None
    skills: Optional[list[str]] = None
    work_model: Optional[str] = None
    location: Optional[str] = None
    problem_statement: Optional[str] = None
    role_family: Optional[str] = None
    tone: Optional[str] = None

class ChallengePublishRequest(BaseModel):
    human_confirmed: bool = False
    change_summary: Optional[str] = None

@router.get("/me")
async def get_my_company(current_user: dict = Depends(AccessControlService.get_current_user)):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    company = await RealityDomainService.get_company_for_user(domain_user["id"])
    return {"status": "success", "data": company}

@router.post("")
async def create_my_company(payload: dict, current_user: dict = Depends(AccessControlService.get_current_user)):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    company = await RealityDomainService.create_company_for_user(domain_user["id"], payload)
    return {"status": "success", "data": company}

@router.patch("/{company_id}")
async def update_my_company(
    company_id: str,
    payload: dict,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    company = await RealityDomainService.update_company_for_user(domain_user["id"], company_id, payload)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"status": "success", "data": company}

@router.get("/challenges")
async def list_my_company_challenges(current_user: dict = Depends(AccessControlService.get_current_user)):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    return {"status": "success", "data": await RealityDomainService.list_company_challenges(domain_user["id"])}

@router.post("/challenges")
async def create_my_company_challenge(
    payload: ChallengeUpsertRequest,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    challenge = await RealityDomainService.create_company_challenge(domain_user["id"], payload.model_dump(exclude_none=True))
    if not challenge:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"status": "success", "data": challenge, "challenge": challenge}

@router.patch("/challenges/{challenge_id}")
async def update_my_company_challenge(
    challenge_id: str,
    payload: ChallengeUpsertRequest,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    try:
        challenge = await RealityDomainService.update_company_challenge(
            domain_user["id"],
            challenge_id,
            payload.model_dump(exclude_none=True),
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return {"status": "success", "data": challenge, "challenge": challenge}

@router.post("/challenges/ai-draft")
async def ai_draft_my_company_challenge(
    payload: ChallengeAiAssistRequest,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    result = await RealityDomainService.ai_draft_company_challenge(
        domain_user["id"],
        payload.model_dump(exclude_none=True),
    )
    return {"status": "success", "data": result}

@router.post("/challenges/{challenge_id}/ai-assist")
async def ai_assist_my_company_challenge(
    challenge_id: str,
    payload: ChallengeAiAssistRequest,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    result = await RealityDomainService.ai_assist_company_challenge(
        domain_user["id"],
        challenge_id,
        payload.model_dump(exclude_none=True),
    )
    if not result:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return {"status": "success", "data": result}

@router.post("/challenges/{challenge_id}/publish")
async def publish_my_company_challenge(
    challenge_id: str,
    payload: ChallengePublishRequest,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    try:
        challenge = await RealityDomainService.publish_company_challenge(
            domain_user["id"],
            challenge_id,
            human_confirmed=payload.human_confirmed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return {"status": "success", "data": challenge, "challenge": challenge}

@router.get("/challenges/{challenge_id}/preview")
async def preview_my_company_challenge(
    challenge_id: str,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    preview = await RealityDomainService.get_company_challenge_preview(domain_user["id"], challenge_id)
    if not preview:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return {"status": "success", "data": preview}

@router.get("/challenges/{challenge_id}/submissions")
async def list_my_company_challenge_submissions(
    challenge_id: str,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    company = await RealityDomainService.get_company_for_user(domain_user["id"])
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    handshakes = await HandshakeDomainService.list_company_handshakes(domain_user["id"], str(company["id"]), 200)
    if handshakes is None:
        raise HTTPException(status_code=404, detail="Company not found")
    filtered = [
        item for item in handshakes
        if str(item.get("job_id") or item.get("jobId") or "") == str(challenge_id)
        or str(item.get("opportunity_id") or item.get("opportunityId") or "") == str(challenge_id)
    ]
    return {"status": "success", "data": filtered}

@router.get("/roles")
async def list_my_company_roles_alias(current_user: dict = Depends(AccessControlService.get_current_user)):
    return await list_my_company_challenges(current_user)

@router.post("/roles")
async def create_my_company_role_alias(
    payload: ChallengeUpsertRequest,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    return await create_my_company_challenge(payload, current_user)

@router.patch("/roles/{challenge_id}")
async def update_my_company_role_alias(
    challenge_id: str,
    payload: ChallengeUpsertRequest,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    return await update_my_company_challenge(challenge_id, payload, current_user)

@router.post("/roles/{challenge_id}/publish")
async def publish_my_company_role_alias(
    challenge_id: str,
    payload: ChallengePublishRequest,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    return await publish_my_company_challenge(challenge_id, payload, current_user)

@router.get("/{company_id}/candidate-shares")
async def list_company_candidate_shares(
    company_id: str,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    shares = await IdentityDomainService.list_company_candidate_shares(domain_user["id"], company_id)
    if shares is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"status": "success", "data": shares}

@router.get("/{company_id}/talent-pool")
async def list_company_talent_pool(
    company_id: str,
    limit: int = Query(default=250, ge=1, le=1000),
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    company = await RealityDomainService.get_company_for_user(domain_user["id"])
    if not company or str(company.get("id")) != str(company_id):
        raise HTTPException(status_code=404, detail="Company not found")
    candidates = await IdentityDomainService.list_registered_candidates(
        limit=limit,
        exclude_user_id=domain_user["id"],
        public_view=True,
    )
    return {"status": "success", "data": candidates}

@router.get("/{company_id}/candidate-shares/{share_id}")
async def get_company_candidate_share(
    company_id: str,
    share_id: str,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    share = await IdentityDomainService.get_company_candidate_share(domain_user["id"], company_id, share_id)
    if not share:
        raise HTTPException(status_code=404, detail="Candidate-company share not found")
    return {"status": "success", "data": share}

@router.get("/{company_id}/handshakes")
async def list_company_handshakes(
    company_id: str,
    limit: int = Query(80, ge=1, le=200),
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    handshakes = await HandshakeDomainService.list_company_handshakes(domain_user["id"], company_id, limit)
    if handshakes is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"status": "success", "data": handshakes}

@router.get("/{company_id}/dashboard")
async def get_company_dashboard(
    company_id: str,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    dashboard = await HandshakeDomainService.get_company_dashboard(domain_user["id"], company_id)
    if dashboard is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"status": "success", "data": dashboard}

@router.get("/{company_id}/handshakes/{handshake_id}/readout")
async def get_company_handshake_readout(
    company_id: str,
    handshake_id: str,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    readout = await HandshakeDomainService.get_company_handshake_readout(domain_user["id"], company_id, handshake_id)
    if readout is None:
        raise HTTPException(status_code=404, detail="Handshake not found")
    return {"status": "success", "data": readout}
