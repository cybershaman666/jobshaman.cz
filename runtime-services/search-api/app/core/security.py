import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import CSRF_TOKEN_EXPIRY
from .database import supabase

security = HTTPBearer()
csrf_tokens: dict[str, dict[str, Any]] = {}


def generate_csrf_token(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(seconds=CSRF_TOKEN_EXPIRY)

    if supabase:
        try:
            supabase.table("csrf_sessions").insert(
                {
                    "token": token,
                    "user_id": user_id,
                    "created_at": created_at.isoformat(),
                    "expires_at": expires_at.isoformat(),
                    "consumed": False,
                }
            ).execute()
        except Exception:
            csrf_tokens[token] = {"user_id": user_id, "expires_at": expires_at}
    else:
        csrf_tokens[token] = {"user_id": user_id, "expires_at": expires_at}
    return token


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except Exception:
        return None


def validate_csrf_token(token: str, user_id: str) -> bool:
    if not token or not user_id:
        return False

    if supabase:
        try:
            resp = (
                supabase.table("csrf_sessions")
                .select("*")
                .eq("token", token)
                .eq("user_id", user_id)
                .execute()
            )
            if resp.data:
                token_data = resp.data[0]
                if token_data.get("consumed"):
                    return False
                expires_at = _parse_iso_datetime(token_data.get("expires_at"))
                if not expires_at or datetime.now(timezone.utc) > expires_at:
                    return False
                return True
        except Exception:
            pass

    in_memory = csrf_tokens.get(token)
    if not in_memory:
        return False
    if datetime.now(timezone.utc) > in_memory["expires_at"]:
        csrf_tokens.pop(token, None)
        return False
    return in_memory["user_id"] == user_id


def consume_csrf_token(token: str) -> None:
    if not token:
        return
    if supabase:
        try:
            supabase.table("csrf_sessions").update({"consumed": True}).eq("token", token).execute()
        except Exception:
            pass
    csrf_tokens.pop(token, None)


def verify_supabase_token(token: str) -> dict:
    if not supabase:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        auth_user = user_response.user
        user_id = auth_user.id
        return {
            "id": user_id,
            "auth_id": user_id,
            "email": getattr(auth_user, "email", "") or "",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return verify_supabase_token(credentials.credentials)


def verify_csrf_token_header(request: Request, user: dict) -> bool:
    csrf_token = request.headers.get("X-CSRF-Token")
    if not csrf_token:
        return False
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        return False
    is_valid = validate_csrf_token(csrf_token, user_id)
    if not is_valid:
        return False
    if request.method and request.method.upper() in ["POST", "PUT", "PATCH", "DELETE"]:
        consume_csrf_token(csrf_token)
    return True


async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; "
        "base-uri 'none'; "
        "form-action 'none'; "
        "frame-ancestors 'none'"
    )
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
    )
    return response
