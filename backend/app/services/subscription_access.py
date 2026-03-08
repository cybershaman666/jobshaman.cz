from __future__ import annotations

from datetime import datetime, timezone

from ..core.database import supabase


def parse_iso_datetime(value: str) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def is_active_subscription(sub: dict | None) -> bool:
    if not sub:
        return False
    status = str(sub.get("status") or "").lower()
    if status not in {"active", "trialing"}:
        return False

    expires_at = parse_iso_datetime(str(sub.get("current_period_end") or ""))
    if expires_at:
        return datetime.now(timezone.utc) <= expires_at
    return True


def fetch_latest_subscription_by(column: str, value: str) -> dict | None:
    if not supabase or not value:
        return None
    try:
        resp = (
            supabase
            .table("subscriptions")
            .select("*")
            .eq(column, value)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None
    except Exception:
        return None


def user_has_allowed_subscription(user: dict, allowed_tiers: set[str]) -> bool:
    user_tier = str(user.get("subscription_tier") or "").lower()
    if user.get("is_subscription_active") and user_tier in allowed_tiers:
        return True

    user_id = user.get("id") or user.get("auth_id")
    if user_id:
        user_sub = fetch_latest_subscription_by("user_id", user_id)
        if user_sub and is_active_subscription(user_sub) and str(user_sub.get("tier") or "").lower() in allowed_tiers:
            return True

    for company_id in (user.get("authorized_ids") or []):
        if company_id == user_id:
            continue
        company_sub = fetch_latest_subscription_by("company_id", company_id)
        if company_sub and is_active_subscription(company_sub) and str(company_sub.get("tier") or "").lower() in allowed_tiers:
            return True

    return False
