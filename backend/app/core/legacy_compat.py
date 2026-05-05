from datetime import datetime, timedelta, timezone
from copy import deepcopy
from hashlib import sha256
from fastapi import Request, Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Dict, Any, Optional

# Import V2's core services
from app.core.legacy_supabase import get_legacy_supabase_client
from app.core.security import security, AccessControlService

supabase = get_legacy_supabase_client()

_AUTH_CONTEXT_CACHE_TTL_SECONDS = 30
_AUTH_CONTEXT_CACHE: dict[str, tuple[datetime, dict]] = {}

# Mocks
class DummyLimiter:
    def limit(self, *args, **kwargs):
        def decorator(func):
            return func
        return decorator
limiter = DummyLimiter()

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def verify_csrf_token_header(request: Request, user: dict) -> bool:
    return True

def require_company_access(user: dict, company_id: str) -> str:
    if not company_id or company_id not in user.get("authorized_ids", []):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return company_id

def verify_supabase_token_legacy(token: str) -> dict:
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
                owner_resp = supabase.table("companies").select("id, name").eq("owner_id", user_id).execute()
                owned_companies = owner_resp.data or []

                created_by_resp = supabase.table("companies").select("id, name").eq("created_by", user_id).execute()
                created_companies = created_by_resp.data or []
                
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
                    profile["company_id"] = all_associations[0]["id"]
                    profile["company_name"] = all_associations[0]["name"]
                
            profile["authorized_ids"] = authorized_ids
            profile["user_type"] = profile.get("user_type", "candidate")
            _AUTH_CONTEXT_CACHE[cache_key] = (now + timedelta(seconds=_AUTH_CONTEXT_CACHE_TTL_SECONDS), deepcopy(profile))
            return profile
            
        raise HTTPException(status_code=401, detail="Profile not found")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    cached_user = getattr(request.state, "current_user", None)
    if isinstance(cached_user, dict):
        return cached_user
    user = verify_supabase_token_legacy(credentials.credentials)
    request.state.current_user = user
    return user

def _parse_iso_datetime(value: str) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None

def fetch_latest_subscription_by(column: str, value: str) -> dict | None:
    if not value or not supabase: return None
    try:
        resp = supabase.table("subscriptions").select("*").eq(column, value).order("updated_at", desc=True).limit(25).execute()
        rows = [row for row in (resp.data or []) if isinstance(row, dict)]
        if not rows: return None

        def _priority(sub: dict) -> tuple[int, int, datetime]:
            tier = str(sub.get("tier") or "").lower()
            tier_weight = {
                "enterprise": 6, "professional": 5, "growth": 4, "starter": 3, "premium": 2, "trial": 1, "free": 0,
            }.get(tier, 0)
            
            def _is_active(s):
                status = (s.get("status") or "").lower()
                if status not in ["active", "trialing"]: return False
                expires = _parse_iso_datetime(s.get("current_period_end"))
                if not expires: return True
                return datetime.now(timezone.utc) <= expires

            updated_at = _parse_iso_datetime(sub.get("updated_at")) or _parse_iso_datetime(sub.get("current_period_end")) or datetime.min.replace(tzinfo=timezone.utc)
            return (1 if _is_active(sub) else 0, tier_weight, updated_at)

        return max(rows, key=_priority)
    except Exception:
        return None

def is_active_subscription(sub: dict | None) -> bool:
    if not sub:
        return False
    status = (sub.get("status") or "").lower()
    if status not in ["active", "trialing"]:
        return False
    expires_at = _parse_iso_datetime(sub.get("current_period_end"))
    if not expires_at:
        return True
    return datetime.now(timezone.utc) <= expires_at

def verify_subscription(user: dict = Depends(get_current_user), request: Request = None):
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

async def send_email(*args, **kwargs):
    print(f"Mocked send_email: {args} {kwargs}")
    return True

def count_company_active_jobs(company_id: str) -> int:
    if not supabase: return 0
    try:
        resp = supabase.table("jobs").select("id", count="exact").eq("company_id", company_id).in_("status", ["active", "published"]).execute()
        return resp.count or 0
    except Exception:
        return 0

def invalidate_subscription_cache(*args, **kwargs):
    pass

class BillingVerificationRequest(BaseModel):
    feature: str
    metadata: Optional[Dict[str, Any]] = None
