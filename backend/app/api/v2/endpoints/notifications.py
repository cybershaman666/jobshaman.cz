from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any
from app.domains.identity.service import IdentityDomainService
# Assuming we have a dependency to get the current user ID
# For now, we'll use a placeholder or assume it's passed/handled by middleware

router = APIRouter()

@router.get("/", response_model=List[Dict[str, Any]])
async def list_notifications(
    user_id: str, # In real app, get from auth dependency
    limit: int = Query(50, ge=1, le=100)
):
    return await IdentityDomainService.list_notifications(user_id, limit)

@router.post("/{notification_id}/read")
async def mark_read(user_id: str, notification_id: str):
    success = await IdentityDomainService.mark_notification_read(user_id, notification_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "success"}

@router.post("/read-all")
async def mark_all_read(user_id: str):
    count = await IdentityDomainService.mark_all_notifications_read(user_id)
    return {"status": "success", "count": count}

@router.post("/simulate")
async def simulate_notification(user_id: str, type: str = "match"):
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
    return await IdentityDomainService.create_notification(user_id, payload)
