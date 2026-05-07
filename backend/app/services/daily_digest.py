from datetime import datetime, timezone, time, timedelta
from zoneinfo import ZoneInfo
from typing import Any, Dict, List, Optional, cast
import math
import json
import re
import unicodedata

from ..core.config import API_BASE_URL
from ..core.database import supabase
from ..services.candidate_intent import (
    get_domain_keywords,
    get_related_domains,
    resolve_candidate_intent_profile,
)
from ..services.email import send_daily_digest_email
from ..services.push_notifications import send_push, is_push_configured
from ..services.unsubscribe import make_unsubscribe_token

_DEFAULT_TZ = "Europe/Prague"
_DIGEST_RADIUS_KM = 50.0
_DIGEST_MAX_JOBS = 10
_APP_URL = "https://jobshaman.cz"

def _build_job_detail_url(job: Dict) -> str:
    job_id = job.get("id")
    # Heuristic: curated jobs have 'native', 'challenge', or 'jobshaman' in source/kind
    source_kind = str(job.get("source_kind") or "").lower()
    source = str(job.get("source") or "").lower()
    is_curated = any(kw in source_kind for kw in ["native", "challenge", "jobshaman"]) or "jobshaman" in source
    
    prefix = "/candidate/role" if is_curated else "/candidate/imported"
    return f"{_APP_URL}{prefix}/{job_id}"

_DIGEST_WINDOW_MINUTES = 20
_DIGEST_LOOKBACK_HOURS = 36
_REMOTE_ONLY_FLAGS = ["remote", "remote-first", "work from home", "home office", "homeoffice", "fully remote"]
_HYBRID_FLAGS = ["hybrid", "kombin", "remote + onsite", "onsite + remote"]
_PROCESS_DIGEST_LAST_SENT_AT: dict[str, str] = {}
_TIMEZONE_TO_COUNTRY = {
    "Europe/Prague": "CZ",
    "Europe/Bratislava": "SK",
    "Europe/Warsaw": "PL",
    "Europe/Berlin": "DE",
    "Europe/Vienna": "AT",
}
_LANGUAGE_FALLBACK_BY_COUNTRY = {
    "CZ": {"cs", "sk"},
    "SK": {"sk", "cs"},
    "PL": {"pl"},
    "DE": {"de"},
    "AT": {"de"},
}
_LANGUAGE_FALLBACK_BY_LOCALE = {
    "cs": {"cs", "sk"},
    "sk": {"sk", "cs"},
    "pl": {"pl"},
    "de": {"de"},
    "en": {"en"},
}
_SUPPORTED_SEARCH_LANGUAGE_CODES = {"cs", "sk", "en", "de", "pl"}
_COUNTRY_NEIGHBORS = {
    "CZ": {"SK", "PL", "DE", "AT"},
    "SK": {"CZ", "PL", "AT"},
    "PL": {"CZ", "SK", "DE"},
    "DE": {"CZ", "AT", "PL"},
    "AT": {"CZ", "SK", "DE"},
}
_ROLE_FOCUS_KEYWORDS = {
    "driving_transport": (
        "ridic",
        "ridicsk",
        "kamion",
        "autobus",
        "taxi",
        "driver",
        "truck driver",
        "bus driver",
        "kierowca",
        "fahrer",
    ),
    "painting_finishing": (
        "lakyrnik",
        "autolakyrnik",
        "natirac",
        "malir",
        "lakiernik",
        "lackierer",
        "painter",
        "paint shop",
    ),
}
_IT_ROLE_KEYWORDS = (
    "developer",
    "software engineer",
    "full stack",
    "backend",
    "frontend",
    "devops",
    "programator",
    "programmierer",
)
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


def _normalize_text(value: Optional[str]) -> str:
    text = str(value or "").lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text


def _as_job_dict(raw: Any) -> Optional[Dict[str, Any]]:
    return raw if isinstance(raw, dict) else None


def _profile_obj(candidate_profile):
    if isinstance(candidate_profile, list):
        return candidate_profile[0] if candidate_profile else None
    return candidate_profile if isinstance(candidate_profile, dict) else None


def _candidate_preferences(candidate_profile) -> dict:
    profile = _profile_obj(candidate_profile)
    if not isinstance(profile, dict):
        return {}
    preferences = profile.get("preferences")
    return preferences if isinstance(preferences, dict) else {}


def _candidate_search_profile(candidate_profile) -> dict:
    preferences = _candidate_preferences(candidate_profile)
    search_profile = preferences.get("searchProfile")
    return search_profile if isinstance(search_profile, dict) else {}


def _normalize_search_language_codes(values: Any) -> list[str]:
    if not isinstance(values, list):
        return ["cs"]
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        code = str(value or "").strip().lower().replace("_", "-").split("-", 1)[0]
        if code not in _SUPPORTED_SEARCH_LANGUAGE_CODES or code in seen:
            continue
        seen.add(code)
        normalized.append(code)
    return normalized or ["cs"]


def _normalize_work_arrangement(value: Any) -> Optional[str]:
    normalized = str(value or "").strip().lower()
    if normalized in {"remote", "hybrid", "onsite"}:
        return normalized
    return None


def _normalize_country_scope(value: Any) -> set[str]:
    if value is None:
        return set()
    if isinstance(value, (set, list, tuple)):
        output: set[str] = set()
        for item in value:
            normalized = str(item or "").strip().upper()
            if normalized:
                output.add(normalized)
        return output
    normalized = str(value or "").strip().upper()
    return {normalized} if normalized else set()


def _normalize_contract_text(value: Optional[str]) -> str:
    raw = _normalize_text(value)
    return re.sub(r"[^a-z0-9]+", " ", raw).strip()


def _contract_type_tags(value: Optional[str]) -> set[str]:
    txt = _normalize_contract_text(value)
    if not txt:
        return set()
    haystack = f" {txt} "
    tags: set[str] = set()
    if re.search(r"\b(ico|osvc|szco|b2b|freelanc\w*|contractor|self employed|selfemployed)\b", haystack) or "zivnost" in haystack:
        tags.add("ico")
    if re.search(r"\b(hpp|full time|fulltime|employment contract|pracovni pomer|pracovny pomer|umowa o prace|vollzeit)\b", haystack):
        tags.add("hpp")
    if re.search(r"\b(part time|parttime|teilzeit|zkracen\w*|castecn\w*|skrat\w*|niepelny etat)\b", haystack):
        tags.add("part_time")
    if re.search(r"\b(brigad\w*|dpp|dpc|temporary|seasonal|minijob|umowa zlecenie)\b", haystack):
        tags.add("brigada")
    return tags


