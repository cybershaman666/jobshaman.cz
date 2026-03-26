from __future__ import annotations

import json
from typing import Any

from ..core.config import APP_PUBLIC_URL
from ..core.database import supabase
from ..services.email import send_signal_boost_interest_email
from ..services.push_notifications import is_push_configured, send_push


def _normalize_locale(value: Any, fallback: str = "en") -> str:
    code = str(value or fallback).split("-")[0].strip().lower()
    if code == "at":
        return "de"
    return code if code in {"cs", "sk", "de", "pl", "en"} else fallback


def _safe_str(value: Any) -> str:
    return str(value or "").strip()


def _build_role_url(locale: str, job_id: str) -> str:
    normalized_locale = _normalize_locale(locale, "en")
    return f"{APP_PUBLIC_URL.rstrip('/')}/{normalized_locale}/jobs/{job_id}"


def _pref_enabled(value: Any, *, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    normalized = str(value).strip().lower()
    if normalized in {"0", "false", "off", "no"}:
        return False
    if normalized in {"1", "true", "on", "yes"}:
        return True
    return default


def _push_copy(locale: str) -> dict[str, str]:
    normalized = _normalize_locale(locale, "en")
    mapping = {
        "cs": {
            "title": "JobShaman – silnější zájem o váš Signal Boost",
            "body": "Recruiter klikl dál. To už není jen zobrazení, ale skutečný follow-up.",
        },
        "sk": {
            "title": "JobShaman – silnejší záujem o váš Signal Boost",
            "body": "Recruiter klikol ďalej. To už nie je len zobrazenie, ale skutočný follow-up.",
        },
        "de": {
            "title": "JobShaman – stärkeres Interesse an Ihrem Signal Boost",
            "body": "Ein Recruiter hat weitergeklickt. Das ist mehr als nur ein Aufruf.",
        },
        "pl": {
            "title": "JobShaman – mocniejsze zainteresowanie Twoim Signal Boost",
            "body": "Rekruter kliknął dalej. To więcej niż samo wyświetlenie.",
        },
        "en": {
            "title": "JobShaman – stronger interest in your Signal Boost",
            "body": "A recruiter clicked further. That is more than just a view.",
        },
    }
    return mapping.get(normalized, mapping["en"])


def notify_candidate_of_signal_boost_interest(output_row: dict[str, Any] | None) -> dict[str, bool]:
    row = output_row or {}
    if not row or not supabase:
        return {"email": False, "push": False}

    candidate_id = _safe_str(row.get("candidate_id"))
    if not candidate_id:
        return {"email": False, "push": False}

    analytics = row.get("analytics") if isinstance(row.get("analytics"), dict) else {}
    recruiter_cta_clicks = int(analytics.get("recruiter_cta_click") or 0)
    original_listing_opens = int(analytics.get("open_original_listing") or 0)
    total_strong_actions = recruiter_cta_clicks + original_listing_opens
    if total_strong_actions != 1:
        return {"email": False, "push": False}

    try:
        profile_resp = (
            supabase.table("profiles")
            .select("id,email,full_name,preferred_locale,daily_digest_enabled,daily_digest_push_enabled")
            .eq("id", candidate_id)
            .maybe_single()
            .execute()
        )
        profile = profile_resp.data if profile_resp and isinstance(profile_resp.data, dict) else None
    except Exception as exc:
        print(f"⚠️ Signal Boost candidate profile lookup failed for {candidate_id}: {exc}")
        return {"email": False, "push": False}

    if not isinstance(profile, dict):
        return {"email": False, "push": False}

    locale = _normalize_locale(profile.get("preferred_locale") or row.get("locale") or "en", "en")
    email = _safe_str(profile.get("email"))
    full_name = _safe_str(profile.get("full_name"))
    job_snapshot = row.get("job_snapshot") if isinstance(row.get("job_snapshot"), dict) else {}
    role_job_id = _safe_str(job_snapshot.get("id"))
    signal_url = f"{APP_PUBLIC_URL.rstrip('/')}/{locale}/signal/{_safe_str(row.get('share_slug'))}"
    role_url = _build_role_url(locale, role_job_id) if role_job_id else signal_url
    company_name = _safe_str(job_snapshot.get("company")) or "Company"
    job_title = _safe_str(job_snapshot.get("title")) or "Role"
    email_enabled = _pref_enabled(profile.get("daily_digest_enabled"), default=True) and bool(email)

    email_ok = False
    if email_enabled and email:
        try:
            email_ok = send_signal_boost_interest_email(
                to_email=email,
                full_name=full_name,
                locale=locale,
                company_name=company_name,
                job_title=job_title,
                role_url=role_url,
                signal_url=signal_url,
            )
        except Exception as exc:
            print(f"⚠️ Signal Boost interest email failed for {candidate_id}: {exc}")

    push_ok = False
    push_enabled = _pref_enabled(profile.get("daily_digest_push_enabled"), default=True)
    if push_enabled and is_push_configured():
        try:
            subs_resp = (
                supabase.table("push_subscriptions")
                .select("endpoint,p256dh,auth")
                .eq("user_id", candidate_id)
                .eq("is_active", True)
                .execute()
            )
            subs = [item for item in (subs_resp.data or []) if isinstance(item, dict)]
            if subs:
                copy = _push_copy(locale)
                payload = json.dumps(
                    {
                        "title": copy["title"],
                        "body": f"{company_name} / {job_title}. {copy['body']}",
                        "url": role_url,
                    }
                )
                delivered = False
                for sub in subs:
                    delivered = send_push(sub, payload) or delivered
                push_ok = delivered
        except Exception as exc:
            print(f"⚠️ Signal Boost interest push failed for {candidate_id}: {exc}")

    return {"email": email_ok, "push": push_ok}
