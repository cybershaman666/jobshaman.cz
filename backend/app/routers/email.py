from fastapi import APIRouter, HTTPException, Query
from starlette.responses import HTMLResponse
from typing import Any, Mapping

from ..core.database import supabase
from ..services.unsubscribe import verify_unsubscribe_token

router = APIRouter()


@router.get("/email/unsubscribe", response_class=HTMLResponse)
async def unsubscribe_daily_digest(
    uid: str = Query(..., min_length=10),
    token: str = Query(..., min_length=32),
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        profile_resp = supabase.table("profiles").select("email").eq("id", uid).maybe_single().execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Profile lookup failed: {exc}")

    profile_data = profile_resp.data if profile_resp else None
    profile: Mapping[str, Any] = profile_data if isinstance(profile_data, Mapping) else {}
    email = profile.get("email")
    if not isinstance(email, str) or not email:
        raise HTTPException(status_code=404, detail="Profile not found")

    if not verify_unsubscribe_token(uid, email, token):
        raise HTTPException(status_code=400, detail="Invalid unsubscribe token")

    try:
        supabase.table("profiles").update({"daily_digest_enabled": False}).eq("id", uid).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update preferences: {exc}")

    html = """
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 40px auto; padding: 24px;">
      <h2 style="color: #0f172a;">You have been unsubscribed</h2>
      <p style="color: #475569;">You will no longer receive the daily job digest.</p>
    </div>
    """
    return HTMLResponse(content=html, status_code=200)
