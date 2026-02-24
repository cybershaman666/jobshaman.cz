from datetime import datetime, timezone, time, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, List, Optional
import math
import json

from ..core.config import API_BASE_URL
from ..core.database import supabase
from ..matching_engine import recommend_jobs_for_user
from ..services.email import send_daily_digest_email
from ..services.push_notifications import send_push, is_push_configured
from ..services.unsubscribe import make_unsubscribe_token

_DEFAULT_TZ = "Europe/Prague"
_DIGEST_RADIUS_KM = 50.0
_DIGEST_MAX_JOBS = 10
_APP_URL = "https://jobshaman.cz"
_DIGEST_WINDOW_MINUTES = 20
_REMOTE_ONLY_FLAGS = ["remote", "remote-first", "work from home", "home office", "homeoffice", "fully remote"]
_COUNTRY_BOUNDS = {
    # Approximate bounds for digest fallback country inference.
    "CZ": (48.3, 51.2, 12.0, 18.9),
    "SK": (47.7, 49.7, 16.8, 22.7),
    "AT": (46.3, 49.1, 9.3, 17.3),
    "DE": (47.2, 55.1, 5.8, 15.1),
    "PL": (49.0, 54.9, 14.1, 24.2),
}


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
    if "remote" in work_model:
        return True
    if "remote" in work_type:
        return True

    text = " ".join(
        [
            str(job.get("title") or ""),
            str(job.get("description") or ""),
            str(job.get("location") or ""),
        ]
    ).lower()
    return any(flag in text for flag in _REMOTE_ONLY_FLAGS)


def _job_distance_km(job: Dict, c_lat: Optional[float], c_lng: Optional[float]) -> Optional[float]:
    if c_lat is None or c_lng is None:
        return None
    j_lat = job.get("lat")
    j_lng = job.get("lng")
    if j_lat is None or j_lng is None:
        return None
    try:
        return _haversine_km(float(c_lat), float(c_lng), float(j_lat), float(j_lng))
    except Exception:
        return None


def _digest_job_sort_key(job: Dict) -> tuple:
    distance = job.get("distance_km")
    has_distance = distance is not None
    return (
        0 if has_distance else 1,
        float(distance) if has_distance else 99999.0,
        -int(job.get("match_score") or 0),
    )


