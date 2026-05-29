from fastapi import APIRouter
from fastapi.responses import JSONResponse
import secrets

router = APIRouter()

@router.get("/csrf-token")
async def get_csrf_token():
    # Pro production nasazení je vhodné řešit session/cookie, zde dummy random token 32b
    csrf_token = secrets.token_urlsafe(32)
    # Expirace v sekundách (např. FE očekává klíč "expiry" v sekundách)
    return JSONResponse(content={"csrf_token": csrf_token, "expiry": 3600})

@router.get("/api/v2/csrf-token")
async def get_csrf_token_v2():
    return await get_csrf_token()
