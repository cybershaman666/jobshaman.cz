from datetime import datetime, timezone, time, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, List, Optional
import math
import json

from ..core.config import API_BASE_URL
from ..core.database import supabase
from ..matching_engine import recommend_jobs_for_user
from ..matching_engine.scoring import REMOTE_FLAGS
from ..services.email import send_daily_digest_email
from ..services.push_notifications import send_push, is_push_configured
from ..services.unsubscribe import make_unsubscribe_token

_DEFAULT_TZ = "Europe/Prague"
_DIGEST_RADIUS_KM = 50.0
_APP_URL = "https://jobshaman.cz"
_DIGEST_WINDOW_MINUTES = 20


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _is_remote_job(job: Dict) -> bool:
    work_model = str(job.get("work_model") or "").lower()
    work_type = str(job.get("work_type") or "").lower()
    if "remote" in work_model or "hybrid" in work_model:
        return True
    if "remote" in work_type or "hybrid" in work_type:
        return True

    text = " ".join(
        [
            str(job.get("title") or ""),
            str(job.get("description") or ""),
            str(job.get("location") or ""),
        ]
    ).lower()
    return any(flag in text for flag in REMOTE_FLAGS)


def _resolve_locale(preferred_locale: Optional[str], preferred_country_code: Optional[str]) -> str:
    if preferred_locale:
        return preferred_locale
    cc = (preferred_country_code or "").upper()
    if cc == "CZ":
        return "cs"
    if cc == "SK":
        return "sk"
    if cc == "PL":
        return "pl"
    if cc in {"DE", "AT"}:
        return "de"
    return "cs"


def _parse_digest_time(value: Optional[str]) -> time:
    if not value:
        return time(7, 30)
    try:
        parts = str(value).split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        return time(hour=hour, minute=minute)
    except Exception:
        return time(7, 30)