def _normalize_contract_filters(values: list[str]) -> set[str]:
    tags: set[str] = set()
    for value in values:
        tags |= _contract_type_tags(value)
    return tags


def _benefit_tags_from_text(value: Optional[str]) -> set[str]:
    txt = _normalize_contract_text(value or "")
    if not txt:
        return set()
    haystack = f" {txt} "
    tags: set[str] = set()
    if re.search(r"\b(home_office|homeoffice|work_from_home|home office|work from home|prace z domova|praca z domu)\b", haystack):
        tags.add("home_office")
    if re.search(r"\b(dog_friendly|dogfriendly|dog friendly|pet friendly|dogs|psi|pes|hund)\b", haystack):
        tags.add("dog_friendly")
    if re.search(r"\b(meal_allowance|meal voucher|meal vouchers|meal|lunch|straven|obed|obedy|posilk)\b", haystack):
        tags.add("meal_allowance")
    if re.search(r"\b(education|training|course|courses|vzdel|skolen|weiterbildung)\b", haystack):
        tags.add("education")
    if re.search(r"\b(multisport|sport card|karta multisport)\b", haystack):
        tags.add("multisport")
    if re.search(r"\b(transport_support|parking|transport|transit|public transport|jizdne|fahrkarte)\b", haystack):
        tags.add("transport_support")
    if re.search(r"\b(vacation_5w|5 weeks|5 week|25 days|25 dni|25 dn)\b", haystack):
        tags.add("vacation_5w")
    if re.search(r"\b(health_care|healthcare|health care|private medical|medical care|zdravotn)\b", haystack):
        tags.add("health_care")
    if re.search(r"\b(pension|retirement|penzij|duchodov|altersvorsorge)\b", haystack):
        tags.add("pension")
    if re.search(r"\b(childcare_support|childcare|daycare|kindergarten|skolk|jesle|przedszkol)\b", haystack):
        tags.add("childcare_support")
    if re.search(r"\b(relocation_support|relocation|housing allowance|accommodation|ubytov|zakwaterowanie)\b", haystack):
        tags.add("relocation_support")
    if re.search(r"\b(employee_shares|stock option|stock options|equity|esop|akcie)\b", haystack):
        tags.add("employee_shares")
    if re.search(r"\b(car_personal|company car|car allowance|sluzebni auto|firemni auto|dienstwagen)\b", haystack):
        tags.add("car_personal")
    return tags


def _normalize_benefit_filters(values: list[str]) -> set[str]:
    tags: set[str] = set()
    for value in values:
        tags |= _benefit_tags_from_text(value)
    return tags


