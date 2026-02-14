from fastapi import APIRouter, Request, Depends, HTTPException, Query
from datetime import datetime, timezone, timedelta
import json
from typing import Optional, List
import re

from ..core.security import get_current_user, verify_csrf_token_header
from ..core.database import supabase
from ..models.requests import AdminSubscriptionUpdateRequest
from ..utils.helpers import now_iso

router = APIRouter()

UUID_RE = re.compile(r"^[0-9a-fA-F-]{8,36}$")

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
    return re.sub(r"[^a-zA-Z0-9@._\\- ]+", " ", value).strip()


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default

def require_admin_user(user: dict) -> dict:
    if not supabase:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    user_id = user.get("id") or user.get("auth_id")
    email = user.get("email")

    if user_id:
        try:
            resp = supabase.table("admin_users").select("*").eq("user_id", user_id).eq("is_active", True).execute()
            if resp.data:
                return resp.data[0]
        except Exception as e:
            msg = str(e)
            print(f"⚠️ Admin lookup by user_id failed: {msg}")
            if "permission denied" in msg or "RLS" in msg:
                raise HTTPException(status_code=500, detail="Admin access blocked by RLS. Ensure SUPABASE_SERVICE_KEY is set.")
            if "does not exist" in msg:
                raise HTTPException(status_code=500, detail="admin_users table missing. Run migrations in production.")

    if email:
        try:
            resp = supabase.table("admin_users").select("*").eq("email", email).eq("is_active", True).execute()
            if resp.data:
                return resp.data[0]
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

    query = supabase.table("subscriptions").select(
        "*, companies!fk_company(name, industry), profiles(email, full_name)",
        count="exact"
    )

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
            companies = supabase.table("companies").select("id").ilike("name", f"%{safe_q}%").execute()
            company_ids = [c["id"] for c in (companies.data or [])]
            if company_ids:
                or_filters.append(f"company_id.in.({','.join(company_ids)})")
        except Exception as e:
            print(f"⚠️ Company search failed: {e}")

        # Profile email/full_name lookup
        try:
            profiles = supabase.table("profiles").select("id").or_(f"email.ilike.%{safe_q}%,full_name.ilike.%{safe_q}%").execute()
            user_ids = [p["id"] for p in (profiles.data or [])]
            if user_ids:
                or_filters.append(f"user_id.in.({','.join(user_ids)})")
        except Exception as e:
            print(f"⚠️ Profile search failed: {e}")

        if or_filters:
            query = query.or_(",".join(or_filters))

    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    resp = query.execute()
    data = resp.data or []

    if kind in ["company", "user"]:
        if kind == "company":
            data = [s for s in data if s.get("company_id")]
        else:
            data = [s for s in data if s.get("user_id")]

    return {
        "items": data,
        "count": resp.count or 0,
        "limit": limit,
        "offset": offset,
    }

