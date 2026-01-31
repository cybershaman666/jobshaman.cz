import secrets
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .database import supabase
from .config import CSRF_TOKEN_EXPIRY

security = HTTPBearer()
csrf_tokens: dict = {}

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
                
                # Find all companies where user is a member
                member_resp = supabase.table("company_members").select("company_id, companies(name)").eq("user_id", user_id).execute()
                member_companies = member_resp.data or []
                
                all_associations = []
                for c in owned_companies:
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
            return profile
            
        raise HTTPException(status_code=401, detail="Profile not found")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    print(f"🔑 [AUTH] Verifying token: {credentials.credentials[:10]}...")
    return verify_supabase_token(credentials.credentials)

def verify_subscription(user: dict = Depends(get_current_user), request: Request = None):
    # Simplified for the sake of the refactor, will be refined in routers
    return user

def verify_csrf_token_header(request: Request, user: dict) -> bool:
    """Helper to verify CSRF token from request headers"""
    csrf_token = request.headers.get("X-CSRF-Token")
    if not csrf_token:
        print(f"❌ CSRF Header 'X-CSRF-Token' missing")
        return False
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        return False
    return validate_csrf_token(csrf_token, user_id)

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
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response
