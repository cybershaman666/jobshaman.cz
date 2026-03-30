from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone

from ..core.database import supabase

_SUBSCRIPTION_CACHE_TTL_SECONDS = 30
_SUBSCRIPTION_CACHE: dict[tuple[str, str], tuple[datetime, dict | None]] = {}


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


def _subscription_priority(sub: dict | None) -> tuple[int, int, datetime]:
    if not sub:
        return (0, 0, datetime.min.replace(tzinfo=timezone.utc))

    tier = str(sub.get("tier") or "").lower()
    tier_weight = {
        "enterprise": 6,
        "professional": 5,
        "growth": 4,
        "starter": 3,
        "premium": 2,
        "trial": 1,
        "free": 0,
    }.get(tier, 0)

    updated_at = (
        parse_iso_datetime(str(sub.get("updated_at") or ""))
        or parse_iso_datetime(str(sub.get("current_period_end") or ""))
        or datetime.min.replace(tzinfo=timezone.utc)
    )
    return (1 if is_active_subscription(sub) else 0, tier_weight, updated_at)


def _pick_best_subscription(rows: list[dict] | None) -> dict | None:
    candidates = [row for row in (rows or []) if isinstance(row, dict)]
    if not candidates:
        return None
    return max(candidates, key=_subscription_priority)


def fetch_latest_subscription_by(column: str, value: str) -> dict | None:
    if not supabase or not value:
        return None
    key = (str(column or ""), str(value or ""))
    now = datetime.now(timezone.utc)
    cached = _SUBSCRIPTION_CACHE.get(key)
    if cached and cached[0] > now:
        return deepcopy(cached[1]) if cached[1] else None
    if cached:
        _SUBSCRIPTION_CACHE.pop(key, None)
    try:
        resp = (
            supabase
            .table("subscriptions")
            .select("*")
            .eq(column, value)
            .order("updated_at", desc=True)
            .limit(25)
            .execute()
        )
        value_out = _pick_best_subscription(resp.data if resp else None)
        _SUBSCRIPTION_CACHE[key] = (now + timedelta(seconds=_SUBSCRIPTION_CACHE_TTL_SECONDS), deepcopy(value_out) if value_out else None)
        return deepcopy(value_out) if value_out else None
    except Exception:
        return None


def invalidate_subscription_cache(column: str | None = None, value: str | None = None) -> None:
    if column is not None and value is not None:
        _SUBSCRIPTION_CACHE.pop((str(column), str(value)), None)
        return
    _SUBSCRIPTION_CACHE.clear()


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
