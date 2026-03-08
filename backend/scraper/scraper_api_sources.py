"""
API/RSS-based job sources for imported listings.

- Arbeitnow: public Europe-focused job API
- We Work Remotely: public RSS feeds by category
"""

from __future__ import annotations

import os
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup

try:
    from .scraper_base import (
        detect_work_type,
        extract_salary,
        get_supabase_client,
        norm_text,
        now_iso,
        save_job_to_supabase,
    )
except ImportError:
    from scraper_base import (  # type: ignore
        detect_work_type,
        extract_salary,
        get_supabase_client,
        norm_text,
        now_iso,
        save_job_to_supabase,
    )


DEFAULT_ARBEITNOW_API_URL = "https://www.arbeitnow.com/api/job-board-api"
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
    "worldwide",
    "anywhere in the world",
    "anywhere worldwide",
    "global",
]


def _html_to_text(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if "<" not in raw and ">" not in raw:
        return norm_text(raw)
    soup = BeautifulSoup(raw, "html.parser")
    return soup.get_text("\n", strip=True)


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

    if any(token in haystack for token in WWR_NON_EU_EXCLUDE_TOKENS):
        return False

    if any(token in haystack for token in WWR_EU_INCLUDE_TOKENS):
        return True

    return False


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


def _resolve_wwr_rss_urls() -> List[str]:
    raw = (os.getenv("WWR_RSS_URLS") or os.getenv("WWR_API_URL") or "").strip()
    if not raw:
        return DEFAULT_WWR_RSS_URLS[:]
    parts = [norm_text(item) for item in raw.split(",")]
    return [item for item in parts if item]


def _resolve_german_tech_jobs_rss_url() -> str:
    return norm_text(os.getenv("GERMAN_TECH_JOBS_RSS_URL") or DEFAULT_GERMAN_TECH_JOBS_RSS_URL)


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


def scrape_weworkremotely_jobs(supabase_client: Any = None) -> int:
    supabase_client = supabase_client or get_supabase_client()
    if not supabase_client:
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

        soup = BeautifulSoup(payload, "xml")
        items = soup.find_all("item")
        if len(items) == 0:
            print(f"ℹ️ WWR RSS {rss_url}: no items.")
            continue

        feed_saved = 0
        for item in items:
            title = norm_text(item.title.get_text()) if item.title else ""
            description = item.description.get_text() if item.description else ""
            link = item.link.get_text(strip=True) if item.link else ""

            if not title or not link:
                continue

            company = ""
            location = "Remote"
            if " at " in title:
                role_part, company_part = title.split(" at ", 1)
                title = norm_text(role_part)
                company = norm_text(company_part)
            categories = [norm_text(node.get_text()) for node in item.find_all("category") if norm_text(node.get_text())]
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

    soup = BeautifulSoup(payload, "xml")
    items = soup.find_all("item")
    if len(items) == 0:
        print(f"ℹ️ GermanTechJobs RSS {rss_url}: no items.")
        return 0

    for item in items:
        title = norm_text(item.title.get_text()) if item.title else ""
        description = item.description.get_text() if item.description else ""
        link = item.link.get_text(strip=True) if item.link else ""
        categories = [norm_text(node.get_text()) for node in item.find_all("category") if norm_text(node.get_text())]

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
