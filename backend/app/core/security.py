import jwt
import os
from fastapi import HTTPException, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

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
    @staticmethod
    def verify_supabase_jwt(credentials: HTTPAuthorizationCredentials = Security(security)):
        token = credentials.credentials
        if not JWT_SECRET:
            use_legacy_fallback = allow_legacy_auth_fallback() or not strict_production_mode()
            if strict_production_mode() or not use_legacy_fallback:
                raise HTTPException(status_code=500, detail="Supabase JWT verification is not configured")
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
                    "sub": str(getattr(user, "id", "")),
                    "email": getattr(user, "email", None),
                    "role": app_metadata.get("role") or metadata.get("role") or "authenticated",
                }
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(status_code=401, detail=f"Invalid token: {str(exc)}") from exc

        try:
            # We don't verify audience because Supabase default tokens use "authenticated"
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    @staticmethod
    def get_current_user(payload: dict = Security(verify_supabase_jwt)):
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing subject")
        
        # Here we would normally implement "Northflank Users Mirror" (Lazy Provisioning)
        # e.g., if user_id not in northflank_db: create_user(user_id)
        
        return {
            "id": user_id,
            "email": payload.get("email"),
            "role": payload.get("role", "authenticated")
        }

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
