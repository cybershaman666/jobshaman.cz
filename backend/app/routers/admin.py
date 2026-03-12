from fastapi import APIRouter, Request, Depends, HTTPException, Query
from datetime import datetime, timezone, timedelta
import time
import json
from collections import defaultdict
from typing import Optional, List, Dict, Any
import re
import traceback
from uuid import UUID

from ..core.security import get_current_user, verify_csrf_token_header
from ..core.database import supabase
from ..matching_engine.evaluation import run_offline_recommendation_evaluation
from ..models.requests import (
    AdminCrmLeadCreateRequest,
    AdminCrmLeadUpdateRequest,
    AdminFounderBoardCardCreateRequest,
    AdminFounderBoardCommentCreateRequest,
    AdminFounderBoardCardUpdateRequest,
    AdminSubscriptionUpdateRequest,
    AdminUserDigestUpdateRequest,
    AdminJobRoleCreateRequest,
    AdminJobRoleUpdateRequest,
)
from ..utils.helpers import now_iso

router = APIRouter()

UUID_RE = re.compile(r"^[0-9a-fA-F-]{8,36}$")
_audit_table_missing_logged = False
_admin_cache_store: Dict[str, tuple[float, Any]] = {}
_ADMIN_STATS_TTL_SECONDS = 120
_ADMIN_AI_QUALITY_TTL_SECONDS = 180
_ADMIN_NOTIFICATIONS_TTL_SECONDS = 60


def _admin_cache_get(key: str) -> Optional[Any]:
    row = _admin_cache_store.get(key)
    if not row:
        return None
    expires_at, value = row
    if expires_at <= time.time():
        _admin_cache_store.pop(key, None)
        return None
    return value


def _admin_cache_set(key: str, value: Any, ttl_seconds: int) -> Any:
    _admin_cache_store[key] = (time.time() + max(1, ttl_seconds), value)
    return value

