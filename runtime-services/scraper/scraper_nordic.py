import requests
from bs4 import BeautifulSoup
import time
import os
import sys
from urllib.parse import quote_plus, urljoin
from typing import List, Dict, Any, Optional

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
        guess_currency
    )
    from scraper_api_sources import (
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
        guess_currency
    )
    from .scraper_api_sources import (
        run_external_api_sources,
        search_arbeitnow_jobs_live,
        search_weworkremotely_jobs_live,
        search_jooble_jobs_live,
    )

def save_job_to_supabase(job_data):
    """Compatibility wrapper; shared saver writes to Jobs Postgres."""
    return shared_save_job_to_supabase(None, job_data)

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
                "search_url_template": "https://duunitori.fi/tyopaikat?haku={query}",
                "country_name": "Finland"
            },
            {
                "name": "Työmarkkinatori",
                "url": "https://www.mol.fi/paikat/",
                "search_url_template": "https://tyomarkkinatori.fi/hae?searchTerm={query}",
                "country_name": "Finland"
            },
            {
                "name": "Oikotie",
                "url": "https://tyopaikat.oikotie.fi",
                "search_url_template": "https://tyopaikat.oikotie.fi/tyopaikat?hakusana={query}",
                "country_name": "Finland"
            },
            {
                "name": "Jobly",
                "url": "https://www.jobly.fi",
                "search_url_template": "https://www.jobly.fi/tyopaikat?search={query}",
                "country_name": "Finland"
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
        self.city_targets = self.COUNTRY_CITY_TARGETS.get(self.country_code, [])

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
                jobs = search_arbeitnow_jobs_live(
                    limit=80,
                    page=page,
                    country_codes=[self.country_code.upper()],
                )
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
        try:
            for page in range(1, 3):
                for term in self.search_terms[:6]:
                    city_filters = [""] + self.city_targets[:3]
                    for city in city_filters:
                        jobs = search_arbeitnow_jobs_live(
                            limit=30,
                            page=page,
                            search_term=term,
                            filter_city=city,
                            country_codes=[self.country_code.upper()],
                        )
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
            jobs = search_weworkremotely_jobs_live(
                limit=80,
                country_codes=[self.country_code.upper()],
            )
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
        try:
            for term in self.search_terms[:6]:
                jobs = search_weworkremotely_jobs_live(
                    limit=40,
                    search_term=term,
                    country_codes=[self.country_code.upper()],
                )
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
        
        if not url:
            return 0
        
        print(f"   🔍 Scraping {name}...")
        saved_count = 0
        
        try:
            max_jobs_per_term = max(10, int(os.getenv("NORDIC_MAX_PORTAL_JOBS_PER_TERM", "20") or "20"))
            for search_term in self.search_terms:
                try:
                    search_url = self._build_portal_search_url(portal, search_term)
                    
                    response = requests.get(search_url, timeout=15, headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
                            
                except Exception as e:
                    print(f"      ⚠️ Error with search term '{search_term}' on {name}: {e}")
                    
        except Exception as e:
            print(f"   ❌ Error scraping {name}: {e}")
        
        return saved_count

    def _build_portal_search_url(self, portal: Dict[str, str], search_term: str) -> str:
        template = portal.get("search_url_template")
        if template:
            return template.format(query=quote_plus(search_term))
        search_param = portal.get("search_param", "q")
        return f"{portal.get('url', '').rstrip('/')}?{search_param}={quote_plus(search_term)}"

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
        
        # 2. Arbeitnow API (Europe-wide)
        total += scraper.scrape_arbeitnow()
        total += scraper.scrape_arbeitnow_expanded()
        
        # 3. We Work Remotely RSS (remote jobs)
        total += scraper.scrape_weworkremotely()
        total += scraper.scrape_weworkremotely_expanded()
        
        # 4. Local job portals (non-IT focused)
        total += scraper.scrape_local_portals()
        
        # 5. TheHub.io (startup/tech jobs)
        total += scraper.scrape_the_hub()
            
    print(f"✅ Nordic scraping finished. Total saved: {total}")
    return total

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    run_nordic_scraper(target)