@router.get("/admin/search")
async def admin_search(
    request: Request,
    user: dict = Depends(get_current_user),
    query: str = Query(..., min_length=2),
    kind: str = Query("company"),
    limit: int = Query(10, ge=1, le=25),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")
    safe_q = _safe_query(query)
    if not safe_q:
        return {"items": []}

    if kind == "user":
        resp = supabase.table("profiles").select("id, email, full_name, role").or_(f"email.ilike.%{safe_q}%,full_name.ilike.%{safe_q}%").limit(limit).execute()
        items = [
            {
                "id": r.get("id"),
                "label": r.get("full_name") or r.get("email") or r.get("id"),
                "secondary": r.get("email"),
                "kind": "user",
            }
            for r in (resp.data or [])
        ]
        return {"items": items}

    resp = supabase.table("companies").select("id, name, industry").ilike("name", f"%{safe_q}%").limit(limit).execute()
    items = [
        {
            "id": r.get("id"),
            "label": r.get("name") or r.get("id"),
            "secondary": r.get("industry"),
            "kind": "company",
        }
        for r in (resp.data or [])
    ]
    return {"items": items}

@router.get("/admin/stats")
async def admin_stats(
    request: Request,
    user: dict = Depends(get_current_user),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    now = datetime.now(timezone.utc)
    last_7 = (now - timedelta(days=7)).isoformat()
    last_30 = (now - timedelta(days=30)).isoformat()

    # Users
    users_total = supabase.table("profiles").select("id", count="exact").execute().count or 0
    users_7 = supabase.table("profiles").select("id", count="exact").gte("created_at", last_7).execute().count or 0
    users_30 = supabase.table("profiles").select("id", count="exact").gte("created_at", last_30).execute().count or 0

    # Companies
    companies_total = supabase.table("companies").select("id", count="exact").execute().count or 0
    companies_7 = supabase.table("companies").select("id", count="exact").gte("created_at", last_7).execute().count or 0
    companies_30 = supabase.table("companies").select("id", count="exact").gte("created_at", last_30).execute().count or 0

    # Paid conversion (company)
    paid_company = supabase.table("subscriptions").select("id", count="exact").neq("tier", "free").in_("status", ["active", "trialing"]).not_.is_("company_id", "null").execute().count or 0
    company_conversion = (paid_company / companies_total * 100) if companies_total else 0

    # Paid conversion (user)
    paid_user = supabase.table("subscriptions").select("id", count="exact").neq("tier", "free").in_("status", ["active", "trialing"]).not_.is_("user_id", "null").execute().count or 0
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

    return {
        "users": {"total": users_total, "new_7d": users_7, "new_30d": users_30},
        "companies": {"total": companies_total, "new_7d": companies_7, "new_30d": companies_30},
        "conversion": {
            "company_paid_percent": round(company_conversion, 2),
            "user_paid_percent": round(user_conversion, 2),
            "paid_companies": paid_company,
            "paid_users": paid_user,
        },
        "traffic": traffic,
    }


@router.get("/admin/ai-quality")
async def admin_ai_quality(
    request: Request,
    user: dict = Depends(get_current_user),
    days: int = Query(30, ge=1, le=180),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    start_iso = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    logs_resp = (
        supabase.table("ai_generation_logs")
        .select("user_id, output_valid, fallback_used, model_final, feature, created_at")
        .gte("created_at", start_iso)
        .order("created_at", desc=True)
        .limit(8000)
        .execute()
    )
    logs = logs_resp.data or []
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

    diffs_resp = (
        supabase.table("ai_generation_diffs")
        .select("change_ratio, feature")
        .gte("created_at", start_iso)
        .order("created_at", desc=True)
        .limit(8000)
        .execute()
    )
    diffs = diffs_resp.data or []
    diff_volatility = round(
        (sum(_safe_float(row.get("change_ratio")) for row in diffs) / len(diffs)) * 100,
        2,
    ) if diffs else 0.0

    interactions_resp = (
        supabase.table("job_interactions")
        .select("user_id, event_type, created_at")
        .gte("created_at", start_iso)
        .in_("event_type", ["impression", "open_detail", "apply_click"])
        .limit(10000)
        .execute()
    )
    interactions = interactions_resp.data or []
    apply_users = {row.get("user_id") for row in interactions if row.get("event_type") == "apply_click" and row.get("user_id")}
    active_users = {row.get("user_id") for row in interactions if row.get("event_type") in ["impression", "open_detail"] and row.get("user_id")}
    ai_users = {row.get("user_id") for row in logs if row.get("user_id")}

    ai_apply_rate = round((len(apply_users & ai_users) / max(1, len(ai_users))) * 100, 2) if ai_users else 0.0
    baseline_apply_rate = round((len(apply_users) / max(1, len(active_users))) * 100, 2) if active_users else 0.0
    conversion_impact = round(ai_apply_rate - baseline_apply_rate, 2)

    model_registry = (
        supabase.table("model_registry")
        .select("subsystem, feature, version, model_name, is_primary, is_fallback, is_active, created_at")
        .eq("is_active", True)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
        .data
        or []
    )
    release_flags = (
        supabase.table("release_flags")
        .select("flag_key, subsystem, is_enabled, rollout_percent, variant, updated_at")
        .order("updated_at", desc=True)
        .limit(100)
        .execute()
        .data
        or []
    )

    return {
        "window_days": days,
        "summary": {
            "total_generations": total,
            "schema_pass_rate": schema_pass_rate,
            "fallback_rate": fallback_rate,
            "diff_volatility": diff_volatility,
            "conversion_impact_on_applications": conversion_impact,
            "ai_apply_rate": ai_apply_rate,
            "baseline_apply_rate": baseline_apply_rate,
        },
        "features": feature_stats,
        "active_models": model_registry,
        "release_flags": release_flags,
    }

@router.get("/admin/notifications")
async def admin_notifications(
    request: Request,
    user: dict = Depends(get_current_user),
    days_ahead: int = Query(7, ge=1, le=30),
):
    require_admin_user(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")

    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=days_ahead)

    resp = supabase.table("subscriptions").select(
        "id, company_id, user_id, tier, status, current_period_end, companies!fk_company(name, industry), profiles(email, full_name)"
    ).eq("status", "trialing").execute()

    items = []
    for sub in resp.data or []:
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

        items.append({
            "subscription_id": sub.get("id"),
            "company_id": sub.get("company_id"),
            "user_id": sub.get("user_id"),
            "company_name": (sub.get("companies") or {}).get("name"),
            "company_industry": (sub.get("companies") or {}).get("industry"),
            "user_email": (sub.get("profiles") or {}).get("email"),
            "user_name": (sub.get("profiles") or {}).get("full_name"),
            "tier": sub.get("tier"),
            "status": sub.get("status"),
            "current_period_end": end_raw,
            "severity": severity,
        })

    items.sort(key=lambda x: x.get("current_period_end") or "")
    return {"items": items, "count": len(items)}

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
    resp = supabase.table("admin_subscription_audit").select("*").eq("subscription_id", subscription_id).order("created_at", desc=True).limit(limit).execute()
    return {"items": resp.data or []}

@router.post("/admin/subscriptions/update")
async def update_subscription(
    payload: AdminSubscriptionUpdateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
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
            update_data["tier"] = "business"

    if payload.status == "canceled":
        update_data["canceled_at"] = now_iso()

    update_data["updated_at"] = now_iso()

    if sub:
        supabase.table("subscriptions").update(update_data).eq("id", sub["id"]).execute()
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

    insert_resp = supabase.table("subscriptions").insert(create_data).execute()
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
        print(f"⚠️ Failed to write admin audit log: {e}")
    return {"status": "created", "subscription_id": new_sub.get("id") if new_sub else None}