def _parse_iso_timestamp(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return None


def _candidate_digest_last_sent(candidate_profile) -> Optional[str]:
    preferences = _candidate_preferences(candidate_profile)
    system = preferences.get("system")
    if isinstance(system, dict):
        for key in ("dailyDigestLastSentAt", "daily_digest_last_sent_at", "digest_last_sent_at"):
            value = system.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    for key in ("dailyDigestLastSentAt", "daily_digest_last_sent_at"):
        value = preferences.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _resolve_last_sent_marker(user_id: str, profile_last_sent: Optional[str], candidate_profile) -> Optional[str]:
    candidates = [
        str(profile_last_sent or "").strip() or None,
        _candidate_digest_last_sent(candidate_profile),
        _PROCESS_DIGEST_LAST_SENT_AT.get(str(user_id or "").strip()),
    ]
    latest_dt: Optional[datetime] = None
    latest_value: Optional[str] = None
    for candidate in candidates:
        parsed = _parse_iso_timestamp(candidate)
        if not parsed:
            continue
        if latest_dt is None or parsed > latest_dt:
            latest_dt = parsed
            latest_value = parsed.isoformat()
    return latest_value


def _response_rows(resp: Any) -> list[dict]:
    data = getattr(resp, "data", None)
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    if isinstance(data, dict):
        return [data]
    return []


def _update_profile_digest_last_sent(user_id: str, sent_at_iso: str) -> bool:
    uid = str(user_id or "").strip()
    if not uid:
        return False
    try:
        resp = (
            supabase.table("profiles")
            .update({"daily_digest_last_sent_at": sent_at_iso})
            .eq("id", uid)
            .execute()
        )
        if getattr(resp, "data", None) is None or _response_rows(resp):
            return True
        print(
            f"⚠️ Failed to update daily_digest_last_sent_at for {uid}: "
            "no profile row was updated."
        )
    except Exception as exc:
        print(f"⚠️ Failed to update daily_digest_last_sent_at for {uid}: {exc}")
    return False


def _persist_candidate_digest_last_sent(user_id: str, candidate_profile, sent_at_iso: str) -> bool:
    uid = str(user_id or "").strip()
    if not uid:
        return False
    try:
        preferences = dict(_candidate_preferences(candidate_profile))
        system = preferences.get("system")
        if not isinstance(system, dict):
            system = {}
        system = dict(system)
        system["dailyDigestLastSentAt"] = sent_at_iso
        preferences["system"] = system
        resp = (
            supabase.table("candidate_profiles")
            .update({"preferences": preferences})
            .eq("id", uid)
            .execute()
        )
        if getattr(resp, "data", None) is None or _response_rows(resp):
            return True
        print(
            f"⚠️ Failed to persist digest fallback marker for {uid}: "
            "no candidate profile row was updated."
        )
    except Exception as exc:
        print(f"⚠️ Failed to persist digest fallback marker for {uid}: {exc}")
    return False


def _sync_profile_last_sent_if_stale(
    user_id: str,
    profile_last_sent: Optional[str],
    resolved_last_sent: Optional[str],
) -> None:
    uid = str(user_id or "").strip()
    if not uid or not resolved_last_sent:
        return

    profile_dt = _parse_iso_timestamp(str(profile_last_sent or "").strip() or None)
    resolved_dt = _parse_iso_timestamp(resolved_last_sent)
    if not resolved_dt:
        return
    if profile_dt and profile_dt >= resolved_dt:
        return

    _update_profile_digest_last_sent(uid, resolved_dt.isoformat())


def _persist_digest_last_sent(user_id: str, candidate_profile, sent_at_iso: str) -> None:
    uid = str(user_id or "").strip()
    if not uid:
        return

    _PROCESS_DIGEST_LAST_SENT_AT[uid] = sent_at_iso

    _update_profile_digest_last_sent(uid, sent_at_iso)
    _persist_candidate_digest_last_sent(uid, candidate_profile, sent_at_iso)


def _normalize_locale_code(locale: Optional[str]) -> str:
    value = str(locale or "").strip().lower()
    if not value:
        return ""
    return value.replace("_", "-").split("-", 1)[0]


def _allowed_language_codes(locale: Optional[str], country_code: Optional[str]) -> set[str]:
    cc = str(country_code or "").strip().upper()
    if cc in _LANGUAGE_FALLBACK_BY_COUNTRY:
        return set(_LANGUAGE_FALLBACK_BY_COUNTRY[cc])
    lc = _normalize_locale_code(locale)
    if lc in _LANGUAGE_FALLBACK_BY_LOCALE:
        return set(_LANGUAGE_FALLBACK_BY_LOCALE[lc])
    return {"cs"}


def _resolve_digest_profile_filters(
    candidate_profile,
    *,
    base_language_codes: Optional[set[str]],
    digest_country_code: Optional[str],
    c_lat: Optional[float],
    c_lng: Optional[float],
) -> dict[str, Any]:
    search_profile = _candidate_search_profile(candidate_profile)
    has_location = c_lat is not None and c_lng is not None or bool(_candidate_address(candidate_profile))
    raw_distance = search_profile.get("defaultMaxDistanceKm")
    try:
        max_distance_km = max(5.0, float(raw_distance if raw_distance is not None else _DIGEST_RADIUS_KM))
    except Exception:
        max_distance_km = _DIGEST_RADIUS_KM

    enable_commute_filter = bool(search_profile.get("defaultEnableCommuteFilter")) and has_location
    preferred_work_arrangement = _normalize_work_arrangement(search_profile.get("preferredWorkArrangement"))
    wants_remote_roles = bool(search_profile.get("wantsRemoteRoles")) or preferred_work_arrangement == "remote"
    remote_only = not enable_commute_filter and wants_remote_roles
    filter_work_arrangement = "remote" if remote_only else (preferred_work_arrangement or "all")

    benefit_terms = [str(item or "").strip() for item in (search_profile.get("preferredBenefitKeys") or []) if str(item or "").strip()]
    if bool(search_profile.get("wantsDogFriendlyOffice")):
        benefit_terms.append("dog_friendly")

    country_scope = _normalize_country_scope(digest_country_code)
    if bool(search_profile.get("nearBorder")) and country_scope:
        expanded = set(country_scope)
        for code in list(country_scope):
            expanded.update(_COUNTRY_NEIGHBORS.get(code, set()))
        country_scope = expanded

    language_codes = set(_normalize_search_language_codes(search_profile.get("remoteLanguageCodes"))) if remote_only else set(base_language_codes or set())

    return {
        "enable_commute_filter": enable_commute_filter,
        "max_distance_km": max_distance_km,
        "remote_only": remote_only,
        "filter_work_arrangement": filter_work_arrangement,
        "contract_filter_tags": _normalize_contract_filters(["ico"]) if bool(search_profile.get("wantsContractorRoles")) else set(),
        "benefit_filter_tags": _normalize_benefit_filters(benefit_terms),
        "language_codes": language_codes,
        "country_scope": country_scope,
        "global_search": bool(search_profile.get("nearBorder")),
    }


def _job_language_allowed(job: Dict, allowed_language_codes: Optional[set[str]]) -> bool:
    if not allowed_language_codes:
        return True
    intelligence = job.get("job_intelligence") if isinstance(job.get("job_intelligence"), dict) else {}
    language = str(intelligence.get("language_code") or job.get("language_code") or "").strip().lower()
    if not language:
        # Unknown language should not be dropped aggressively.
        return True
    return language in allowed_language_codes


def _infer_role_focus_families(candidate_profile) -> set[str]:
    profile = _profile_obj(candidate_profile)
    if not profile:
        return set()
    chunks = [
        profile.get("job_title"),
        profile.get("cv_text"),
        profile.get("cv_ai_text"),
        " ".join(profile.get("skills") or []),
    ]
    text = _normalize_text("\n".join(str(chunk or "") for chunk in chunks))
    if not text:
        return set()
    families: set[str] = set()
    for family, keywords in _ROLE_FOCUS_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            families.add(family)
    return families


def _job_role_families(job: Dict) -> set[str]:
    intelligence = job.get("job_intelligence") if isinstance(job.get("job_intelligence"), dict) else {}
    canonical_family = str(intelligence.get("role_family") or "").strip().lower()
    if canonical_family:
        return {canonical_family}
    text = _normalize_text(f"{job.get('title') or ''} {job.get('description') or ''}")
    if not text:
        return set()
    families: set[str] = set()
    for family, keywords in _ROLE_FOCUS_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            families.add(family)
    return families


def _is_it_role(job: Dict) -> bool:
    text = _normalize_text(f"{job.get('title') or ''} {job.get('description') or ''}")
    return any(keyword in text for keyword in _IT_ROLE_KEYWORDS)


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


def _job_work_arrangement(job: Dict) -> str:
    if _is_remote_job(job):
        return "remote"
    work_model = _normalize_text(job.get("work_model"))
    work_type = _normalize_text(job.get("work_type"))
    description = _normalize_text(job.get("description"))
    haystack = f"{work_model} {work_type} {description}"
    if any(flag in haystack for flag in _HYBRID_FLAGS):
        return "hybrid"
    return "onsite"


def _job_benefit_tags(job: Dict) -> set[str]:
    parts: list[str] = []
    benefits = job.get("benefits")
    if isinstance(benefits, list):
        parts.extend(str(item or "") for item in benefits)
    elif benefits:
        parts.append(str(benefits))
    parts.append(str(job.get("description") or ""))
    parts.append(str(job.get("title") or ""))
    return _benefit_tags_from_text(" ".join(parts))


def _job_matches_digest_profile_filters(
    job: Dict,
    *,
    digest_filters: Optional[dict[str, Any]],
    c_lat: Optional[float],
    c_lng: Optional[float],
) -> tuple[bool, Optional[float]]:
    filters = digest_filters or {}
    arrangement = _job_work_arrangement(job)

    if bool(filters.get("remote_only")) and arrangement != "remote":
        return False, None

    required_arrangement = str(filters.get("filter_work_arrangement") or "all").strip().lower()
    if required_arrangement in {"remote", "hybrid", "onsite"} and arrangement != required_arrangement:
        return False, None

    contract_filter_tags = cast(set[str], filters.get("contract_filter_tags") or set())
    if contract_filter_tags:
        if not _contract_type_tags(job.get("contract_type")).intersection(contract_filter_tags):
            return False, None

    benefit_filter_tags = cast(set[str], filters.get("benefit_filter_tags") or set())
    if benefit_filter_tags and not benefit_filter_tags.issubset(_job_benefit_tags(job)):
        return False, None

    distance = _job_distance_km(job, c_lat, c_lng)
    if bool(filters.get("enable_commute_filter")) and arrangement != "remote":
        max_distance = float(filters.get("max_distance_km") or _DIGEST_RADIUS_KM)
        if c_lat is not None and c_lng is not None:
            if distance is None or distance > max_distance:
                return False, distance

    return True, distance


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
    role_focus_match = bool(job.get("role_focus_match", True))
    return (
        0 if role_focus_match else 1,
        0 if has_distance else 1,
        float(distance) if has_distance else 99999.0,
        -int(job.get("match_score") or 0),
    )


def _pick_personalized_digest_jobs(
    recs: List[Dict],
    c_lat: Optional[float],
    c_lng: Optional[float],
    country_code: Optional[str],
    allowed_language_codes: Optional[set[str]] = None,
    candidate_profile=None,
    digest_filters: Optional[dict[str, Any]] = None,
    limit: int = _DIGEST_MAX_JOBS,
) -> List[Dict]:
    picks: List[Dict] = []
    role_focus_families = _infer_role_focus_families(candidate_profile)
    filters = digest_filters or {}
    effective_languages = cast(set[str], filters.get("language_codes") or allowed_language_codes or set())
    effective_country_scope = filters.get("country_scope") or country_code

    for item in recs:
        job = item.get("job") or {}
        job_id = job.get("id")
        if not job_id:
            continue
        if not _job_in_country(job, effective_country_scope):
            continue
        if not _job_language_allowed(job, effective_languages or None):
            continue

        job_families = _job_role_families(job)
        role_focus_match = bool(role_focus_families.intersection(job_families)) if role_focus_families else True
        if role_focus_families and not role_focus_match and _is_it_role(job):
            continue

        profile_match, distance = _job_matches_digest_profile_filters(
            job,
            digest_filters=filters,
            c_lat=c_lat,
            c_lng=c_lng,
        )
        if not profile_match:
            continue

        match_score = int(float(item.get("score") or 0))
        if role_focus_families and not role_focus_match:
            match_score = max(0, int(round(match_score * 0.75)))
        elif role_focus_families and role_focus_match:
            match_score = min(100, int(round(match_score * 1.1)))

        packed = {
            "id": job_id,
            "title": job.get("title") or "",
            "company": job.get("company") or job.get("company_name") or "",
            "location": job.get("location") or "",
            "match_score": match_score,
            "distance_km": round(float(distance), 2) if distance is not None else None,
            "detail_url": _build_job_detail_url(job),
            "role_focus_match": role_focus_match,
        }
        picks.append(packed)

    picks = sorted(picks, key=_digest_job_sort_key)
    return picks[:limit]


def _resolve_locale(preferred_locale: Optional[str], preferred_country_code: Optional[str]) -> str:
    normalized_locale = _normalize_locale_code(preferred_locale)
    cc = (preferred_country_code or "").upper()
    allowed_by_country = {
        "CZ": {"cs", "sk", "en"},
        "SK": {"sk", "cs", "en"},
        "PL": {"pl", "en"},
        "DE": {"de", "en"},
        "AT": {"de", "en"},
    }
    if normalized_locale:
        if not cc:
            return normalized_locale
        allowed = allowed_by_country.get(cc)
        if not allowed or normalized_locale in allowed:
            return normalized_locale
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

    if window_start <= now_local <= window_end:
        return True

    # If we missed the strict window and no digest was sent today, send on the next run.
    return now_local > window_end


def _did_any_enabled_digest_channel_succeed(
    email_enabled: bool,
    email_ok: bool,
    push_enabled: bool,
    push_ok: bool,
) -> bool:
    return (email_enabled and email_ok) or (push_enabled and push_ok)


def _candidate_location(candidate_profile) -> tuple[Optional[float], Optional[float]]:
    candidate_profile = _profile_obj(candidate_profile)
    if not candidate_profile:
        return None, None
    lat = candidate_profile.get("lat")
    lng = candidate_profile.get("lng")
    try:
        return (float(lat) if lat is not None else None, float(lng) if lng is not None else None)
    except Exception:
        return None, None


def _candidate_address(candidate_profile) -> Optional[str]:
    candidate_profile = _profile_obj(candidate_profile)
    if not candidate_profile:
        return None
    return str(candidate_profile.get("address") or "").strip() or None


def _extract_city_from_address(address: Optional[str]) -> Optional[str]:
    text = str(address or "").strip()
    if not text:
        return None
    parts = [p.strip() for p in text.split(",") if p.strip()]
    if not parts:
        return None

    # Walk from the end, but skip country-only segments like "Czechia" or "Austria".
    country_only_segments = {
        "czech",
        "czech republic",
        "czechia",
        "cesko",
        "česko",
        "slovakia",
        "slovensko",
        "poland",
        "polska",
        "germany",
        "deutschland",
        "austria",
        "osterreich",
        "österreich",
    }
    for segment in reversed(parts):
        normalized_segment = _normalize_text(segment).strip()
        if normalized_segment in country_only_segments:
            continue
        cleaned = re.sub(r"^\d{3}\s?\d{2}\s+", "", segment).strip()
        cleaned = re.sub(r"^\d{4,5}\s+", "", cleaned).strip()
        if not cleaned:
            continue
        tokenized = [token for token in cleaned.split() if token]
        if not tokenized:
            continue
        # If the segment still starts with a street number, prefer the trailing city token.
        if tokenized[0].isdigit() and len(tokenized) > 1:
            return tokenized[-1]
        return cleaned

    fallback = parts[0].strip()
    return fallback or None


def _role_keywords(value: Optional[str]) -> List[str]:
    text = _normalize_text(value)
    if not text:
        return []
    raw_tokens = [t for t in text.replace("/", " ").replace("-", " ").split() if t]
    stop = {"and", "the", "with", "for", "of", "a", "an", "senior", "junior", "lead", "manager", "specialist"}
    tokens = [t for t in raw_tokens if len(t) >= 3 and t not in stop]
    # Keep only a few keywords to avoid broad OR queries.
    seen: set[str] = set()
    compact: List[str] = []
    for t in tokens:
        if t in seen:
            continue
        seen.add(t)
        compact.append(t)
        if len(compact) >= 4:
            break
    return compact


def _candidate_has_matching_signal(candidate_profile) -> bool:
    candidate_profile = _profile_obj(candidate_profile)
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
    digest_timezone: Optional[str] = None,
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

    profile_obj = _profile_obj(candidate_profile)
    if isinstance(profile_obj, dict):
        by_address = _country_from_address(profile_obj.get("address"))
        if by_address:
            return by_address

    tz_country = _TIMEZONE_TO_COUNTRY.get(str(digest_timezone or "").strip())
    if tz_country:
        return tz_country
    return None


def _job_in_country(
    job: Dict,
    country_code: Optional[str],
    allow_missing: bool = False,
    remote_if_missing: bool = False,
) -> bool:
    required_scope = _normalize_country_scope(country_code)
    if not required_scope:
        return True
    job_country = str(job.get("country_code") or "").strip().upper()
    if not job_country:
        if not allow_missing:
            return False
        if remote_if_missing:
            return _is_remote_job(job)
        return True
    return job_country in required_scope


def _fetch_newest_local_jobs(
    c_lat: Optional[float],
    c_lng: Optional[float],
    address: Optional[str],
    country_code: Optional[str],
    allowed_language_codes: Optional[set[str]] = None,
    digest_filters: Optional[dict[str, Any]] = None,
    lookback_hours: Optional[int] = _DIGEST_LOOKBACK_HOURS,
    limit: int = _DIGEST_MAX_JOBS,
) -> List[Dict]:
    if not supabase:
        return []

    cutoff = None
    if lookback_hours:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=int(lookback_hours))).isoformat()

    try:
        filters = digest_filters or {}
        country_scope = _normalize_country_scope(filters.get("country_scope") or country_code)
        query = (
            supabase.table("jobs")
            .select("id,title,company,location,lat,lng,work_model,work_type,description,scraped_at,country_code,language_code,benefits,contract_type,source,source_kind,company_id")
            .eq("legality_status", "legal")
            .order("scraped_at", desc=True)
            .limit(250)
        )
        if cutoff:
            query = query.gte("scraped_at", cutoff)
        if len(country_scope) == 1:
            query = query.ilike("country_code", next(iter(country_scope)))
        elif country_scope:
            query = query.in_("country_code", list(country_scope))
        if bool(filters.get("enable_commute_filter")) and (c_lat is None or c_lng is None):
            city = _extract_city_from_address(address)
            if city:
                query = query.ilike("location", f"%{city}%")
        resp = query.execute()
    except Exception as exc:
        print(f"⚠️ Fallback local jobs query failed: {exc}")
        return []

    rows = [r for r in (resp.data or []) if isinstance(r, dict)]
    picks: List[Dict] = []
    for raw in rows:
        job = _as_job_dict(raw)
        if not job:
            continue
        if not _job_in_country(job, country_scope or country_code):
            continue
        effective_languages = cast(set[str], (digest_filters or {}).get("language_codes") or allowed_language_codes or set())
        if not _job_language_allowed(job, effective_languages or None):
            continue
        profile_match, distance = _job_matches_digest_profile_filters(
            job,
            digest_filters=digest_filters,
            c_lat=c_lat,
            c_lng=c_lng,
        )
        if not profile_match:
            continue

        picks.append(
            {
                "id": job.get("id"),
                "title": job.get("title") or "",
                "company": job.get("company") or "",
                "location": job.get("location") or "",
                "distance_km": round(float(distance), 2) if distance is not None else None,
                "match_score": None,
                "detail_url": _build_job_detail_url(job),
            }
        )
    picks = sorted(picks, key=_digest_job_sort_key)
    if picks:
        return picks[:limit]
    if not picks and lookback_hours:
        return _fetch_newest_local_jobs(
            c_lat=c_lat,
            c_lng=c_lng,
            address=address,
            country_code=country_code,
            allowed_language_codes=allowed_language_codes,
            digest_filters=digest_filters,
            lookback_hours=None,
            limit=limit,
        )
    return picks


