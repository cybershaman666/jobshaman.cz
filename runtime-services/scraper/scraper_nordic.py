import requests
from bs4 import BeautifulSoup
import time
import os
import sys
from urllib.parse import quote_plus, urljoin
from typing import List, Dict, Any, Optional
import unicodedata
import re

# Add current directory to sys.path for local imports
_here = os.path.dirname(os.path.abspath(__file__))
if _here not in sys.path:
    sys.path.insert(0, _here)

try:
    from scraper_base import (
        now_iso,
        norm_text,
        save_job_to_supabase as shared_save_job_to_supabase,
        geocode_location,
        normalize_jobs_country_code,
        get_country_centroid,
        detect_language_code,
        guess_currency,
        scrape_page,
        build_description,
        extract_benefits,
        extract_salary,
        filter_out_junk,
    )
    from scraper_api_sources import (
        LiveSourceUnavailableError,
        run_external_api_sources,
        search_arbeitnow_jobs_live,
        search_weworkremotely_jobs_live,
        search_jooble_jobs_live,
    )
except ImportError:
    from .scraper_base import (
        now_iso,
        norm_text,
        save_job_to_supabase as shared_save_job_to_supabase,
        geocode_location,
        normalize_jobs_country_code,
        get_country_centroid,
        detect_language_code,
        guess_currency,
        scrape_page,
        build_description,
        extract_benefits,
        extract_salary,
        filter_out_junk,
    )
    from .scraper_api_sources import (
        LiveSourceUnavailableError,
        run_external_api_sources,
        search_arbeitnow_jobs_live,
        search_weworkremotely_jobs_live,
        search_jooble_jobs_live,
    )

def save_job_to_supabase(job_data):
    """Compatibility wrapper; shared saver writes to Jobs Postgres."""
    return shared_save_job_to_supabase(None, job_data)


def _is_dns_resolution_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return (
        "nameresolutionerror" in message
        or "failed to resolve" in message
        or "temporary failure in name resolution" in message
    )

