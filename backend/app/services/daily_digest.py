from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Dict, List, Optional
import math

from ..core.config import API_BASE_URL
from ..core.database import supabase
from ..matching_engine import recommend_jobs_for_user
from ..matching_engine.scoring import REMOTE_FLAGS
from ..services.email import send_daily_digest_email
from ..services.unsubscribe import make_unsubscribe_token

_DIGEST_TZ = ZoneInfo("Europe/Prague")
_DIGEST_RADIUS_KM = 50.0
_APP_URL = "https://jobshaman.cz"


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


def run_daily_job_digest() -> None:
    if not supabase:
        return

    now_local = datetime.now(_DIGEST_TZ)
    today = now_local.date()
    now_utc_iso = datetime.now(timezone.utc).isoformat()

    try:
        resp = (
            supabase.table("profiles")
            .select(
                "id,email,full_name,preferred_locale,preferred_country_code,daily_digest_enabled,daily_digest_last_sent_at,"
                "candidate_profiles(lat,lng,address)"
            )
            .eq("role", "candidate")
            .eq("daily_digest_enabled", True)
            .execute()
        )
    except Exception as exc:
        print(f"⚠️ Daily digest profile fetch failed: {exc}")
        return

    rows = resp.data or []
    for row in rows:
        user_id = row.get("id")
        email = row.get("email")
        if not user_id or not email:
            continue

        last_sent = row.get("daily_digest_last_sent_at")
        if last_sent:
            try:
                dt = datetime.fromisoformat(str(last_sent).replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt.astimezone(_DIGEST_TZ).date() == today:
                    continue
            except Exception:
                pass

        candidate_profile = row.get("candidate_profiles")
        c_lat, c_lng = _candidate_location(candidate_profile)

        recs = recommend_jobs_for_user(user_id=user_id, limit=30, allow_cache=True)
        if not recs:
            continue

        digest_jobs: List[Dict] = []
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

        if not digest_jobs:
            continue

        locale = _resolve_locale(row.get("preferred_locale"), row.get("preferred_country_code"))
        unsubscribe_token = make_unsubscribe_token(user_id, email)
        unsubscribe_url = f"{API_BASE_URL}/email/unsubscribe?uid={user_id}&token={unsubscribe_token}"

        ok = send_daily_digest_email(
            to_email=email,
            full_name=row.get("full_name") or "",
            locale=locale,
            jobs=digest_jobs,
            app_url=_APP_URL,
            unsubscribe_url=unsubscribe_url,
        )

        if ok:
            try:
                supabase.table("profiles").update({"daily_digest_last_sent_at": now_utc_iso}).eq("id", user_id).execute()
            except Exception as exc:
                print(f"⚠️ Failed to update daily_digest_last_sent_at for {user_id}: {exc}")
