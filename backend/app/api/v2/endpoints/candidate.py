from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.security import AccessControlService
from app.domains.identity.service import IdentityDomainService

router = APIRouter()

JCFPM_ITEMS = [
    ("d1_cognitive", "Dokážu rychle najít podstatu složitého problému."),
    ("d2_social", "V týmu umím vytvořit důvěru a jasnou domluvu."),
    ("d3_motivational", "Nejvíc mě pohání práce, která má viditelný smysl."),
    ("d4_energy", "Dlouhodobě zvládám tlak bez ztráty kvality rozhodování."),
    ("d5_values", "Při rozhodování si hlídám soulad s vlastními hodnotami."),
    ("d6_ai_readiness", "AI nástroje beru jako přirozenou součást práce."),
    ("d7_cognitive_reflection", "Umím zpochybnit vlastní první interpretaci."),
    ("d8_digital_eq", "V digitální komunikaci rozpoznám kontext i emocionální tón."),
    ("d9_systems_thinking", "Vidím vazby mezi lidmi, procesy a výsledky."),
    ("d10_ambiguity_interpretation", "Nejasné zadání mě spíš aktivuje než paralyzuje."),
    ("d11_problem_decomposition", "Velký problém si umím rozlozit na testovatelné části."),
    ("d12_moral_compass", "Při tlaku na výkon neztrácím etický kompas."),
]

class RitualStep(BaseModel):
    id: str
    text: str

class RitualCompletionRequest(BaseModel):
    steps: List[RitualStep]
    language: Optional[str] = "cs"

@router.post("/ritual/complete")
async def complete_ritual(
    payload: RitualCompletionRequest,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    """
    V2 Ritual Completion:
    Interpret narrative, update weights, refresh embedding.
    """
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    
    try:
        result = await IdentityDomainService.process_ritual_completion(
            user_id=str(domain_user["id"]),
            steps=[step.model_dump() for step in payload.steps],
            language=payload.language
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/profile/me")
async def get_my_profile(current_user: dict = Depends(AccessControlService.get_current_user)):
    """
    Test protected endpoint for V2.
    Requires a valid Supabase JWT token.
    Mirrors user in Northflank Postgres if they don't exist yet.
    """
    # Mirror user in V2 Domain
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"]
    )
    
    # Get profile data
    profile = await IdentityDomainService.get_candidate_profile(domain_user["id"])
    
    return {
        "status": "success",
        "message": "Welcome to V2 API",
        "data": {
            "user": domain_user,
            "profile": profile,
            "features": ["shamanic_cyberpunk_ui", "v2_domain_services"]
        }
    }

@router.patch("/profile/me")
async def update_my_profile(
    updates: dict,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )

    try:
        data = await IdentityDomainService.update_candidate_profile(domain_user["id"], updates)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {
        "status": "success",
        "data": data,
    }

@router.get("/cv")
async def list_my_cv_documents(current_user: dict = Depends(AccessControlService.get_current_user)):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    return {"status": "success", "data": await IdentityDomainService.list_cv_documents(domain_user["id"])}

@router.post("/cv")
async def create_my_cv_document(
    payload: dict,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    return {"status": "success", "data": await IdentityDomainService.create_cv_document(domain_user["id"], payload)}

@router.patch("/cv/{cv_id}")
async def update_my_cv_document(
    cv_id: str,
    payload: dict,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    doc = await IdentityDomainService.update_cv_document(domain_user["id"], cv_id, payload)
    if not doc:
        raise HTTPException(status_code=404, detail="CV document not found")
    return {"status": "success", "data": doc}

@router.delete("/cv/{cv_id}")
async def delete_my_cv_document(
    cv_id: str,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    deleted = await IdentityDomainService.delete_cv_document(domain_user["id"], cv_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="CV document not found")
    return {"status": "success", "data": {"ok": True}}

@router.get("/jcfpm/items")
async def get_jcfpm_items():
    return {
        "status": "success",
        "data": [
            {
                "id": f"v2-{dimension}",
                "dimension": dimension,
                "prompt": prompt,
                "prompt_i18n": {"cs": prompt, "en": prompt},
                "sort_order": index + 1,
            }
            for index, (dimension, prompt) in enumerate(JCFPM_ITEMS)
        ],
    }

@router.get("/jcfpm/latest")
async def get_my_latest_jcfpm_snapshot(current_user: dict = Depends(AccessControlService.get_current_user)):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    return {"status": "success", "data": await IdentityDomainService.get_latest_jcfpm_snapshot(domain_user["id"])}

@router.post("/jcfpm/snapshots")
async def create_my_jcfpm_snapshot(
    payload: dict,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    return {"status": "success", "data": await IdentityDomainService.create_jcfpm_snapshot(domain_user["id"], payload)}

@router.get("/signals")
async def list_my_identity_signals(current_user: dict = Depends(AccessControlService.get_current_user)):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    return {"status": "success", "data": await IdentityDomainService.list_identity_signals(domain_user["id"])}

@router.post("/signals")
async def create_my_identity_signal(
    payload: dict,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    try:
        signal = await IdentityDomainService.create_identity_signal(domain_user["id"], payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "success", "data": signal}

@router.get("/company-shares")
async def list_my_company_shares(current_user: dict = Depends(AccessControlService.get_current_user)):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    return {"status": "success", "data": await IdentityDomainService.list_candidate_company_shares(domain_user["id"])}

@router.post("/company-shares")
async def create_my_company_share(
    payload: dict,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    try:
        share = await IdentityDomainService.create_candidate_company_share(domain_user["id"], payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "success", "data": share}

@router.post("/company-shares/{share_id}/revoke")
async def revoke_my_company_share(
    share_id: str,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    share = await IdentityDomainService.revoke_candidate_company_share(domain_user["id"], share_id)
    if not share:
        raise HTTPException(status_code=404, detail="Candidate-company share not found")
    return {"status": "success", "data": share}