def _fetch_role_focused_jobs(
    role_title: str,
    c_lat: Optional[float],
    c_lng: Optional[float],
    address: Optional[str],
    country_code: Optional[str],
    allowed_language_codes: Optional[set[str]] = None,
    digest_filters: Optional[dict[str, Any]] = None,
    lookback_hours: Optional[int] = _DIGEST_LOOKBACK_HOURS,
    limit: int = _DIGEST_MAX_JOBS,
) -> List[Dict]:
    if not supabase:
        return []

    keywords = _role_keywords(role_title)
    if not keywords:
        return []

    cutoff = None
    if lookback_hours:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=int(lookback_hours))).isoformat()

    try:
        filters = digest_filters or {}
        country_scope = _normalize_country_scope(filters.get("country_scope") or country_code)
        query = (
            supabase.table("jobs")
            .select("id,title,company,location,lat,lng,work_model,work_type,description,scraped_at,country_code,language_code,benefits,contract_type,source,source_kind,company_id")
            .eq("legality_status", "legal")
            .order("scraped_at", desc=True)
            .limit(300)
        )
        if cutoff:
            query = query.gte("scraped_at", cutoff)
        if len(country_scope) == 1:
            query = query.ilike("country_code", next(iter(country_scope)))
        elif country_scope:
            query = query.in_("country_code", list(country_scope))
        if bool(filters.get("enable_commute_filter")) and (c_lat is None or c_lng is None):
            city = _extract_city_from_address(address)
            if city:
                query = query.ilike("location", f"%{city}%")

        or_clauses: List[str] = []
        for kw in keywords:
            or_clauses.append(f"title.ilike.%{kw}%")
            or_clauses.append(f"description.ilike.%{kw}%")
        if or_clauses:
            query = query.or_(",".join(or_clauses))

        resp = query.execute()
    except Exception as exc:
        print(f"⚠️ Role-focused digest query failed: {exc}")
        return []

    rows = [r for r in (resp.data or []) if isinstance(r, dict)]
    picks: List[Dict] = []
    for raw in rows:
        job = _as_job_dict(raw)
        if not job:
            continue
        job_id = job.get("id")
        if not job_id:
            continue
        if not _job_in_country(job, country_scope or country_code):
            continue
        effective_languages = cast(set[str], filters.get("language_codes") or allowed_language_codes or set())
        if not _job_language_allowed(job, effective_languages or None):
            continue
        profile_match, distance = _job_matches_digest_profile_filters(
            job,
            digest_filters=digest_filters,
            c_lat=c_lat,
            c_lng=c_lng,
        )
        if not profile_match:
            continue

        picks.append(
            {
                "id": job_id,
                "title": job.get("title") or "",
                "company": job.get("company") or "",
                "location": job.get("location") or "",
                "country_code": job.get("country_code") or "",
                "distance_km": round(float(distance), 2) if distance is not None else None,
                "match_score": None,
                "detail_url": _build_job_detail_url(job),
            }
        )
    picks = sorted(picks, key=_digest_job_sort_key)
    if picks:
        return picks[:limit]
    if not picks and lookback_hours:
        return _fetch_role_focused_jobs(
            role_title=role_title,
            c_lat=c_lat,
            c_lng=c_lng,
            address=address,
            country_code=country_code,
            allowed_language_codes=allowed_language_codes,
            digest_filters=digest_filters,
            lookback_hours=None,
            limit=limit,
        )
    return picks


