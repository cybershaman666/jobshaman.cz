"""
API/RSS-based job sources for imported listings.

- Arbeitnow: public Europe-focused job API
- We Work Remotely: public RSS feeds by category
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from importlib import import_module
import os
import time
from email.utils import parsedate_to_datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple
import xml.etree.ElementTree as ET

import requests
from bs4 import BeautifulSoup

def _import_first(module_names: list[str]) -> Any:
    last_error: Exception | None = None
    for module_name in module_names:
        try:
            return import_module(module_name)
        except Exception as exc:
            last_error = exc
    if last_error is not None:
        raise last_error
    raise ImportError("No module names provided")


_scraper_base = _import_first(["scraper.scraper_base", "backend.scraper.scraper_base"])
detect_work_type = _scraper_base.detect_work_type
extract_salary = _scraper_base.extract_salary
get_supabase_client = _scraper_base.get_supabase_client
normalize_country_code = _scraper_base.normalize_country_code
normalize_jobs_country_code = _scraper_base.normalize_jobs_country_code
norm_text = _scraper_base.norm_text
now_iso = _scraper_base.now_iso
save_job_to_supabase = _scraper_base.save_job_to_supabase

_geocoding = _import_first(["geocoding", "backend.geocoding"])
geocode_location = _geocoding.geocode_location
normalize_address = _geocoding.normalize_address


DEFAULT_ARBEITNOW_API_URL = "https://www.arbeitnow.com/api/job-board-api"
DEFAULT_JOOBLE_API_HOST = "cz.jooble.org"
DEFAULT_JOOBLE_API_HOSTS = {
    "CZ": "cz.jooble.org",
    "SK": "sk.jooble.org",
    "DE": "de.jooble.org",
    "AT": "at.jooble.org",
    "PL": "pl.jooble.org",
}
DEFAULT_JOOBLE_LANGUAGE_CODES = {
    "CZ": "cs",
    "SK": "sk",
    "DE": "de",
    "AT": "de",
    "PL": "pl",
}
DEFAULT_WWR_RSS_URLS = [
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
    "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
    "https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss",
    "https://weworkremotely.com/categories/remote-product-jobs.rss",
    "https://weworkremotely.com/categories/remote-design-jobs.rss",
    "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
    "https://weworkremotely.com/categories/all-other-remote-jobs.rss",
]
DEFAULT_GERMAN_TECH_JOBS_RSS_URL = "https://germantechjobs.de/rss"
HTTP_TIMEOUT_SECONDS = 30
LIVE_SEARCH_CACHE_TTL_SECONDS = max(30, int(os.getenv("LIVE_SEARCH_CACHE_TTL_SECONDS") or "900"))
LIVE_SEARCH_GEOCODE_TTL_SECONDS = max(300, int(os.getenv("LIVE_SEARCH_GEOCODE_TTL_SECONDS") or "86400"))
LIVE_SEARCH_CACHE_TABLE = "external_live_search_cache"
JOOBLE_HOST_FORBIDDEN_COOLDOWN_SECONDS = max(300, int(os.getenv("JOOBLE_HOST_FORBIDDEN_COOLDOWN_SECONDS") or "3600"))
_LIVE_SEARCH_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
_LIVE_GEOCODE_CACHE: Dict[str, Tuple[float, Optional[Dict[str, Any]]]] = {}
_JOOBLE_HOST_FORBIDDEN_UNTIL: Dict[str, float] = {}
_SUPABASE_CLIENT: Any = None
_SUPABASE_CLIENT_RESOLVED = False
_LIVE_SEARCH_CACHE_DB_AVAILABLE: Optional[bool] = None
_LIVE_GEOCODE_CACHE_DB_AVAILABLE: Optional[bool] = None
WWR_EU_INCLUDE_TOKENS = [
    "emea",
    "europe",
    "europe only",
    "european union",
    "eu only",
    "uk",
    "united kingdom",
    "germany",
    "deutschland",
    "austria",
    "österreich",
    "poland",
    "slovakia",
    "czech republic",
    "czechia",
    "česko",
    "france",
    "italy",
    "spain",
    "netherlands",
    "belgium",
    "portugal",
    "sweden",
    "norway",
    "denmark",
    "finland",
    "ireland",
    "switzerland",
]
WWR_NON_EU_EXCLUDE_TOKENS = [
    "united states",
    "usa only",
    "u.s.",
    "us only",
    "north america",
    "canada",
    "latin america",
    "latam",
    "apac",
    "asia pacific",
    "australia",
    "new zealand",
    # Note: worldwide/global roles are not "non-EU" by definition. Treat them as neutral.
    "worldwide",
    "anywhere in the world",
    "anywhere worldwide",
    "global",
]
WWR_NEUTRAL_TOKENS = [
    "worldwide",
    "anywhere in the world",
    "anywhere worldwide",
    "global",
    "anywhere",
]
WWR_HARD_EXCLUDE_TOKENS = [token for token in WWR_NON_EU_EXCLUDE_TOKENS if token not in set(WWR_NEUTRAL_TOKENS)]

_BROAD_LOCATION_TOKENS = {
    "remote",
    "worldwide",
    "global",
    "europe",
    "emea",
    "eu",
    "european union",
    "anywhere",
    "anywhere in the world",
    "north america",
    "united states",
    "usa",
    "canada",
    "germany",
    "deutschland",
    "austria",
    "osterreich",
    "österreich",
    "poland",
    "slovakia",
    "czech republic",
    "czechia",
}


def _html_to_text(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if "<" not in raw and ">" not in raw:
        return norm_text(raw)
    soup = BeautifulSoup(raw, "html.parser")
    return soup.get_text("\n", strip=True)

def _xml_local_name(tag: str) -> str:
    if not tag:
        return ""
    return tag.split("}", 1)[-1]


def _rss_item_child_text(item: ET.Element, name: str) -> str:
    wanted = name.lower()
    for child in list(item):
        if _xml_local_name(child.tag).lower() == wanted:
            return norm_text(child.text or "")
    return ""


def _parse_rss_items(payload: str) -> List[Dict[str, Any]]:
    # Avoid BeautifulSoup("xml") which depends on optional parsers (lxml).
    # Standard library XML parser is enough for RSS feeds we consume here.
    try:
        root = ET.fromstring((payload or "").lstrip())
    except Exception as exc:
        print(f"⚠️ RSS XML parse failed: {exc}")
        return []

    items: List[Dict[str, Any]] = []
    for item in root.iter():
        if _xml_local_name(item.tag).lower() != "item":
            continue

        title = _rss_item_child_text(item, "title")
        link = _rss_item_child_text(item, "link")
        description = ""
        for child in list(item):
            if _xml_local_name(child.tag).lower() == "description":
                description = child.text or ""
                break
        pub_date = _rss_item_child_text(item, "pubDate")

        categories: List[str] = []
        for child in list(item):
            if _xml_local_name(child.tag).lower() == "category":
                value = norm_text(child.text or "")
                if value:
                    categories.append(value)

        items.append({
            "title": title,
            "link": link,
            "description": description,
            "pubDate": pub_date,
            "categories": categories,
        })

    return items


def _as_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [norm_text(str(item)) for item in value if norm_text(str(item))]
    if isinstance(value, str):
        return [part for part in (norm_text(x) for x in value.split(",")) if part]
    return [norm_text(str(value))]


COUNTRY_DETECTION_RULES: List[Tuple[str, str]] = [
    ("canada", "ca"),
    ("toronto", "ca"),
    ("vancouver", "ca"),
    ("montreal", "ca"),
    ("united states", "us"),
    ("usa", "us"),
    ("new york", "us"),
    ("california", "us"),
    ("texas", "us"),
    ("united kingdom", "gb"),
    ("london", "gb"),
    ("manchester", "gb"),
    ("austria", "at"),
    ("österreich", "at"),
    ("vienna", "at"),
    ("wien", "at"),
    ("germany", "de"),
    ("deutschland", "de"),
    ("berlin", "de"),
    ("munich", "de"),
    ("münchen", "de"),
    ("hamburg", "de"),
    ("frankfurt", "de"),
    ("cologne", "de"),
    ("köln", "de"),
    ("poland", "pl"),
    ("polska", "pl"),
    ("warsaw", "pl"),
    ("krakow", "pl"),
    ("wroclaw", "pl"),
    ("slovakia", "sk"),
    ("slovensko", "sk"),
    ("bratislava", "sk"),
    ("czech republic", "cs"),
    ("czechia", "cs"),
    ("czech", "cs"),
    ("cesko", "cs"),
    ("česko", "cs"),
    ("prague", "cs"),
    ("praha", "cs"),
    ("netherlands", "nl"),
    ("amsterdam", "nl"),
    ("rotterdam", "nl"),
    ("france", "fr"),
    ("paris", "fr"),
    ("lyon", "fr"),
    ("spain", "es"),
    ("madrid", "es"),
    ("barcelona", "es"),
    ("italy", "it"),
    ("rome", "it"),
    ("milan", "it"),
]


def _infer_country_code(location: str, tags: Iterable[str], extra_text: str = "") -> Optional[str]:
    haystack = f"{location} {' '.join(tags)} {extra_text}".lower()
    rules = [
        (" at ", "at"),
        ("remote / germany", "de"),
        ("remote / austria", "at"),
        ("remote / poland", "pl"),
        ("remote / slovakia", "sk"),
        ("remote / czech", "cs"),
    ]
    for needle, code in rules:
        if needle in haystack:
            return code
    for needle, code in COUNTRY_DETECTION_RULES:
        if needle in haystack:
            return code
    return None


def _extract_wwr_location_and_country(title: str, description: str, categories: Iterable[str]) -> Tuple[str, Optional[str]]:
    combined_text = norm_text("\n".join([title or "", description or "", " ".join(categories or [])]))
    lowered = combined_text.lower()

    explicit_location_markers: List[Tuple[str, str, Optional[str]]] = [
        ("europe", "Europe", None),
        ("emea", "EMEA", None),
        ("united kingdom", "United Kingdom", "gb"),
        ("uk", "United Kingdom", "gb"),
        ("germany", "Germany", "de"),
        ("deutschland", "Germany", "de"),
        ("austria", "Austria", "at"),
        ("österreich", "Austria", "at"),
        ("poland", "Poland", "pl"),
        ("slovakia", "Slovakia", "sk"),
        ("czech republic", "Czech Republic", "cs"),
        ("czechia", "Czech Republic", "cs"),
        ("canada", "Canada", "ca"),
        ("united states", "United States", "us"),
        ("usa", "United States", "us"),
    ]
    for marker, label, code in explicit_location_markers:
        if marker in lowered:
            return label, code

    inferred_country = _infer_country_code("", categories, combined_text)
    if inferred_country == "de":
        return "Germany", inferred_country
    if inferred_country == "at":
        return "Austria", inferred_country
    if inferred_country == "pl":
        return "Poland", inferred_country
    if inferred_country == "sk":
        return "Slovakia", inferred_country
    if inferred_country == "cs":
        return "Czech Republic", inferred_country

    return "Remote", None


def _build_contract_type(value: Any) -> Optional[str]:
    items = _as_list(value)
    if not items:
        return None
    return ", ".join(items[:3])


def _infer_work_model(location: str, description: str, tags: Iterable[str]) -> str:
    haystack = f"{location} {description} {' '.join(tags)}".lower()
    if "hybrid" in haystack:
        return "Hybrid"
    if any(token in haystack for token in ["remote", "work from home", "anywhere", "distributed", "home office"]):
        return "Remote"
    return "On-site"


def _is_wwr_eu_relevant(title: str, description: str, categories: Iterable[str]) -> bool:
    haystack = norm_text("\n".join([
        title or "",
        description or "",
        " ".join(categories or []),
    ])).lower()
    if not haystack:
        return False

    # Hard geo constraints first (US-only, APAC-only, etc.).
    if any(token in haystack for token in WWR_HARD_EXCLUDE_TOKENS):
        return False

    if any(token in haystack for token in WWR_EU_INCLUDE_TOKENS):
        return True

    # Worldwide roles are generally EU-relevant for EU candidates.
    if any(token in haystack for token in WWR_NEUTRAL_TOKENS):
        return True

    return False


def _pick_default_country_code(allowed_country_codes: set[str]) -> Optional[str]:
    if not allowed_country_codes:
        return None
    # Prefer CZ to keep default behavior stable for Czech-first deployments.
    if "CZ" in allowed_country_codes:
        return "CZ"
    return sorted(allowed_country_codes)[0]


def _save_api_job(
    supabase_client: Any,
    seen_urls: set[str],
    *,
    title: str,
    company: str,
    location: str,
    description: str,
    url: str,
    tags: Optional[List[str]] = None,
    contract_type: Optional[str] = None,
    salary_text: Optional[str] = None,
    country_code: Optional[str] = None,
    salary_currency: Optional[str] = None,
    work_model: Optional[str] = None,
) -> bool:
    clean_url = norm_text(url)
    if not clean_url:
        return False

    cleaned_title = norm_text(title) or "Remote role"
    cleaned_company = norm_text(company) or "Unknown company"
    cleaned_location = norm_text(location) or "Remote"
    cleaned_description = _html_to_text(description) or cleaned_title
    normalized_tags = [tag for tag in _as_list(tags) if tag]

    salary_from, salary_to, detected_currency = extract_salary(salary_text or "", salary_currency or "EUR")
    job_data: Dict[str, Any] = {
        "title": cleaned_title,
        "company": cleaned_company,
        "location": cleaned_location,
        "description": cleaned_description,
        "url": clean_url,
        "benefits": normalized_tags[:8],
        "contract_type": contract_type,
        "work_type": work_model or detect_work_type(cleaned_title, cleaned_description, cleaned_location),
        "work_model": work_model or _infer_work_model(cleaned_location, cleaned_description, normalized_tags),
        "salary_from": salary_from,
        "salary_to": salary_to,
        "salary_currency": detected_currency or salary_currency or "EUR",
        "scraped_at": now_iso(),
    }
    resolved_country_code = country_code or _infer_country_code(cleaned_location, normalized_tags, cleaned_description)
    if resolved_country_code:
        job_data["country_code"] = resolved_country_code
    return save_job_to_supabase(supabase_client, job_data, seen_urls=seen_urls)


def _request_json(url: str, *, params: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None) -> Any:
    response = requests.get(url, params=params, headers=headers, timeout=HTTP_TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.json()


def _request_text(url: str, *, headers: Optional[Dict[str, str]] = None) -> str:
    response = requests.get(url, headers=headers, timeout=HTTP_TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.text


def _build_live_cache_key(prefix: str, **parts: Any) -> str:
    normalized_parts: List[str] = [prefix]
    for key in sorted(parts.keys()):
        value = parts[key]
        if isinstance(value, (list, tuple, set)):
            normalized = ",".join(sorted(str(item).strip().upper() for item in value if str(item).strip()))
        else:
            normalized = str(value or "").strip().lower()
        normalized_parts.append(f"{key}={normalized}")
    return "|".join(normalized_parts)


def _get_cache_supabase_client() -> Any:
    global _SUPABASE_CLIENT, _SUPABASE_CLIENT_RESOLVED
    if _SUPABASE_CLIENT_RESOLVED:
        return _SUPABASE_CLIENT
    _SUPABASE_CLIENT_RESOLVED = True
    try:
        _SUPABASE_CLIENT = get_supabase_client()
    except Exception as exc:
        print(f"⚠️ Live cache Supabase client init failed: {exc}")
        _SUPABASE_CLIENT = None
    return _SUPABASE_CLIENT


def _should_disable_cache_table(exc: Exception, table_name: str) -> bool:
    message = str(exc).lower()
    return (
        table_name.lower() in message
        and (
            "does not exist" in message
            or "relation" in message
            or "schema cache" in message
            or "column" in message
        )
    )


def _get_cached_live_search_from_db(cache_key: str) -> Optional[List[Dict[str, Any]]]:
    global _LIVE_SEARCH_CACHE_DB_AVAILABLE
    if _LIVE_SEARCH_CACHE_DB_AVAILABLE is False:
        return None

    supabase = _get_cache_supabase_client()
    if not supabase:
        return None

    try:
        response = (
            supabase.table(LIVE_SEARCH_CACHE_TABLE)
            .select("payload_json")
            .eq("cache_key", cache_key)
            .gte("expires_at", datetime.now(timezone.utc).isoformat())
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        if _should_disable_cache_table(exc, LIVE_SEARCH_CACHE_TABLE):
            _LIVE_SEARCH_CACHE_DB_AVAILABLE = False
        print(f"⚠️ Live search DB cache read failed: {exc}")
        return None

    # Some Supabase client wrappers can return None on failure without raising.
    if response is None:
        _LIVE_SEARCH_CACHE_DB_AVAILABLE = False
        return None

    row = response.data or None
    payload = row.get("payload_json") if isinstance(row, dict) else None
    if not isinstance(payload, list):
        return None

    snapshot = [dict(item) for item in payload if isinstance(item, dict)]
    _LIVE_SEARCH_CACHE[cache_key] = (time.time(), snapshot)
    _LIVE_SEARCH_CACHE_DB_AVAILABLE = True
    return [dict(item) for item in snapshot]


def _set_cached_live_search_in_db(
    cache_key: str,
    payload: List[Dict[str, Any]],
    *,
    provider: str,
    search_term: str = "",
    filter_city: str = "",
    country_codes: Optional[List[str]] = None,
    exclude_country_codes: Optional[List[str]] = None,
    page: int = 1,
) -> None:
    global _LIVE_SEARCH_CACHE_DB_AVAILABLE
    if _LIVE_SEARCH_CACHE_DB_AVAILABLE is False:
        return

    supabase = _get_cache_supabase_client()
    if not supabase:
        return

    now = datetime.now(timezone.utc)
    snapshot = [dict(item) for item in payload]
    try:
        supabase.table(LIVE_SEARCH_CACHE_TABLE).upsert(
            {
                "cache_key": cache_key,
                "provider": provider,
                "search_term": norm_text(search_term),
                "filter_city": norm_text(filter_city),
                "country_codes": [
                    code for code in (normalize_country_code(value) for value in (country_codes or [])) if code
                ],
                "exclude_country_codes": [
                    code for code in (normalize_country_code(value) for value in (exclude_country_codes or [])) if code
                ],
                "page": max(1, int(page or 1)),
                "result_count": len(snapshot),
                "payload_json": snapshot,
                "fetched_at": now.isoformat(),
                "expires_at": (now + timedelta(seconds=LIVE_SEARCH_CACHE_TTL_SECONDS)).isoformat(),
                "updated_at": now.isoformat(),
            },
            on_conflict="cache_key",
        ).execute()
        _LIVE_SEARCH_CACHE_DB_AVAILABLE = True
    except Exception as exc:
        if _should_disable_cache_table(exc, LIVE_SEARCH_CACHE_TABLE):
            _LIVE_SEARCH_CACHE_DB_AVAILABLE = False
        print(f"⚠️ Live search DB cache write failed: {exc}")


def _get_cached_live_search(cache_key: str) -> Optional[List[Dict[str, Any]]]:
    cached = _LIVE_SEARCH_CACHE.get(cache_key)
    if not cached:
        return _get_cached_live_search_from_db(cache_key)
    cached_at, payload = cached
    if time.time() - cached_at > LIVE_SEARCH_CACHE_TTL_SECONDS:
        _LIVE_SEARCH_CACHE.pop(cache_key, None)
        return _get_cached_live_search_from_db(cache_key)
    return [dict(item) for item in payload]


def _set_cached_live_search(
    cache_key: str,
    payload: List[Dict[str, Any]],
    *,
    provider: str,
    search_term: str = "",
    filter_city: str = "",
    country_codes: Optional[List[str]] = None,
    exclude_country_codes: Optional[List[str]] = None,
    page: int = 1,
) -> List[Dict[str, Any]]:
    snapshot = [dict(item) for item in payload]
    _LIVE_SEARCH_CACHE[cache_key] = (time.time(), snapshot)
    _set_cached_live_search_in_db(
        cache_key,
        snapshot,
        provider=provider,
        search_term=search_term,
        filter_city=filter_city,
        country_codes=country_codes,
        exclude_country_codes=exclude_country_codes,
        page=page,
    )
    return [dict(item) for item in snapshot]


def _get_cached_live_geocode_from_db(location: str) -> Optional[Optional[Dict[str, Any]]]:
    global _LIVE_GEOCODE_CACHE_DB_AVAILABLE
    if _LIVE_GEOCODE_CACHE_DB_AVAILABLE is False:
        return None

    supabase = _get_cache_supabase_client()
    if not supabase:
        return None

    normalized = normalize_address(location)
    if not normalized:
        return None

    freshness_cutoff = (
        datetime.now(timezone.utc) - timedelta(seconds=LIVE_SEARCH_GEOCODE_TTL_SECONDS)
    ).isoformat()
    try:
        response = (
            supabase.table("geocode_cache")
            .select("lat, lon, country")
            .eq("address_normalized", normalized)
            .gte("cached_at", freshness_cutoff)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        if _should_disable_cache_table(exc, "geocode_cache"):
            _LIVE_GEOCODE_CACHE_DB_AVAILABLE = False
        print(f"⚠️ Live geocode DB cache read failed: {exc}")
        return None

    if response is None:
        _LIVE_GEOCODE_CACHE_DB_AVAILABLE = False
        return None

    row = response.data or None
    if not isinstance(row, dict):
        return None

    geo = {
        "lat": row.get("lat"),
        "lon": row.get("lon"),
        "country": row.get("country"),
        "source": "supabase_geocode_cache",
    }
    _LIVE_GEOCODE_CACHE[location] = (time.time(), dict(geo))
    _LIVE_GEOCODE_CACHE_DB_AVAILABLE = True
    return geo


def _set_cached_live_geocode_in_db(location: str, payload: Optional[Dict[str, Any]]) -> None:
    global _LIVE_GEOCODE_CACHE_DB_AVAILABLE
    if _LIVE_GEOCODE_CACHE_DB_AVAILABLE is False or not isinstance(payload, dict):
        return

    supabase = _get_cache_supabase_client()
    if not supabase:
        return

    normalized = normalize_address(location)
    if not normalized:
        return

    try:
        supabase.table("geocode_cache").upsert(
            {
                "address_normalized": normalized,
                "address_original": location,
                "lat": float(payload.get("lat")),
                "lon": float(payload.get("lon")),
                "country": payload.get("country"),
                "cached_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="address_normalized",
        ).execute()
        _LIVE_GEOCODE_CACHE_DB_AVAILABLE = True
    except Exception as exc:
        if _should_disable_cache_table(exc, "geocode_cache"):
            _LIVE_GEOCODE_CACHE_DB_AVAILABLE = False
        print(f"⚠️ Live geocode DB cache write failed: {exc}")


def _get_cached_live_geocode(location: str) -> Optional[Optional[Dict[str, Any]]]:
    cached = _LIVE_GEOCODE_CACHE.get(location)
    if not cached:
        return _get_cached_live_geocode_from_db(location)
    cached_at, payload = cached
    if time.time() - cached_at > LIVE_SEARCH_GEOCODE_TTL_SECONDS:
        _LIVE_GEOCODE_CACHE.pop(location, None)
        return _get_cached_live_geocode_from_db(location)
    return dict(payload) if isinstance(payload, dict) else payload


def _set_cached_live_geocode(location: str, payload: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    snapshot = dict(payload) if isinstance(payload, dict) else None
    _LIVE_GEOCODE_CACHE[location] = (time.time(), snapshot)
    _set_cached_live_geocode_in_db(location, snapshot)
    return dict(snapshot) if isinstance(snapshot, dict) else None


def _resolve_wwr_rss_urls() -> List[str]:
    raw = (os.getenv("WWR_RSS_URLS") or os.getenv("WWR_API_URL") or "").strip()
    if not raw:
        return DEFAULT_WWR_RSS_URLS[:]
    parts = [norm_text(item) for item in raw.split(",")]
    return [item for item in parts if item]


def _resolve_german_tech_jobs_rss_url() -> str:
    return norm_text(os.getenv("GERMAN_TECH_JOBS_RSS_URL") or DEFAULT_GERMAN_TECH_JOBS_RSS_URL)


def _resolve_jooble_api_key() -> str:
    return norm_text(os.getenv("JOOBLE_API_KEY"))


def _resolve_jooble_api_host() -> str:
    return norm_text(os.getenv("JOOBLE_API_HOST") or DEFAULT_JOOBLE_API_HOST)


def _resolve_jooble_api_hosts() -> Dict[str, str]:
    resolved = dict(DEFAULT_JOOBLE_API_HOSTS)
    raw = norm_text(os.getenv("JOOBLE_API_HOSTS"))
    if raw:
        for chunk in raw.split(","):
            part = norm_text(chunk)
            if not part or "=" not in part:
                continue
            code_raw, host_raw = part.split("=", 1)
            code = normalize_country_code(code_raw)
            host = norm_text(host_raw)
            if code and host:
                resolved[code] = host

    fallback = _resolve_jooble_api_host()
    if fallback:
        resolved.setdefault("DEFAULT", fallback)
    return resolved


def _resolve_jooble_allowed_country_codes() -> List[str]:
    raw = norm_text(os.getenv("JOOBLE_ALLOWED_COUNTRY_CODES") or os.getenv("JOOBLE_USABLE_COUNTRY_CODES"))
    if not raw:
        return []
    result: List[str] = []
    for chunk in raw.split(","):
        code = normalize_country_code(chunk)
        if code and code not in result:
            result.append(code)
    return result


def _resolve_jooble_language_code(country_codes: Optional[List[str]] = None) -> str:
    normalized_codes = [
        code for code in (normalize_country_code(value) for value in (country_codes or [])) if code
    ]
    if len(normalized_codes) == 1:
        return DEFAULT_JOOBLE_LANGUAGE_CODES.get(normalized_codes[0], "en")
    return "en"


def _iter_jooble_candidate_hosts(country_codes: Optional[List[str]] = None) -> List[Tuple[Optional[str], str]]:
    hosts = _resolve_jooble_api_hosts()
    allowed_codes = set(_resolve_jooble_allowed_country_codes())
    normalized_codes = [
        code for code in (normalize_country_code(value) for value in (country_codes or [])) if code
    ]
    candidates: List[Tuple[Optional[str], str]] = []
    seen: set[str] = set()

    def _push(code: Optional[str], host: Optional[str]) -> None:
        resolved_host = norm_text(host)
        if not resolved_host or resolved_host in seen:
            return
        if code and allowed_codes and code not in allowed_codes:
            return
        seen.add(resolved_host)
        candidates.append((code, resolved_host))

    if len(normalized_codes) == 1:
        preferred_code = normalized_codes[0]
        _push(preferred_code, hosts.get(preferred_code))

    fallback = hosts.get("DEFAULT") or _resolve_jooble_api_host()
    _push("DEFAULT", fallback)

    for code, host in hosts.items():
        if code == "DEFAULT":
            continue
        _push(code, host)

    return candidates


def _is_jooble_host_available(host: str) -> bool:
    cooldown_until = _JOOBLE_HOST_FORBIDDEN_UNTIL.get(host)
    if cooldown_until and cooldown_until > time.time():
        return False
    if cooldown_until:
        _JOOBLE_HOST_FORBIDDEN_UNTIL.pop(host, None)
    return True


def _wwr_db_import_enabled() -> bool:
    return (os.getenv("ENABLE_WWR_DB_IMPORT") or "true").strip().lower() in {"1", "true", "yes", "on"}


def _parse_wwr_pub_date(raw: str) -> Optional[str]:
    value = norm_text(raw)
    if not value:
        return None
    try:
        return parsedate_to_datetime(value).isoformat()
    except Exception:
        return None


def _build_wwr_live_job(
    *,
    title: str,
    company: str,
    location: str,
    description: str,
    link: str,
    categories: List[str],
    country_code: Optional[str],
    scraped_at: Optional[str],
) -> Dict[str, Any]:
    salary_from, salary_to, detected_currency = extract_salary(description or "", "EUR")
    normalized_country = normalize_country_code(country_code)
    payload = {
        "id": link,
        "title": title or "Remote role",
        "company": company or "Unknown company",
        "location": location or "Remote",
        "description": _html_to_text(description) or title or "Remote role",
        "url": link,
        "source": "weworkremotely.com",
        "benefits": categories[:8],
        "tags": categories[:8],
        "contract_type": None,
        "work_type": "Remote",
        "work_model": "Remote",
        "salary_from": salary_from,
        "salary_to": salary_to,
        "salary_currency": detected_currency or "EUR",
        "salary_timeframe": "month",
        "scraped_at": scraped_at or now_iso(),
        "country_code": normalized_country,
        "language_code": "en",
        "education_level": None,
        "legality_status": "legal",
        "verification_notes": "Live RSS import from We Work Remotely",
    }
    _attach_live_coordinates(payload)
    return payload


def _country_code_to_jooble_location(country_code: Optional[str]) -> str:
    normalized = normalize_country_code(country_code)
    mapping = {
        "CZ": "Czech Republic",
        "SK": "Slovakia",
        "PL": "Poland",
        "DE": "Germany",
        "AT": "Austria",
        "GB": "United Kingdom",
        "NL": "Netherlands",
        "FR": "France",
        "ES": "Spain",
        "IT": "Italy",
        "CH": "Switzerland",
        "BE": "Belgium",
        "PT": "Portugal",
        "SE": "Sweden",
        "DK": "Denmark",
        "FI": "Finland",
        "IE": "Ireland",
    }
    return mapping.get(normalized or "", "")


def _build_jooble_live_job(item: Dict[str, Any]) -> Dict[str, Any]:
    title = norm_text(item.get("title") or "")
    location = norm_text(item.get("location") or "Remote")
    company = norm_text(item.get("company") or "Unknown company")
    snippet = str(item.get("snippet") or "")
    salary_text = norm_text(item.get("salary") or "")
    source = norm_text(item.get("source") or "jooble")
    link = norm_text(item.get("link") or "")
    updated = norm_text(item.get("updated") or "") or now_iso()
    type_label = norm_text(item.get("type") or "")
    salary_from, salary_to, detected_currency = extract_salary(salary_text, "EUR")
    country_code = _infer_country_code(location, [source, type_label], snippet)

    benefits: List[str] = []
    if type_label:
        benefits.append(type_label)
    if source:
        benefits.append(source)

    normalized_country_code = normalize_country_code(country_code)
    payload = {
        "id": str(item.get("id") or link or f"jooble:{title}:{company}:{location}"),
        "title": title or "Remote role",
        "company": company,
        "location": location or "Remote",
        "description": _html_to_text(snippet) or title or "Remote role",
        "url": link,
        "source": f"jooble:{source}" if source else "jooble",
        "benefits": benefits[:8],
        "tags": benefits[:8],
        "contract_type": type_label or None,
        "work_type": detect_work_type(title, snippet, location),
        "work_model": _infer_work_model(location, snippet, benefits),
        "salary_from": salary_from,
        "salary_to": salary_to,
        "salary_currency": detected_currency or "EUR",
        "salary_timeframe": "month",
        "scraped_at": updated,
        "country_code": normalized_country_code,
        "language_code": DEFAULT_JOOBLE_LANGUAGE_CODES.get(normalized_country_code or "", "en"),
        "education_level": None,
        "legality_status": "legal",
        "verification_notes": "Live API import from Jooble",
    }
    _attach_live_coordinates(payload)
    return payload


def _location_precise_enough_for_geocoding(location: str) -> bool:
    normalized = norm_text(location).lower()
    if not normalized:
        return False
    if normalized in _BROAD_LOCATION_TOKENS:
        return False
    if any(token in normalized for token in ["remote", "worldwide", "anywhere", "global", "emea"]):
        return False
    segments = [part.strip() for part in normalized.replace("/", ",").split(",") if part.strip()]
    if len(segments) >= 2:
        return True
    tokens = normalized.split()
    if len(tokens) >= 2 and normalized not in _BROAD_LOCATION_TOKENS:
        return True
    return False


def _attach_live_coordinates(job_data: Dict[str, Any]) -> None:
    location = norm_text(job_data.get("location") or "")
    if not _location_precise_enough_for_geocoding(location):
        return
    geo = _get_cached_live_geocode(location)
    if geo is None and location not in _LIVE_GEOCODE_CACHE:
        try:
            geo = geocode_location(location)
        except Exception as exc:
            print(f"⚠️ Live geocoding failed for '{location}': {exc}")
            _set_cached_live_geocode(location, None)
            return
        _set_cached_live_geocode(location, geo)
    if not geo:
        return
    try:
        job_data["lat"] = float(geo.get("lat"))
        job_data["lng"] = float(geo.get("lon"))
    except Exception:
        return
    geocoded_country = normalize_jobs_country_code(geo.get("country"))
    if geocoded_country and not job_data.get("country_code"):
        job_data["country_code"] = normalize_country_code(geocoded_country)


def search_weworkremotely_jobs_live(
    *,
    limit: int = 20,
    search_term: str = "",
    filter_city: str = "",
    country_codes: Optional[List[str]] = None,
    exclude_country_codes: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    cache_key = _build_live_cache_key(
        "wwr",
        limit=limit,
        search_term=search_term,
        filter_city=filter_city,
        country_codes=country_codes or [],
        exclude_country_codes=exclude_country_codes or [],
    )
    cached = _get_cached_live_search(cache_key)
    if cached is not None:
        return cached[: max(1, limit)]

    rss_urls = _resolve_wwr_rss_urls()
    normalized_search_tokens = [token for token in norm_text(search_term).lower().split() if token]
    normalized_city_tokens = [token for token in norm_text(filter_city).lower().split() if token]
    allowed_country_codes = {
        code for code in (normalize_country_code(value) for value in (country_codes or [])) if code
    }
    blocked_country_codes = {
        code for code in (normalize_country_code(value) for value in (exclude_country_codes or [])) if code
    }

    results: List[Dict[str, Any]] = []
    seen_urls: set[str] = set()

    for rss_url in rss_urls:
        try:
            payload = _request_text(
                rss_url,
                headers={"Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8"},
            )
        except Exception as exc:
            print(f"❌ WWR live RSS fetch failed for {rss_url}: {exc}")
            continue

        items = _parse_rss_items(payload)
        if not items:
            continue

        for item in items:
            raw_title = norm_text(item.get("title") or "")
            description = str(item.get("description") or "")
            link = norm_text(item.get("link") or "")
            pub_date = _parse_wwr_pub_date(str(item.get("pubDate") or "")) if item.get("pubDate") else None

            if not raw_title or not link or link in seen_urls:
                continue

            title = raw_title
            company = ""
            if " at " in raw_title:
                role_part, company_part = raw_title.split(" at ", 1)
                title = norm_text(role_part)
                company = norm_text(company_part)

            categories = [norm_text(x) for x in (item.get("categories") or []) if norm_text(x)]
            if not _is_wwr_eu_relevant(title, description, categories):
                continue

            location, inferred_country_code = _extract_wwr_location_and_country(title, description, categories)
            normalized_country = normalize_country_code(inferred_country_code)
            if allowed_country_codes:
                if normalized_country is None:
                    # WWR often doesn't include a concrete country. If the caller requests countries
                    # (candidate availability), pin to one of them so the job isn't dropped.
                    normalized_country = _pick_default_country_code(allowed_country_codes)
                if normalized_country not in allowed_country_codes:
                    continue
            if normalized_country and normalized_country in blocked_country_codes:
                continue

            haystack = norm_text("\n".join([
                title,
                company,
                location,
                description,
                " ".join(categories),
            ])).lower()
            if normalized_search_tokens and not all(token in haystack for token in normalized_search_tokens):
                continue
            if normalized_city_tokens and not all(token in haystack for token in normalized_city_tokens):
                continue

            results.append(
                _build_wwr_live_job(
                    title=title,
                    company=company,
                    location=location,
                    description=description,
                    link=link,
                    categories=categories,
                    country_code=normalized_country,
                    scraped_at=pub_date,
                )
            )
            seen_urls.add(link)

            if len(results) >= max(1, limit):
                return _set_cached_live_search(
                    cache_key,
                    results,
                    provider="weworkremotely",
                    search_term=search_term,
                    filter_city=filter_city,
                    country_codes=list(allowed_country_codes),
                    exclude_country_codes=list(blocked_country_codes),
                )[: max(1, limit)]

    return _set_cached_live_search(
        cache_key,
        results,
        provider="weworkremotely",
        search_term=search_term,
        filter_city=filter_city,
        country_codes=list(allowed_country_codes),
        exclude_country_codes=list(blocked_country_codes),
    )


def search_jooble_jobs_live(
    *,
    limit: int = 20,
    search_term: str = "",
    filter_city: str = "",
    country_codes: Optional[List[str]] = None,
    exclude_country_codes: Optional[List[str]] = None,
    page: int = 1,
) -> List[Dict[str, Any]]:
    cache_key = _build_live_cache_key(
        "jooble",
        limit=limit,
        page=page,
        search_term=search_term,
        filter_city=filter_city,
        country_codes=country_codes or [],
        exclude_country_codes=exclude_country_codes or [],
    )
    cached = _get_cached_live_search(cache_key)
    if cached is not None:
        return cached[: max(1, limit)]

    api_key = _resolve_jooble_api_key()
    candidate_hosts = _iter_jooble_candidate_hosts(country_codes)
    if not api_key or not candidate_hosts:
        return []

    keywords = norm_text(search_term)
    if not keywords:
        return []

    allowed_country_codes = [
        code for code in (normalize_country_code(value) for value in (country_codes or [])) if code
    ]
    blocked_country_codes = {
        code for code in (normalize_country_code(value) for value in (exclude_country_codes or [])) if code
    }

    location = norm_text(filter_city)
    if len(allowed_country_codes) == 1:
        country_location = _country_code_to_jooble_location(allowed_country_codes[0])
        if location:
            location = f"{location}, {country_location}" if country_location else location
        else:
            location = country_location

    payload: Dict[str, Any] = {
        "keywords": keywords,
        "page": str(max(1, page)),
        "ResultOnPage": str(max(1, min(limit, 20))),
        "SearchMode": "0",
    }
    if location:
        payload["location"] = location
    payload["language"] = _resolve_jooble_language_code(allowed_country_codes)

    last_error: Exception | None = None
    data: Dict[str, Any] | None = None
    successful_host: str | None = None
    forbidden_hosts: List[str] = []

    for host_code, api_host in candidate_hosts:
        if not _is_jooble_host_available(api_host):
            continue

        endpoint = f"https://{api_host}/api/{api_key}"
        try:
            response = requests.post(endpoint, json=payload, timeout=HTTP_TIMEOUT_SECONDS)
            response.raise_for_status()
            parsed = response.json() if response.content else {}
            if isinstance(parsed, dict):
                data = parsed
                successful_host = api_host
                break
            last_error = RuntimeError(f"Jooble API returned invalid payload for host {api_host}")
            print(f"❌ Jooble live API payload invalid for host {api_host}")
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            if status_code == 403:
                _JOOBLE_HOST_FORBIDDEN_UNTIL[api_host] = time.time() + JOOBLE_HOST_FORBIDDEN_COOLDOWN_SECONDS
                forbidden_hosts.append(api_host)
                last_error = PermissionError(f"Jooble API forbidden for host {api_host}")
                print(f"❌ Jooble live API request forbidden for host {api_host}")
                continue
            last_error = RuntimeError(f"Jooble API request failed for host {api_host}: HTTP {status_code or 'unknown'}")
            print(f"❌ Jooble live API request failed for host {api_host}: {exc}")
            continue
        except Exception as exc:
            last_error = RuntimeError(f"Jooble API request failed for host {api_host}: {exc}")
            print(f"❌ Jooble live API request failed for host {api_host}: {exc}")
            continue

    if data is None:
        if forbidden_hosts and len(forbidden_hosts) >= len(candidate_hosts):
            raise PermissionError(f"Jooble API forbidden for all candidate hosts: {', '.join(forbidden_hosts)}")
        if last_error:
            raise last_error
        return []

    jobs = data.get("jobs") if isinstance(data, dict) else None
    if not isinstance(jobs, list):
        return []

    results: List[Dict[str, Any]] = []
    seen_urls: set[str] = set()
    for item in jobs:
        if not isinstance(item, dict):
            continue
        mapped = _build_jooble_live_job(item)
        url = norm_text(mapped.get("url") or "")
        if not url or url in seen_urls:
            continue

        mapped_country = normalize_country_code(mapped.get("country_code"))
        if not mapped_country and len(allowed_country_codes) == 1:
            mapped["country_code"] = allowed_country_codes[0]
            mapped_country = allowed_country_codes[0]
        if successful_host and not mapped.get("language_code"):
            mapped["language_code"] = _resolve_jooble_language_code(allowed_country_codes)
        if allowed_country_codes and mapped_country not in allowed_country_codes:
            continue
        if mapped_country and mapped_country in blocked_country_codes:
            continue

        results.append(mapped)
        seen_urls.add(url)
        if len(results) >= max(1, limit):
            break

    return _set_cached_live_search(
        cache_key,
        results,
        provider="jooble",
        search_term=search_term,
        filter_city=filter_city,
        country_codes=allowed_country_codes,
        exclude_country_codes=list(blocked_country_codes),
        page=page,
    )


def scrape_arbeitnow_jobs(supabase_client: Any = None) -> int:
    supabase_client = supabase_client or get_supabase_client()
    if not supabase_client:
        return 0

    api_url = (os.getenv("ARBEITNOW_API_URL") or DEFAULT_ARBEITNOW_API_URL).strip()
    page_cap_raw = (os.getenv("ARBEITNOW_MAX_PAGES") or os.getenv("SCRAPER_MAX_PAGES") or "5").strip()
    try:
        page_cap = max(1, int(page_cap_raw))
    except ValueError:
        page_cap = 5

    print(f"🌍 API source: Arbeitnow ({api_url})")
    total_saved = 0
    seen_urls: set[str] = set()

    for page in range(1, page_cap + 1):
        try:
            payload = _request_json(api_url, params={"page": page})
        except Exception as exc:
            print(f"❌ Arbeitnow API fetch failed on page {page}: {exc}")
            break

        jobs = payload.get("data") if isinstance(payload, dict) else payload
        if not isinstance(jobs, list) or len(jobs) == 0:
            print(f"ℹ️ Arbeitnow page {page}: no more jobs.")
            break

        page_saved = 0
        for item in jobs:
            if not isinstance(item, dict):
                continue
            url = item.get("url") or item.get("slug")
            if url and str(url).startswith("/"):
                url = f"https://www.arbeitnow.com{url}"
            saved = _save_api_job(
                supabase_client,
                seen_urls,
                title=str(item.get("title") or ""),
                company=str(item.get("company_name") or item.get("company") or ""),
                location=str(item.get("location") or "Remote"),
                description=str(item.get("description") or ""),
                url=str(url or ""),
                tags=_as_list(item.get("tags")),
                contract_type=_build_contract_type(item.get("job_types")),
                country_code=_infer_country_code(
                    str(item.get("location") or ""),
                    _as_list(item.get("tags")),
                    str(item.get("description") or ""),
                ),
                salary_currency="EUR",
                work_model=_infer_work_model(
                    str(item.get("location") or "Remote"),
                    str(item.get("description") or ""),
                    _as_list(item.get("tags"))
                ),
            )
            if saved:
                total_saved += 1
                page_saved += 1
        print(f"   ✅ Arbeitnow page {page}: saved {page_saved} jobs")

    return total_saved


def _build_arbeitnow_live_job(item: Dict[str, Any]) -> Dict[str, Any]:
    # Arbeitnow API payload can contain non-string values (ints, None). norm_text()
    # expects a string, so always coerce first.
    title = norm_text(str(item.get("title") or ""))
    company = norm_text(str(item.get("company_name") or item.get("company") or "Unknown company"))
    location = norm_text(str(item.get("location") or "Remote"))
    description = str(item.get("description") or "")
    tags = []
    for raw in _as_list(item.get("tags")):
        normalized = norm_text(str(raw or ""))
        if normalized:
            tags.append(normalized)
    url = item.get("url") or item.get("slug") or ""
    if url and str(url).startswith("/"):
        url = f"https://www.arbeitnow.com{url}"
    url = norm_text(str(url))
    created_at = norm_text(str(item.get("created_at") or "")) or now_iso()

    salary_from, salary_to, detected_currency = extract_salary(description or "", "EUR")
    inferred_country = _infer_country_code(location, tags, description)
    payload = {
        "id": url or str(item.get("slug") or f"arbeitnow:{title}:{company}:{location}"),
        "title": title or "Role",
        "company": company or "Unknown company",
        "location": location or "Remote",
        "description": _html_to_text(description) or title or "Role",
        "url": url,
        "source": "arbeitnow.com",
        "benefits": tags[:8],
        "tags": tags[:8],
        "contract_type": _build_contract_type(item.get("job_types")) or None,
        "work_type": detect_work_type(title, description, location),
        "work_model": _infer_work_model(location, description, tags),
        "salary_from": salary_from,
        "salary_to": salary_to,
        "salary_currency": detected_currency or "EUR",
        "salary_timeframe": "month",
        "scraped_at": created_at,
        "country_code": normalize_country_code(inferred_country),
        "language_code": "en",
        "education_level": None,
        "legality_status": "legal",
        "verification_notes": "Live API import from Arbeitnow",
    }
    _attach_live_coordinates(payload)
    return payload


def search_arbeitnow_jobs_live(
    *,
    limit: int = 20,
    page: int = 1,
    search_term: str = "",
    filter_city: str = "",
    country_codes: Optional[List[str]] = None,
    exclude_country_codes: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    cache_key = _build_live_cache_key(
        "arbeitnow",
        limit=limit,
        page=page,
        search_term=search_term,
        filter_city=filter_city,
        country_codes=country_codes or [],
        exclude_country_codes=exclude_country_codes or [],
    )
    cached = _get_cached_live_search(cache_key)
    if cached is not None:
        return cached[: max(1, limit)]

    api_url = (os.getenv("ARBEITNOW_API_URL") or DEFAULT_ARBEITNOW_API_URL).strip()
    normalized_search_tokens = [token for token in norm_text(search_term).lower().split() if token]
    normalized_city_tokens = [token for token in norm_text(filter_city).lower().split() if token]
    allowed_country_codes = {
        code for code in (normalize_country_code(value) for value in (country_codes or [])) if code
    }
    blocked_country_codes = {
        code for code in (normalize_country_code(value) for value in (exclude_country_codes or [])) if code
    }

    try:
        payload = _request_json(api_url, params={"page": max(1, int(page or 1))})
    except Exception as exc:
        print(f"❌ Arbeitnow live API fetch failed: {exc}")
        return _set_cached_live_search(
            cache_key,
            [],
            provider="arbeitnow",
            search_term=search_term,
            filter_city=filter_city,
            country_codes=list(allowed_country_codes),
            exclude_country_codes=list(blocked_country_codes),
            page=page,
        )

    jobs = payload.get("data") if isinstance(payload, dict) else payload
    if not isinstance(jobs, list) or not jobs:
        return _set_cached_live_search(
            cache_key,
            [],
            provider="arbeitnow",
            search_term=search_term,
            filter_city=filter_city,
            country_codes=list(allowed_country_codes),
            exclude_country_codes=list(blocked_country_codes),
            page=page,
        )

    results: List[Dict[str, Any]] = []
    seen_urls: set[str] = set()
    for item in jobs:
        if not isinstance(item, dict):
            continue
        try:
            mapped = _build_arbeitnow_live_job(item)
        except Exception as exc:
            print(f"⚠️ Arbeitnow live mapping failed: {exc}")
            continue
        url = norm_text(mapped.get("url") or "")
        if not url or url in seen_urls:
            continue

        mapped_country = normalize_country_code(mapped.get("country_code"))
        if allowed_country_codes:
            if mapped_country is None:
                mapped_country = _pick_default_country_code(allowed_country_codes)
                mapped["country_code"] = mapped_country
            if mapped_country not in allowed_country_codes:
                continue
        if mapped_country and mapped_country in blocked_country_codes:
            continue

        haystack = norm_text("\n".join([
            str(mapped.get("title") or ""),
            str(mapped.get("company") or ""),
            str(mapped.get("location") or ""),
            str(mapped.get("description") or ""),
            " ".join([norm_text(x) for x in (mapped.get("tags") or []) if norm_text(x)]),
        ])).lower()
        if normalized_search_tokens and not all(token in haystack for token in normalized_search_tokens):
            continue
        if normalized_city_tokens and not all(token in haystack for token in normalized_city_tokens):
            continue

        results.append(mapped)
        seen_urls.add(url)
        if len(results) >= max(1, limit):
            break

    return _set_cached_live_search(
        cache_key,
        results,
        provider="arbeitnow",
        search_term=search_term,
        filter_city=filter_city,
        country_codes=list(allowed_country_codes),
        exclude_country_codes=list(blocked_country_codes),
        page=page,
    )[: max(1, limit)]


def scrape_weworkremotely_jobs(supabase_client: Any = None) -> int:
    supabase_client = supabase_client or get_supabase_client()
    if not supabase_client:
        return 0
    if not _wwr_db_import_enabled():
        print("ℹ️ WWR DB import disabled (ENABLE_WWR_DB_IMPORT=false).")
        return 0

    rss_urls = _resolve_wwr_rss_urls()
    print(f"🌍 RSS source: We Work Remotely ({len(rss_urls)} feeds)")
    total_saved = 0
    seen_urls: set[str] = set()

    for rss_url in rss_urls:
        try:
            payload = _request_text(rss_url, headers={"Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8"})
        except Exception as exc:
            print(f"❌ WWR RSS fetch failed for {rss_url}: {exc}")
            continue

        items = _parse_rss_items(payload)
        if len(items) == 0:
            print(f"ℹ️ WWR RSS {rss_url}: no items.")
            continue

        feed_saved = 0
        for item in items:
            title = norm_text(item.get("title") or "")
            description = str(item.get("description") or "")
            link = norm_text(item.get("link") or "")

            if not title or not link:
                continue

            company = ""
            location = "Remote"
            if " at " in title:
                role_part, company_part = title.split(" at ", 1)
                title = norm_text(role_part)
                company = norm_text(company_part)
            categories = [norm_text(x) for x in (item.get("categories") or []) if norm_text(x)]
            if not _is_wwr_eu_relevant(title, description, categories):
                continue
            location, inferred_country_code = _extract_wwr_location_and_country(title, description, categories)

            saved = _save_api_job(
                supabase_client,
                seen_urls,
                title=title,
                company=company,
                location=location,
                description=description,
                url=link,
                tags=categories,
                contract_type=None,
                salary_text=description,
                country_code=inferred_country_code,
                salary_currency="EUR",
                work_model="Remote",
            )
            if saved:
                total_saved += 1
                feed_saved += 1
        print(f"   ✅ WWR RSS {rss_url}: saved {feed_saved} jobs")

    return total_saved


def scrape_german_tech_jobs(supabase_client: Any = None) -> int:
    supabase_client = supabase_client or get_supabase_client()
    if not supabase_client:
        return 0

    rss_url = _resolve_german_tech_jobs_rss_url()
    if not rss_url:
        return 0

    print(f"🌍 RSS source: GermanTechJobs ({rss_url})")
    seen_urls: set[str] = set()
    total_saved = 0

    try:
        payload = _request_text(rss_url, headers={"Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8"})
    except Exception as exc:
        print(f"❌ GermanTechJobs RSS fetch failed for {rss_url}: {exc}")
        return 0

    items = _parse_rss_items(payload)
    if len(items) == 0:
        print(f"ℹ️ GermanTechJobs RSS {rss_url}: no items.")
        return 0

    for item in items:
        title = norm_text(item.get("title") or "")
        description = str(item.get("description") or "")
        link = norm_text(item.get("link") or "")
        categories = [norm_text(x) for x in (item.get("categories") or []) if norm_text(x)]

        if not title or not link:
            continue

        company = ""
        location = "Germany"
        if " at " in title:
            role_part, company_part = title.split(" at ", 1)
            title = norm_text(role_part)
            company = norm_text(company_part)

        location_signals = [category for category in categories if any(token in category.lower() for token in ["remote", "berlin", "munich", "münchen", "hamburg", "germany", "deutschland", "cologne", "köln", "frankfurt"])]
        if location_signals:
            location = ", ".join(location_signals[:2])
        elif "remote" in description.lower():
            location = "Remote / Germany"

        saved = _save_api_job(
            supabase_client,
            seen_urls,
            title=title,
            company=company,
            location=location,
            description=description,
            url=link,
            tags=categories,
            contract_type=None,
            salary_text=description,
            country_code="de",
            salary_currency="EUR",
            work_model=_infer_work_model(location, description, categories),
        )
        if saved:
            total_saved += 1

    print(f"   ✅ GermanTechJobs RSS {rss_url}: saved {total_saved} jobs")
    return total_saved


def run_external_api_sources(supabase_client: Any = None) -> int:
    supabase_client = supabase_client or get_supabase_client()
    if not supabase_client:
        print("❌ API sources skipped: Supabase is not available.")
        return 0

    total_saved = 0
    try:
        total_saved += scrape_arbeitnow_jobs(supabase_client)
    except Exception as exc:
        print(f"❌ Arbeitnow import failed: {exc}")
    try:
        total_saved += scrape_weworkremotely_jobs(supabase_client)
    except Exception as exc:
        print(f"❌ WWR import failed: {exc}")
    try:
        total_saved += scrape_german_tech_jobs(supabase_client)
    except Exception as exc:
        print(f"❌ GermanTechJobs import failed: {exc}")
    print(f"✅ API sources finished. Saved {total_saved} jobs.")
    return total_saved
