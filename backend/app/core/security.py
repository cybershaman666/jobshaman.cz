from copy import deepcopy
from hashlib import sha256
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .database import supabase
from .config import CSRF_TOKEN_EXPIRY
from ..services.subscription_access import fetch_latest_subscription_by, is_active_subscription

security = HTTPBearer()
csrf_tokens: dict = {}
_AUTH_CONTEXT_CACHE_TTL_SECONDS = 30
_AUTH_CONTEXT_CACHE: dict[str, tuple[datetime, dict]] = {}

def generate_csrf_token(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(seconds=CSRF_TOKEN_EXPIRY)

    if supabase:
        try:
            supabase.table("csrf_sessions").insert({
                "token": token,
                "user_id": user_id,
                "created_at": created_at.isoformat(),
                "expires_at": expires_at.isoformat(),
                "consumed": False,
            }).execute()
        except Exception as e:
            print(f"⚠️ Failed to store CSRF token in Supabase: {e}")
            csrf_tokens[token] = {"user_id": user_id, "expires_at": expires_at}
    else:
        csrf_tokens[token] = {"user_id": user_id, "expires_at": expires_at}
    return token

def validate_csrf_token(token: str, user_id: str) -> bool:
    if not token or not user_id:
        return False
    if supabase:
        try:
            resp = supabase.table("csrf_sessions").select("*").eq("token", token).eq("user_id", user_id).execute()
            if resp.data:
                token_data = resp.data[0]
                if token_data.get("consumed"): return False
                expires_at = datetime.fromisoformat(token_data["expires_at"])
                if datetime.now(timezone.utc) > expires_at: return False
                return True
        except Exception as e:
            print(f"⚠️ CSRF Supabase error: {e}")
    
    if token in csrf_tokens:
        token_data = csrf_tokens[token]
        if datetime.now(timezone.utc) > token_data["expires_at"]:
            del csrf_tokens[token]
            return False
        return token_data["user_id"] == user_id
    return False

def consume_csrf_token(token: str) -> None:
    if not token: return
    if supabase:
        try:
            supabase.table("csrf_sessions").update({"consumed": True}).eq("token", token).execute()
        except: pass
    if token in csrf_tokens:
        del csrf_tokens[token]

def verify_supabase_token(token: str) -> dict:
    if not supabase:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    cache_key = sha256(token.encode("utf-8")).hexdigest()
    cached = _AUTH_CONTEXT_CACHE.get(cache_key)
    now = datetime.now(timezone.utc)
    if cached and cached[0] > now:
        return deepcopy(cached[1])
    if cached:
        _AUTH_CONTEXT_CACHE.pop(cache_key, None)
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = user_response.user.id
        profile_resp = supabase.table("profiles").select("*").eq("id", user_id).execute()
        
        if profile_resp.data:
            profile = profile_resp.data[0]
            authorized_ids = [user_id]
            profile["auth_id"] = user_id
            profile["email"] = getattr(user_response.user, "email", "")
            
            if profile.get("role") == "recruiter":
                # Find all companies owned by user
                owner_resp = supabase.table("companies").select("id, name").eq("owner_id", user_id).execute()
                owned_companies = owner_resp.data or []

                # Legacy fallback: some older company rows only populated created_by
                created_by_resp = supabase.table("companies").select("id, name").eq("created_by", user_id).execute()
                created_companies = created_by_resp.data or []
                
                # Find all companies where user is a member
                member_resp = supabase.table("company_members").select("company_id, companies(name)").eq("user_id", user_id).execute()
                member_companies = member_resp.data or []
                
                all_associations = []
                for c in owned_companies:
                    if c["id"] not in authorized_ids:
                        all_associations.append({"id": c["id"], "name": c.get("name"), "type": "owner"})
                        authorized_ids.append(c["id"])

                for c in created_companies:
                    if c["id"] not in authorized_ids:
                        all_associations.append({"id": c["id"], "name": c.get("name"), "type": "owner"})
                        authorized_ids.append(c["id"])
                
                for m in member_companies:
                    if m["company_id"] not in authorized_ids:
                        all_associations.append({"id": m["company_id"], "name": m.get("companies", {}).get("name"), "type": "member"})
                        authorized_ids.append(m["company_id"])
                
                if all_associations:
                    profile["user_type"] = "company"
                    profile["associations"] = all_associations
                    # Keep legacy fields for compatibility (using SIRT/first association)
                    profile["company_id"] = all_associations[0]["id"]
                    profile["company_name"] = all_associations[0]["name"]
                
            profile["authorized_ids"] = authorized_ids
            profile["user_type"] = profile.get("user_type", "candidate")
            _AUTH_CONTEXT_CACHE[cache_key] = (now + timedelta(seconds=_AUTH_CONTEXT_CACHE_TTL_SECONDS), deepcopy(profile))
            return profile
            
        raise HTTPException(status_code=401, detail="Profile not found")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_company_access(user: dict, company_id: str) -> str:
    if not company_id or company_id not in user.get("authorized_ids", []):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return company_id

async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    cached_user = getattr(request.state, "current_user", None)
    if isinstance(cached_user, dict):
        return cached_user
    user = verify_supabase_token(credentials.credentials)
    request.state.current_user = user
    return user

def _parse_iso_datetime(value: str) -> datetime | None:
    if not value:
        return None
    try:
        # Handle "Z" suffix
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        # Normalize naive timestamps to UTC to avoid aware/naive comparison crashes.
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None

def verify_subscription(user: dict = Depends(get_current_user), request: Request = None):
    """
    Attach subscription info to the user context.
    Does not block free users; enforcement happens in feature-specific routes.
    """
    user_id = user.get("id") or user.get("auth_id")
    if not user_id or not supabase:
        return user
    if request is not None:
        cached_user = getattr(request.state, "subscription_user", None)
        if isinstance(cached_user, dict):
            return cached_user

    is_company = bool(user.get("company_name"))
    sub = None
    if is_company:
        company_id = user.get("company_id")
        if company_id:
            sub = fetch_latest_subscription_by("company_id", str(company_id))
    else:
        sub = fetch_latest_subscription_by("user_id", str(user_id))
    tier = sub.get("tier") if sub else "free"
    status = sub.get("status") if sub else "inactive"
    expires_at_raw = sub.get("current_period_end") if sub else None
    expires_at = _parse_iso_datetime(expires_at_raw)

    user["subscription_tier"] = tier
    user["subscription_status"] = status
    user["subscription_expires_at"] = expires_at_raw
    user["subscription_id"] = sub.get("id") if sub else None
    user["is_subscription_active"] = bool(is_active_subscription(sub))

    if not user["is_subscription_active"] and tier == "free":
        user["subscription_status"] = "free"

    if request is not None:
        request.state.subscription_user = user
    return user

def verify_csrf_token_header(request: Request, user: dict) -> bool:
    """Helper to verify CSRF token from request headers"""
    csrf_token = request.headers.get("X-CSRF-Token")
    if not csrf_token:
        # We don't print ❌ here because some routes (like telemetry) optionally accept CSRF.
        # Loggers or individual routes can handle the warning if needed.
        return False
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        return False
    is_valid = validate_csrf_token(csrf_token, user_id)
    if not is_valid:
        return False
    # Consume token for state-changing requests to prevent replay
    if request.method and request.method.upper() in ["POST", "PUT", "PATCH", "DELETE"]:
        consume_csrf_token(csrf_token)
    return True

def cleanup_csrf_sessions():
    """Periodic task to remove expired CSRF tokens from Supabase"""
    if not supabase: return
    try:
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("csrf_sessions").delete().lt("expires_at", now).execute()
        supabase.table("csrf_sessions").delete().eq("consumed", True).execute()
        print(f"🧹 CSRF cleanup completed")
    except Exception as e:
        print(f"⚠️ CSRF cleanup failed: {e}")

async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    # X-XSS-Protection is deprecated in modern browsers but harmless for legacy
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # API-first CSP: disallow all content by default
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; "
        "base-uri 'none'; "
        "form-action 'none'; "
        "frame-ancestors 'none'"
    )
    # Reduce access to browser features
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), "
        "interest-cohort=()"
    )
    return response