def _fetch_domain_focused_jobs(
    domain_key: Optional[str],
    c_lat: Optional[float],
    c_lng: Optional[float],
    address: Optional[str],
    country_code: Optional[str],
    allowed_language_codes: Optional[set[str]] = None,
    digest_filters: Optional[dict[str, Any]] = None,
    lookback_hours: Optional[int] = _DIGEST_LOOKBACK_HOURS,
    limit: int = _DIGEST_MAX_JOBS,
) -> List[Dict]:
    if not supabase:
        return []

    keywords = _role_keywords(" ".join(get_domain_keywords(domain_key)))
    if not keywords:
        return []

    cutoff = None
    if lookback_hours:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=int(lookback_hours))).isoformat()

    try:
        filters = digest_filters or {}
        country_scope = _normalize_country_scope(filters.get("country_scope") or country_code)
        query = (
            supabase.table("jobs")
            .select("id,title,company,location,lat,lng,work_model,work_type,description,scraped_at,country_code,language_code,benefits,contract_type,source,source_kind,company_id")
            .eq("legality_status", "legal")
            .order("scraped_at", desc=True)
            .limit(300)
        )
        if cutoff:
            query = query.gte("scraped_at", cutoff)
        if len(country_scope) == 1:
            query = query.ilike("country_code", next(iter(country_scope)))
        elif country_scope:
            query = query.in_("country_code", list(country_scope))
        if bool(filters.get("enable_commute_filter")) and (c_lat is None or c_lng is None):
            city = _extract_city_from_address(address)
            if city:
                query = query.ilike("location", f"%{city}%")

        or_clauses: List[str] = []
        for kw in keywords:
            or_clauses.append(f"title.ilike.%{kw}%")
            or_clauses.append(f"description.ilike.%{kw}%")
        if or_clauses:
            query = query.or_(",".join(or_clauses))

        resp = query.execute()
    except Exception as exc:
        print(f"⚠️ Domain-focused digest query failed: {exc}")
        return []

    rows = [r for r in (resp.data or []) if isinstance(r, dict)]
    picks: List[Dict] = []
    for raw in rows:
        job = _as_job_dict(raw)
        if not job:
            continue
        job_id = job.get("id")
        if not job_id:
            continue
        if not _job_in_country(job, country_scope or country_code):
            continue
        effective_languages = cast(set[str], filters.get("language_codes") or allowed_language_codes or set())
        if not _job_language_allowed(job, effective_languages or None):
            continue
        profile_match, distance = _job_matches_digest_profile_filters(
            job,
            digest_filters=digest_filters,
            c_lat=c_lat,
            c_lng=c_lng,
        )
        if not profile_match:
            continue

        picks.append(
            {
                "id": job_id,
                "title": job.get("title") or "",
                "company": job.get("company") or "",
                "location": job.get("location") or "",
                "country_code": job.get("country_code") or "",
                "distance_km": round(float(distance), 2) if distance is not None else None,
                "match_score": None,
                "detail_url": _build_job_detail_url(job),
            }
        )
    picks = sorted(picks, key=_digest_job_sort_key)
    if picks:
        return picks[:limit]
    if not picks and lookback_hours:
        return _fetch_domain_focused_jobs(
            domain_key=domain_key,
            c_lat=c_lat,
            c_lng=c_lng,
            address=address,
            country_code=country_code,
            allowed_language_codes=allowed_language_codes,
            digest_filters=digest_filters,
            lookback_hours=None,
            limit=limit,
        )
    return picks