def _should_send_now(last_sent: Optional[str], digest_time: time, tz_name: str) -> bool:
    try:
        tz = ZoneInfo(tz_name or _DEFAULT_TZ)
    except Exception:
        tz = ZoneInfo(_DEFAULT_TZ)

    now_local = datetime.now(tz)
    today = now_local.date()

    if last_sent:
        try:
            dt = datetime.fromisoformat(str(last_sent).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if dt.astimezone(tz).date() == today:
                return False
        except Exception:
            pass

    window_start = datetime.combine(today, digest_time, tzinfo=tz)
    window_end = window_start + timedelta(minutes=_DIGEST_WINDOW_MINUTES)
    return window_start <= now_local <= window_end


def _candidate_location(candidate_profile) -> tuple[Optional[float], Optional[float]]:
    if isinstance(candidate_profile, list):
        candidate_profile = candidate_profile[0] if candidate_profile else None
    if not candidate_profile:
        return None, None
    lat = candidate_profile.get("lat")
    lng = candidate_profile.get("lng")
    try:
        return (float(lat) if lat is not None else None, float(lng) if lng is not None else None)
    except Exception:
        return None, None


def _candidate_has_matching_signal(candidate_profile) -> bool:
    if isinstance(candidate_profile, list):
        candidate_profile = candidate_profile[0] if candidate_profile else None
    if not candidate_profile:
        return False

    skills = candidate_profile.get("skills") or []
    cv_text = str(candidate_profile.get("cv_text") or "").strip()
    cv_ai_text = str(candidate_profile.get("cv_ai_text") or "").strip()
    return bool((isinstance(skills, list) and len(skills) > 0) or cv_text or cv_ai_text)


def _fetch_newest_local_jobs(
    c_lat: Optional[float],
    c_lng: Optional[float],
    preferred_country_code: Optional[str],
    limit: int = 5,
) -> List[Dict]:
    if not supabase:
        return []

    try:
        query = (
            supabase.table("jobs")
            .select("id,title,company,location,lat,lng,work_model,work_type,description,scraped_at,country_code")
            .eq("legality_status", "legal")
            .order("scraped_at", desc=True)
            .limit(250)
        )
        if preferred_country_code:
            query = query.eq("country_code", str(preferred_country_code).upper())
        resp = query.execute()
    except Exception as exc:
        print(f"⚠️ Fallback local jobs query failed: {exc}")
        return []

    rows = resp.data or []
    picks: List[Dict] = []
    for job in rows:
        remote = _is_remote_job(job)
        if not remote:
            j_lat = job.get("lat")
            j_lng = job.get("lng")
            if c_lat is None or c_lng is None or j_lat is None or j_lng is None:
                continue
            try:
                distance = _haversine_km(float(c_lat), float(c_lng), float(j_lat), float(j_lng))
            except Exception:
                continue
            if distance > _DIGEST_RADIUS_KM:
                continue

        picks.append(
            {
                "id": job.get("id"),
                "title": job.get("title") or "",
                "company": job.get("company") or "",
                "location": job.get("location") or "",
                "match_score": None,
                "detail_url": f"{_APP_URL}/jobs/{job.get('id')}",
            }
        )
        if len(picks) >= limit:
            break
    return picks


def run_daily_job_digest() -> None:
    if not supabase:
        return

    now_utc_iso = datetime.now(timezone.utc).isoformat()

    try:
        resp = (
            supabase.table("profiles")
            .select(
                "id,email,full_name,preferred_locale,preferred_country_code,daily_digest_enabled,daily_digest_last_sent_at,"
                "daily_digest_time,daily_digest_timezone,daily_digest_push_enabled,"
                "candidate_profiles(lat,lng,address,skills,cv_text,cv_ai_text)"
            )
            .eq("role", "candidate")
            .execute()
        )
    except Exception as exc:
        print(f"⚠️ Daily digest profile fetch failed: {exc}")
        return

    rows = resp.data or []
    for row in rows:
        user_id = row.get("id")
        email = row.get("email")
        email_enabled = bool(row.get("daily_digest_enabled")) and bool(email)
        push_enabled = bool(row.get("daily_digest_push_enabled")) and is_push_configured()
        if not user_id or (not email_enabled and not push_enabled):
            continue

        digest_time = _parse_digest_time(row.get("daily_digest_time"))
        digest_tz = row.get("daily_digest_timezone") or _DEFAULT_TZ
        last_sent = row.get("daily_digest_last_sent_at")
        if not _should_send_now(last_sent, digest_time, digest_tz):
            continue

        candidate_profile = row.get("candidate_profiles")
        c_lat, c_lng = _candidate_location(candidate_profile)
        has_matching_signal = _candidate_has_matching_signal(candidate_profile)

        digest_jobs: List[Dict] = []
        if has_matching_signal:
            recs = recommend_jobs_for_user(user_id=user_id, limit=30, allow_cache=True)
            for item in recs:
                job = item.get("job") or {}
                job_id = job.get("id")
                if not job_id:
                    continue

                remote = _is_remote_job(job)
                if not remote:
                    j_lat = job.get("lat")
                    j_lng = job.get("lng")
                    if c_lat is None or c_lng is None or j_lat is None or j_lng is None:
                        continue
                    try:
                        distance = _haversine_km(float(c_lat), float(c_lng), float(j_lat), float(j_lng))
                    except Exception:
                        continue
                    if distance > _DIGEST_RADIUS_KM:
                        continue

                digest_jobs.append(
                    {
                        "id": job_id,
                        "title": job.get("title") or "",
                        "company": job.get("company") or job.get("company_name") or "",
                        "location": job.get("location") or "",
                        "match_score": int(float(item.get("score") or 0)),
                        "detail_url": f"{_APP_URL}/jobs/{job_id}",
                    }
                )
                if len(digest_jobs) >= 5:
                    break

        # Fallback for users with incomplete profiles (or empty personalized result):
        # deliver newest local jobs without AI match percentages.
        if not digest_jobs:
            digest_jobs = _fetch_newest_local_jobs(
                c_lat=c_lat,
                c_lng=c_lng,
                preferred_country_code=row.get("preferred_country_code"),
                limit=5,
            )

        if not digest_jobs:
            continue

        locale = _resolve_locale(row.get("preferred_locale"), row.get("preferred_country_code"))
        unsubscribe_url = ""
        if email_enabled:
            unsubscribe_token = make_unsubscribe_token(user_id, email)
            unsubscribe_url = f"{API_BASE_URL}/email/unsubscribe?uid={user_id}&token={unsubscribe_token}"

        email_ok = False
        if email_enabled:
            email_ok = send_daily_digest_email(
                to_email=email,
                full_name=row.get("full_name") or "",
                locale=locale,
                jobs=digest_jobs,
                app_url=_APP_URL,
                unsubscribe_url=unsubscribe_url,
            )

        push_ok = False
        if push_enabled:
            try:
                subs_resp = (
                    supabase.table("push_subscriptions")
                    .select("endpoint,p256dh,auth")
                    .eq("user_id", user_id)
                    .eq("is_active", True)
                    .execute()
                )
                subs = subs_resp.data or []
                if subs:
                    titles = [j.get("title") for j in digest_jobs if j.get("title")]
                    body = "\n".join(titles[:5])
                    push_copy = {
                        "cs": {
                            "title": "JobShaman – denní digest",
                            "fallback": "Máte nový přehled pracovních nabídek.",
                        },
                        "en": {
                            "title": "JobShaman – daily digest",
                            "fallback": "Your daily job matches are ready.",
                        },
                        "de": {
                            "title": "JobShaman – täglicher Digest",
                            "fallback": "Ihr täglicher Job‑Digest ist bereit.",
                        },
                        "pl": {
                            "title": "JobShaman – dzienny digest",
                            "fallback": "Twoje dzienne dopasowania są gotowe.",
                        },
                        "sk": {
                            "title": "JobShaman – denný digest",
                            "fallback": "Váš denný prehľad ponúk je pripravený.",
                        },
                    }
                    copy = push_copy.get(locale, push_copy["cs"])
                    payload = json.dumps(
                        {
                            "title": copy["title"],
                            "body": body or copy["fallback"],
                            "url": f"{_APP_URL}/digest",
                        }
                    )
                    for sub in subs:
                        send_push(sub, payload)
                    push_ok = True
            except Exception as exc:
                print(f"⚠️ Push digest failed for {user_id}: {exc}")

        # Mark digest as sent only when the enabled channel actually succeeded.
        # This prevents email-enabled users from being marked as "sent" when only push worked.
        sent_successfully = (email_enabled and email_ok) or (push_enabled and push_ok and not email_enabled)

        if sent_successfully:
            try:
                supabase.table("profiles").update({"daily_digest_last_sent_at": now_utc_iso}).eq("id", user_id).execute()
            except Exception as exc:
                print(f"⚠️ Failed to update daily_digest_last_sent_at for {user_id}: {exc}")
        else:
            print(
                f"⚠️ Digest not marked as sent for {user_id}: "
                f"email_enabled={email_enabled}, email_ok={email_ok}, push_enabled={push_enabled}, push_ok={push_ok}"
            )
