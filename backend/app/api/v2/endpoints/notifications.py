from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any
from app.core.security import AccessControlService
from app.domains.identity.service import IdentityDomainService

router = APIRouter()

@router.get("/", response_model=List[Dict[str, Any]])
async def list_notifications(
    current_user: dict = Depends(AccessControlService.get_current_user),
    limit: int = Query(50, ge=1, le=100)
):
    return await IdentityDomainService.list_notifications(current_user["id"], limit)

@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    current_user: dict = Depends(AccessControlService.get_current_user)
):
    success = await IdentityDomainService.mark_notification_read(current_user["id"], notification_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "success"}

@router.post("/read-all")
async def mark_all_read(
    current_user: dict = Depends(AccessControlService.get_current_user)
):
    count = await IdentityDomainService.mark_all_notifications_read(current_user["id"])
    return {"status": "success", "count": count}

@router.post("/simulate")
async def simulate_notification(
    type: str = "match",
    current_user: dict = Depends(AccessControlService.get_current_user)
):
    if type == "match":
        payload = {
            "title": "Nová shoda nalezena! 🚀",
            "content": "Cybershaman našel novou pozici 'Senior AI Architect', která přesně odpovídá tvému profilu.",
            "type": "match",
            "link": "/candidate/marketplace"
        }
    else:
        payload = {
            "title": "Aktualizace handshaku",
            "content": "Firma právě prozkoumala tvoje řešení v sandboxu.",
            "type": "handshake",
            "link": "/candidate/insights"
        }
    return await IdentityDomainService.create_notification(current_user["id"], payload)
