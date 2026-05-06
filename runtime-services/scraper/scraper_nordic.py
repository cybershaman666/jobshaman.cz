import requests
from bs4 import BeautifulSoup
import time
import os
import sys
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
    from scraper_api_sources import run_external_api_sources
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
    from .scraper_api_sources import run_external_api_sources

# Initialize Supabase client
_supabase_client = None

def _get_supabase_client():
    """Get or initialize Supabase client"""
    global _supabase_client
    if _supabase_client is None:
        try:
            from supabase import create_client
            url = os.getenv("SUPABASE_URL", "")
            key = os.getenv("SUPABASE_KEY", "")
            if url and key:
                _supabase_client = create_client(url, key)
        except Exception as e:
            print(f"⚠️ Failed to initialize Supabase: {e}")
    return _supabase_client

def save_job_to_supabase(job_data):
    """Wrapper for save_job_to_supabase with client initialization"""
    client = _get_supabase_client()
    return shared_save_job_to_supabase(client, job_data)

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
                "search_param": "q",
                "country_name": "Denmark"
            },
            {
                "name": "Jobindex",
                "url": "https://www.jobindex.dk/jobsearch/joblist",
                "search_param": "q",
                "country_name": "Denmark"
            },
        ],
        "se": [
            {
                "name": "Arbetsformedlingen",
                "url": "https://www.arbetsformedlingen.se/lediga-jobb",
                "search_param": "q",
                "country_name": "Sweden"
            },
            {
                "name": "StepStone",
                "url": "https://www.stepstone.se/jobb",
                "search_param": "q",
                "country_name": "Sweden"
            },
        ],
        "no": [
            {
                "name": "Finn",
                "url": "https://www.finn.no/job/browse",
                "search_param": "q",
                "country_name": "Norway"
            },
            {
                "name": "StepStone",
                "url": "https://www.stepstone.no/ledige-stillinger",
                "search_param": "q",
                "country_name": "Norway"
            },
        ],
        "fi": [
            {
                "name": "Duunitori",
                "url": "https://duunitori.fi/tyopaikan-haku",
                "search_param": "q",
                "country_name": "Finland"
            },
            {
                "name": "Työmarkkinatori",
                "url": "https://www.mol.fi/paikat/",
                "search_param": "q",
                "country_name": "Finland"
            },
        ],
    }

    def __init__(self, country_code: str):
        self.country_code = country_code.lower()
        self.the_hub_country = self.THE_HUB_COUNTRIES.get(self.country_code)
        self.supabase = None # Will be initialized in scraper_base if available
        self.seen_urls = set()

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
        try:
            from scraper_api_sources import search_jooble_jobs_live
            
            # Search for common job titles to get diverse results
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
                    page=1
                )
                
                print(f"   Found {len(jobs)} jobs for '{search_term}'")
                
                for job in jobs:
                    # search_jooble_jobs_live already returns mapped jobs
                    # We just need to save them
                    if job.get("url") not in self.seen_urls:
                        success = save_job_to_supabase(job)
                        if success:
                            saved_count += 1
                            self.seen_urls.add(job.get("url", ""))
            
            return saved_count
        except Exception as e:
            print(f"   ❌ Error scraping Jooble API: {e}")
            import traceback
            traceback.print_exc()
            return 0

    def scrape_arbeitnow(self) -> int:
        """Fetch jobs from Arbeitnow API (Europe-wide)"""
        print(f"🚀 Scraping Arbeitnow API for {self.country_code.upper()}...")
        try:
            base_url = os.getenv("ARBEITNOW_API_URL", "https://www.arbeitnow.com/api/job-board-api")
            page_limit = min(3, int(os.getenv("ARBEITNOW_MAX_PAGES", "3")))
            
            saved_count = 0
            for page in range(1, page_limit + 1):
                try:
                    response = requests.get(base_url, params={"page": page}, timeout=15)
                    response.raise_for_status()
                    data = response.json()
                    
                    jobs = data.get("data", [])
                    if not jobs:
                        break
                    
                    for job in jobs:
                        # Filter by country
                        location = job.get("location", "").lower()
                        if self.country_code.upper() not in location.upper():
                            continue
                        
                        if self._process_arbeitnow_job(job):
                            saved_count += 1
                            
                except Exception as e:
                    print(f"   ⚠️ Error on Arbeitnow page {page}: {e}")
                    break
                    
            if saved_count > 0:
                print(f"   ✅ Saved {saved_count} jobs from Arbeitnow")
            return saved_count
        except Exception as e:
            print(f"   ❌ Error scraping Arbeitnow: {e}")
            return 0

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
            rss_urls = [
                "https://weworkremotely.com/categories/remote-programming-jobs.rss",
                "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
                "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
                "https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss",
            ]
            
            saved_count = 0
            for rss_url in rss_urls:
                try:
                    response = requests.get(rss_url, timeout=15, headers={
                        'User-Agent': 'JobShaman/1.0 (+jobshaman.cz)'
                    })
                    response.raise_for_status()
                    
                    root = BeautifulSoup(response.content, 'xml')
                    items = root.find_all('item')
                    
                    for item in items:
                        title_elem = item.find('title')
                        description_elem = item.find('description')
                        link_elem = item.find('link')
                        
                        if not all([title_elem, description_elem, link_elem]):
                            continue
                        
                        title = norm_text(title_elem.get_text())
                        description = str(description_elem.get_text())
                        link = norm_text(link_elem.get_text())
                        
                        # Filter for Nordic interest (optional - "Remote" jobs are global)
                        if self._process_wwr_job(title, description, link):
                            saved_count += 1
                            
                except Exception as e:
                    print(f"   ⚠️ Error on WWR RSS {rss_url}: {e}")
                    
            if saved_count > 0:
                print(f"   ✅ Saved {saved_count} jobs from We Work Remotely")
            return saved_count
        except Exception as e:
            print(f"   ❌ Error scraping We Work Remotely: {e}")
            return 0

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
            # Search for common job titles
            search_terms = ["developer", "engineer", "manager", "support", "marketing", "sales"]
            
            for search_term in search_terms:
                try:
                    # Add search parameter
                    search_url = f"{url}?q={search_term}"
                    
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
                            for keyword in ['job', 'position', 'role', 'vacancy']
                        )][:20]  # Limit to 20
                    
                    for container in job_containers[:10]:  # Limit to 10 per search term
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
                if url and url.startswith('/'):
                    url = base_url.rstrip('/') + url
                elif not url.startswith('http'):
                    url = base_url.rstrip('/') + '/' + url
            
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

def run_nordic_scraper(country_code: str = None):
    """Entry point for Nordic scraper expansion"""
    countries = [country_code] if country_code else ["dk", "se", "no", "fi"]
    
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
        
        # 3. We Work Remotely RSS (remote jobs)
        total += scraper.scrape_weworkremotely()
        
        # 4. Local job portals (non-IT focused)
        total += scraper.scrape_local_portals()
        
        # 5. TheHub.io (startup/tech jobs)
        total += scraper.scrape_the_hub()
            
    print(f"✅ Nordic scraping finished. Total saved: {total}")
    return total

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    run_nordic_scraper(target)