def _pick_personalized_digest_jobs(
    recs: List[Dict],
    c_lat: Optional[float],
    c_lng: Optional[float],
    country_code: Optional[str],
    limit: int = _DIGEST_MAX_JOBS,
) -> List[Dict]:
    strict_local: List[Dict] = []
    relaxed_personalized: List[Dict] = []

    for item in recs:
        job = item.get("job") or {}
        job_id = job.get("id")
        if not job_id:
            continue
        if not _job_in_country(job, country_code):
            continue

        remote = _is_remote_job(job)
        distance = _job_distance_km(job, c_lat, c_lng)
        packed = {
            "id": job_id,
            "title": job.get("title") or "",
            "company": job.get("company") or job.get("company_name") or "",
            "location": job.get("location") or "",
            "match_score": int(float(item.get("score") or 0)),
            "distance_km": round(float(distance), 2) if distance is not None else None,
            "detail_url": f"{_APP_URL}/jobs/{job_id}",
        }

        if remote or (distance is not None and distance <= _DIGEST_RADIUS_KM):
            strict_local.append(packed)
        else:
            # Keep personalized items for secondary fallback so email still shows AI match.
            relaxed_personalized.append(packed)

    strict_local = sorted(strict_local, key=_digest_job_sort_key)
    if strict_local:
        return strict_local[:limit]

    relaxed_personalized = sorted(relaxed_personalized, key=_digest_job_sort_key)
    return relaxed_personalized[:limit]


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
    window_start = datetime.combine(today, digest_time, tzinfo=tz)
    window_end = window_start + timedelta(minutes=_DIGEST_WINDOW_MINUTES)

    if last_sent:
        try:
            dt = datetime.fromisoformat(str(last_sent).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            last_local = dt.astimezone(tz)
            # Default behavior: only one digest per day.
            # Exception: if user changed digest time to a later slot today and the
            # previous send happened before today's new window, allow one resend.
            if last_local.date() == today and last_local >= window_start:
                return False
        except Exception:
            pass

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
    job_title = str(candidate_profile.get("job_title") or "").strip()
    return bool((isinstance(skills, list) and len(skills) > 0) or cv_text or cv_ai_text or job_title)


def _country_from_coordinates(lat: Optional[float], lng: Optional[float]) -> Optional[str]:
    if lat is None or lng is None:
        return None
    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except Exception:
        return None

    for code, (min_lat, max_lat, min_lng, max_lng) in _COUNTRY_BOUNDS.items():
        if min_lat <= lat_f <= max_lat and min_lng <= lng_f <= max_lng:
            return code
    return None


def _country_from_address(address: Optional[str]) -> Optional[str]:
    text = str(address or "").strip().lower()
    if not text:
        return None

    mapping = {
        "CZ": ("czech", "czechia", "čes", "cesk", "praha", "brno", "ostrava"),
        "SK": ("slovak", "slovensko", "bratislava", "košice", "kosice"),
        "PL": ("poland", "polska", "warsz", "krakow", "kraków"),
        "DE": ("germany", "deutschland", "berlin", "münchen", "munich"),
        "AT": ("austria", "österreich", "osterreich", "wien", "vienna"),
    }
    for code, keywords in mapping.items():
        if any(keyword in text for keyword in keywords):
            return code
    return None


def _resolve_digest_country_code(
    preferred_country_code: Optional[str],
    preferred_locale: Optional[str],
    candidate_profile,
    c_lat: Optional[float],
    c_lng: Optional[float],
) -> Optional[str]:
    preferred = str(preferred_country_code or "").strip().upper()
    if preferred:
        return preferred

    by_coordinates = _country_from_coordinates(c_lat, c_lng)
    if by_coordinates:
        return by_coordinates

    locale = str(preferred_locale or "").strip().lower()
    if locale.startswith("cs"):
        return "CZ"
    if locale.startswith("sk"):
        return "SK"
    if locale.startswith("pl"):
        return "PL"
    if locale.startswith("de"):
        # Keep German locale broad, do not force DE/AT split.
        return None

    profile_obj = candidate_profile[0] if isinstance(candidate_profile, list) and candidate_profile else candidate_profile
    if isinstance(profile_obj, dict):
        return _country_from_address(profile_obj.get("address"))
    return None


def _job_in_country(job: Dict, country_code: Optional[str]) -> bool:
    required = str(country_code or "").strip().upper()
    if not required:
        return True
    job_country = str(job.get("country_code") or "").strip().upper()
    if not job_country:
        return False
    return job_country == required


def _fetch_newest_local_jobs(
    c_lat: Optional[float],
    c_lng: Optional[float],
    country_code: Optional[str],
    limit: int = _DIGEST_MAX_JOBS,
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
        if country_code:
            query = query.eq("country_code", str(country_code).upper())
        resp = query.execute()
    except Exception as exc:
        print(f"⚠️ Fallback local jobs query failed: {exc}")
        return []

    rows = resp.data or []
    picks: List[Dict] = []
    for job in rows:
        if not _job_in_country(job, country_code):
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


def _fetch_newest_jobs_relaxed(limit: int = _DIGEST_MAX_JOBS) -> List[Dict]:
    """Last-resort fallback to avoid silent digest drops when strict filters return no jobs."""
    if not supabase:
        return []

    try:
        resp = (
            supabase.table("jobs")
            .select("id,title,company,location,scraped_at")
            .eq("legality_status", "legal")
            .order("scraped_at", desc=True)
            .limit(100)
            .execute()
        )
    except Exception as exc:
        print(f"⚠️ Relaxed fallback jobs query failed: {exc}")
        return []

    rows = resp.data or []
    picks: List[Dict] = []
    for job in rows:
        job_id = job.get("id")
        if not job_id:
            continue
        picks.append(
            {
                "id": job_id,
                "title": job.get("title") or "",
                "company": job.get("company") or "",
                "location": job.get("location") or "",
                "match_score": None,
                "detail_url": f"{_APP_URL}/jobs/{job_id}",
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
                "candidate_profiles(lat,lng,address,job_title,skills,cv_text,cv_ai_text)"
            )
            .eq("role", "candidate")
            .execute()
        )
    except Exception as exc:
        print(f"⚠️ Daily digest profile fetch failed: {exc}")
        return

    rows = resp.data or []
    print(f"📬 Daily digest candidates loaded: {len(rows)}")
    for row in rows:
        user_id = row.get("id")
        email = row.get("email")
        email_enabled = bool(row.get("daily_digest_enabled")) and bool(email)
        push_enabled = bool(row.get("daily_digest_push_enabled")) and is_push_configured()
        if not user_id or (not email_enabled and not push_enabled):
            print(
                f"⏭️ [Digest] skipped user={user_id}: "
                f"email_enabled={email_enabled}, push_enabled={push_enabled}, has_email={bool(email)}"
            )
            continue

        digest_time = _parse_digest_time(row.get("daily_digest_time"))
        digest_tz = row.get("daily_digest_timezone") or _DEFAULT_TZ
        last_sent = row.get("daily_digest_last_sent_at")
        if not _should_send_now(last_sent, digest_time, digest_tz):
            print(
                f"⏭️ [Digest] outside window user={user_id}: "
                f"time={digest_time}, tz={digest_tz}, last_sent={last_sent}"
            )
            continue

        candidate_profile = row.get("candidate_profiles")
        c_lat, c_lng = _candidate_location(candidate_profile)
        digest_country_code = _resolve_digest_country_code(
            preferred_country_code=row.get("preferred_country_code"),
            preferred_locale=row.get("preferred_locale"),
            candidate_profile=candidate_profile,
            c_lat=c_lat,
            c_lng=c_lng,
        )
        has_matching_signal = _candidate_has_matching_signal(candidate_profile)

        digest_jobs: List[Dict] = []
        if has_matching_signal:
            # Fetch broader set, then prioritize local+relevant entries for digest.
            recs = recommend_jobs_for_user(user_id=user_id, limit=120, allow_cache=True)
            digest_jobs = _pick_personalized_digest_jobs(
                recs=recs,
                c_lat=c_lat,
                c_lng=c_lng,
                country_code=digest_country_code,
                limit=_DIGEST_MAX_JOBS,
            )

        # Fallback for users with incomplete profiles (or empty personalized result):
        # deliver newest local jobs without AI match percentages.
        if not digest_jobs:
            digest_jobs = _fetch_newest_local_jobs(
                c_lat=c_lat,
                c_lng=c_lng,
                country_code=digest_country_code,
                limit=_DIGEST_MAX_JOBS,
            )
            if not digest_jobs:
                print(
                    f"⚠️ [Digest] strict/local selection returned 0 jobs for user={user_id}; "
                    "using relaxed fallback."
                )
                digest_jobs = _fetch_newest_jobs_relaxed(limit=_DIGEST_MAX_JOBS)

        if not digest_jobs:
            print(f"⏭️ [Digest] skipped user={user_id}: no jobs available even after relaxed fallback")
            continue

        locale = _resolve_locale(row.get("preferred_locale"), digest_country_code)
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
