from fastapi import APIRouter, Depends, HTTPException, Request
from ..core.security import generate_csrf_token, get_current_user
from ..core.limiter import limiter

router = APIRouter()

@router.get("/csrf-token")
@limiter.limit("50/minute")
async def get_csrf_token(request: Request, user: dict = Depends(get_current_user)):
    """
    Returns a new CSRF token for the authenticated user.
    The token is also stored in Supabase for cross-verification.
    """
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    token = generate_csrf_token(user_id)
    return {"csrf_token": token}