def _merge_digest_jobs(primary: List[Dict], secondary: List[Dict], limit: int) -> List[Dict]:
    seen: set[str] = set()
    merged: List[Dict] = []
    for entry in primary + secondary:
        job_id = entry.get("id")
        if not job_id:
            continue
        key = str(job_id)
        if key in seen:
            continue
        seen.add(key)
        merged.append(entry)
        if len(merged) >= limit:
            break
    return merged


def _fetch_newest_jobs_relaxed(
    country_code: Optional[str],
    c_lat: Optional[float] = None,
    c_lng: Optional[float] = None,
    address: Optional[str] = None,
    allowed_language_codes: Optional[set[str]] = None,
    digest_filters: Optional[dict[str, Any]] = None,
    lookback_hours: Optional[int] = _DIGEST_LOOKBACK_HOURS,
    limit: int = _DIGEST_MAX_JOBS,
) -> List[Dict]:
    """Last-resort fallback to avoid silent digest drops when strict filters return no jobs."""
    if not supabase:
        return []

    cutoff = None
    if lookback_hours:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=int(lookback_hours))).isoformat()

    try:
        filters = digest_filters or {}
        country_scope = _normalize_country_scope(filters.get("country_scope") or country_code)
        query = (
            supabase.table("jobs")
            .select("id,title,company,location,lat,lng,work_model,work_type,description,scraped_at,country_code,language_code,benefits,contract_type,source,source_kind,company_id")
            .eq("legality_status", "legal")
            .order("scraped_at", desc=True)
            .limit(100)
        )
        if cutoff:
            query = query.gte("scraped_at", cutoff)
        if bool(filters.get("enable_commute_filter")) and (c_lat is None or c_lng is None):
            city = _extract_city_from_address(address)
            if city:
                query = query.ilike("location", f"%{city}%")
        resp = query.execute()
    except Exception as exc:
        print(f"⚠️ Relaxed fallback jobs query failed: {exc}")
        return []

    rows = [r for r in (resp.data or []) if isinstance(r, dict)]
    picks: List[Dict] = []
    for raw in rows:
        job = _as_job_dict(raw)
        if not job:
            continue
        job_id = job.get("id")
        if not job_id:
            continue
        if not _job_in_country(job, country_scope or country_code, allow_missing=True, remote_if_missing=bool(country_scope or country_code)):
            continue
        effective_languages = cast(set[str], filters.get("language_codes") or allowed_language_codes or set())
        if not _job_language_allowed(job, effective_languages or None):
            continue
        profile_match, distance = _job_matches_digest_profile_filters(
            job,
            digest_filters=digest_filters,
            c_lat=c_lat,
            c_lng=c_lng,
        )
        if not profile_match:
            continue
        picks.append(
            {
                "id": job_id,
                "title": job.get("title") or "",
                "company": job.get("company") or "",
                "location": job.get("location") or "",
                "distance_km": round(float(distance), 2) if distance is not None else None,
                "match_score": None,
                "detail_url": _build_job_detail_url(job),
            }
        )
    picks = sorted(picks, key=_digest_job_sort_key)
    if picks:
        return picks[:limit]
    if not picks and lookback_hours:
        return _fetch_newest_jobs_relaxed(
            c_lat=c_lat,
            c_lng=c_lng,
            address=address,
            country_code=country_code,
            allowed_language_codes=allowed_language_codes,
            digest_filters=digest_filters,
            lookback_hours=None,
            limit=limit,
        )
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
                "candidate_profiles(lat,lng,address,job_title,skills,cv_text,cv_ai_text,tax_profile,preferences)"
            )
            .in_("role", ["candidate"])
            .or_("daily_digest_enabled.eq.true,daily_digest_push_enabled.eq.true")
            .execute()
        )
    except Exception as exc:
        print(f"⚠️ Daily digest profile fetch failed: {exc}")
        return

    rows = [r for r in (resp.data or []) if isinstance(r, dict)]
    print(f"📬 Daily digest candidates loaded: {len(rows)}")
    for row in rows:
        try:
            user_id = str(row.get("id") or "")
            email = str(row.get("email") or "")
            email_enabled = bool(row.get("daily_digest_enabled")) and bool(email)
            push_enabled = bool(row.get("daily_digest_push_enabled")) and is_push_configured()
            if not user_id or (not email_enabled and not push_enabled):
                print(
                    f"⏭️ [Digest] skipped user={user_id}: "
                    f"email_enabled={email_enabled}, push_enabled={push_enabled}, has_email={bool(email)}"
                )
                continue
    
            digest_time = _parse_digest_time(str(row.get("daily_digest_time") or "") or None)
            digest_tz = str(row.get("daily_digest_timezone") or _DEFAULT_TZ)
            candidate_profile = row.get("candidate_profiles")
            profile_last_sent = str(row.get("daily_digest_last_sent_at") or "") or None
            last_sent = _resolve_last_sent_marker(
                user_id=user_id,
                profile_last_sent=profile_last_sent,
                candidate_profile=candidate_profile,
            )
            _sync_profile_last_sent_if_stale(
                user_id=user_id,
                profile_last_sent=profile_last_sent,
                resolved_last_sent=last_sent,
            )
            if not _should_send_now(last_sent, digest_time, digest_tz):
                print(
                    f"⏭️ [Digest] outside window user={user_id}: "
                    f"time={digest_time}, tz={digest_tz}, last_sent={last_sent}"
                )
                continue

            c_lat, c_lng = _candidate_location(candidate_profile)
            c_address = _candidate_address(candidate_profile)
            profile_obj = _profile_obj(candidate_profile)
            tax_profile = profile_obj.get("tax_profile") if isinstance(profile_obj, dict) and isinstance(profile_obj.get("tax_profile"), dict) else {}
            tax_country_code = str(tax_profile.get("countryCode") or tax_profile.get("country_code") or "").strip().upper() or None
            digest_country_code = _resolve_digest_country_code(
                preferred_country_code=str(row.get("preferred_country_code") or "").strip().upper() or tax_country_code,
                preferred_locale=str(row.get("preferred_locale") or "") or None,
                candidate_profile=candidate_profile,
                c_lat=c_lat,
                c_lng=c_lng,
                digest_timezone=digest_tz,
            )
            locale = _resolve_locale(str(row.get("preferred_locale") or "") or None, digest_country_code)
            allowed_languages = _allowed_language_codes(locale, digest_country_code)
            digest_filters = _resolve_digest_profile_filters(
                candidate_profile,
                base_language_codes=allowed_languages,
                digest_country_code=digest_country_code,
                c_lat=c_lat,
                c_lng=c_lng,
            )
            intent = resolve_candidate_intent_profile(candidate_profile)
            role_title = str(intent.get("target_role") or "").strip()
            primary_domain = str(intent.get("primary_domain") or "").strip() or None
            secondary_domains = [str(item).strip() for item in (intent.get("secondary_domains") or []) if str(item).strip()]
            include_adjacent_domains = bool(intent.get("include_adjacent_domains", True))

            digest_jobs: List[Dict] = []
            role_jobs: List[Dict] = []
            domain_jobs: List[Dict] = []
            if _candidate_has_matching_signal(candidate_profile):
                try:
                    from ..matching_engine import recommend_jobs_for_user

                    personalized = recommend_jobs_for_user(
                        user_id=user_id,
                        limit=max(30, _DIGEST_MAX_JOBS * 3),
                        allow_cache=True,
                        candidate=profile_obj if isinstance(profile_obj, dict) else None,
                    )
                    digest_jobs = _pick_personalized_digest_jobs(
                        recs=personalized,
                        c_lat=c_lat,
                        c_lng=c_lng,
                        country_code=digest_country_code,
                        allowed_language_codes=allowed_languages,
                        candidate_profile=candidate_profile,
                        digest_filters=digest_filters,
                        limit=_DIGEST_MAX_JOBS,
                    )
                except Exception as exc:
                    print(f"⚠️ Personalized digest recommendation fetch failed for {user_id}: {exc}")
            if role_title:
                role_jobs = _fetch_role_focused_jobs(
                    role_title=role_title,
                    c_lat=c_lat,
                    c_lng=c_lng,
                    address=c_address,
                    country_code=digest_country_code,
                    allowed_language_codes=allowed_languages,
                    digest_filters=digest_filters,
                    limit=_DIGEST_MAX_JOBS,
                )
            if primary_domain:
                domain_jobs = _fetch_domain_focused_jobs(
                    domain_key=primary_domain,
                    c_lat=c_lat,
                    c_lng=c_lng,
                    address=c_address,
                    country_code=digest_country_code,
                    allowed_language_codes=allowed_languages,
                    digest_filters=digest_filters,
                    limit=_DIGEST_MAX_JOBS,
                )
            digest_jobs = _merge_digest_jobs(digest_jobs, _merge_digest_jobs(role_jobs, domain_jobs, _DIGEST_MAX_JOBS), _DIGEST_MAX_JOBS)
            if not digest_jobs and include_adjacent_domains:
                related_domains = list(dict.fromkeys(secondary_domains + get_related_domains(primary_domain)))
                for related_domain in related_domains[:2]:
                    adjacent_jobs = _fetch_domain_focused_jobs(
                        domain_key=related_domain,
                        c_lat=c_lat,
                        c_lng=c_lng,
                        address=c_address,
                        country_code=digest_country_code,
                        allowed_language_codes=allowed_languages,
                        digest_filters=digest_filters,
                        limit=max(3, _DIGEST_MAX_JOBS // 2),
                    )
                    digest_jobs = _merge_digest_jobs(digest_jobs, adjacent_jobs, _DIGEST_MAX_JOBS)
                    if len(digest_jobs) >= _DIGEST_MAX_JOBS:
                        break
    
            # Fallback for users with incomplete profiles (or empty personalized result):
            # deliver newest local jobs without AI match percentages.
            if not digest_jobs:
                digest_jobs = _fetch_newest_local_jobs(
                    c_lat=c_lat,
                    c_lng=c_lng,
                    address=c_address,
                    country_code=digest_country_code,
                    allowed_language_codes=allowed_languages,
                    digest_filters=digest_filters,
                    limit=_DIGEST_MAX_JOBS,
                )
                if not digest_jobs:
                    print(
                        f"⚠️ [Digest] strict/local selection returned 0 jobs for user={user_id}; "
                        "using relaxed fallback."
                    )
                    digest_jobs = _fetch_newest_jobs_relaxed(
                        c_lat=c_lat,
                        c_lng=c_lng,
                        address=c_address,
                        country_code=digest_country_code,
                        allowed_language_codes=allowed_languages,
                        digest_filters=digest_filters,
                        limit=_DIGEST_MAX_JOBS,
                    )
                if not digest_jobs and allowed_languages:
                    print(
                        f"⚠️ [Digest] language-filtered fallback returned 0 jobs for user={user_id}; "
                        "retrying without language restriction."
                    )
                    digest_jobs = _fetch_newest_jobs_relaxed(
                        c_lat=c_lat,
                        c_lng=c_lng,
                        address=c_address,
                        country_code=digest_country_code,
                        allowed_language_codes=None,
                        digest_filters={**digest_filters, "language_codes": set()},
                        limit=_DIGEST_MAX_JOBS,
                    )
                if not digest_jobs and digest_country_code:
                    print(
                        f"⚠️ [Digest] country fallback returned 0 jobs for user={user_id}; "
                        "retrying across all countries."
                    )
                    digest_jobs = _fetch_newest_jobs_relaxed(
                        c_lat=c_lat,
                        c_lng=c_lng,
                        address=c_address,
                        country_code=None,
                        allowed_language_codes=None,
                        digest_filters={**digest_filters, "country_scope": set(), "language_codes": set()},
                        limit=_DIGEST_MAX_JOBS,
                    )
    
            if not digest_jobs:
                print(f"⏭️ [Digest] skipped user={user_id}: no jobs available even after relaxed fallback")
                continue
    
            unsubscribe_url = ""
            if email_enabled:
                unsubscribe_token = make_unsubscribe_token(str(user_id), str(email))
                unsubscribe_url = f"{API_BASE_URL}/email/unsubscribe?uid={user_id}&token={unsubscribe_token}"
    
            email_ok = False
            if email_enabled:
                email_ok = send_daily_digest_email(
                    to_email=str(email),
                    full_name=str(row.get("full_name") or ""),
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
                    subs = [r for r in (subs_resp.data or []) if isinstance(r, dict)]
                    if subs:
                        titles = [str(j.get("title")) for j in digest_jobs if j.get("title")]
                        body = "\n".join(titles[:5])
                        push_copy = {
                            "cs": {
                                "title": "JobShaman \u2013 denní digest",
                                "fallback": "Máte nový přehled pracovních nabídek.",
                            },
                            "en": {
                                "title": "JobShaman \u2013 daily digest",
                                "fallback": "Your daily job matches are ready.",
                            },
                            "de": {
                                "title": "JobShaman \u2013 täglicher Digest",
                                "fallback": "Ihr täglicher Job\u2011Digest ist bereit.",
                            },
                            "pl": {
                                "title": "JobShaman \u2013 dzienny digest",
                                "fallback": "Twoje dzienne dopasowania są gotowe.",
                            },
                            "sk": {
                                "title": "JobShaman \u2013 denný digest",
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
    
            # Mark digest as sent when any enabled channel succeeds.
            # With a shared "last_sent" timestamp, this avoids repeated push delivery
            # when email is enabled but currently failing.
            sent_successfully = _did_any_enabled_digest_channel_succeed(
                email_enabled=email_enabled,
                email_ok=email_ok,
                push_enabled=push_enabled,
                push_ok=push_ok,
            )
    
            if sent_successfully:
                _persist_digest_last_sent(user_id=user_id, candidate_profile=candidate_profile, sent_at_iso=now_utc_iso)
            else:
                print(
                    f"⚠️ Digest not marked as sent for {user_id}: "
                    f"email_enabled={email_enabled}, email_ok={email_ok}, push_enabled={push_enabled}, push_ok={push_ok}"
                )
        except Exception as outer_exc:
            print(f"❌ CRITICAL ERROR processing digest for user {row.get('id')}: {outer_exc}")
