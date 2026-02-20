from fastapi import APIRouter, Request, Depends, HTTPException, Query
from datetime import datetime, timezone, timedelta
import json
from collections import defaultdict
from typing import Optional, List
import re
import traceback

from ..core.security import get_current_user, verify_csrf_token_header
from ..core.database import supabase
from ..matching_engine.evaluation import run_offline_recommendation_evaluation
from ..models.requests import AdminSubscriptionUpdateRequest, AdminUserDigestUpdateRequest
from ..utils.helpers import now_iso

router = APIRouter()

UUID_RE = re.compile(r"^[0-9a-fA-F-]{8,36}$")
_audit_table_missing_logged = False

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

    geo_breakdown = {}
    try:
        events_resp = (
            supabase.table("analytics_events")
            .select("metadata, event_type, created_at")
            .gte("created_at", last_30)
            .execute()
        )
        events = events_resp.data or []
        country_counts = {}
        device_counts = {}
        os_counts = {}
        browser_counts = {}
        for row in events:
            if row.get("event_type") != "page_view":
                continue
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

    return {
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
        .select("user_id, output_valid, fallback_used, model_final, feature, created_at, tokens_in, tokens_out, estimated_cost")
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

    rec_resp = (
        supabase.table("recommendation_cache")
        .select("user_id, score, model_version, scoring_version, breakdown_json, computed_at")
        .gte("computed_at", start_iso)
        .order("computed_at", desc=True)
        .limit(10000)
        .execute()
    )
    rec_rows = rec_resp.data or []
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

    try:
        exposures_resp = (
            supabase.table("recommendation_exposures")
            .select("request_id, user_id, job_id, model_version, scoring_version, predicted_action_probability, ranking_strategy, is_new_job, is_long_tail_company, shown_at")
            .gte("shown_at", start_iso)
            .order("shown_at", desc=True)
            .limit(30000)
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
            .limit(30000)
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
    }


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
                update_data["tier"] = "business"

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