def _parse_iso_datetime(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None

def _safe_query(value: str) -> str:
    if not value:
        return ""
    return re.sub(r"[^a-zA-Z0-9@._ -]+", " ", value).strip()


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _clean_admin_text(value: Optional[str], max_len: int = 5000) -> Optional[str]:
    if value is None:
        return None
    clean = re.sub(r"\s+", " ", str(value)).strip()
    if not clean:
        return None
    return clean[:max_len]


def _clean_uuid(value: Optional[str]) -> Optional[str]:
    clean = _clean_admin_text(value, 64)
    if not clean:
        return None
    try:
        return str(UUID(clean))
    except Exception:
        return None


def _safe_count(table: str, *, since: Optional[str] = None, filters: Optional[List[tuple[str, Any]]] = None) -> int:
    if not supabase:
        return 0
    try:
        query = supabase.table(table).select("id", count="exact")
        if since:
            query = query.gte("created_at", since)
        for field, value in (filters or []):
            query = query.eq(field, value)
        resp = query.execute()
        return resp.count or 0
    except Exception as exc:
        print(f"⚠️ Admin safe count failed for {table}: {exc}")
        return 0


def _safe_table_rows(
    table: str,
    *,
    select: str = "*",
    order_by: Optional[str] = None,
    desc: bool = False,
    limit: Optional[int] = None,
    filters: Optional[List[tuple[str, str, Any]]] = None,
) -> List[dict]:
    if not supabase:
        return []
    try:
        query = supabase.table(table).select(select)
        for op, field, value in (filters or []):
            if op == "eq":
                query = query.eq(field, value)
            elif op == "gte":
                query = query.gte(field, value)
            elif op == "in":
                query = query.in_(field, value)
        if order_by:
            query = query.order(order_by, desc=desc)
        if limit:
            query = query.limit(limit)
        resp = query.execute()
        return resp.data or []
    except Exception as exc:
        print(f"⚠️ Admin safe table fetch failed for {table}: {exc}")
        return []


def _build_lead_payload(raw: dict, *, admin: Optional[dict] = None, include_owner: bool = False) -> dict:
    payload = {
        "company_name": _clean_admin_text(raw.get("company_name"), 200),
        "contact_name": _clean_admin_text(raw.get("contact_name"), 160),
        "contact_role": _clean_admin_text(raw.get("contact_role"), 160),
        "email": _clean_admin_text(raw.get("email"), 320),
        "phone": _clean_admin_text(raw.get("phone"), 80),
        "website": _clean_admin_text(raw.get("website"), 320),
        "country": _clean_admin_text(raw.get("country"), 120),
        "city": _clean_admin_text(raw.get("city"), 120),
        "status": _clean_admin_text(raw.get("status"), 32),
        "priority": _clean_admin_text(raw.get("priority"), 32),
        "source": _clean_admin_text(raw.get("source"), 32),
        "notes": _clean_admin_text(raw.get("notes"), 8000),
        "next_follow_up_at": raw.get("next_follow_up_at"),
        "last_contacted_at": raw.get("last_contacted_at"),
        "linked_company_id": _clean_admin_text(raw.get("linked_company_id"), 64),
        "metadata": raw.get("metadata") if isinstance(raw.get("metadata"), dict) else {},
        "updated_at": now_iso(),
    }
    if include_owner and admin:
        payload["owner_admin_user_id"] = admin.get("user_id")
        payload["owner_admin_email"] = admin.get("email")
    return {k: v for k, v in payload.items() if v is not None}


def _build_founder_card_payload(raw: dict, *, admin: Optional[dict] = None, include_author: bool = False) -> dict:
    payload = {
        "title": _clean_admin_text(raw.get("title"), 220),
        "body": _clean_admin_text(raw.get("body"), 12000),
        "card_type": _clean_admin_text(raw.get("card_type"), 32),
        "status": _clean_admin_text(raw.get("status"), 32),
        "priority": _clean_admin_text(raw.get("priority"), 32),
        "assignee_name": _clean_admin_text(raw.get("assignee_name"), 160),
        "assignee_email": _clean_admin_text(raw.get("assignee_email"), 320),
        "metadata": raw.get("metadata") if isinstance(raw.get("metadata"), dict) else {},
        "updated_at": now_iso(),
    }
    if include_author and admin:
        payload["author_admin_user_id"] = _clean_uuid(admin.get("user_id"))
        payload["author_admin_email"] = admin.get("email")
    return {k: v for k, v in payload.items() if v is not None}


def _build_founder_comment_payload(raw: dict, *, admin: Optional[dict] = None) -> dict:
    payload = {
        "body": _clean_admin_text(raw.get("body"), 4000),
        "author_admin_user_id": _clean_uuid(admin.get("user_id")) if admin else None,
        "author_admin_email": admin.get("email") if admin else None,
        "updated_at": now_iso(),
    }
    return {k: v for k, v in payload.items() if v is not None}

def require_admin_user(user: dict) -> dict:
    if not supabase:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    user_id = user.get("id") or user.get("auth_id")
    email = user.get("email")
    cache_identity = str(user_id or email or "").strip().lower()
    if cache_identity:
        cached = _admin_cache_get(f"admin_user:{cache_identity}")
        if cached is not None:
            return cached

    if user_id:
        try:
            resp = supabase.table("admin_users").select("*").eq("user_id", user_id).eq("is_active", True).limit(1).execute()
            if resp.data:
                return _admin_cache_set(f"admin_user:{cache_identity}", resp.data[0], 300)
        except Exception as e:
            msg = str(e)
            print(f"⚠️ Admin lookup by user_id failed: {msg}")
            if "permission denied" in msg or "RLS" in msg:
                raise HTTPException(status_code=500, detail="Admin access blocked by RLS. Ensure SUPABASE_SERVICE_KEY is set.")
            if "does not exist" in msg:
                raise HTTPException(status_code=500, detail="admin_users table missing. Run migrations in production.")

    if email:
        try:
            resp = supabase.table("admin_users").select("*").eq("email", email).eq("is_active", True).limit(1).execute()
            if resp.data:
                return _admin_cache_set(f"admin_user:{cache_identity}", resp.data[0], 300)
        except Exception as e:
            msg = str(e)
            print(f"⚠️ Admin lookup by email failed: {msg}")
            if "permission denied" in msg or "RLS" in msg:
                raise HTTPException(status_code=500, detail="Admin access blocked by RLS. Ensure SUPABASE_SERVICE_KEY is set.")
            if "does not exist" in msg:
                raise HTTPException(status_code=500, detail="admin_users table missing. Run migrations in production.")

    raise HTTPException(status_code=403, detail="Admin access required")

def _target_from_subscription(sub: dict) -> tuple[Optional[str], Optional[str]]:
    if not sub:
        return None, None
    if sub.get("company_id"):
        return "company", sub.get("company_id")
    if sub.get("user_id"):
        return "user", sub.get("user_id")
    return None, None


def _strip_legacy_unsafe_fields(payload: dict, error_message: str) -> dict:
    """
    Remove optional fields that may be missing in older production schemas.
    This keeps admin updates functional during rolling migrations.
    """
    if not payload:
        return payload

    sanitized = dict(payload)
    legacy_optional_fields = ["updated_at", "canceled_at", "cancel_at_period_end"]

    # If we know the exact missing column, remove it. Otherwise remove all optional legacy fields.
    if "column" in error_message and "does not exist" in error_message:
        removed_any = False
        for field in legacy_optional_fields:
            if field in error_message and field in sanitized:
                sanitized.pop(field, None)
                removed_any = True
        if not removed_any:
            for field in legacy_optional_fields:
                sanitized.pop(field, None)

    return sanitized


def _is_missing_admin_audit_table_error(error: Exception) -> bool:
    msg = str(error)
    return "admin_subscription_audit" in msg and ("PGRST205" in msg or "does not exist" in msg)


def _is_missing_table_error(error: Exception, table_name: str) -> bool:
    msg = str(error).lower()
    table = table_name.lower()
    return (
        ("pgrst205" in msg and table in msg)
        or (f"relation \"public.{table}\"" in msg and "does not exist" in msg)
        or (f"relation \"{table}\"" in msg and "does not exist" in msg)
        or (f"table '{table}'" in msg)
    )


def _is_foreign_key_error(error: Exception, table_name: str, field_name: str) -> bool:
    msg = str(error).lower()
    return (
        "foreign key" in msg
        and table_name.lower() in msg
        and field_name.lower() in msg
    ) or "23503" in msg


def _log_audit_table_missing_once(error: Exception) -> None:
    global _audit_table_missing_logged
    if _audit_table_missing_logged:
        return
    _audit_table_missing_logged = True
    print(
        "ℹ️ admin_subscription_audit table is missing. "
        "Audit logging is disabled until migration 20260209_add_admin_subscription_audit.sql is applied. "
        f"Original error: {error}"
    )


def _is_paid_tier(tier: Optional[str]) -> bool:
    return bool(tier and tier != "free")


def _manual_billing_suffix(existing_sub: Optional[dict], target_id: Optional[str]) -> str:
    seed = (
        (existing_sub or {}).get("company_id")
        or (existing_sub or {}).get("user_id")
        or target_id
        or "manual"
    )
    clean = re.sub(r"[^a-zA-Z0-9_-]", "", str(seed))
    return (clean or "manual")[:24]


def _ensure_active_subscription_fields(
    patch: dict,
    existing_sub: Optional[dict] = None,
    target_id: Optional[str] = None,
) -> dict:
    """
    Some production schemas enforce check_active_subscription_complete:
    active/trialing paid subscriptions must have complete billing fields.
    """
    payload = dict(patch or {})
    base = existing_sub or {}

    tier = payload.get("tier", base.get("tier"))
    status = payload.get("status", base.get("status"))
    is_active_like = status in ["active", "trialing"]
    if not (is_active_like and _is_paid_tier(tier)):
        return payload

    now_dt = datetime.now(timezone.utc)
    suffix = _manual_billing_suffix(existing_sub, target_id)

    current_period_start = payload.get("current_period_start") or base.get("current_period_start")
    if not current_period_start:
        payload["current_period_start"] = now_dt.isoformat()

    current_period_end = payload.get("current_period_end") or base.get("current_period_end")
    if not current_period_end:
        payload["current_period_end"] = (now_dt + timedelta(days=30)).isoformat()

    stripe_customer_id = payload.get("stripe_customer_id") or base.get("stripe_customer_id")
    if not stripe_customer_id:
        payload["stripe_customer_id"] = f"manual_cust_{suffix}"

    stripe_subscription_id = payload.get("stripe_subscription_id") or base.get("stripe_subscription_id")
    if not stripe_subscription_id:
        payload["stripe_subscription_id"] = f"manual_sub_{suffix}_{int(now_dt.timestamp())}"

    return payload

@router.get("/admin/me")
async def admin_me(user: dict = Depends(get_current_user)):
    admin = require_admin_user(user)
    return {
        "id": admin.get("id"),
        "user_id": admin.get("user_id"),
        "email": admin.get("email"),
        "role": admin.get("role"),
        "is_active": admin.get("is_active"),
    }

@router.get("/admin/subscriptions")
async def list_subscriptions(
    request: Request,
    user: dict = Depends(get_current_user),
    q: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    kind: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    try:
        query = supabase.table("subscriptions").select("*", count="exact")

        if tier:
            query = query.eq("tier", tier)
        if status:
            query = query.eq("status", status)

        safe_q = _safe_query(q or "")
        if safe_q:
            or_filters: List[str] = []

            # Direct matches
            or_filters.append(f"stripe_subscription_id.ilike.%{safe_q}%")
            or_filters.append(f"stripe_customer_id.ilike.%{safe_q}%")

            if UUID_RE.match(safe_q):
                or_filters.append(f"id.eq.{safe_q}")
                or_filters.append(f"user_id.eq.{safe_q}")
                or_filters.append(f"company_id.eq.{safe_q}")

            # Company name lookup
            try:
                companies_resp = supabase.table("companies").select("id").ilike("name", f"%{safe_q}%").execute()
                company_ids = [c["id"] for c in (companies_resp.data or [])]
                if company_ids:
                    or_filters.append(f"company_id.in.({','.join(company_ids)})")
            except Exception as e:
                print(f"⚠️ Company search failed in admin: {e}")

            # Profile email/full_name lookup
            try:
                profiles_resp = supabase.table("profiles").select("id").or_(f"email.ilike.%{safe_q}%,full_name.ilike.%{safe_q}%").execute()
                user_ids = [p["id"] for p in (profiles_resp.data or [])]
                if user_ids:
                    or_filters.append(f"user_id.in.({','.join(user_ids)})")
            except Exception as e:
                print(f"⚠️ Profile search failed in admin: {e}")

            if or_filters:
                query = query.or_(",".join(or_filters))

        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        resp = query.execute()
        
        # Check for PostgREST errors that didn't raise
        if hasattr(resp, 'error') and resp.error:
            print(f"❌ PostgREST error in list_subscriptions: {resp.error}")
            raise HTTPException(status_code=500, detail=f"Database error: {resp.error}")

        data = [row for row in (resp.data or []) if isinstance(row, dict)]

        # Enrich relations separately instead of relying on PostgREST embedded joins.
        # This avoids runtime 500s when foreign-key embedding differs across environments.
        company_ids = sorted({str(s.get("company_id")) for s in data if s.get("company_id")})
        user_ids = sorted({str(s.get("user_id")) for s in data if s.get("user_id")})

        companies_by_id = {}
        if company_ids:
            try:
                companies_resp = (
                    supabase.table("companies")
                    .select("id,name,industry")
                    .in_("id", company_ids)
                    .execute()
                )
                companies_by_id = {
                    str(row.get("id")): {
                        "name": row.get("name"),
                        "industry": row.get("industry"),
                    }
                    for row in (companies_resp.data or [])
                    if isinstance(row, dict) and row.get("id")
                }
            except Exception as exc:
                print(f"⚠️ Admin subscriptions company enrichment failed: {exc}")

        profiles_by_id = {}
        if user_ids:
            profile_attempts = [
                "id,email,full_name",
                "id,email,name",
            ]
            for select_expr in profile_attempts:
                try:
                    profiles_resp = (
                        supabase.table("profiles")
                        .select(select_expr)
                        .in_("id", user_ids)
                        .execute()
                    )
                    profiles_by_id = {}
                    for row in (profiles_resp.data or []):
                        if not isinstance(row, dict) or not row.get("id"):
                            continue
                        profiles_by_id[str(row.get("id"))] = {
                            "email": row.get("email"),
                            "full_name": row.get("full_name") or row.get("name"),
                        }
                    break
                except Exception as exc:
                    print(f"⚠️ Admin subscriptions profile enrichment failed ({select_expr}): {exc}")

        for row in data:
            company_id = str(row.get("company_id") or "")
            user_id = str(row.get("user_id") or "")
            row["companies"] = companies_by_id.get(company_id)
            row["profiles"] = profiles_by_id.get(user_id)

        if kind in ["company", "user"]:
            if kind == "company":
                data = [s for s in data if s.get("company_id")]
            else:
                data = [s for s in data if s.get("user_id")]

        return {
            "items": data,
            "count": getattr(resp, 'count', 0) or 0,
            "limit": limit,
            "offset": offset,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ CRASH in list_subscriptions: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal admin error: {str(e)}")

@router.get("/admin/search")
async def admin_search(
    request: Request,
    user: dict = Depends(get_current_user),
    query: str = Query(..., min_length=2),
    kind: str = Query("company"),
    limit: int = Query(10, ge=1, le=25),
):
    try:
        require_admin_user(user)
        if not supabase:
            raise HTTPException(status_code=500, detail="Database unavailable")
        safe_q = _safe_query(query)
        if not safe_q:
            return {"items": []}

        if kind == "user":
            # Backward compatibility for partially migrated schemas.
            # Try richer profile shapes first, then degrade gracefully.
            user_rows = None
            user_attempts = [
                ("id, email, full_name, role", f"email.ilike.%{safe_q}%,full_name.ilike.%{safe_q}%"),
                ("id, email, full_name", f"email.ilike.%{safe_q}%,full_name.ilike.%{safe_q}%"),
                ("id, email, name", f"email.ilike.%{safe_q}%,name.ilike.%{safe_q}%"),
            ]
            for select_expr, or_filter in user_attempts:
                try:
                    resp = (
                        supabase.table("profiles")
                        .select(select_expr)
                        .or_(or_filter)
                        .limit(limit)
                        .execute()
                    )
                    user_rows = resp.data or []
                    break
                except Exception as exc:
                    print(f"⚠️ Admin user search attempt failed ({select_expr}): {exc}")

            if user_rows is None:
                try:
                    resp = (
                        supabase.table("profiles")
                        .select("id, email")
                        .ilike("email", f"%{safe_q}%")
                        .limit(limit)
                        .execute()
                    )
                    user_rows = resp.data or []
                except Exception as exc:
                    print(f"⚠️ Admin user search fallback failed: {exc}")
                    user_rows = []

            items = [
                {
                    "id": r.get("id"),
                    "label": r.get("full_name") or r.get("name") or r.get("email") or r.get("id"),
                    "secondary": r.get("email"),
                    "kind": "user",
                }
                for r in user_rows
            ]
            return {"items": items}

        if kind == "lead":
            lead_rows = []
            try:
                resp = (
                    supabase.table("admin_crm_leads")
                    .select("id,company_name,contact_name,email,status,city,country,updated_at")
                    .or_(f"company_name.ilike.%{safe_q}%,contact_name.ilike.%{safe_q}%,email.ilike.%{safe_q}%,phone.ilike.%{safe_q}%")
                    .order("updated_at", desc=True)
                    .limit(limit)
                    .execute()
                )
                lead_rows = resp.data or []
            except Exception as exc:
                print(f"⚠️ Admin lead search failed: {exc}")

            return {
                "items": [
                    {
                        "id": r.get("id"),
                        "label": r.get("company_name") or r.get("id"),
                        "secondary": " • ".join([part for part in [r.get("contact_name"), r.get("email"), r.get("status")] if part]),
                        "kind": "lead",
                    }
                    for r in lead_rows
                ]
            }

        company_rows = None
        company_attempts = [
            "id, name, industry",
            "id, name",
        ]
        for select_expr in company_attempts:
            try:
                resp = (
                    supabase.table("companies")
                    .select(select_expr)
                    .ilike("name", f"%{safe_q}%")
                    .limit(limit)
                    .execute()
                )
                company_rows = resp.data or []
                break
            except Exception as exc:
                print(f"⚠️ Admin company search attempt failed ({select_expr}): {exc}")

        if company_rows is None:
            company_rows = []

        items = [
            {
                "id": r.get("id"),
                "label": r.get("name") or r.get("id"),
                "secondary": r.get("industry"),
                "kind": "company",
            }
            for r in company_rows
        ]
        return {"items": items}
    except HTTPException:
        raise
    except Exception as exc:
        print(f"⚠️ Admin search unexpected failure: {exc}")
        print(traceback.format_exc())
        return {"items": []}


@router.get("/admin/crm/entities")
async def admin_crm_entities(
    request: Request,
    user: dict = Depends(get_current_user),
    q: Optional[str] = Query(None),
    kind: str = Query("all", pattern="^(company|user|all)$"),
    limit: int = Query(200, ge=1, le=500),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    safe_q = _safe_query(q or "")

    def _fetch_entities(table: str, select_attempts: List[str], *, search_fields: List[str], entity_kind: str) -> List[dict]:
        rows: List[dict] = []
        for select_expr in select_attempts:
            try:
                query_builder = supabase.table(table).select(select_expr)
                if safe_q:
                    or_filters = ",".join([f"{field}.ilike.%{safe_q}%" for field in search_fields])
                    query_builder = query_builder.or_(or_filters)
                try:
                    resp = query_builder.order("created_at", desc=True).limit(limit).execute()
                except Exception:
                    resp = query_builder.limit(limit).execute()
                rows = resp.data or []
                break
            except Exception as exc:
                print(f"⚠️ Admin CRM entity fetch failed for {table} ({select_expr}): {exc}")
        return [row for row in rows if isinstance(row, dict) and row.get("id")]

    company_rows: List[dict] = []
    user_rows: List[dict] = []
    if kind in {"all", "company"}:
        company_rows = _fetch_entities(
            "companies",
            [
                "id,name,industry,created_at,website",
                "id,name,industry,created_at",
                "id,name,created_at",
            ],
            search_fields=["name", "industry"],
            entity_kind="company",
        )
    if kind in {"all", "user"}:
        user_rows = _fetch_entities(
            "profiles",
            [
                "id,email,full_name,role,created_at",
                "id,email,full_name,created_at",
                "id,email,name,created_at",
                "id,email,created_at",
            ],
            search_fields=["email", "full_name", "name"],
            entity_kind="user",
        )

    company_ids = [str(row.get("id")) for row in company_rows if row.get("id")]
    user_ids = [str(row.get("id")) for row in user_rows if row.get("id")]
    subscription_rows: List[dict] = []
    if company_ids or user_ids:
        try:
            sub_query = supabase.table("subscriptions").select("*")
            filters: List[str] = []
            if company_ids:
                filters.append(f"company_id.in.({','.join(company_ids)})")
            if user_ids:
                filters.append(f"user_id.in.({','.join(user_ids)})")
            if filters:
                sub_query = sub_query.or_(",".join(filters))
            subscription_rows = sub_query.limit(max(limit * 2, 200)).execute().data or []
        except Exception as exc:
            print(f"⚠️ Admin CRM subscription enrichment failed: {exc}")
            subscription_rows = []

    subscriptions_by_company = {
        str(row.get("company_id")): row
        for row in subscription_rows
        if row.get("company_id")
    }
    subscriptions_by_user = {
        str(row.get("user_id")): row
        for row in subscription_rows
        if row.get("user_id")
    }

    items: List[dict] = []
    for row in company_rows:
        entity_id = str(row.get("id"))
        subscription = subscriptions_by_company.get(entity_id)
        items.append({
            "id": entity_id,
            "kind": "company",
            "label": row.get("name") or entity_id,
            "secondary": " • ".join([part for part in [row.get("industry"), (subscription or {}).get("tier") or "free"] if part]),
            "entity": row,
            "subscription": subscription,
        })
    for row in user_rows:
        entity_id = str(row.get("id"))
        subscription = subscriptions_by_user.get(entity_id)
        items.append({
            "id": entity_id,
            "kind": "user",
            "label": row.get("full_name") or row.get("name") or row.get("email") or entity_id,
            "secondary": " • ".join([part for part in [row.get("email"), (subscription or {}).get("tier") or "free"] if part]),
            "entity": row,
            "subscription": subscription,
        })

    items = sorted(
        items,
        key=lambda item: (
            0 if item.get("subscription") else 1,
            str(item.get("label") or "").lower(),
        ),
    )[:limit]
    return {"items": items, "count": len(items)}


@router.get("/admin/crm/entity-detail")
async def admin_crm_entity_detail(
    request: Request,
    user: dict = Depends(get_current_user),
    kind: str = Query(..., pattern="^(company|user|lead)$"),
    entity_id: str = Query(..., min_length=8, max_length=64),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    now = datetime.now(timezone.utc)
    last_30_iso = (now - timedelta(days=30)).isoformat()
    last_90_iso = (now - timedelta(days=90)).isoformat()

    def _safe_count(table_name: str, filters: List[tuple[str, str, Any]]) -> int:
        try:
            q = supabase.table(table_name).select("id", count="exact")
            for op, field, value in filters:
                if op == "eq":
                    q = q.eq(field, value)
                elif op == "gte":
                    q = q.gte(field, value)
                elif op == "in":
                    q = q.in_(field, value)
                elif op == "not_null":
                    q = q.not_.is_(field, "null")
            resp = q.execute()
            return resp.count or 0
        except Exception:
            return 0

    def _safe_select_single(table_name: str, select_attempts: List[str], filter_field: str, filter_value: str) -> Optional[dict]:
        for select_expr in select_attempts:
            try:
                resp = (
                    supabase.table(table_name)
                    .select(select_expr)
                    .eq(filter_field, filter_value)
                    .maybe_single()
                    .execute()
                )
                if resp and isinstance(resp.data, dict):
                    return resp.data
            except Exception:
                continue
        return None

    def _safe_rows(
        table_name: str,
        select_expr: str,
        filters: List[tuple[str, str, Any]],
        order_field: Optional[str] = None,
        desc: bool = True,
        limit: int = 20,
    ) -> List[dict]:
        try:
            q = supabase.table(table_name).select(select_expr)
            for op, field, value in filters:
                if op == "eq":
                    q = q.eq(field, value)
                elif op == "gte":
                    q = q.gte(field, value)
                elif op == "in":
                    q = q.in_(field, value)
            if order_field:
                q = q.order(order_field, desc=desc)
            q = q.limit(limit)
            resp = q.execute()
            rows = resp.data or []
            return [row for row in rows if isinstance(row, dict)]
        except Exception:
            return []

    def _titleize(value: str) -> str:
        if not value:
            return "event"
        return str(value).replace("_", " ").strip()

    def _append_timeline(
        timeline: List[dict],
        *,
        entry_id: str,
        category: str,
        event_type: str,
        title: str,
        detail: str = "",
        timestamp: Optional[str] = None,
        severity: str = "info",
        job_id: Optional[str] = None,
        job_title: str = "",
    ) -> None:
        if not timestamp:
            return
        timeline.append({
            "id": entry_id,
            "category": category,
            "type": event_type,
            "title": title,
            "detail": detail,
            "timestamp": timestamp,
            "severity": severity,
            "job_id": job_id,
            "job_title": job_title,
        })

    if kind == "lead":
        try:
            lead_resp = (
                supabase.table("admin_crm_leads")
                .select("*")
                .eq("id", entity_id)
                .maybe_single()
                .execute()
            )
            lead = lead_resp.data if lead_resp else None
        except Exception:
            lead = None

        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        created_at = lead.get("created_at")
        updated_at = lead.get("updated_at")
        last_contacted_at = lead.get("last_contacted_at")
        next_follow_up_at = lead.get("next_follow_up_at")

        timeline: List[dict] = []
        _append_timeline(
            timeline,
            entry_id=f"lead-created:{entity_id}",
            category="crm",
            event_type="lead_created",
            title="Lead přidaný do CRM",
            detail=lead.get("source") or "manual",
            timestamp=created_at,
            severity="info",
        )
        _append_timeline(
            timeline,
            entry_id=f"lead-contacted:{entity_id}",
            category="contact",
            event_type="last_contacted",
            title="Poslední kontakt",
            detail=lead.get("contact_name") or lead.get("email") or "",
            timestamp=last_contacted_at,
            severity="info",
        )
        _append_timeline(
            timeline,
            entry_id=f"lead-followup:{entity_id}",
            category="follow_up",
            event_type="next_follow_up",
            title="Naplánovaný follow-up",
            detail=lead.get("status") or "",
            timestamp=next_follow_up_at,
            severity="warning",
        )
        if updated_at and updated_at != created_at:
            _append_timeline(
                timeline,
                entry_id=f"lead-updated:{entity_id}",
                category="crm",
                event_type="lead_updated",
                title="Lead naposledy upravený",
                detail=lead.get("owner_admin_email") or "",
                timestamp=updated_at,
                severity="info",
            )

        days_open = 0
        created_dt = _parse_iso_datetime(created_at) if created_at else None
        if created_dt:
            days_open = max(0, int((now - created_dt).total_seconds() // 86400))

        return {
            "kind": "lead",
            "entity": lead,
            "subscription": None,
            "metrics": {
                "days_open": days_open,
                "has_email": 1 if lead.get("email") else 0,
                "has_phone": 1 if lead.get("phone") else 0,
                "follow_up_scheduled": 1 if lead.get("next_follow_up_at") else 0,
                "linked_company": 1 if lead.get("linked_company_id") else 0,
            },
            "breakdowns": {},
            "recent": {},
            "timeline": sorted(timeline, key=lambda item: item.get("timestamp") or "", reverse=True),
            "timeline_categories": ["crm", "contact", "follow_up"],
        }

    if kind == "company":
        entity = _safe_select_single(
            "companies",
            [
                "id,name,industry,description,website,created_at,owner_id,contact_email,contact_phone,company_size",
                "id,name,industry,description,website,created_at,owner_id",
                "id,name,industry,created_at,owner_id",
                "id,name,created_at",
            ],
            "id",
            entity_id,
        )
        if not entity:
            raise HTTPException(status_code=404, detail="Company not found")

        try:
            sub_resp = (
                supabase.table("subscriptions")
                .select("*")
                .eq("company_id", entity_id)
                .maybe_single()
                .execute()
            )
            subscription = sub_resp.data if sub_resp else None
        except Exception:
            subscription = None

        jobs_total = _safe_count("jobs", [("eq", "company_id", entity_id)])
        jobs_recent_30 = _safe_count("jobs", [("eq", "company_id", entity_id), ("gte", "created_at", last_30_iso)])
        active_jobs = _safe_count("jobs", [("eq", "company_id", entity_id), ("eq", "status", "active")])
        paused_jobs = _safe_count("jobs", [("eq", "company_id", entity_id), ("eq", "status", "paused")])
        closed_jobs = _safe_count("jobs", [("eq", "company_id", entity_id), ("eq", "status", "closed")])
        if active_jobs == 0 and paused_jobs == 0 and closed_jobs == 0:
            # Fallback for older schemas without explicit status.
            active_jobs = _safe_count("jobs", [("eq", "company_id", entity_id), ("eq", "is_active", True)])
            closed_jobs = _safe_count("jobs", [("eq", "company_id", entity_id), ("eq", "is_active", False)])

        applications_total = _safe_count("job_applications", [("eq", "company_id", entity_id)])
        applications_recent_30 = _safe_count("job_applications", [("eq", "company_id", entity_id), ("gte", "created_at", last_30_iso)])
        application_status_counts: Dict[str, int] = {}
        for status_key in ["pending", "reviewed", "shortlisted", "rejected", "hired", "withdrawn", "timeout", "closed"]:
            application_status_counts[status_key] = _safe_count(
                "job_applications",
                [("eq", "company_id", entity_id), ("eq", "status", status_key)],
            )

        company_members = _safe_count("company_members", [("eq", "company_id", entity_id), ("eq", "is_active", True)])
        if company_members == 0:
            company_members = _safe_count("company_members", [("eq", "company_id", entity_id)])

        application_messages_total = _safe_count("application_messages", [("eq", "company_id", entity_id)])

        recent_jobs = []
        for select_expr in [
            "id,title,status,created_at,updated_at,location",
            "id,title,is_active,created_at,updated_at,location",
            "id,title,created_at,updated_at,location",
        ]:
            try:
                resp = (
                    supabase.table("jobs")
                    .select(select_expr)
                    .eq("company_id", entity_id)
                    .order("updated_at", desc=True)
                    .limit(8)
                    .execute()
                )
                recent_jobs = resp.data or []
                break
            except Exception:
                continue

        company_job_rows = []
        for select_expr in [
            "id,title,status,is_active,created_at,updated_at,location,company",
            "id,title,status,created_at,updated_at,location,company",
            "id,title,is_active,created_at,updated_at,location,company",
            "id,title,created_at,updated_at,location,company",
        ]:
            try:
                resp = (
                    supabase.table("jobs")
                    .select(select_expr)
                    .eq("company_id", entity_id)
                    .order("updated_at", desc=True)
                    .limit(250)
                    .execute()
                )
                company_job_rows = resp.data or []
                break
            except Exception:
                continue

        jobs_by_id: Dict[str, dict] = {}
        for row in company_job_rows:
            job_id = str(row.get("id") or "").strip()
            if not job_id:
                continue
            jobs_by_id[job_id] = row

        job_reaction_map: Dict[str, dict] = {}

        def _ensure_job_breakdown(job_id: str) -> dict:
            existing = job_reaction_map.get(job_id)
            if existing is not None:
                return existing
            job_row = jobs_by_id.get(job_id) or {}
            status_value = job_row.get("status")
            if not status_value:
                status_value = "active" if job_row.get("is_active") else "inactive"
            breakdown = {
                "job_id": job_id,
                "job_title": job_row.get("title") or f"job #{job_id}",
                "job_location": job_row.get("location") or "",
                "job_status": status_value or "",
                "interaction_total_90d": 0,
                "unique_users_90d": 0,
                "open_detail_90d": 0,
                "apply_click_90d": 0,
                "save_90d": 0,
                "unsave_90d": 0,
                "swipe_left_90d": 0,
                "swipe_right_90d": 0,
                "applications_total": 0,
                "applications_recent_30d": 0,
                "application_status_counts": {},
            }
            job_reaction_map[job_id] = breakdown
            return breakdown

        interaction_unique_users: Dict[str, set[str]] = {}
        company_job_ids = list(jobs_by_id.keys())
        if company_job_ids:
            try:
                interaction_rows = (
                    supabase.table("job_interactions")
                    .select("job_id,user_id,event_type,created_at")
                    .in_("job_id", company_job_ids)
                    .gte("created_at", last_90_iso)
                    .order("created_at", desc=True)
                    .limit(50000)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                interaction_rows = []

            for row in interaction_rows:
                job_id = str(row.get("job_id") or "").strip()
                event_type = str(row.get("event_type") or "").strip().lower()
                if not job_id or not event_type:
                    continue
                breakdown = _ensure_job_breakdown(job_id)
                breakdown["interaction_total_90d"] += 1
                if event_type == "open_detail":
                    breakdown["open_detail_90d"] += 1
                elif event_type == "apply_click":
                    breakdown["apply_click_90d"] += 1
                elif event_type == "save":
                    breakdown["save_90d"] += 1
                elif event_type == "unsave":
                    breakdown["unsave_90d"] += 1
                elif event_type == "swipe_left":
                    breakdown["swipe_left_90d"] += 1
                elif event_type == "swipe_right":
                    breakdown["swipe_right_90d"] += 1

                user_id = str(row.get("user_id") or "").strip()
                if user_id:
                    interaction_unique_users.setdefault(job_id, set()).add(user_id)

            try:
                application_rows = (
                    supabase.table("job_applications")
                    .select("job_id,status,candidate_id,created_at,submitted_at")
                    .eq("company_id", entity_id)
                    .order("created_at", desc=True)
                    .limit(20000)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                application_rows = []

            for row in application_rows:
                job_id = str(row.get("job_id") or "").strip()
                if not job_id:
                    continue
                breakdown = _ensure_job_breakdown(job_id)
                breakdown["applications_total"] += 1
                status_key = str(row.get("status") or "pending").strip().lower() or "pending"
                status_counts = breakdown["application_status_counts"]
                status_counts[status_key] = int(status_counts.get(status_key) or 0) + 1
                created_at = row.get("submitted_at") or row.get("created_at")
                created_dt = _parse_iso_datetime(created_at) if created_at else None
                if created_dt and created_dt >= now - timedelta(days=30):
                    breakdown["applications_recent_30d"] += 1

        for job_id, unique_users in interaction_unique_users.items():
            breakdown = _ensure_job_breakdown(job_id)
            breakdown["unique_users_90d"] = len(unique_users)

        job_reaction_breakdown = sorted(
            job_reaction_map.values(),
            key=lambda item: (
                -int(item.get("applications_total") or 0),
                -int(item.get("interaction_total_90d") or 0),
                str(item.get("job_title") or "").lower(),
            ),
        )

        recent_applications = []
        for order_field, select_expr in [
            ("submitted_at", "id,job_id,status,submitted_at,created_at,candidate_id,source"),
            ("created_at", "id,job_id,status,created_at,candidate_id,source"),
        ]:
            try:
                resp = (
                    supabase.table("job_applications")
                    .select(select_expr)
                    .eq("company_id", entity_id)
                    .order(order_field, desc=True)
                    .limit(8)
                    .execute()
                )
                recent_applications = resp.data or []
                break
            except Exception:
                continue

        activity_log_available = True
        activity_log = []
        try:
            resp = (
                supabase.table("company_activity_log")
                .select("id,event_type,subject_type,subject_id,payload,actor_user_id,created_at")
                .eq("company_id", entity_id)
                .order("created_at", desc=True)
                .limit(10)
                .execute()
            )
            activity_log = resp.data or []
        except Exception:
            activity_log_available = False

        subscription_audit_available = True
        subscription_audit_rows: List[dict] = []
        if subscription and subscription.get("id"):
            try:
                subscription_audit_rows = (
                    supabase.table("admin_subscription_audit")
                    .select("id,action,before,after,admin_email,created_at")
                    .eq("subscription_id", subscription.get("id"))
                    .order("created_at", desc=True)
                    .limit(20)
                    .execute()
                    .data
                    or []
                )
            except Exception as e:
                if _is_missing_admin_audit_table_error(e):
                    _log_audit_table_missing_once(e)
                    subscription_audit_available = False
                else:
                    subscription_audit_rows = []

        recent_messages = _safe_rows(
            "application_messages",
            "id,application_id,sender_role,created_at",
            [("eq", "company_id", entity_id)],
            order_field="created_at",
            limit=12,
        )

        timeline: List[dict] = []
        for row in subscription_audit_rows:
            before = row.get("before") or {}
            after = row.get("after") or {}
            before_tier = (before or {}).get("tier")
            after_tier = (after or {}).get("tier")
            before_status = (before or {}).get("status")
            after_status = (after or {}).get("status")
            changes = []
            if before_tier != after_tier and (before_tier or after_tier):
                changes.append(f"tier: {before_tier or '-'} -> {after_tier or '-'}")
            if before_status != after_status and (before_status or after_status):
                changes.append(f"status: {before_status or '-'} -> {after_status or '-'}")
            _append_timeline(
                timeline,
                entry_id=f"audit:{row.get('id')}",
                category="subscription",
                event_type=str(row.get("action") or "update"),
                title=f"Subscription {_titleize(str(row.get('action') or 'update'))}",
                detail=f"{'; '.join(changes)}{(' | by ' + str(row.get('admin_email'))) if row.get('admin_email') else ''}",
                timestamp=row.get("created_at"),
                severity="info",
            )

        for row in activity_log:
            _append_timeline(
                timeline,
                entry_id=f"activity:{row.get('id')}",
                category="activity",
                event_type=str(row.get("event_type") or "activity"),
                title=_titleize(str(row.get("event_type") or "activity")),
                detail=f"{row.get('subject_type') or 'record'} #{row.get('subject_id') or '-'}",
                timestamp=row.get("created_at"),
                severity="info",
            )

        for row in recent_applications:
            status_value = str(row.get("status") or "pending")
            severity = "success" if status_value in ["hired", "shortlisted"] else ("danger" if status_value in ["rejected", "timeout", "closed"] else "info")
            _append_timeline(
                timeline,
                entry_id=f"application:{row.get('id')}",
                category="application",
                event_type=status_value,
                title=f"Handshake {status_value}",
                detail=f"job #{row.get('job_id') or '-'}",
                timestamp=row.get("submitted_at") or row.get("created_at"),
                severity=severity,
                job_id=str(row.get("job_id") or "") or None,
                job_title=(jobs_by_id.get(str(row.get("job_id") or "")) or {}).get("title") or "",
            )

        for row in recent_jobs:
            job_status = row.get("status")
            if not job_status:
                job_status = "active" if row.get("is_active") else "inactive"
            _append_timeline(
                timeline,
                entry_id=f"job:{row.get('id')}",
                category="job",
                event_type=str(job_status),
                title=f"Role {_titleize(str(job_status))}",
                detail=str(row.get("title") or f"job #{row.get('id')}"),
                timestamp=row.get("updated_at") or row.get("created_at"),
                severity="info",
                job_id=str(row.get("id") or "") or None,
                job_title=str(row.get("title") or ""),
            )

        for row in recent_messages:
            sender_role = str(row.get("sender_role") or "unknown")
            _append_timeline(
                timeline,
                entry_id=f"message:{row.get('id')}",
                category="message",
                event_type=sender_role,
                title=f"Message from {sender_role}",
                detail=f"application #{row.get('application_id') or '-'}",
                timestamp=row.get("created_at"),
                severity="info",
            )

        timeline = sorted(
            timeline,
            key=lambda item: _parse_iso_datetime(item.get("timestamp") or "") or datetime.fromtimestamp(0, tz=timezone.utc),
            reverse=True,
        )[:50]
        timeline_categories = sorted({item.get("category") for item in timeline if item.get("category")})

        return {
            "kind": "company",
            "entity": entity,
            "subscription": subscription,
            "metrics": {
                "jobs_total": jobs_total,
                "jobs_recent_30d": jobs_recent_30,
                "jobs_active": active_jobs,
                "jobs_paused": paused_jobs,
                "jobs_closed": closed_jobs,
                "applications_total": applications_total,
                "applications_recent_30d": applications_recent_30,
                "company_members": company_members,
                "application_messages_total": application_messages_total,
            },
            "breakdowns": {
                "application_status": application_status_counts,
                "job_reactions": job_reaction_breakdown,
            },
            "recent": {
                "jobs": recent_jobs,
                "applications": recent_applications,
                "activity": activity_log,
            },
            "timeline": timeline,
            "timeline_categories": timeline_categories,
            "flags": {
                "activity_log_available": activity_log_available,
                "subscription_audit_available": subscription_audit_available,
            },
        }

    # kind == "user"
    entity = _safe_select_single(
        "profiles",
        [
            "id,email,full_name,role,created_at,preferred_country_code,daily_digest_enabled,daily_digest_push_enabled,daily_digest_time,daily_digest_timezone,daily_digest_last_sent_at",
            "id,email,name,role,created_at,preferred_country_code,daily_digest_enabled,daily_digest_push_enabled,daily_digest_time,daily_digest_timezone,daily_digest_last_sent_at",
            "id,email,full_name,role,created_at",
            "id,email,name,role,created_at",
            "id,email,created_at",
        ],
        "id",
        entity_id,
    )
    if not entity:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        sub_resp = (
            supabase.table("subscriptions")
            .select("*")
            .eq("user_id", entity_id)
            .maybe_single()
            .execute()
        )
        subscription = sub_resp.data if sub_resp else None
    except Exception:
        subscription = None

    applications_total = _safe_count("job_applications", [("eq", "candidate_id", entity_id)])
    applications_recent_30 = _safe_count("job_applications", [("eq", "candidate_id", entity_id), ("gte", "created_at", last_30_iso)])
    interactions_total = _safe_count("job_interactions", [("eq", "user_id", entity_id)])
    interactions_recent_30 = _safe_count("job_interactions", [("eq", "user_id", entity_id), ("gte", "created_at", last_30_iso)])
    opens_recent_30 = _safe_count("job_interactions", [("eq", "user_id", entity_id), ("eq", "event_type", "open_detail"), ("gte", "created_at", last_30_iso)])
    applies_recent_30 = _safe_count("job_interactions", [("eq", "user_id", entity_id), ("eq", "event_type", "apply_click"), ("gte", "created_at", last_30_iso)])
    saves_recent_30 = _safe_count("job_interactions", [("eq", "user_id", entity_id), ("in", "event_type", ["save", "unsave"]), ("gte", "created_at", last_30_iso)])

    user_application_status_counts: Dict[str, int] = {}
    for status_key in ["pending", "reviewed", "shortlisted", "rejected", "hired", "withdrawn", "timeout", "closed"]:
        user_application_status_counts[status_key] = _safe_count(
            "job_applications",
            [("eq", "candidate_id", entity_id), ("eq", "status", status_key)],
        )

    owned_companies = _safe_count("companies", [("eq", "owner_id", entity_id)])
    member_companies = _safe_count("company_members", [("eq", "user_id", entity_id), ("eq", "is_active", True)])
    if member_companies == 0:
        member_companies = _safe_count("company_members", [("eq", "user_id", entity_id)])

    recent_applications = []
    for order_field, select_expr in [
        ("submitted_at", "id,job_id,company_id,status,submitted_at,created_at,source"),
        ("created_at", "id,job_id,company_id,status,created_at,source"),
    ]:
        try:
            resp = (
                supabase.table("job_applications")
                .select(select_expr)
                .eq("candidate_id", entity_id)
                .order(order_field, desc=True)
                .limit(8)
                .execute()
            )
            recent_applications = resp.data or []
            break
        except Exception:
            continue

    recent_interactions = []
    try:
        resp = (
            supabase.table("job_interactions")
            .select("id,job_id,event_type,created_at")
            .eq("user_id", entity_id)
            .order("created_at", desc=True)
            .limit(12)
            .execute()
        )
        recent_interactions = resp.data or []
    except Exception:
        recent_interactions = []

    recent_messages = _safe_rows(
        "application_messages",
        "id,application_id,sender_role,created_at",
        [("eq", "candidate_id", entity_id)],
        order_field="created_at",
        limit=12,
    )

    subscription_audit_available = True
    subscription_audit_rows: List[dict] = []
    if subscription and subscription.get("id"):
        try:
            subscription_audit_rows = (
                supabase.table("admin_subscription_audit")
                .select("id,action,before,after,admin_email,created_at")
                .eq("subscription_id", subscription.get("id"))
                .order("created_at", desc=True)
                .limit(20)
                .execute()
                .data
                or []
            )
        except Exception as e:
            if _is_missing_admin_audit_table_error(e):
                _log_audit_table_missing_once(e)
                subscription_audit_available = False
            else:
                subscription_audit_rows = []

    timeline: List[dict] = []
    for row in subscription_audit_rows:
        before = row.get("before") or {}
        after = row.get("after") or {}
        before_tier = (before or {}).get("tier")
        after_tier = (after or {}).get("tier")
        before_status = (before or {}).get("status")
        after_status = (after or {}).get("status")
        changes = []
        if before_tier != after_tier and (before_tier or after_tier):
            changes.append(f"tier: {before_tier or '-'} -> {after_tier or '-'}")
        if before_status != after_status and (before_status or after_status):
            changes.append(f"status: {before_status or '-'} -> {after_status or '-'}")
        _append_timeline(
            timeline,
            entry_id=f"audit:{row.get('id')}",
            category="subscription",
            event_type=str(row.get("action") or "update"),
            title=f"Subscription {_titleize(str(row.get('action') or 'update'))}",
            detail=f"{'; '.join(changes)}{(' | by ' + str(row.get('admin_email'))) if row.get('admin_email') else ''}",
            timestamp=row.get("created_at"),
            severity="info",
        )

    for row in recent_applications:
        status_value = str(row.get("status") or "pending")
        severity = "success" if status_value in ["hired", "shortlisted"] else ("danger" if status_value in ["rejected", "timeout", "closed"] else "info")
        _append_timeline(
            timeline,
            entry_id=f"application:{row.get('id')}",
            category="application",
            event_type=status_value,
            title=f"Handshake {status_value}",
            detail=f"job #{row.get('job_id') or '-'}",
            timestamp=row.get("submitted_at") or row.get("created_at"),
            severity=severity,
        )

    for row in recent_interactions:
        event_type = str(row.get("event_type") or "interaction")
        _append_timeline(
            timeline,
            entry_id=f"interaction:{row.get('id')}",
            category="interaction",
            event_type=event_type,
            title=_titleize(event_type),
            detail=f"job #{row.get('job_id') or '-'}",
            timestamp=row.get("created_at"),
            severity="info",
        )

    for row in recent_messages:
        sender_role = str(row.get("sender_role") or "unknown")
        _append_timeline(
            timeline,
            entry_id=f"message:{row.get('id')}",
            category="message",
            event_type=sender_role,
            title=f"Message from {sender_role}",
            detail=f"application #{row.get('application_id') or '-'}",
            timestamp=row.get("created_at"),
            severity="info",
        )

    timeline = sorted(
        timeline,
        key=lambda item: _parse_iso_datetime(item.get("timestamp") or "") or datetime.fromtimestamp(0, tz=timezone.utc),
        reverse=True,
    )[:50]
    timeline_categories = sorted({item.get("category") for item in timeline if item.get("category")})

    return {
        "kind": "user",
        "entity": entity,
        "subscription": subscription,
        "metrics": {
            "applications_total": applications_total,
            "applications_recent_30d": applications_recent_30,
            "interactions_total": interactions_total,
            "interactions_recent_30d": interactions_recent_30,
            "open_detail_recent_30d": opens_recent_30,
            "apply_click_recent_30d": applies_recent_30,
            "save_events_recent_30d": saves_recent_30,
            "owned_companies": owned_companies,
            "member_companies": member_companies,
        },
        "breakdowns": {
            "application_status": user_application_status_counts,
        },
        "recent": {
            "applications": recent_applications,
            "interactions": recent_interactions,
        },
        "timeline": timeline,
        "timeline_categories": timeline_categories,
        "flags": {
            "subscription_audit_available": subscription_audit_available,
        },
    }


@router.get("/admin/crm/job-reactions-summary")
async def admin_crm_job_reactions_summary(
    request: Request,
    user: dict = Depends(get_current_user),
    q: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    window_days: int = Query(90, ge=7, le=365),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    safe_q = _safe_query(q or "").lower()
    since_iso = (datetime.now(timezone.utc) - timedelta(days=window_days)).isoformat()

    try:
        interaction_rows = (
            supabase.table("job_interactions")
            .select("job_id,user_id,event_type,created_at")
            .gte("created_at", since_iso)
            .limit(50000)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        print(f"⚠️ Admin CRM job interaction summary failed: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load CRM job reaction summary")

    counts_by_job: Dict[str, dict] = {}
    users_by_job: Dict[str, set[str]] = {}
    for row in interaction_rows:
        job_id = str(row.get("job_id") or "").strip()
        event_type = str(row.get("event_type") or "").strip().lower()
        if not job_id or not event_type:
            continue
        bucket = counts_by_job.setdefault(job_id, {
            "interaction_total": 0,
            "open_detail": 0,
            "apply_click": 0,
            "save": 0,
            "unsave": 0,
            "swipe_left": 0,
            "swipe_right": 0,
        })
        bucket["interaction_total"] += 1
        if event_type in bucket:
            bucket[event_type] += 1
        user_id = str(row.get("user_id") or "").strip()
        if user_id:
            users_by_job.setdefault(job_id, set()).add(user_id)

    job_ids = list(counts_by_job.keys())
    if not job_ids:
        return {"items": [], "count": 0, "window_days": window_days}

    job_rows: List[dict] = []
    for i in range(0, len(job_ids), 200):
        chunk = job_ids[i:i + 200]
        try:
            resp = (
                supabase.table("jobs")
                .select("id,title,company,company_id,status,is_active,location")
                .in_("id", chunk)
                .execute()
            )
            job_rows.extend(resp.data or [])
        except Exception:
            continue

    jobs_by_id = {str(row.get("id")): row for row in job_rows if row.get("id") is not None}

    application_counts_by_job: Dict[str, dict] = {}
    for i in range(0, len(job_ids), 200):
        chunk = job_ids[i:i + 200]
        try:
            resp = (
                supabase.table("job_applications")
                .select("job_id,status,created_at,submitted_at")
                .in_("job_id", chunk)
                .gte("created_at", since_iso)
                .limit(20000)
                .execute()
            )
            rows = resp.data or []
        except Exception:
            rows = []
        for row in rows:
            job_id = str(row.get("job_id") or "").strip()
            if not job_id:
                continue
            bucket = application_counts_by_job.setdefault(job_id, {
                "applications_total": 0,
                "application_status_counts": {},
            })
            bucket["applications_total"] += 1
            status_key = str(row.get("status") or "pending").strip().lower() or "pending"
            status_counts = bucket["application_status_counts"]
            status_counts[status_key] = int(status_counts.get(status_key) or 0) + 1

    items: List[dict] = []
    for job_id, bucket in counts_by_job.items():
        job = jobs_by_id.get(job_id)
        if not job:
            continue
        company = str(job.get("company") or "").strip()
        title = str(job.get("title") or "").strip()
        location = str(job.get("location") or "").strip()
        haystack = f"{title} {company} {location}".lower()
        if safe_q and safe_q not in haystack:
            continue
        status_value = job.get("status")
        if not status_value:
            status_value = "active" if job.get("is_active") else "inactive"
        app_bucket = application_counts_by_job.get(job_id, {})
        items.append({
            "job_id": job_id,
            "job_title": title or f"job #{job_id}",
            "company": company or "Unknown company",
            "company_id": str(job.get("company_id") or "") or None,
            "job_status": status_value or "",
            "location": location,
            "unique_users": len(users_by_job.get(job_id, set())),
            "interaction_total": int(bucket.get("interaction_total") or 0),
            "open_detail": int(bucket.get("open_detail") or 0),
            "apply_click": int(bucket.get("apply_click") or 0),
            "save": int(bucket.get("save") or 0),
            "unsave": int(bucket.get("unsave") or 0),
            "swipe_left": int(bucket.get("swipe_left") or 0),
            "swipe_right": int(bucket.get("swipe_right") or 0),
            "applications_total": int(app_bucket.get("applications_total") or 0),
            "application_status_counts": app_bucket.get("application_status_counts") or {},
        })

    items = sorted(
        items,
        key=lambda item: (
            -int(item.get("applications_total") or 0),
            -int(item.get("apply_click") or 0),
            -int(item.get("open_detail") or 0),
            -int(item.get("unique_users") or 0),
            str(item.get("company") or "").lower(),
            str(item.get("job_title") or "").lower(),
        ),
    )[:limit]

    return {
        "items": items,
        "count": len(items),
        "window_days": window_days,
    }


@router.get("/admin/crm/leads")
async def admin_crm_leads(
    request: Request,
    user: dict = Depends(get_current_user),
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    try:
        query = supabase.table("admin_crm_leads").select("*", count="exact")
        safe_q = _safe_query(q or "")
        if safe_q:
            query = query.or_(f"company_name.ilike.%{safe_q}%,contact_name.ilike.%{safe_q}%,email.ilike.%{safe_q}%,phone.ilike.%{safe_q}%")
        if status:
            query = query.eq("status", status)
        resp = query.order("updated_at", desc=True).range(offset, offset + limit - 1).execute()
        return {"items": resp.data or [], "count": resp.count or 0}
    except Exception as exc:
        print(f"⚠️ Admin CRM leads load failed: {exc}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to load CRM leads")


@router.post("/admin/crm/leads")
async def admin_crm_lead_create(
    payload: AdminCrmLeadCreateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    admin = require_admin_user(user)
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    try:
        lead_payload = _build_lead_payload(payload.model_dump(), admin=admin, include_owner=True)
        if not lead_payload.get("company_name"):
            raise HTTPException(status_code=400, detail="company_name is required")
        resp = supabase.table("admin_crm_leads").insert(lead_payload).execute()
        return {"item": (resp.data or [None])[0]}
    except HTTPException:
        raise
    except Exception as exc:
        print(f"⚠️ Admin CRM lead create failed: {exc}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to create CRM lead")


@router.patch("/admin/crm/leads/{lead_id}")
async def admin_crm_lead_update(
    lead_id: str,
    payload: AdminCrmLeadUpdateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    admin = require_admin_user(user)
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    try:
        lead_payload = _build_lead_payload(payload.model_dump(exclude_unset=True), admin=admin, include_owner=False)
        lead_payload["owner_admin_user_id"] = admin.get("user_id")
        lead_payload["owner_admin_email"] = admin.get("email")
        if list(lead_payload.keys()) == ["updated_at", "owner_admin_user_id", "owner_admin_email"]:
            return {"status": "noop", "lead_id": lead_id}
        resp = (
            supabase.table("admin_crm_leads")
            .update(lead_payload)
            .eq("id", lead_id)
            .execute()
        )
        return {"item": (resp.data or [None])[0], "lead_id": lead_id}
    except Exception as exc:
        print(f"⚠️ Admin CRM lead update failed: {exc}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to update CRM lead")


@router.get("/admin/founder-board")
async def admin_founder_board(
    request: Request,
    user: dict = Depends(get_current_user),
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(120, ge=1, le=400),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    cache_key = f"admin_founder_board:v1:{_safe_query(q or '')}:{status or 'all'}:{limit}"
    cached = _admin_cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        query = supabase.table("admin_founder_board_cards").select("*")
        safe_q = _safe_query(q or "")
        if safe_q:
            query = query.or_(f"title.ilike.%{safe_q}%,body.ilike.%{safe_q}%,assignee_name.ilike.%{safe_q}%,author_admin_email.ilike.%{safe_q}%")
        if status:
            query = query.eq("status", status)
        resp = query.order("updated_at", desc=True).limit(limit).execute()
        items = resp.data or []
        comments_by_card: Dict[str, List[dict]] = {}
        card_ids = [str(item.get("id")) for item in items if item.get("id")]
        if card_ids:
            comment_rows = _safe_table_rows(
                "admin_founder_board_comments",
                select="id, card_id, body, author_admin_user_id, author_admin_email, created_at, updated_at",
                order_by="created_at",
                desc=False,
                limit=max(200, len(card_ids) * 12),
                filters=[("in", "card_id", card_ids)],
            )
            comment_author_ids = [
                str(row.get("author_admin_user_id"))
                for row in comment_rows
                if row.get("author_admin_user_id")
            ]
            comment_authors_by_id: Dict[str, dict] = {}
            if comment_author_ids:
                comment_author_rows = _safe_table_rows(
                    "profiles",
                    select="id, full_name, email",
                    limit=max(50, len(comment_author_ids)),
                    filters=[("in", "id", list(set(comment_author_ids)))],
                )
                comment_authors_by_id = {
                    str(row.get("id")): row
                    for row in comment_author_rows
                    if row.get("id")
                }
            for row in comment_rows:
                card_id = str(row.get("card_id") or "")
                if not card_id:
                    continue
                author = comment_authors_by_id.get(str(row.get("author_admin_user_id") or ""), {})
                row["author_name"] = author.get("full_name") or author.get("email") or row.get("author_admin_email")
                comments_by_card.setdefault(card_id, []).append(row)
        for item in items:
            card_id = str(item.get("id") or "")
            item["comments"] = comments_by_card.get(card_id, [])
            item["comments_count"] = len(item["comments"])
        return _admin_cache_set(cache_key, {"items": items, "count": len(items)}, 30)
    except Exception as exc:
        print(f"⚠️ Founder board load failed: {exc}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to load founder board")


@router.post("/admin/founder-board")
async def admin_founder_board_create(
    payload: AdminFounderBoardCardCreateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    admin = require_admin_user(user)
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    try:
        insert_payload = _build_founder_card_payload(payload.model_dump(), admin=admin, include_author=True)
        if not insert_payload.get("title"):
            raise HTTPException(status_code=400, detail="title is required")
        resp = supabase.table("admin_founder_board_cards").insert(insert_payload).execute()
        _admin_cache_store.clear()
        return {"item": (resp.data or [None])[0]}
    except HTTPException:
        raise
    except Exception as exc:
        print(f"⚠️ Founder board create failed: {exc}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to create founder board card")


@router.patch("/admin/founder-board/{card_id}")
async def admin_founder_board_update(
    card_id: str,
    payload: AdminFounderBoardCardUpdateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    admin = require_admin_user(user)
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    try:
        update_payload = _build_founder_card_payload(payload.model_dump(exclude_unset=True), admin=admin, include_author=False)
        if list(update_payload.keys()) == ["updated_at"]:
            return {"status": "noop", "card_id": card_id}
        resp = (
            supabase.table("admin_founder_board_cards")
            .update(update_payload)
            .eq("id", card_id)
            .execute()
        )
        _admin_cache_store.clear()
        return {"item": (resp.data or [None])[0], "card_id": card_id}
    except Exception as exc:
        print(f"⚠️ Founder board update failed: {exc}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to update founder board card")


@router.post("/admin/founder-board/{card_id}/comments")
async def admin_founder_board_comment_create(
    card_id: str,
    payload: AdminFounderBoardCommentCreateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    admin = require_admin_user(user)
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    try:
        card_resp = (
            supabase.table("admin_founder_board_cards")
            .select("id")
            .eq("id", card_id)
            .limit(1)
            .execute()
        )
        if not (card_resp.data or []):
            raise HTTPException(status_code=404, detail="Founder board card not found")

        insert_payload = _build_founder_comment_payload(payload.model_dump(), admin=admin)
        if not insert_payload.get("body"):
            raise HTTPException(status_code=400, detail="body is required")
        insert_payload["card_id"] = card_id
        resp = supabase.table("admin_founder_board_comments").insert(insert_payload).execute()
        _admin_cache_store.clear()
        return {"item": (resp.data or [None])[0], "card_id": card_id}
    except HTTPException:
        raise
    except Exception as exc:
        print(f"⚠️ Founder board comment create failed: {exc}")
        print(traceback.format_exc())
        if _is_missing_table_error(exc, "admin_founder_board_comments"):
            raise HTTPException(
                status_code=500,
                detail="admin_founder_board_comments table missing. Run migrations in production."
            )
        if _is_missing_table_error(exc, "admin_founder_board_cards"):
            raise HTTPException(
                status_code=500,
                detail="admin_founder_board_cards table missing. Run migrations in production."
            )
        if _is_foreign_key_error(exc, "admin_founder_board_comments", "card_id"):
            raise HTTPException(status_code=404, detail="Founder board card not found")
        raise HTTPException(status_code=500, detail=f"Failed to create founder board comment: {str(exc)[:240]}")


@router.get("/admin/jcfpm/job-roles")
async def list_job_role_profiles(
    request: Request,
    user: dict = Depends(get_current_user),
    q: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    query = supabase.table("job_role_profiles").select("*", count="exact")
    safe_q = _safe_query(q or "")
    if safe_q:
        query = query.ilike("title", f"%{safe_q}%")
    query = query.order("title", desc=False).range(offset, offset + limit - 1)
    resp = query.execute()
    return {
        "items": resp.data or [],
        "count": resp.count or 0,
        "limit": limit,
        "offset": offset,
    }


@router.post("/admin/jcfpm/job-roles")
async def create_job_role_profile(
    payload: AdminJobRoleCreateRequest,
    user: dict = Depends(get_current_user),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    insert_payload = payload.dict()
    resp = supabase.table("job_role_profiles").insert(insert_payload).execute()
    return {"item": (resp.data or [None])[0]}


@router.patch("/admin/jcfpm/job-roles/{role_id}")
async def update_job_role_profile(
    role_id: str,
    payload: AdminJobRoleUpdateRequest,
    user: dict = Depends(get_current_user),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    update_payload = {k: v for k, v in payload.dict().items() if v is not None}
    if not update_payload:
        raise HTTPException(status_code=400, detail="No fields provided")

    resp = supabase.table("job_role_profiles").update(update_payload).eq("id", role_id).execute()
    return {"item": (resp.data or [None])[0]}


@router.delete("/admin/jcfpm/job-roles/{role_id}")
async def delete_job_role_profile(
    role_id: str,
    user: dict = Depends(get_current_user),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")
    supabase.table("job_role_profiles").delete().eq("id", role_id).execute()
    return {"ok": True}


@router.get("/admin/push-subscriptions")
async def admin_push_subscriptions(
    request: Request,
    user: dict = Depends(get_current_user),
    q: str = Query("", max_length=120),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0, le=10_000),
    active_only: bool = Query(True),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    query = supabase.table("push_subscriptions").select(
        "id,user_id,endpoint,is_active,created_at,updated_at,user_agent,profiles(email,full_name)"
    )
    if active_only:
        query = query.eq("is_active", True)

    safe_q = _safe_query(q)
    if safe_q:
        try:
            profiles = supabase.table("profiles").select("id").or_(f"email.ilike.%{safe_q}%,full_name.ilike.%{safe_q}%").execute()
            user_ids = [p["id"] for p in (profiles.data or [])]
            if user_ids:
                query = query.in_("user_id", user_ids)
        except Exception as e:
            print(f"⚠️ Push subscription search failed: {e}")

    resp = query.order("updated_at", desc=True).range(offset, offset + limit - 1).execute()
    return {
        "items": resp.data or [],
        "count": resp.count or 0,
        "limit": limit,
        "offset": offset,
    }


@router.get("/admin/users/{user_id}/digest")
async def admin_user_digest(
    user_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    resp = supabase.table("profiles").select(
        "id, email, full_name, preferred_locale, preferred_country_code, daily_digest_enabled, daily_digest_push_enabled, daily_digest_time, daily_digest_timezone, daily_digest_last_sent_at"
    ).eq("id", user_id).maybe_single().execute()
    profile = resp.data if resp else None
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")

    return profile


@router.post("/admin/users/{user_id}/digest")
async def admin_user_digest_update(
    user_id: str,
    payload: AdminUserDigestUpdateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    require_admin_user(user)
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    update_data = {}
    if payload.daily_digest_enabled is not None:
        update_data["daily_digest_enabled"] = payload.daily_digest_enabled
    if payload.daily_digest_push_enabled is not None:
        update_data["daily_digest_push_enabled"] = payload.daily_digest_push_enabled
    if payload.daily_digest_time is not None:
        update_data["daily_digest_time"] = payload.daily_digest_time
    if payload.daily_digest_timezone is not None:
        update_data["daily_digest_timezone"] = payload.daily_digest_timezone

    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")

    try:
        supabase.table("profiles").update(update_data).eq("id", user_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Update failed: {exc}")

    resp = supabase.table("profiles").select(
        "id, email, full_name, preferred_locale, preferred_country_code, daily_digest_enabled, daily_digest_push_enabled, daily_digest_time, daily_digest_timezone, daily_digest_last_sent_at"
    ).eq("id", user_id).maybe_single().execute()
    profile = resp.data if resp else None
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")

    return profile

@router.get("/admin/stats")
async def admin_stats(
    request: Request,
    user: dict = Depends(get_current_user),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    cache_key = "admin_stats:v2"
    cached = _admin_cache_get(cache_key)
    if cached is not None:
        return cached

    now = datetime.now(timezone.utc)
    last_7 = (now - timedelta(days=7)).isoformat()
    last_30 = (now - timedelta(days=30)).isoformat()

    # Users
    users_total = _safe_count("profiles")
    users_7 = _safe_count("profiles", since=last_7)
    users_30 = _safe_count("profiles", since=last_30)

    # Companies
    companies_total = _safe_count("companies")
    companies_7 = _safe_count("companies", since=last_7)
    companies_30 = _safe_count("companies", since=last_30)

    # Paid conversion (company)
    try:
        paid_company = supabase.table("subscriptions").select("id", count="exact").neq("tier", "free").in_("status", ["active", "trialing"]).not_.is_("company_id", "null").execute().count or 0
    except Exception as exc:
        print(f"⚠️ Admin paid company conversion failed: {exc}")
        paid_company = 0
    company_conversion = (paid_company / companies_total * 100) if companies_total else 0

    # Paid conversion (user)
    try:
        paid_user = supabase.table("subscriptions").select("id", count="exact").neq("tier", "free").in_("status", ["active", "trialing"]).not_.is_("user_id", "null").execute().count or 0
    except Exception as exc:
        print(f"⚠️ Admin paid user conversion failed: {exc}")
        paid_user = 0
    user_conversion = (paid_user / users_total * 100) if users_total else 0

    traffic = None
    try:
        traffic_resp = supabase.rpc("get_admin_traffic_stats", {"top_limit": 8}).execute()
        traffic_data = traffic_resp.data
        if isinstance(traffic_data, list):
            traffic = traffic_data[0] if len(traffic_data) == 1 else traffic_data
        elif isinstance(traffic_data, str):
            traffic = json.loads(traffic_data)
        else:
            traffic = traffic_data
    except Exception as e:
        print(f"⚠️ Admin traffic stats failed: {e}")

    geo_breakdown = {}
    try:
        events_resp = (
            supabase.table("analytics_events")
            .select("metadata, event_type")
            .eq("event_type", "page_view")
            .gte("created_at", last_30)
            .order("created_at", desc=True)
            .limit(5000)
            .execute()
        )
        events = events_resp.data or []
        country_counts = {}
        device_counts = {}
        os_counts = {}
        browser_counts = {}
        for row in events:
            metadata = row.get("metadata") or {}
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except Exception:
                    metadata = {}

            country = (metadata.get("country_code") or metadata.get("country") or "Unknown").upper()
            device = metadata.get("device_type") or "unknown"
            os_name = metadata.get("os") or "unknown"
            browser = metadata.get("browser") or "unknown"

            country_counts[country] = country_counts.get(country, 0) + 1
            device_counts[device] = device_counts.get(device, 0) + 1
            os_counts[os_name] = os_counts.get(os_name, 0) + 1
            browser_counts[browser] = browser_counts.get(browser, 0) + 1

        def _top_items(counts: dict, limit: int = 8):
            return sorted(
                [{"label": k, "count": v} for k, v in counts.items()],
                key=lambda x: x["count"],
                reverse=True,
            )[:limit]

        geo_breakdown = {
            "top_countries": _top_items(country_counts, 8),
            "top_devices": _top_items(device_counts, 5),
            "top_os": _top_items(os_counts, 6),
            "top_browsers": _top_items(browser_counts, 6),
        }
    except Exception as e:
        print(f"⚠️ Admin geo stats failed: {e}")

    return _admin_cache_set(cache_key, {
        "users": {"total": users_total, "new_7d": users_7, "new_30d": users_30},
        "companies": {"total": companies_total, "new_7d": companies_7, "new_30d": companies_30},
        "conversion": {
            "company_paid_percent": round(company_conversion, 2),
            "user_paid_percent": round(user_conversion, 2),
            "paid_companies": paid_company,
            "paid_users": paid_user,
        },
        "traffic": {
            **(traffic or {}),
            **({"geo": geo_breakdown} if geo_breakdown else {}),
        } if traffic or geo_breakdown else None,
    }, _ADMIN_STATS_TTL_SECONDS)


@router.get("/admin/ai-quality")
async def admin_ai_quality(
    request: Request,
    user: dict = Depends(get_current_user),
    days: int = Query(30, ge=1, le=180),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    cache_key = f"admin_ai_quality:v2:{days}"
    cached = _admin_cache_get(cache_key)
    if cached is not None:
        return cached

    start_iso = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    logs = _safe_table_rows(
        "ai_generation_logs",
        select="user_id, output_valid, fallback_used, model_final, feature, created_at, tokens_in, tokens_out, estimated_cost",
        order_by="created_at",
        desc=True,
        limit=5000,
        filters=[("gte", "created_at", start_iso)],
    )
    total = len(logs)
    valid_count = sum(1 for row in logs if row.get("output_valid"))
    fallback_count = sum(1 for row in logs if row.get("fallback_used"))
    schema_pass_rate = round((valid_count / total) * 100, 2) if total else 0.0
    fallback_rate = round((fallback_count / total) * 100, 2) if total else 0.0

    feature_stats = {}
    for row in logs:
        feature = row.get("feature") or "unknown"
        agg = feature_stats.setdefault(feature, {"total": 0, "valid": 0, "fallback": 0})
        agg["total"] += 1
        if row.get("output_valid"):
            agg["valid"] += 1
        if row.get("fallback_used"):
            agg["fallback"] += 1

    for feature, agg in feature_stats.items():
        t = max(1, agg["total"])
        agg["schema_pass_rate"] = round((agg["valid"] / t) * 100, 2)
        agg["fallback_rate"] = round((agg["fallback"] / t) * 100, 2)

    token_total = sum(int(row.get("tokens_in") or 0) + int(row.get("tokens_out") or 0) for row in logs)
    avg_tokens_per_generation = round(token_total / max(1, total), 2) if total else 0.0
    total_estimated_cost = round(sum(_safe_float(row.get("estimated_cost")) for row in logs), 6)
    avg_estimated_cost_per_generation = round(total_estimated_cost / max(1, total), 6) if total else 0.0

    token_usage_trend = defaultdict(lambda: {"tokens_in": 0, "tokens_out": 0, "count": 0})
    cost_usage_trend = defaultdict(lambda: {"estimated_cost": 0.0, "count": 0})
    usage_by_model = defaultdict(lambda: {"requests": 0, "tokens_in": 0, "tokens_out": 0, "estimated_cost": 0.0})
    usage_by_user = defaultdict(lambda: {"requests": 0, "tokens_in": 0, "tokens_out": 0, "estimated_cost": 0.0})
    for row in logs:
        created = str(row.get("created_at") or "")
        day = created[:10] if len(created) >= 10 else "unknown"
        token_usage_trend[day]["tokens_in"] += int(row.get("tokens_in") or 0)
        token_usage_trend[day]["tokens_out"] += int(row.get("tokens_out") or 0)
        token_usage_trend[day]["count"] += 1
        cost_usage_trend[day]["estimated_cost"] += _safe_float(row.get("estimated_cost"))
        cost_usage_trend[day]["count"] += 1

        model_name = str(row.get("model_final") or "unknown")
        usage_by_model[model_name]["requests"] += 1
        usage_by_model[model_name]["tokens_in"] += int(row.get("tokens_in") or 0)
        usage_by_model[model_name]["tokens_out"] += int(row.get("tokens_out") or 0)
        usage_by_model[model_name]["estimated_cost"] += _safe_float(row.get("estimated_cost"))

        user_id = str(row.get("user_id") or "")
        if user_id:
            usage_by_user[user_id]["requests"] += 1
            usage_by_user[user_id]["tokens_in"] += int(row.get("tokens_in") or 0)
            usage_by_user[user_id]["tokens_out"] += int(row.get("tokens_out") or 0)
            usage_by_user[user_id]["estimated_cost"] += _safe_float(row.get("estimated_cost"))

    token_usage_trend_rows = [
        {"day": day, **vals}
        for day, vals in sorted(token_usage_trend.items(), key=lambda item: item[0], reverse=True)[:14]
    ]
    cost_usage_trend_rows = [
        {
            "day": day,
            "estimated_cost": round(vals.get("estimated_cost", 0.0), 6),
            "count": vals.get("count", 0),
        }
        for day, vals in sorted(cost_usage_trend.items(), key=lambda item: item[0], reverse=True)[:14]
    ]
    usage_by_model_rows = [
        {
            "model": model,
            "requests": vals.get("requests", 0),
            "tokens_in": vals.get("tokens_in", 0),
            "tokens_out": vals.get("tokens_out", 0),
            "estimated_cost": round(vals.get("estimated_cost", 0.0), 6),
        }
        for model, vals in sorted(
            usage_by_model.items(),
            key=lambda item: item[1].get("estimated_cost", 0.0),
            reverse=True,
        )
    ][:10]
    usage_by_user_rows = [
        {
            "user_id": user_id,
            "requests": vals.get("requests", 0),
            "tokens_in": vals.get("tokens_in", 0),
            "tokens_out": vals.get("tokens_out", 0),
            "estimated_cost": round(vals.get("estimated_cost", 0.0), 6),
        }
        for user_id, vals in sorted(
            usage_by_user.items(),
            key=lambda item: item[1].get("estimated_cost", 0.0),
            reverse=True,
        )
    ][:12]

    diffs = _safe_table_rows(
        "ai_generation_diffs",
        select="change_ratio, feature",
        order_by="created_at",
        desc=True,
        limit=4000,
        filters=[("gte", "created_at", start_iso)],
    )
    diff_volatility = round(
        (sum(_safe_float(row.get("change_ratio")) for row in diffs) / len(diffs)) * 100,
        2,
    ) if diffs else 0.0

    rec_rows = _safe_table_rows(
        "recommendation_cache",
        select="user_id, score, model_version, scoring_version, breakdown_json, computed_at",
        order_by="computed_at",
        desc=True,
        limit=6000,
        filters=[("gte", "computed_at", start_iso)],
    )
    avg_recommendation_score = round(
        sum(_safe_float(row.get("score")) for row in rec_rows) / max(1, len(rec_rows)), 2
    ) if rec_rows else 0.0

    missing_core_skill_rows = 0
    for row in rec_rows:
        breakdown = row.get("breakdown_json") or {}
        if isinstance(breakdown, dict) and (breakdown.get("missing_core_skills") or []):
            missing_core_skill_rows += 1
    missing_core_skills_share = round((missing_core_skill_rows / max(1, len(rec_rows))) * 100, 2) if rec_rows else 0.0

    score_distribution = {
        "lt_40": 0,
        "40_60": 0,
        "60_80": 0,
        "gte_80": 0,
    }
    for row in rec_rows:
        score = _safe_float(row.get("score"))
        if score < 40:
            score_distribution["lt_40"] += 1
        elif score < 60:
            score_distribution["40_60"] += 1
        elif score < 80:
            score_distribution["60_80"] += 1
        else:
            score_distribution["gte_80"] += 1

    interactions = _safe_table_rows(
        "job_interactions",
        select="user_id, event_type, created_at",
        limit=6000,
        filters=[
            ("gte", "created_at", start_iso),
            ("in", "event_type", ["impression", "open_detail", "apply_click"]),
        ],
    )
    apply_users = {row.get("user_id") for row in interactions if row.get("event_type") == "apply_click" and row.get("user_id")}
    active_users = {row.get("user_id") for row in interactions if row.get("event_type") in ["impression", "open_detail"] and row.get("user_id")}
    ai_users = {row.get("user_id") for row in logs if row.get("user_id")}

    ai_apply_rate = round((len(apply_users & ai_users) / max(1, len(ai_users))) * 100, 2) if ai_users else 0.0
    baseline_apply_rate = round((len(apply_users) / max(1, len(active_users))) * 100, 2) if active_users else 0.0
    conversion_impact = round(ai_apply_rate - baseline_apply_rate, 2)

    try:
        exposures_resp = (
            supabase.table("recommendation_exposures")
            .select("request_id, user_id, job_id, model_version, scoring_version, predicted_action_probability, ranking_strategy, is_new_job, is_long_tail_company, shown_at")
            .gte("shown_at", start_iso)
            .order("shown_at", desc=True)
            .limit(12000)
            .execute()
        )
        exposure_rows = exposures_resp.data or []
    except Exception:
        exposure_rows = []

    try:
        feedback_resp = (
            supabase.table("recommendation_feedback_events")
            .select("request_id, user_id, job_id, signal_type, created_at")
            .gte("created_at", start_iso)
            .eq("signal_type", "apply_click")
            .limit(12000)
            .execute()
        )
        feedback_rows = feedback_resp.data or []
    except Exception:
        feedback_rows = []
    apply_keys_with_request = {
        (
            str(row.get("request_id") or ""),
            str(row.get("user_id") or ""),
            str(row.get("job_id") or ""),
        )
        for row in feedback_rows
        if row.get("user_id") and row.get("job_id")
    }
    apply_keys_without_request = {
        (str(row.get("user_id") or ""), str(row.get("job_id") or ""))
        for row in feedback_rows
        if row.get("user_id") and row.get("job_id")
    }

    ctr_model_counts = defaultdict(lambda: {"exposures": 0, "applies": 0, "users": set()})
    ctr_scoring_counts = defaultdict(lambda: {"exposures": 0, "applies": 0, "users": set()})
    prediction_sum = 0.0
    prediction_count = 0
    strategy_counts = defaultdict(int)
    new_job_exposures = 0
    long_tail_exposures = 0

    for row in exposure_rows:
        req_id = str(row.get("request_id") or "")
        uid = str(row.get("user_id") or "")
        job_id = str(row.get("job_id") or "")
        if not uid or not job_id:
            continue
        is_apply = (
            (req_id, uid, job_id) in apply_keys_with_request
            or (uid, job_id) in apply_keys_without_request
        )

        model_version = row.get("model_version") or "unknown"
        scoring_version = row.get("scoring_version") or "unknown"
        ctr_model_counts[model_version]["exposures"] += 1
        ctr_scoring_counts[scoring_version]["exposures"] += 1
        if is_apply:
            ctr_model_counts[model_version]["applies"] += 1
            ctr_scoring_counts[scoring_version]["applies"] += 1
        ctr_model_counts[model_version]["users"].add(uid)
        ctr_scoring_counts[scoring_version]["users"].add(uid)

        pred = row.get("predicted_action_probability")
        if pred is not None:
            prediction_sum += _safe_float(pred)
            prediction_count += 1
        strategy = str(row.get("ranking_strategy") or "core")
        strategy_counts[strategy] += 1
        if bool(row.get("is_new_job")):
            new_job_exposures += 1
        if bool(row.get("is_long_tail_company")):
            long_tail_exposures += 1

    ctr_by_model_version = []
    for version, agg in ctr_model_counts.items():
        ctr = round((agg["applies"] / max(1, agg["exposures"])) * 100, 2)
        ctr_by_model_version.append(
            {
                "model_version": version,
                "ctr_apply": ctr,
                "exposures": agg["exposures"],
                "applies": agg["applies"],
                "users": len(agg["users"]),
            }
        )
    ctr_by_model_version.sort(key=lambda row: row.get("ctr_apply", 0), reverse=True)

    ctr_by_scoring_version = []
    for version, agg in ctr_scoring_counts.items():
        ctr = round((agg["applies"] / max(1, agg["exposures"])) * 100, 2)
        ctr_by_scoring_version.append(
            {
                "scoring_version": version,
                "ctr_apply": ctr,
                "exposures": agg["exposures"],
                "applies": agg["applies"],
                "users": len(agg["users"]),
            }
        )
    ctr_by_scoring_version.sort(key=lambda row: row.get("ctr_apply", 0), reverse=True)

    try:
        eval_rows = (
            supabase.table("model_offline_evaluations")
            .select("model_key, model_version, scoring_version, sample_size, auc, log_loss, precision_at_5, precision_at_10, created_at, notes")
            .eq("model_key", "job_apply_probability")
            .order("created_at", desc=True)
            .limit(20)
            .execute()
            .data
            or []
        )
    except Exception:
        eval_rows = []
    latest_eval_overall = next((row for row in eval_rows if not row.get("scoring_version")), None)

    model_registry = _safe_table_rows(
        "model_registry",
        select="subsystem, feature, version, model_name, is_primary, is_fallback, is_active, created_at",
        order_by="created_at",
        desc=True,
        limit=50,
        filters=[("eq", "is_active", True)],
    )
    release_flags = _safe_table_rows(
        "release_flags",
        select="flag_key, subsystem, is_enabled, rollout_percent, variant, updated_at",
        order_by="updated_at",
        desc=True,
        limit=100,
    )

    return _admin_cache_set(cache_key, {
        "window_days": days,
        "summary": {
            "total_generations": total,
            "ai_unique_users": len(ai_users),
            "total_tokens": token_total,
            "total_estimated_cost": total_estimated_cost,
            "avg_estimated_cost_per_generation": avg_estimated_cost_per_generation,
            "schema_pass_rate": schema_pass_rate,
            "fallback_rate": fallback_rate,
            "diff_volatility": diff_volatility,
            "avg_tokens_per_generation": avg_tokens_per_generation,
            "avg_recommendation_score": avg_recommendation_score,
            "missing_core_skills_share": missing_core_skills_share,
            "conversion_impact_on_applications": conversion_impact,
            "ai_apply_rate": ai_apply_rate,
            "baseline_apply_rate": baseline_apply_rate,
            "recommendation_exposures": len(exposure_rows),
            "recommendation_applies": len(feedback_rows),
            "predicted_action_probability_avg": round((prediction_sum / max(1, prediction_count)) * 100, 2) if prediction_count else 0.0,
            "exploration_share": round((strategy_counts.get("exploration", 0) / max(1, len(exposure_rows))) * 100, 2) if exposure_rows else 0.0,
            "new_job_share": round((new_job_exposures / max(1, len(exposure_rows))) * 100, 2) if exposure_rows else 0.0,
            "long_tail_share": round((long_tail_exposures / max(1, len(exposure_rows))) * 100, 2) if exposure_rows else 0.0,
        },
        "features": feature_stats,
        "token_usage_trend": token_usage_trend_rows,
        "cost_usage_trend": cost_usage_trend_rows,
        "usage_by_model": usage_by_model_rows,
        "usage_by_user": usage_by_user_rows,
        "score_distribution": score_distribution,
        "ctr_by_model_version": ctr_by_model_version,
        "ctr_by_scoring_version": ctr_by_scoring_version,
        "offline_eval_latest": latest_eval_overall,
        "offline_eval_rows": eval_rows,
        "selection_strategy_counts": dict(strategy_counts),
        "active_models": model_registry,
        "release_flags": release_flags,
    }, _ADMIN_AI_QUALITY_TTL_SECONDS)


@router.post("/admin/ai-quality/evaluate")
async def admin_ai_quality_evaluate(
    request: Request,
    user: dict = Depends(get_current_user),
    days: int = Query(30, ge=7, le=180),
):
    require_admin_user(user)
    result = run_offline_recommendation_evaluation(window_days=days)
    return {"status": "ok", "window_days": days, "result": result}

@router.get("/admin/notifications")
async def admin_notifications(
    request: Request,
    user: dict = Depends(get_current_user),
    days_ahead: int = Query(7, ge=1, le=30),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    cache_key = f"admin_notifications:v1:{days_ahead}"
    cached = _admin_cache_get(cache_key)
    if cached is not None:
        return cached

    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=days_ahead)

    trialing_rows = _safe_table_rows(
        "subscriptions",
        select="id, company_id, user_id, tier, status, current_period_end",
        filters=[("eq", "status", "trialing")],
    )

    company_ids = [row.get("company_id") for row in trialing_rows if row.get("company_id")]
    user_ids = [row.get("user_id") for row in trialing_rows if row.get("user_id")]

    companies_by_id: Dict[str, dict] = {}
    if company_ids:
        company_rows = _safe_table_rows(
            "companies",
            select="id, name, industry",
            limit=len(company_ids),
            filters=[("in", "id", company_ids)],
        )
        companies_by_id = {str(row.get("id")): row for row in company_rows if row.get("id")}

    profiles_by_id: Dict[str, dict] = {}
    if user_ids:
        profile_rows = _safe_table_rows(
            "profiles",
            select="id, email, full_name",
            limit=len(user_ids),
            filters=[("in", "id", user_ids)],
        )
        profiles_by_id = {str(row.get("id")): row for row in profile_rows if row.get("id")}

    items = []
    for sub in trialing_rows:
        end_raw = sub.get("current_period_end")
        end_dt = _parse_iso_datetime(end_raw)
        if not end_dt:
            continue

        if end_dt < now:
            severity = "expired"
        elif end_dt.date() == now.date():
            severity = "today"
        elif end_dt <= horizon:
            severity = "soon"
        else:
            continue

        company = companies_by_id.get(str(sub.get("company_id") or ""), {})
        profile = profiles_by_id.get(str(sub.get("user_id") or ""), {})
        items.append({
            "subscription_id": sub.get("id"),
            "company_id": sub.get("company_id"),
            "user_id": sub.get("user_id"),
            "company_name": company.get("name"),
            "company_industry": company.get("industry"),
            "user_email": profile.get("email"),
            "user_name": profile.get("full_name"),
            "tier": sub.get("tier"),
            "status": sub.get("status"),
            "current_period_end": end_raw,
            "severity": severity,
        })

    items.sort(key=lambda x: x.get("current_period_end") or "")
    return _admin_cache_set(cache_key, {"items": items, "count": len(items)}, _ADMIN_NOTIFICATIONS_TTL_SECONDS)

@router.get("/admin/subscriptions/{subscription_id}/audit")
async def admin_subscription_audit(
    subscription_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")
    try:
        resp = supabase.table("admin_subscription_audit").select("*").eq("subscription_id", subscription_id).order("created_at", desc=True).limit(limit).execute()
        return {"items": resp.data or [], "audit_available": True}
    except Exception as e:
        if _is_missing_admin_audit_table_error(e):
            _log_audit_table_missing_once(e)
            return {"items": [], "audit_available": False}
        raise

@router.post("/admin/subscriptions/update")
async def update_subscription(
    payload: AdminSubscriptionUpdateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    try:
        admin = require_admin_user(user)
        if not verify_csrf_token_header(request, user):
            raise HTTPException(status_code=403, detail="CSRF validation failed")
        if not supabase:
            raise HTTPException(status_code=500, detail="Database unavailable")

        target_col = None
        target_id = None
        if payload.target_type and payload.target_id:
            target_col = "company_id" if payload.target_type == "company" else "user_id"
            target_id = payload.target_id

        sub = None
        if payload.subscription_id:
            sub_resp = supabase.table("subscriptions").select("*").eq("id", payload.subscription_id).execute()
            sub = sub_resp.data[0] if sub_resp.data else None
        elif target_col and target_id:
            sub_resp = supabase.table("subscriptions").select("*").eq(target_col, target_id).execute()
            sub = sub_resp.data[0] if sub_resp.data else None
        else:
            raise HTTPException(status_code=400, detail="subscription_id or target_type/target_id required")

        before_snapshot = sub.copy() if sub else None

        update_data = {}
        if payload.tier is not None:
            update_data["tier"] = payload.tier
        if payload.status is not None:
            update_data["status"] = payload.status
        if payload.current_period_start is not None:
            update_data["current_period_start"] = payload.current_period_start
        if payload.current_period_end is not None:
            update_data["current_period_end"] = payload.current_period_end
        if payload.cancel_at_period_end is not None:
            update_data["cancel_at_period_end"] = payload.cancel_at_period_end

        # Trial controls
        if payload.set_trial_days or payload.set_trial_until:
            start_dt = datetime.now(timezone.utc)
            if payload.set_trial_until:
                end_dt = _parse_iso_datetime(payload.set_trial_until)
                if not end_dt:
                    raise HTTPException(status_code=400, detail="Invalid set_trial_until format")
            else:
                end_dt = start_dt + timedelta(days=payload.set_trial_days or 0)

            update_data["current_period_start"] = start_dt.isoformat()
            update_data["current_period_end"] = end_dt.isoformat()
            update_data["status"] = "trialing"
            if "tier" not in update_data:
                update_data["tier"] = "trial"

        if payload.status == "canceled":
            update_data["canceled_at"] = now_iso()

        update_data["updated_at"] = now_iso()

        if sub:
            update_data = _ensure_active_subscription_fields(update_data, existing_sub=sub, target_id=target_id)
            update_payload = dict(update_data)
            try:
                supabase.table("subscriptions").update(update_payload).eq("id", sub["id"]).execute()
            except Exception as update_error:
                update_msg = str(update_error)
                fallback_payload = _strip_legacy_unsafe_fields(update_payload, update_msg)
                if fallback_payload != update_payload:
                    print(f"⚠️ Retrying admin subscription update with legacy-safe payload (subscription_id={sub['id']})")
                    if fallback_payload:
                        supabase.table("subscriptions").update(fallback_payload).eq("id", sub["id"]).execute()
                else:
                    raise

            updated_resp = supabase.table("subscriptions").select("*").eq("id", sub["id"]).execute()
            updated_sub = updated_resp.data[0] if updated_resp.data else None
            target_type, target_id_value = _target_from_subscription(updated_sub or sub)
            try:
                supabase.table("admin_subscription_audit").insert({
                    "subscription_id": sub["id"],
                    "target_type": target_type,
                    "target_id": target_id_value,
                    "action": "update",
                    "admin_user_id": admin.get("user_id"),
                    "admin_email": admin.get("email") or user.get("email"),
                    "before": before_snapshot,
                    "after": updated_sub,
                }).execute()
            except Exception as e:
                if _is_missing_admin_audit_table_error(e):
                    _log_audit_table_missing_once(e)
                else:
                    print(f"⚠️ Failed to write admin audit log: {e}")
            return {"status": "updated", "subscription_id": sub["id"]}

        # Create new subscription if missing
        if not target_col or not target_id:
            raise HTTPException(status_code=400, detail="Cannot create without target_type/target_id")

        create_data = {
            target_col: target_id,
            "tier": update_data.get("tier", "free"),
            "status": update_data.get("status", "inactive"),
            "current_period_start": update_data.get("current_period_start"),
            "current_period_end": update_data.get("current_period_end"),
            "cancel_at_period_end": update_data.get("cancel_at_period_end", False),
            "updated_at": now_iso(),
        }
        create_data = _ensure_active_subscription_fields(create_data, existing_sub=None, target_id=target_id)

        try:
            insert_resp = supabase.table("subscriptions").insert(create_data).execute()
        except Exception as insert_error:
            insert_msg = str(insert_error)
            fallback_create = _strip_legacy_unsafe_fields(create_data, insert_msg)
            if fallback_create != create_data:
                print(f"⚠️ Retrying admin subscription create with legacy-safe payload ({target_col}={target_id})")
                insert_resp = supabase.table("subscriptions").insert(fallback_create).execute()
            else:
                raise

        new_sub = insert_resp.data[0] if insert_resp.data else None
        try:
            target_type, target_id_value = _target_from_subscription(new_sub)
            supabase.table("admin_subscription_audit").insert({
                "subscription_id": new_sub.get("id") if new_sub else None,
                "target_type": target_type,
                "target_id": target_id_value,
                "action": "create",
                "admin_user_id": admin.get("user_id"),
                "admin_email": admin.get("email") or user.get("email"),
                "before": None,
                "after": new_sub,
            }).execute()
        except Exception as e:
            if _is_missing_admin_audit_table_error(e):
                _log_audit_table_missing_once(e)
            else:
                print(f"⚠️ Failed to write admin audit log: {e}")
        return {"status": "created", "subscription_id": new_sub.get("id") if new_sub else None}
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        print(f"❌ Admin subscription update failed: {msg}")
        print(traceback.format_exc())
        if "permission denied" in msg or "RLS" in msg:
            raise HTTPException(status_code=500, detail="Admin update blocked by RLS. Configure SUPABASE_SERVICE_KEY on backend.")
        if "check_active_subscription_complete" in msg:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Subscription violates check_active_subscription_complete. "
                    "Active/trialing paid plans require complete billing fields "
                    "(stripe_customer_id, stripe_subscription_id, period dates)."
                ),
            )
        if "invalid input value for enum" in msg or "violates check constraint" in msg:
            raise HTTPException(status_code=400, detail=f"Invalid tier/status for current DB schema: {msg}")
        if "column" in msg and "does not exist" in msg:
            raise HTTPException(status_code=500, detail=f"Subscriptions schema mismatch: {msg}")
        raise HTTPException(status_code=500, detail=f"Admin subscription update failed: {msg}")
