from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone

from ..core.database import supabase
from ..core.security import get_current_user, verify_csrf_token_header
from ..models.requests import PushSubscribeRequest, PushUnsubscribeRequest

router = APIRouter()


@router.post("/push/subscribe")
async def push_subscribe(
    payload: PushSubscribeRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    sub = payload.subscription or {}
    endpoint = sub.get("endpoint")
    keys = sub.get("keys") or {}
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")

    if not endpoint or not p256dh or not auth:
        raise HTTPException(status_code=400, detail="Invalid subscription payload")

    expires_at = None
    if sub.get("expirationTime"):
        try:
            expires_at = datetime.fromtimestamp(float(sub.get("expirationTime")) / 1000, tz=timezone.utc).isoformat()
        except Exception:
            expires_at = None

    record = {
        "user_id": user_id,
        "endpoint": endpoint,
        "p256dh": p256dh,
        "auth": auth,
        "expires_at": expires_at,
        "user_agent": payload.user_agent,
        "is_active": True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        supabase.table("push_subscriptions").upsert(record, on_conflict="endpoint").execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Push subscription failed: {exc}")

    return {"status": "ok"}


@router.post("/push/unsubscribe")
async def push_unsubscribe(
    payload: PushUnsubscribeRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    try:
        supabase.table("push_subscriptions").update({"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("user_id", user_id).eq("endpoint", payload.endpoint).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Push unsubscribe failed: {exc}")

    return {"status": "ok"}
