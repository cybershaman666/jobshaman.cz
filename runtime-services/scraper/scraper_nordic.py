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
        save_job_to_supabase,
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
        save_job_to_supabase,
        geocode_location,
        normalize_jobs_country_code,
        get_country_centroid,
        detect_language_code,
        guess_currency
    )
    from .scraper_api_sources import run_external_api_sources

class NordicScraper:
    """
    Scraper for Nordic countries (DK, SE, NO, FI).
    Uses TheHub.io API for Startup/Tech jobs and Jooble API for general jobs.
    """
    
    # Mapping of country codes to TheHub.io country identifiers
    THE_HUB_COUNTRIES = {
        "dk": "denmark",
        "se": "sweden",
        "no": "norway",
        "fi": "finland"
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
        base_url = "https://thehub.io/api/jobs/search"
        params = {
            "countryCode": self.country_code.upper(),
            "limit": 100,
            "offset": 0
        }
        
        saved_count = 0
        try:
            response = requests.get(base_url, params=params, timeout=15)
            response.raise_for_status()
            data = response.json()
            
            jobs = data.get("jobs", [])
            print(f"   Found {len(jobs)} jobs on TheHub.io")
            
            for job in jobs:
                if self._process_the_hub_job(job):
                    saved_count += 1
                    
        except Exception as e:
            print(f"   ❌ Error scraping TheHub.io: {e}")
            
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
            
            success = save_job_to_supabase(None, final_job) # supabase client is handled inside
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
        print(f"🚀 Scraping Jooble API for {self.country_code.upper()} (General Jobs)...")
        try:
            from scraper_api_sources import search_jooble_jobs_live
            
            # We search for broad terms to get "non-IT" jobs too
            # or just use a generic search if search_term is empty
            jobs = search_jooble_jobs_live(
                limit=100,
                search_term="práce" if self.country_code == "cz" else "jobs", # Generic terms
                country_codes=[self.country_code.upper()]
            )
            
            saved_count = 0
            for job in jobs:
                # search_jooble_jobs_live already returns mapped jobs
                # We just need to save them
                success = save_job_to_supabase(job)
                if success:
                    saved_count += 1
            
            return saved_count
        except Exception as e:
            print(f"   ❌ Error scraping Jooble API: {e}")
            return 0

def run_nordic_scraper(country_code: str = None):
    """Entry point for Nordic scraper expansion"""
    countries = [country_code] if country_code else ["dk", "se", "no", "fi"]
    
    total = 0
    for code in countries:
        scraper = NordicScraper(code)
        # 1. Tech/Startup jobs from TheHub.io
        total += scraper.scrape_the_hub()
        # 2. General jobs from Jooble (if API key available)
        if os.getenv("JOOBLE_API_KEY"):
            total += scraper.scrape_jooble()
        else:
            print(f"   ⚠️ JOOBLE_API_KEY missing, skipping general jobs for {code.upper()}")
            
    print(f"✅ Nordic scraping finished. Total saved: {total}")
    return total

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    run_nordic_scraper(target)