class NordicScraper:
    """
    Scraper for Nordic countries (DK, SE, NO, FI).
    Covers: Jooble API, Arbeitnow, We Work Remotely, local job portals.
    """
    
    # Mapping of country codes to TheHub.io country identifiers
    THE_HUB_COUNTRIES = {
        "dk": "denmark",
        "se": "sweden",
        "no": "norway",
        "fi": "finland"
    }

    # Local job portal mappings by country
    LOCAL_PORTALS = {
        "dk": [
            {
                "name": "Findjob",
                "url": "https://www.findjob.dk/jobs",
                "search_url_template": "https://www.findjob.dk/jobs?q={query}",
                "country_name": "Denmark"
            },
            {
                "name": "Jobindex",
                "url": "https://www.jobindex.dk/jobsearch/joblist",
                "search_url_template": "https://www.jobindex.dk/jobsearch/joblist?query={query}",
                "country_name": "Denmark"
            },
            {
                "name": "Jobbsafari",
                "url": "https://www.jobbsafari.dk/ledige-stillinger",
                "search_url_template": "https://www.jobbsafari.dk/ledige-stillinger?q={query}",
                "country_name": "Denmark"
            },
            {
                "name": "Ofir",
                "url": "https://www.ofir.dk/jobs",
                "search_url_template": "https://www.ofir.dk/jobs?q={query}",
                "country_name": "Denmark"
            },
        ],
        "se": [
            {
                "name": "Arbetsformedlingen",
                "url": "https://www.arbetsformedlingen.se/lediga-jobb",
                "search_url_template": "https://arbetsformedlingen.se/platsbanken/annonser?q={query}",
                "country_name": "Sweden"
            },
            {
                "name": "StepStone",
                "url": "https://www.stepstone.se/jobb",
                "search_url_template": "https://www.stepstone.se/jobb?ke={query}",
                "country_name": "Sweden"
            },
            {
                "name": "Jobbsafari",
                "url": "https://www.jobbsafari.se/lediga-jobb",
                "search_url_template": "https://www.jobbsafari.se/lediga-jobb?q={query}",
                "country_name": "Sweden"
            },
            {
                "name": "Ledigajobb",
                "url": "https://ledigajobb.se",
                "search_url_template": "https://ledigajobb.se/jobb?query={query}",
                "country_name": "Sweden"
            },
        ],
        "no": [
            {
                "name": "Finn",
                "url": "https://www.finn.no/job/browse",
                "search_url_template": "https://www.finn.no/job/browse.html?q={query}",
                "country_name": "Norway"
            },
            {
                "name": "StepStone",
                "url": "https://www.stepstone.no/ledige-stillinger",
                "search_url_template": "https://www.stepstone.no/ledige-stillinger?ke={query}",
                "country_name": "Norway"
            },
            {
                "name": "Jobbnorge",
                "url": "https://www.jobbnorge.no/ledige-stillinger",
                "search_url_template": "https://www.jobbnorge.no/search?query={query}",
                "country_name": "Norway"
            },
            {
                "name": "Jobbsafari",
                "url": "https://www.jobbsafari.no/ledige-stillinger",
                "search_url_template": "https://www.jobbsafari.no/ledige-stillinger?q={query}",
                "country_name": "Norway"
            },
        ],
        "fi": [
            {
                "name": "Duunitori",
                "url": "https://duunitori.fi/tyopaikan-haku",
                "search_url_template": "https://duunitori.fi/tyopaikat?alue=finland&haku={query}",
                "country_name": "Finland",
                "headers_profile": "browser_fi",
                "browse_all_url_template": "https://duunitori.fi/tyopaikat?alue=finland&sivu={page}",
                "disabled_reason": "Cloudflare challenge currently blocks scraper-style access; enable only when a browser-capable or challenge-solving route is available.",
            },
            {
                "name": "Työmarkkinatori",
                "url": "https://www.mol.fi/paikat/",
                "search_url_template": "https://tyomarkkinatori.fi/hae?searchTerm={query}",
                "country_name": "Finland",
                "disabled_reason": "Official job search uses the KIPA P67 API with KIPA-SubscriptionId and IP onboarding; HTML search path is not publicly scrapeable.",
            },
            {
                "name": "Oikotie",
                "url": "https://tyopaikat.oikotie.fi",
                "search_url_template": "https://tyopaikat.oikotie.fi/tyopaikat?hakusana={query}",
                "country_name": "Finland",
                "disabled_reason": "Oikotie Työpaikat has been shut down; the public site now shows a closure notice instead of active listings.",
            },
            {
                "name": "Jobly",
                "url": "https://www.jobly.fi",
                "search_url_template": "https://www.jobly.fi/tyopaikat/{query_slug}",
                "country_name": "Finland",
                "headers_profile": "browser_fi",
                "browse_all_url_template": "https://www.jobly.fi/tyopaikat?page={page}",
                "category_url_templates": [
                    "https://www.jobly.fi/tyopaikat/ohjelmistokehitys?page={page}",
                    "https://www.jobly.fi/en/jobs/software-development?page={page}",
                ],
                "search_terms_override": [
                    "developer", "software developer", "ohjelmistokehittäjä",
                    "full stack developer", "data engineer", "project manager",
                    "sales", "marketing", "customer service",
                ],
            },
        ],
    }

    COUNTRY_SEARCH_TERMS = {
        "dk": [
            "developer", "software", "engineer", "projektleder", "salg",
            "marketing", "kundeservice", "data", "økonomi", "regnskab",
        ],
        "se": [
            "utvecklare", "developer", "ingenjör", "projektledare", "försäljning",
            "marknadsföring", "kundservice", "dataanalytiker", "ekonomi", "redovisning",
        ],
        "no": [
            "utvikler", "developer", "ingeniør", "prosjektleder", "salg",
            "markedsføring", "kundeservice", "dataanalytiker", "økonomi", "regnskap",
        ],
        "fi": [
            "kehittäjä", "developer", "insinööri", "projektipäällikkö", "myynti",
            "markkinointi", "asiakaspalvelu", "data-analyytikko", "talous", "kirjanpito",
        ],
    }

    GLOBAL_REMOTE_TERMS = {
        "dk": ["developer", "software", "engineer", "data", "sales", "marketing"],
        "se": ["developer", "software", "engineer", "data", "sales", "marketing"],
        "no": ["developer", "software", "engineer", "data", "sales", "marketing"],
        "fi": ["developer", "software", "engineer", "data", "sales", "marketing"],
    }

    COUNTRY_CITY_TARGETS = {
        "dk": ["Copenhagen", "Aarhus", "Odense", "Aalborg"],
        "se": ["Stockholm", "Gothenburg", "Malmo", "Uppsala"],
        "no": ["Oslo", "Bergen", "Trondheim", "Stavanger"],
        "fi": ["Helsinki", "Espoo", "Tampere", "Turku"],
    }

    def __init__(self, country_code: str):
        self.country_code = country_code.lower()
        self.the_hub_country = self.THE_HUB_COUNTRIES.get(self.country_code)
        self.supabase = None # Will be initialized in scraper_base if available
        self.seen_urls = set()
        self.search_terms = self._resolve_search_terms()
        self.global_remote_terms = list(self.GLOBAL_REMOTE_TERMS.get(self.country_code, self.search_terms[:6]))
        self.city_targets = self.COUNTRY_CITY_TARGETS.get(self.country_code, [])
        self.enable_global_remote_feeds = str(
            os.getenv("NORDIC_ENABLE_GLOBAL_REMOTE_FEEDS", "false")
        ).strip().lower() in {"1", "true", "yes", "on"}
        self.enable_the_hub = str(
            os.getenv("NORDIC_ENABLE_THEHUB", "true")
        ).strip().lower() in {"1", "true", "yes", "on"}

    def _resolve_search_terms(self) -> List[str]:
        terms = list(self.COUNTRY_SEARCH_TERMS.get(self.country_code, []))
        extra_raw = str(os.getenv(f"NORDIC_EXTRA_TERMS_{self.country_code.upper()}") or "").strip()
        if extra_raw:
            terms.extend([norm_text(part) for part in extra_raw.split(",") if norm_text(part)])
        deduped: List[str] = []
        seen: set[str] = set()
        for term in terms:
            low = term.lower()
            if low in seen:
                continue
            seen.add(low)
            deduped.append(term)
        max_terms = max(4, int(os.getenv("NORDIC_SEARCH_TERM_LIMIT", "10") or "10"))
        return deduped[:max_terms]

    def scrape_the_hub(self) -> int:
        """Fetch jobs from TheHub.io API"""
        if not self.the_hub_country:
            return 0
            
        print(f"🚀 Scraping TheHub.io for {self.country_code.upper()}...")
        
        # TheHub.io uses an Algolia-backed API or a direct search endpoint
        # We'll use their public search API endpoint
        base_url = "https://api.thehub.io/jobs"
        params = {
            "country": self.the_hub_country,
            "limit": 100,
            "offset": 0
        }
        
        saved_count = 0
        try:
            response = requests.get(base_url, params=params, timeout=15, headers={
                'User-Agent': 'JobShaman/1.0 (+jobshaman.cz)'
            })
            response.raise_for_status()
            data = response.json()
            
            jobs = data.get("data", data.get("jobs", []))
            print(f"   Found {len(jobs)} jobs on TheHub.io")
            
            for job in jobs:
                if self._process_the_hub_job(job):
                    saved_count += 1
                    
        except Exception as e:
            if _is_dns_resolution_error(e):
                print("   ℹ️ TheHub.io skipped due to DNS resolution failure in current environment.")
                return 0
            print(f"   ⚠️ TheHub.io unavailable or error: {e}")
            
        return saved_count

    def _process_the_hub_job(self, job_data: Dict[str, Any]) -> bool:
        """Map TheHub.io job payload to JobShaman schema"""
        try:
            job_id = job_data.get("id")
            if not job_id:
                return False
                
            slug = job_data.get("slug", "")
            url = f"https://thehub.io/jobs/{slug}" if slug else f"https://thehub.io/jobs/{job_id}"
            
            if url in self.seen_urls:
                return False
                
            title = norm_text(job_data.get("title", ""))
            company_data = job_data.get("company", {})
            company_name = norm_text(company_data.get("name", "Unknown Company"))
            
            location_data = job_data.get("location", {})
            city = norm_text(location_data.get("city", ""))
            country = norm_text(location_data.get("country", self.country_code.upper()))
            location_str = f"{city}, {country}" if city else country
            
            description = job_data.get("description", "")
            if not description:
                # Try to get more text from other fields
                description = job_data.get("teaser", "")
                
            # Clean HTML if present
            if "<" in description:
                description = BeautifulSoup(description, "html.parser").get_text(separator="\n")

            # Extract salary if available
            salary_data = job_data.get("salary", {})
            salary_from = salary_data.get("from")
            salary_to = salary_data.get("to")
            currency = salary_data.get("currency", guess_currency(self.country_code))

            # Tags and metadata
            tags = job_data.get("keyTechnologies", [])
            if not tags:
                tags = [role.get("name") for role in job_data.get("roles", []) if role.get("name")]

            work_model = "On-site"
            if job_data.get("remote"):
                work_model = "Remote"
            elif "hybrid" in description.lower() or "hybrid" in title.lower():
                work_model = "Hybrid"

            # Geocoding
            lat, lon = None, None
            geo_result = geocode_location(location_str)
            if geo_result:
                lat, lon = geo_result.get("lat"), geo_result.get("lon")
            else:
                centroid = get_country_centroid(self.country_code)
                if centroid:
                    lat, lon = centroid.get("lat"), centroid.get("lon")

            final_job = {
                "title": title,
                "company": company_name,
                "location": location_str,
                "description": description,
                "url": url,
                "source": "thehub.io",
                "country_code": self.country_code,
                "lat": lat,
                "lng": lon,
                "salary_from": salary_from,
                "salary_to": salary_to,
                "salary_currency": currency,
                "tags": tags[:10],
                "work_model": work_model,
                "scraped_at": now_iso(),
                "language_code": detect_language_code(description) or "en"
            }
            
            success = save_job_to_supabase(final_job)
            if success:
                self.seen_urls.add(url)
                return True
        except Exception as e:
            print(f"      ❌ Error processing job: {e}")
            
        return False

    def scrape_jooble(self) -> int:
        """
        Use Jooble API for general (non-IT) jobs.
        """
        print(f"🚀 Scraping Jooble API for {self.country_code.upper()}...")
        # This Jooble key is often scoped only to a subset of country hosts.
        # Don't let unsupported Nordic hosts slow the whole run down.
        if self.country_code.upper() not in {"CZ", "SK", "DE", "AT", "PL"}:
            print(f"   ℹ️ Jooble host not verified for {self.country_code.upper()}, skipping.")
            return 0
        try:
            search_terms = [
                "engineer", "developer", "manager",
                "sales", "marketing", "support", "operations"
            ]

            saved_count = 0
            for search_term in search_terms:
                jobs = search_jooble_jobs_live(
                    limit=50,
                    search_term=search_term,
                    country_codes=[self.country_code.upper()],
                    page=1,
                )

                print(f"   Found {len(jobs)} jobs for '{search_term}'")

                for job in jobs:
                    if job.get("url") not in self.seen_urls:
                        success = save_job_to_supabase(job)
                        if success:
                            saved_count += 1
                            self.seen_urls.add(job.get("url", ""))

            return saved_count
        except PermissionError as e:
            print(f"   ⚠️ Jooble not allowed for {self.country_code.upper()}: {e}")
            return 0
        except Exception as e:
            print(f"   ❌ Error scraping Jooble API: {e}")
            return 0

    def scrape_arbeitnow(self) -> int:
        """Fetch jobs from Arbeitnow API (Europe-wide)"""
        print(f"🚀 Scraping Arbeitnow API for {self.country_code.upper()}...")
        try:
            page_limit = min(3, int(os.getenv("ARBEITNOW_MAX_PAGES", "3")))
            saved_count = 0

            for page in range(1, page_limit + 1):
                try:
                    jobs = search_arbeitnow_jobs_live(
                        limit=80,
                        page=page,
                        country_codes=[self.country_code.upper()],
                    )
                except LiveSourceUnavailableError as e:
                    print(f"   ℹ️ Arbeitnow skipped: {e}")
                    break
                except Exception as e:
                    if _is_dns_resolution_error(e):
                        print("   ℹ️ Arbeitnow skipped due to DNS resolution failure in current environment.")
                        break
                    raise
                if not jobs:
                    break

                page_saved = 0
                for job in jobs:
                    if job.get("url") in self.seen_urls:
                        continue
                    success = save_job_to_supabase(job)
                    if success:
                        saved_count += 1
                        page_saved += 1
                        self.seen_urls.add(job.get("url", ""))
                print(f"   Found {len(jobs)} filtered Arbeitnow jobs on page {page} for {self.country_code.upper()}")

            if saved_count > 0:
                print(f"   ✅ Saved {saved_count} jobs from Arbeitnow")
            return saved_count
        except Exception as e:
            print(f"   ❌ Error scraping Arbeitnow: {e}")
            return 0

    def scrape_arbeitnow_expanded(self) -> int:
        """Broader Arbeitnow query sweep for Nordic-relevant remote and city matches."""
        print(f"🚀 Scraping expanded Arbeitnow search for {self.country_code.upper()}...")
        saved_count = 0
        seen_urls_local: set[str] = set()
        dns_failed = False
        try:
            for page in range(1, 3):
                if dns_failed:
                    break
                for term in self.global_remote_terms[:6]:
                    if dns_failed:
                        break
                    city_filters = [""] + self.city_targets[:3]
                    for city in city_filters:
                        try:
                            jobs = search_arbeitnow_jobs_live(
                                limit=30,
                                page=page,
                                search_term=term,
                                filter_city=city,
                                country_codes=[self.country_code.upper()],
                            )
                        except LiveSourceUnavailableError as e:
                            print(f"   ℹ️ Expanded Arbeitnow skipped: {e}")
                            dns_failed = True
                            break
                        except Exception as e:
                            if _is_dns_resolution_error(e):
                                print("   ℹ️ Expanded Arbeitnow skipped due to DNS resolution failure in current environment.")
                                dns_failed = True
                                break
                            raise
                        city_label = city or "all"
                        print(f"   Arbeitnow expanded '{term}' / {city_label} / page {page}: {len(jobs)} jobs")
                        for job in jobs:
                            url = str(job.get("url") or "")
                            if not url or url in self.seen_urls or url in seen_urls_local:
                                continue
                            success = save_job_to_supabase(job)
                            if success:
                                saved_count += 1
                                self.seen_urls.add(url)
                                seen_urls_local.add(url)
        except Exception as e:
            print(f"   ⚠️ Expanded Arbeitnow failed for {self.country_code.upper()}: {e}")
        return saved_count

    def _process_arbeitnow_job(self, job_data: Dict[str, Any]) -> bool:
        """Map Arbeitnow job to JobShaman schema"""
        try:
            url = job_data.get("url")
            if not url:
                return False
            
            if url in self.seen_urls:
                return False
            
            title = norm_text(job_data.get("title", ""))
            company = norm_text(job_data.get("company_name", job_data.get("company", "Unknown")))
            location = norm_text(job_data.get("location", ""))
            description = str(job_data.get("description", ""))
            
            # Geocoding
            lat, lon = None, None
            if location:
                geo_result = geocode_location(f"{location}, {self.country_code.upper()}")
                if geo_result:
                    lat, lon = geo_result.get("lat"), geo_result.get("lon")
            
            if not lat or not lon:
                centroid = get_country_centroid(self.country_code)
                if centroid:
                    lat, lon = centroid.get("lat"), centroid.get("lon")
            
            final_job = {
                "title": title,
                "company": company,
                "location": location,
                "description": description,
                "url": url,
                "source": "arbeitnow.com",
                "country_code": self.country_code,
                "lat": lat,
                "lng": lon,
                "tags": job_data.get("tags", [])[:10],
                "work_model": "On-site",
                "scraped_at": now_iso(),
                "language_code": detect_language_code(description) or "en"
            }
            
            success = save_job_to_supabase(final_job)
            if success:
                self.seen_urls.add(url)
            return success
        except Exception as e:
            print(f"      ⚠️ Error processing Arbeitnow job: {e}")
            return False

    def scrape_weworkremotely(self) -> int:
        """Fetch remote jobs from We Work Remotely RSS (Nordic-relevant only)"""
        print(f"🚀 Scraping We Work Remotely RSS for {self.country_code.upper()}...")
        try:
            try:
                jobs = search_weworkremotely_jobs_live(
                    limit=80,
                    country_codes=[self.country_code.upper()],
                )
            except LiveSourceUnavailableError as e:
                print(f"   ℹ️ We Work Remotely skipped: {e}")
                return 0
            except Exception as e:
                if _is_dns_resolution_error(e):
                    print("   ℹ️ We Work Remotely skipped due to DNS resolution failure in current environment.")
                    return 0
                raise
            print(f"   Found {len(jobs)} filtered WWR jobs for {self.country_code.upper()}")

            saved_count = 0
            for job in jobs:
                if job.get("url") in self.seen_urls:
                    continue
                success = save_job_to_supabase(job)
                if success:
                    saved_count += 1
                    self.seen_urls.add(job.get("url", ""))

            if saved_count > 0:
                print(f"   ✅ Saved {saved_count} jobs from We Work Remotely")
            return saved_count
        except Exception as e:
            print(f"   ❌ Error scraping We Work Remotely: {e}")
            return 0

    def scrape_weworkremotely_expanded(self) -> int:
        """Broader WWR sweep with role-based filters to catch more Nordic-relevant remote work."""
        print(f"🚀 Scraping expanded WWR search for {self.country_code.upper()}...")
        saved_count = 0
        seen_urls_local: set[str] = set()
        dns_failed = False
        try:
            for term in self.global_remote_terms[:6]:
                if dns_failed:
                    break
                try:
                    jobs = search_weworkremotely_jobs_live(
                        limit=40,
                        search_term=term,
                        country_codes=[self.country_code.upper()],
                    )
                except LiveSourceUnavailableError as e:
                    print(f"   ℹ️ Expanded WWR skipped: {e}")
                    dns_failed = True
                    break
                except Exception as e:
                    if _is_dns_resolution_error(e):
                        print("   ℹ️ Expanded WWR skipped due to DNS resolution failure in current environment.")
                        dns_failed = True
                        break
                    raise
                print(f"   WWR expanded '{term}': {len(jobs)} jobs")
                for job in jobs:
                    url = str(job.get("url") or "")
                    if not url or url in self.seen_urls or url in seen_urls_local:
                        continue
                    success = save_job_to_supabase(job)
                    if success:
                        saved_count += 1
                        self.seen_urls.add(url)
                        seen_urls_local.add(url)
        except Exception as e:
            print(f"   ⚠️ Expanded WWR failed for {self.country_code.upper()}: {e}")
        return saved_count

    def _process_wwr_job(self, title: str, description: str, url: str) -> bool:
        """Map We Work Remotely job to JobShaman schema"""
        try:
            if url in self.seen_urls:
                return False
            
            company = ""
            if " at " in title:
                role_part, company_part = title.split(" at ", 1)
                title = norm_text(role_part)
                company = norm_text(company_part)
            
            final_job = {
                "title": title,
                "company": company or "Unknown",
                "location": "Remote",
                "description": description,
                "url": url,
                "source": "weworkremotely.com",
                "country_code": self.country_code,
                "lat": None,
                "lng": None,
                "work_model": "Remote",
                "scraped_at": now_iso(),
                "language_code": detect_language_code(description) or "en"
            }
            
            success = save_job_to_supabase(final_job)
            if success:
                self.seen_urls.add(url)
            return success
        except Exception as e:
            print(f"      ⚠️ Error processing WWR job: {e}")
            return False

    def scrape_local_portals(self) -> int:
        """Scrape local Nordic job portals"""
        print(f"🚀 Scraping local job portals for {self.country_code.upper()}...")
        
        portals = self.LOCAL_PORTALS.get(self.country_code, [])
        total_saved = 0
        
        for portal in portals:
            try:
                saved = self._scrape_portal(portal)
                total_saved += saved
            except Exception as e:
                print(f"   ⚠️ Error scraping {portal['name']}: {e}")
        
        if total_saved > 0:
            print(f"   ✅ Saved {total_saved} jobs from local portals")
        return total_saved

    def _scrape_portal(self, portal: Dict[str, str]) -> int:
        """Scrape a single local job portal"""
        name = portal.get("name", "Unknown")
        url = portal.get("url", "")
        country_name = portal.get("country_name", "")
        disabled_reason = portal.get("disabled_reason")
        
        if not url:
            return 0
        if disabled_reason:
            print(f"   ℹ️ Skipping {name}: {disabled_reason}")
            return 0
        
        print(f"   🔍 Scraping {name}...")
        saved_count = 0
        
        try:
            dedicated_scrapers = {
                ("fi", "Duunitori"): self._scrape_duunitori_fi,
                ("fi", "Jobly"): self._scrape_jobly_fi,
            }
            dedicated = dedicated_scrapers.get((self.country_code, name))
            if dedicated:
                return dedicated(portal)

            max_jobs_per_term = max(10, int(os.getenv("NORDIC_MAX_PORTAL_JOBS_PER_TERM", "20") or "20"))
            search_terms = portal.get("search_terms_override") or self.search_terms
            for search_term in search_terms:
                try:
                    search_url = self._build_portal_search_url(portal, search_term)
                    
                    response = requests.get(search_url, timeout=15, headers={
                        **self._get_portal_headers(portal),
                    })
                    response.raise_for_status()
                    
                    soup = BeautifulSoup(response.content, 'html.parser')
                    
                    # Generic selectors (works for most job sites)
                    # Try multiple common selectors
                    job_containers = soup.select('[data-job-id], [job-id], .job-item, .job-card, .vacancy, article[data-qa="job-item"]')
                    
                    if not job_containers:
                        # Fallback: try finding links with job keywords
                        all_links = soup.find_all('a', href=True)
                        job_containers = [link for link in all_links if any(
                            keyword in link.get_text().lower() 
                            for keyword in ['job', 'position', 'role', 'vacancy', 'arbete', 'jobb', 'stilling', 'työ']
                        )][:max_jobs_per_term]
                    
                    for container in job_containers[:max_jobs_per_term]:
                        try:
                            job_data = self._extract_job_from_html(container, name, country_name, url)
                            if job_data:
                                success = save_job_to_supabase(job_data)
                                if success:
                                    saved_count += 1
                                    self.seen_urls.add(job_data.get("url", ""))
                        except Exception as e:
                            print(f"      ⚠️ Error extracting job from {name}: {e}")
                            
                except requests.HTTPError as e:
                    status_code = e.response.status_code if e.response is not None else None
                    print(f"      ⚠️ Error with search term '{search_term}' on {name}: {e}")
                    if status_code in {403, 404, 429}:
                        print(f"      ℹ️ Stopping {name} after HTTP {status_code}, remaining terms skipped.")
                        break
                except Exception as e:
                    print(f"      ⚠️ Error with search term '{search_term}' on {name}: {e}")
                    if _is_dns_resolution_error(e):
                        print(f"      ℹ️ Stopping {name} after DNS resolution failure, remaining terms skipped.")
                        break
                    
        except Exception as e:
            print(f"   ❌ Error scraping {name}: {e}")
        
        return saved_count

    def _scrape_duunitori_fi(self, portal: Dict[str, str]) -> int:
        max_jobs_per_term = max(10, int(os.getenv("NORDIC_MAX_PORTAL_JOBS_PER_TERM", "20") or "20"))
        search_terms = portal.get("search_terms_override") or self.search_terms
        saved_count = 0
        saved_count += self._scrape_fi_listing_pages(
            portal,
            page_urls=self._build_paginated_urls(
                str(portal.get("browse_all_url_template") or ""),
                max(3, int(os.getenv("NORDIC_FI_DUUNITORI_BROAD_PAGES", "8") or "8")),
            ),
            extractor=self._extract_duunitori_listing_links,
            builder=lambda listing: self._build_duunitori_job(listing, portal),
            label="Duunitori broad crawl",
            max_jobs_per_page=max_jobs_per_term,
        )
        for search_term in search_terms:
            try:
                search_url = self._build_portal_search_url(portal, search_term)
                response = requests.get(search_url, timeout=20, headers=self._get_portal_headers(portal))
                response.raise_for_status()
                soup = BeautifulSoup(response.content, "html.parser")
                listing_links = self._extract_duunitori_listing_links(soup, max_jobs_per_term)
                if not listing_links:
                    print(f"      ℹ️ Duunitori: no listings parsed for '{search_term}'")
                    continue
                for listing in listing_links[:max_jobs_per_term]:
                    job_data = self._build_duunitori_job(listing, portal)
                    if not job_data:
                        continue
                    success = save_job_to_supabase(job_data)
                    if success:
                        saved_count += 1
                        self.seen_urls.add(job_data.get("url", ""))
            except requests.HTTPError as e:
                status_code = e.response.status_code if e.response is not None else None
                print(f"      ⚠️ Error with search term '{search_term}' on Duunitori: {e}")
                if status_code in {403, 404, 429}:
                    print(f"      ℹ️ Stopping Duunitori after HTTP {status_code}, remaining terms skipped.")
                    break
            except Exception as e:
                print(f"      ⚠️ Error with search term '{search_term}' on Duunitori: {e}")
                if _is_dns_resolution_error(e):
                    print("      ℹ️ Stopping Duunitori after DNS resolution failure, remaining terms skipped.")
                    break
        return saved_count

    def _scrape_jobly_fi(self, portal: Dict[str, str]) -> int:
        max_jobs_per_term = max(20, int(os.getenv("NORDIC_MAX_PORTAL_JOBS_PER_TERM", "30") or "30"))
        search_terms = portal.get("search_terms_override") or self.search_terms
        saved_count = 0
        broad_page_count = max(6, int(os.getenv("NORDIC_FI_JOBLY_BROAD_PAGES", "18") or "18"))
        page_urls = []
        page_urls.extend(self._build_paginated_urls(str(portal.get("browse_all_url_template") or ""), broad_page_count))
        for template in portal.get("category_url_templates") or []:
            page_urls.extend(self._build_paginated_urls(str(template or ""), max(4, broad_page_count // 2)))
        saved_count += self._scrape_fi_listing_pages(
            portal,
            page_urls=page_urls,
            extractor=self._extract_jobly_listing_links,
            builder=lambda listing: self._build_jobly_job(listing, portal),
            label="Jobly broad crawl",
            max_jobs_per_page=max_jobs_per_term,
        )
        for search_term in search_terms:
            try:
                search_url = self._build_portal_search_url(portal, search_term)
                response = requests.get(search_url, timeout=20, headers=self._get_portal_headers(portal))
                response.raise_for_status()
                soup = BeautifulSoup(response.content, "html.parser")
                listing_links = self._extract_jobly_listing_links(soup, max_jobs_per_term)
                if not listing_links:
                    print(f"      ℹ️ Jobly: no listings parsed for '{search_term}'")
                    continue
                for listing in listing_links[:max_jobs_per_term]:
                    job_data = self._build_jobly_job(listing, portal)
                    if not job_data:
                        continue
                    success = save_job_to_supabase(job_data)
                    if success:
                        saved_count += 1
                        self.seen_urls.add(job_data.get("url", ""))
            except requests.HTTPError as e:
                status_code = e.response.status_code if e.response is not None else None
                print(f"      ⚠️ Error with search term '{search_term}' on Jobly: {e}")
                if status_code in {403, 404, 429}:
                    print(f"      ℹ️ Stopping Jobly after HTTP {status_code}, remaining terms skipped.")
                    break
            except Exception as e:
                print(f"      ⚠️ Error with search term '{search_term}' on Jobly: {e}")
                if _is_dns_resolution_error(e):
                    print("      ℹ️ Stopping Jobly after DNS resolution failure, remaining terms skipped.")
                    break
        return saved_count

    def _build_paginated_urls(self, template: str, page_count: int) -> List[str]:
        if not template:
            return []
        urls: List[str] = []
        for page in range(1, max(1, page_count) + 1):
            try:
                urls.append(template.format(page=page))
            except Exception:
                continue
        return urls

    def _scrape_fi_listing_pages(
        self,
        portal: Dict[str, str],
        *,
        page_urls: List[str],
        extractor,
        builder,
        label: str,
        max_jobs_per_page: int,
    ) -> int:
        if not page_urls:
            return 0
        saved_count = 0
        seen_page_urls: set[str] = set()
        for page_url in page_urls:
            if page_url in seen_page_urls:
                continue
            seen_page_urls.add(page_url)
            try:
                response = requests.get(page_url, timeout=20, headers=self._get_portal_headers(portal))
                response.raise_for_status()
                soup = BeautifulSoup(response.content, "html.parser")
                listing_links = extractor(soup, max_jobs_per_page)
                if not listing_links:
                    continue
                print(f"      ℹ️ {label}: {len(listing_links)} listings from {page_url}")
                for listing in listing_links[:max_jobs_per_page]:
                    job_data = builder(listing)
                    if not job_data:
                        continue
                    success = save_job_to_supabase(job_data)
                    if success:
                        saved_count += 1
                        self.seen_urls.add(job_data.get("url", ""))
            except requests.HTTPError as e:
                status_code = e.response.status_code if e.response is not None else None
                print(f"      ⚠️ {label} page failed ({status_code or 'unknown'}) for {page_url}: {e}")
                if status_code in {403, 404, 429}:
                    break
            except Exception as e:
                print(f"      ⚠️ {label} page failed for {page_url}: {e}")
                if _is_dns_resolution_error(e):
                    break
        return saved_count

    def _build_portal_search_url(self, portal: Dict[str, str], search_term: str) -> str:
        template = portal.get("search_url_template")
        if template:
            return template.format(query=quote_plus(search_term), query_slug=self._slugify_query(search_term))
        search_param = portal.get("search_param", "q")
        return f"{portal.get('url', '').rstrip('/')}?{search_param}={quote_plus(search_term)}"

    def _extract_duunitori_listing_links(self, soup: BeautifulSoup, limit: int) -> List[Dict[str, str]]:
        listings: List[Dict[str, str]] = []
        seen_urls: set[str] = set()
        for anchor in soup.find_all("a", href=True):
            href = str(anchor.get("href") or "")
            if "/tyopaikat/tyo/" not in href:
                continue
            url = urljoin("https://duunitori.fi", href.split("?")[0])
            if url in seen_urls or url in self.seen_urls:
                continue
            title = norm_text(anchor.get_text(" ", strip=True))
            if len(title) < 4:
                continue
            block = anchor.find_parent(["article", "li", "section", "div"])
            block_text = norm_text(block.get_text("\n", strip=True)) if block else title
            listings.append({
                "title": title,
                "url": url,
                "block_text": block_text,
            })
            seen_urls.add(url)
            if len(listings) >= limit:
                break
        return listings

    def _extract_jobly_listing_links(self, soup: BeautifulSoup, limit: int) -> List[Dict[str, str]]:
        listings: List[Dict[str, str]] = []
        seen_urls: set[str] = set()
        for anchor in soup.find_all("a", href=True):
            href = str(anchor.get("href") or "")
            if "/tyopaikka/" not in href:
                continue
            url = urljoin("https://www.jobly.fi", href.split("?")[0])
            if url in seen_urls or url in self.seen_urls:
                continue
            title = norm_text(anchor.get_text(" ", strip=True))
            if len(title) < 4:
                continue
            block = anchor.find_parent(["article", "li", "section", "div"])
            block_text = norm_text(block.get_text("\n", strip=True)) if block else title
            listings.append({
                "title": title,
                "url": url,
                "block_text": block_text,
            })
            seen_urls.add(url)
            if len(listings) >= limit:
                break
        return listings

    def _build_duunitori_job(self, listing: Dict[str, str], portal: Dict[str, str]) -> Optional[Dict[str, Any]]:
        detail_soup = scrape_page(str(listing.get("url") or ""))
        if not detail_soup:
            return None
        title = self._extract_title(detail_soup, fallback=str(listing.get("title") or ""))
        company = self._extract_duunitori_company(detail_soup, listing)
        location = self._extract_duunitori_location(detail_soup, listing)
        description = self._extract_duunitori_description(detail_soup, title)
        work_model = self._extract_work_model_fi(detail_soup, title, description)
        salary_text = self._extract_salary_text_fi(detail_soup, listing)
        salary_from, salary_to, salary_currency = extract_salary(salary_text, guess_currency(self.country_code))
        benefits = extract_benefits(detail_soup, [
            "ul li",
            "main li",
            "article li",
        ])
        return self._build_fi_job_payload(
            portal_name=str(portal.get("name") or "duunitori"),
            url=str(listing.get("url") or ""),
            title=title,
            company=company,
            location=location,
            description=description,
            work_model=work_model,
            salary_from=salary_from,
            salary_to=salary_to,
            salary_currency=salary_currency,
            tags=benefits[:10],
        )

    def _build_jobly_job(self, listing: Dict[str, str], portal: Dict[str, str]) -> Optional[Dict[str, Any]]:
        detail_soup = scrape_page(str(listing.get("url") or ""))
        if not detail_soup:
            return None
        title = self._extract_title(detail_soup, fallback=str(listing.get("title") or ""))
        company = self._extract_jobly_company(detail_soup, listing)
        location = self._extract_jobly_location(detail_soup, listing)
        description = self._extract_jobly_description(detail_soup, title)
        work_model = self._extract_work_model_fi(detail_soup, title, description)
        salary_text = self._extract_salary_text_fi(detail_soup, listing)
        salary_from, salary_to, salary_currency = extract_salary(salary_text, guess_currency(self.country_code))
        benefits = extract_benefits(detail_soup, [
            "ul li",
            "main li",
            "article li",
        ])
        return self._build_fi_job_payload(
            portal_name=str(portal.get("name") or "jobly"),
            url=str(listing.get("url") or ""),
            title=title,
            company=company,
            location=location,
            description=description,
            work_model=work_model,
            salary_from=salary_from,
            salary_to=salary_to,
            salary_currency=salary_currency,
            tags=benefits[:10],
        )

    def _extract_title(self, detail_soup: BeautifulSoup, fallback: str = "") -> str:
        h1 = detail_soup.find("h1")
        if h1:
            title = norm_text(h1.get_text(" ", strip=True))
            if title:
                return title
        og_title = detail_soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            return norm_text(str(og_title.get("content") or "")) or fallback
        return fallback or "Role"

    def _extract_duunitori_company(self, detail_soup: BeautifulSoup, listing: Dict[str, str]) -> str:
        blocked_tokens = {"työpaikkakuvaus", "job description", "hakuaika", "työsuhdetyyppi", "sijainti"}
        h1 = detail_soup.find("h1")
        if h1:
            for sibling in h1.find_all_next(["a", "div", "span"], limit=8):
                text = norm_text(sibling.get_text(" ", strip=True))
                if text and text != listing.get("title") and " - " not in text and len(text) > 1:
                    if text.lower() not in blocked_tokens and "helsinki" not in text.lower() and "julkaistu" not in text.lower():
                        return text
                if " - " in text:
                    left = norm_text(text.split(" - ", 1)[0])
                    if left and left.lower() not in blocked_tokens:
                        return left
        block_text = str(listing.get("block_text") or "")
        title = str(listing.get("title") or "")
        lines = [norm_text(line) for line in block_text.split("\n") if norm_text(line)]
        for idx, line in enumerate(lines):
            if line == title and idx + 1 < len(lines):
                candidate = lines[idx + 1]
                if candidate.lower() not in blocked_tokens and "julkaistu" not in candidate.lower():
                    return candidate
        return "Unknown company"

    def _extract_duunitori_location(self, detail_soup: BeautifulSoup, listing: Dict[str, str]) -> str:
        for marker in ["Sijainti", "Location"]:
            node = detail_soup.find(string=lambda x: isinstance(x, str) and marker in x)
            if node:
                parent = node.parent
                if parent:
                    text = norm_text(parent.get_text("\n", strip=True)).replace(marker, "").strip(": ")
                    if text and text.lower() != marker.lower():
                        return text.split("\n")[0].strip()
        headline = detail_soup.find("h1")
        if headline:
            text = norm_text(headline.find_parent().get_text("\n", strip=True)) if headline.find_parent() else ""
            match = re.search(r" - ([A-Za-zÅÄÖåäö\-/ ]+)$", text)
            if match:
                return norm_text(match.group(1))
        block_text = str(listing.get("block_text") or "")
        location_match = re.search(r"(Helsinki|Espoo|Tampere|Turku|Oulu|Vantaa|Lahti|Kuopio|Jyväskylä|Rovaniemi|Vaasa|Pori|Kouvola|Joensuu|Lappeenranta|Mikkeli|Seinäjoki|Kajaani|Kemi|Rauma|Finland)(?:\s+ja\s+\d+\s+muuta)?", block_text, re.I)
        if location_match:
            return norm_text(location_match.group(0))
        return "Finland"

    def _extract_duunitori_description(self, detail_soup: BeautifulSoup, title: str) -> str:
        description = build_description(detail_soup, {
            "paragraphs": ["main p", "article p", "section p"],
            "lists": ["main ul", "article ul", "section ul"],
        })
        if len(description) >= 200:
            return filter_out_junk(description)
        marker = detail_soup.find(string=lambda x: isinstance(x, str) and ("Työpaikkakuvaus" in x or "Job description" in x))
        if marker:
            section_parts: List[str] = []
            parent = marker.parent
            if parent:
                for elem in parent.find_all_next(["p", "li", "h2", "h3"], limit=80):
                    text = norm_text(elem.get_text(" ", strip=True))
                    if not text:
                        continue
                    if text in {"Hakuaika", "Työsuhdetyyppi", "Sijainti"}:
                        break
                    if elem.name == "li":
                        section_parts.append(f"- {text}")
                    else:
                        section_parts.append(text)
            if section_parts:
                return filter_out_junk("\n\n".join(section_parts))
        return title

    def _extract_jobly_company(self, detail_soup: BeautifulSoup, listing: Dict[str, str]) -> str:
        blocked_tokens = {"suositeltu", "tallenna työpaikka", "hakuaika", "sijainti", "työsuhdetyyppi"}
        block_text = str(listing.get("block_text") or "")
        title = str(listing.get("title") or "")
        compact = norm_text(block_text)
        pattern = rf"{re.escape(title)}\s+\d{{2}}\.\d{{2}}\.\d{{4}},\s+(.+?)\s+(?:Helsinki|Espoo|Tampere|Turku|Oulu|Vantaa|Lahti|Kuopio|Jyväskylä|Jyvaskyla|Vaasa|Mikkeli|Hyvinkää|Hyvinkaa|Pori|Joensuu|Lappeenranta|Rovaniemi|Kajaani|Kemi|Rauma)\b"
        match = re.search(pattern, compact)
        if match:
            candidate = norm_text(match.group(1))
            if candidate and candidate.lower() not in blocked_tokens:
                return candidate
        og_title = detail_soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            raw = norm_text(str(og_title.get("content") or ""))
            if " - " in raw:
                middle = raw.split(" - ", 1)[0]
                if "," in middle:
                    parts = [norm_text(part) for part in middle.split(",") if norm_text(part)]
                    if len(parts) >= 2:
                        return parts[-1]
        h1 = detail_soup.find("h1")
        if h1:
            lines = [norm_text(line) for line in detail_soup.get_text("\n", strip=True).split("\n") if norm_text(line)]
            title = norm_text(h1.get_text(" ", strip=True))
            for idx, line in enumerate(lines):
                if line != title:
                    continue
                for candidate in lines[idx + 1: idx + 8]:
                    if re.search(r"\d{2}\.\d{2}\.\d{4}", candidate):
                        continue
                    if candidate.lower() in blocked_tokens:
                        continue
                    if candidate in {"Hae paikkaa", "Tallenna työpaikka"}:
                        continue
                    if re.search(r"\b(Helsinki|Espoo|Tampere|Turku|Oulu|Vantaa|Lahti|Kuopio|Jyväskylä|Vaasa|Mikkeli|Hyvinkää|Hyvinkaa)\b", candidate):
                        continue
                    if len(candidate) > 1:
                        return candidate
        lines = [norm_text(line) for line in block_text.split("\n") if norm_text(line)]
        for idx, line in enumerate(lines):
            if line == title and idx + 1 < len(lines):
                candidate = lines[idx + 1]
                if not re.search(r"\d{2}\.\d{2}\.\d{4}", candidate):
                    return candidate
        return "Unknown company"

    def _extract_jobly_location(self, detail_soup: BeautifulSoup, listing: Dict[str, str]) -> str:
        lines = [norm_text(line) for line in detail_soup.get_text("\n", strip=True).split("\n") if norm_text(line)]
        title = self._extract_title(detail_soup, fallback=str(listing.get("title") or ""))
        for idx, line in enumerate(lines):
            if line != title:
                continue
            location_candidates: List[str] = []
            for candidate in lines[idx + 1: idx + 12]:
                if candidate in {"Hae paikkaa", "Tallenna työpaikka"}:
                    continue
                if re.search(r"\d{2}\.\d{2}\.\d{4}", candidate):
                    break
                if candidate in {"Kokopäiväinen", "Vakituinen", "Osa-aikainen", "Hybridityö", "Etätyö"}:
                    break
                if re.search(r"\b(Helsinki|Espoo|Tampere|Turku|Oulu|Vantaa|Lahti|Kuopio|Jyväskylä|Jyvaskyla|Vaasa|Mikkeli|Hyvinkää|Hyvinkaa|Pori|Joensuu|Lappeenranta|Rovaniemi|Kajaani|Kemi|Rauma)\b", candidate):
                    location_candidates.append(candidate)
            if location_candidates:
                return ", ".join(dict.fromkeys(location_candidates))
        text = norm_text(detail_soup.get_text("\n", strip=True))
        match = re.search(r"(Helsinki|Espoo|Tampere|Turku|Oulu|Vantaa|Lahti|Kuopio|Jyväskylä|Rovaniemi|Vaasa|Pori|Kouvola|Joensuu|Lappeenranta|Mikkeli|Seinäjoki|Kajaani|Kemi|Rauma|Mynämäki|Pertunmaa|Ilmajoki|Kuusamo|Finland)(?:,\s*[A-Za-zÅÄÖåäö\- ]+)?", text, re.I)
        if match:
            return norm_text(match.group(0))
        block_text = str(listing.get("block_text") or "")
        lines = [norm_text(line) for line in block_text.split("\n") if norm_text(line)]
        for line in lines:
            if re.search(r"\d{2}\.\d{2}\.\d{4}", line):
                continue
            if len(line) > 2 and re.search(r"[A-Za-zÅÄÖåäö]", line):
                if any(city in line.lower() for city in ["helsinki", "espoo", "tampere", "turku", "oulu", "vantaa", "lahti", "kuopio", "jyväskylä", "rovaniemi", "vaasa", "pori", "kouvola", "joensuu", "lappeenranta", "mikkeli", "seinäjoki", "kajaani", "kemi", "rauma"]):
                    return line
        return "Finland"

    def _extract_jobly_description(self, detail_soup: BeautifulSoup, title: str) -> str:
        description = build_description(detail_soup, {
            "paragraphs": ["main p", "article p", "section p"],
            "lists": ["main ul", "article ul", "section ul"],
        })
        if len(description) >= 200:
            return filter_out_junk(description)
        candidates = []
        for div in detail_soup.find_all(["div", "main", "article", "section"]):
            text = norm_text(div.get_text(" ", strip=True))
            if 300 <= len(text) <= 20000:
                candidates.append(text)
        if candidates:
            candidates.sort(key=len, reverse=True)
            return filter_out_junk(candidates[0])
        return title

    def _extract_salary_text_fi(self, detail_soup: BeautifulSoup, listing: Dict[str, str]) -> str:
        text = norm_text(detail_soup.get_text("\n", strip=True))
        matches = re.findall(r"\d[\d\s\u00a0]*(?:[.,]\d+)?\s*[–-]?\s*\d*[\d\s\u00a0]*(?:[.,]\d+)?\s*(?:€|€/kk|€/h|e/kk|e/h)", text, re.I)
        if matches:
            return matches[0]
        block_text = str(listing.get("block_text") or "")
        block_matches = re.findall(r"\d[\d\s\u00a0]*(?:[.,]\d+)?\s*[–-]?\s*\d*[\d\s\u00a0]*(?:[.,]\d+)?\s*(?:€|€/kk|€/h|e/kk|e/h)", block_text, re.I)
        if block_matches:
            return block_matches[0]
        return ""

    def _extract_work_model_fi(self, detail_soup: BeautifulSoup, title: str, description: str) -> str:
        text = norm_text(detail_soup.get_text("\n", strip=True))
        low = f"{title}\n{text}\n{description}".lower()
        if any(token in low for token in ["hybridi", "hybrid"]):
            return "Hybrid"
        if any(token in low for token in ["etätyö", "etatyö", "remote", "work from home", "anywhere in finland", "anywhere in europe"]):
            return "Remote"
        return "On-site"

    def _build_fi_job_payload(
        self,
        *,
        portal_name: str,
        url: str,
        title: str,
        company: str,
        location: str,
        description: str,
        work_model: str,
        salary_from: Optional[int],
        salary_to: Optional[int],
        salary_currency: Optional[str],
        tags: List[str],
    ) -> Optional[Dict[str, Any]]:
        clean_url = norm_text(url)
        if not clean_url or clean_url in self.seen_urls:
            return None
        if not self._is_probably_finland_job(location, title, description):
            return None
        clean_description = filter_out_junk(description or title)
        lat, lon = None, None
        geo_result = geocode_location(f"{location}, Finland")
        if geo_result:
            lat, lon = geo_result.get("lat"), geo_result.get("lon")
        if not lat or not lon:
            centroid = get_country_centroid(self.country_code)
            if centroid:
                lat, lon = centroid.get("lat"), centroid.get("lon")
        return {
            "title": norm_text(title) or "Role",
            "company": norm_text(company) or "Unknown company",
            "location": norm_text(location) or "Finland",
            "description": clean_description,
            "url": clean_url,
            "source": portal_name.lower(),
            "country_code": self.country_code,
            "lat": lat,
            "lng": lon,
            "salary_from": salary_from,
            "salary_to": salary_to,
            "salary_currency": salary_currency or guess_currency(self.country_code),
            "tags": [tag for tag in tags if tag][:10],
            "work_model": work_model,
            "scraped_at": now_iso(),
            "language_code": detect_language_code(clean_description) or "fi",
        }

    def _is_probably_finland_job(self, location: str, title: str, description: str) -> bool:
        haystack = norm_text(f"{location}\n{title}\n{description}").lower()
        finland_markers = [
            "finland", "suomi", "helsinki", "espoo", "tampere", "turku", "oulu", "vantaa",
            "jyväskylä", "jyvaskyla", "vaasa", "kuopio", "lahti", "hyvinkää", "hyvinkaa",
            "mikkeli", "rovaniemi", "joensuu", "lappeenranta", "seinäjoki", "seinajoki",
            "pori", "rauma", "kajaani", "kemi", "uusimaa", "pirkanmaa",
        ]
        foreign_hard_markers = [
            "sweden", "ruotsi", "stockholm", "norway", "norge", "oslo", "denmark", "danmark",
            "copenhagen", "germany", "deutschland", "berlin", "india", "intia", "poland", "usa",
            "united states", "canada", "spain", "italy", "france", "remote europe", "remote germany",
        ]
        if any(marker in haystack for marker in finland_markers):
            return True
        if any(marker in haystack for marker in foreign_hard_markers):
            return False
        # Default-allow only generic Finland listings from Finnish portals.
        return location.strip().lower() in {"finland", ""} or "etä" in haystack or "hybridi" in haystack

    def _slugify_query(self, search_term: str) -> str:
        normalized = unicodedata.normalize("NFKD", search_term)
        ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
        slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text.lower()).strip("-")
        return slug or "developer"

    def _get_portal_headers(self, portal: Dict[str, str]) -> Dict[str, str]:
        profile = portal.get("headers_profile", "browser_default")
        base_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Referer": portal.get("url", ""),
        }
        if profile == "browser_fi":
            base_headers["Accept-Language"] = "fi-FI,fi;q=0.9,en-US;q=0.8,en;q=0.7"
        elif profile == "browser_sv":
            base_headers["Accept-Language"] = "sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7"
        elif profile == "browser_no":
            base_headers["Accept-Language"] = "nb-NO,nn-NO;q=0.9,no;q=0.8,en-US;q=0.7,en;q=0.6"
        elif profile == "browser_dk":
            base_headers["Accept-Language"] = "da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7"
        return base_headers

    def _extract_job_from_html(self, element, portal_name: str, country_name: str, base_url: str) -> Optional[Dict]:
        """Extract job data from HTML element"""
        try:
            # Try multiple selectors for title
            title_elem = element.find(['h1', 'h2', 'h3', 'h4']) or element.find(['a'])
            if not title_elem:
                return None
            
            title = norm_text(title_elem.get_text())
            if not title or len(title) < 5:
                return None
            
            # Extract URL
            url = None
            link_elem = element.find('a', href=True)
            if link_elem:
                url = link_elem.get('href', '')
                url = urljoin(base_url, url)
            
            if not url or url in self.seen_urls:
                return None
            
            # Try to extract company
            company_elem = element.find(['span', 'div'], {'class': ['company', 'employer', 'organization']})
            company = norm_text(company_elem.get_text()) if company_elem else portal_name
            
            # Try to extract location
            location_elem = element.find(['span', 'div'], {'class': ['location', 'place', 'city']})
            location = norm_text(location_elem.get_text()) if location_elem else country_name
            
            # Try to extract description
            desc_elem = element.find(['p', 'div'], {'class': ['description', 'summary', 'excerpt']})
            description = str(desc_elem.get_text()) if desc_elem else title
            
            # Geocoding
            lat, lon = None, None
            geo_result = geocode_location(f"{location}, {country_name}")
            if geo_result:
                lat, lon = geo_result.get("lat"), geo_result.get("lon")
            
            if not lat or not lon:
                centroid = get_country_centroid(self.country_code)
                if centroid:
                    lat, lon = centroid.get("lat"), centroid.get("lon")
            
            final_job = {
                "title": title,
                "company": company,
                "location": location,
                "description": description,
                "url": url,
                "source": portal_name.lower(),
                "country_code": self.country_code,
                "lat": lat,
                "lng": lon,
                "work_model": "On-site",
                "scraped_at": now_iso(),
                "language_code": detect_language_code(description) or "en"
            }
            
            return final_job
        except Exception as e:
            print(f"      ⚠️ Error extracting job: {e}")
            return None

    def scrape_stack_overflow(self) -> int:
        """Fetch jobs from Stack Overflow (placeholder)"""
        print(f"🚀 Scraping Stack Overflow Jobs for {self.country_code.upper()}...")
        try:
            # Stack Overflow closed their job board
            print(f"   ℹ️ Stack Overflow jobs discontinued (board closed in 2021)")
            return 0
            
        except Exception as e:
            print(f"   ⚠️ Stack Overflow scraping not available: {e}")
            return 0

def run_nordic_scraper(country_code: str | list[str] | tuple[str, ...] | None = None):
    """Entry point for Nordic scraper expansion"""
    if isinstance(country_code, (list, tuple)):
        countries = [str(code).lower() for code in country_code]
    else:
        countries = [str(country_code).lower()] if country_code else ["dk", "se", "no", "fi"]
    
    total = 0
    for code in countries:
        scraper = NordicScraper(code)
        
        # 1. Jooble (primary source)
        if os.getenv("JOOBLE_API_KEY"):
            total += scraper.scrape_jooble()
        else:
            print(f"   ⚠️ JOOBLE_API_KEY missing, skipping Jooble for {code.upper()}")
        
        # 2. Global remote feeds are opt-in for Nordic countries.
        if scraper.enable_global_remote_feeds:
            total += scraper.scrape_arbeitnow()
            total += scraper.scrape_arbeitnow_expanded()
            total += scraper.scrape_weworkremotely()
            total += scraper.scrape_weworkremotely_expanded()
        else:
            print(f"   ℹ️ Global remote feeds disabled for {code.upper()} (set NORDIC_ENABLE_GLOBAL_REMOTE_FEEDS=true to enable).")
        
        # 3. Local job portals (non-IT focused)
        total += scraper.scrape_local_portals()
        
        # 4. TheHub.io (startup/tech jobs)
        if scraper.enable_the_hub:
            total += scraper.scrape_the_hub()
        else:
            print(f"   ℹ️ TheHub.io disabled for {code.upper()} (set NORDIC_ENABLE_THEHUB=true to enable).")
            
    print(f"✅ Nordic scraping finished. Total saved: {total}")
    return total

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    run_nordic_scraper(target)
