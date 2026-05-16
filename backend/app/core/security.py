import jwt
import os
from fastapi import HTTPException, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
import requests
from jose import jwt as jose_jwt
from jose import jwk as jose_jwk
import json
import time

from app.core.legacy_supabase import get_legacy_supabase_client
from app.core.runtime import allow_legacy_auth_fallback, strict_production_mode

# Load the shared project envs. Supabase auth and Northflank DB currently live
# in the same env set, while V2 itself must only use Supabase for auth.
root_env = os.path.join(os.path.dirname(__file__), "../../../../.env")
backend_env = os.path.join(os.path.dirname(__file__), "../../../../backend/.env")
load_dotenv(root_env)
load_dotenv(backend_env)

security = HTTPBearer()
JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET") or os.environ.get("JWT_SECRET")

class AccessControlService:
    JWKS_URL = os.environ.get("SUPABASE_JWKS_URL") or "https://frquoinhhxkxnvcyomtr.supabase.co/auth/v1/.well-known/jwks.json"
    JWKS_CACHE = None
    JWKS_CACHE_AT = 0
    JWKS_CACHE_TTL = 300  # 5 min

    @staticmethod
    def _get_jwks():
        now = int(time.time())
        if (
            not AccessControlService.JWKS_CACHE
            or (now - AccessControlService.JWKS_CACHE_AT) > AccessControlService.JWKS_CACHE_TTL
        ):
            try:
                resp = requests.get(AccessControlService.JWKS_URL, timeout=5)
                resp.raise_for_status()
                AccessControlService.JWKS_CACHE = resp.json()
                AccessControlService.JWKS_CACHE_AT = now
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Chyba načítání JWKS: {e}")
        return AccessControlService.JWKS_CACHE

    @staticmethod
    def verify_supabase_jwt_raw(token: str):
        if not JWT_SECRET:
            use_legacy_fallback = allow_legacy_auth_fallback()
            if not use_legacy_fallback and strict_production_mode():
                raise HTTPException(status_code=500, detail="Supabase JWT verification is not configured (SUPABASE_JWT_SECRET missing)")
            client = get_legacy_supabase_client()
            if not client:
                raise HTTPException(status_code=500, detail="Supabase auth is not configured")
            try:
                user_response = client.auth.get_user(token)
                user = getattr(user_response, "user", None)
                if not user:
                    raise HTTPException(status_code=401, detail="Invalid token")
                metadata = getattr(user, "user_metadata", None) or {}
                app_metadata = getattr(user, "app_metadata", None) or {}
                return {
                    "id": str(getattr(user, "id", "")),
                    "sub": str(getattr(user, "id", "")),
                    "email": getattr(user, "email", None),
                    "role": app_metadata.get("role") or metadata.get("role") or "authenticated",
                }
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(status_code=401, detail=f"Invalid token: {str(exc)}") from exc

        # Rozpoznání typu tokenu podle headeru
        headers_segment = token.split('.')[0] + "=="
        try:
            headers = json.loads(
                base64url_decode(headers_segment).decode()
            )
            alg = headers.get("alg")
            kid = headers.get("kid")
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid JWT header.")

        if alg == "HS256":
            try:
                payload = jwt.decode(
                    token,
                    JWT_SECRET,
                    algorithms=["HS256"],
                    options={"verify_aud": False}
                )
                if "id" not in payload and "sub" in payload:
                    payload["id"] = payload["sub"]
                return payload
            except jwt.ExpiredSignatureError:
                raise HTTPException(status_code=401, detail="Token has expired")
            except jwt.InvalidTokenError as e:
                raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

        elif alg == "ES256":
            # JWKS+JOSE-based ověření
            jwks = AccessControlService._get_jwks()
            keys = jwks.get("keys", [])
            key = next((k for k in keys if k.get("kid") == kid), None)
            if not key:
                raise HTTPException(status_code=401, detail=f"Unknown KID '{kid}' in JWT.")
            try:
                payload = jose_jwt.decode(
                    token,
                    key,
                    algorithms=["ES256"],
                    options={"verify_aud": False}
                )
                if "id" not in payload and "sub" in payload:
                    payload["id"] = payload["sub"]
                return payload
            except jose_jwt.ExpiredSignatureError:
                raise HTTPException(status_code=401, detail="Token has expired")
            except jose_jwt.JWTError as e:
                raise HTTPException(status_code=401, detail=f"Invalid token (ES256): {str(e)}")
        else:
            raise HTTPException(status_code=401, detail=f"JWT s nepodporovaným algoritmem: {alg}")

# helper
import base64
def base64url_decode(input):
    rem = len(input) % 4
    if rem > 0:
        input += '=' * (4 - rem)
    return base64.urlsafe_b64decode(input)

    @staticmethod
    def verify_supabase_jwt(credentials: HTTPAuthorizationCredentials = Security(security)):
        return AccessControlService.verify_supabase_jwt_raw(credentials.credentials)

    @staticmethod
    def get_current_user(payload: dict = Security(verify_supabase_jwt)):
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing subject")
        
        return {
            "id": user_id,
            "email": payload.get("email"),
            "role": payload.get("role", "authenticated")
        }

def verify_supabase_token(token: str):
    return AccessControlService.verify_supabase_jwt_raw(token)

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
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), "
        "interest-cohort=()"
    )
    return response

async def cleanup_csrf_sessions():
    """Stub for legacy compatibility since CSRF is currently disabled in V2."""
    pass
