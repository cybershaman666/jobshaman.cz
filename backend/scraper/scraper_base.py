"""
JobShaman Scraper - Base Module
Shared utilities and base classes for all country-specific scrapers
Includes geocoding support for PostGIS spatial queries
"""

import requests
from bs4 import BeautifulSoup
import json
import time
from dotenv import load_dotenv
from supabase import create_client, Client
import os
from urllib.parse import urljoin, urlparse
import re
from datetime import datetime
import sys
from typing import Optional, Dict, List, Tuple, Callable, Any

# Add parent directory to path to import geocoding module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from geocoding import geocode_location

# --- Environment Setup ---

# Explicitly load .env from backend directory
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(backend_dir, '.env')
print(f"🔍 Hledám .env soubor v: {env_path}")
if os.path.exists(env_path):
    print(f"✅ .env soubor nalezen, načítám...")
    load_dotenv(dotenv_path=env_path)
else:
    print(f"⚠️ .env soubor nenalezen v {env_path}, zkouším výchozí umístění...")
    load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Debug output
print(f"   SUPABASE_URL: {'✅ NAČTENO' if SUPABASE_URL else '❌ CHYBÍ'}")
print(f"   SUPABASE_SERVICE_KEY: {'✅ NAČTENO' if SUPABASE_SERVICE_KEY else '❌ CHYBÍ'}")


# --- Supabase Client Initialization ---

def get_supabase_client() -> Optional[Client]:
    """Initialize Supabase client with service role key"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print(
            "⚠️ VAROVÁNÍ: SUPABASE_URL nebo SUPABASE_SERVICE_KEY chybí. "
            "Scrapování bude fungovat, ale data se neuloží."
        )
        return None
    try:
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("✅ Úspěšně vytvořen klient Supabase (s právy service role).")
        return client
    except Exception as e:
        print(f"❌ Chyba při inicializaci Supabase klienta: {e}")
        return None


# --- Utility Functions ---

def now_iso() -> str:
    """Return current UTC time in ISO format"""
    return datetime.utcnow().isoformat()


def norm_text(s: str) -> str:
    """Normalize text by removing extra whitespace"""
    if not s:
        return ""
    return re.sub(r"\s+", " ", s).strip()


def extract_salary(
    salary_text: str, 
    currency: str = 'CZK'
) -> Tuple[Optional[int], Optional[int], str]:
    """
    Extract salary range from text with multi-currency support
    
    Args:
        salary_text: Text containing salary information
        currency: Expected currency (CZK, EUR, PLN, etc.)
    
    Returns:
        Tuple of (salary_from, salary_to, currency)
    """
    if not salary_text:
        return None, None, currency
    
    # Extract numeric segments including separators (dot, comma, space)
    nums = re.findall(r"\d[\d\s\.,]*", salary_text)
    vals = []
    
    for x in nums:
        # Remove spaces and dots (often thousand separators in EU)
        cleaned = x.replace(" ", "").replace("\u00a0", "").replace(".", "")
        
        # Handle comma - if exactly 2 digits after comma at end, it's cents
        if "," in cleaned:
            parts = cleaned.split(",")
            if len(parts) > 1 and len(parts[-1]) == 2:
                cleaned = parts[0]  # Drop cents
            else:
                cleaned = cleaned.replace(",", "")  # Comma as thousand separator
        
        if cleaned:
            try:
                val = int(cleaned)
                # Filter nonsensical values (e.g. '2024' from date or '1' from '1st floor')
                if val > 100:
                    vals.append(val)
            except ValueError:
                continue
    
    # Check for "thousand" multiplier
    low_txt = salary_text.lower()
    if any(word in low_txt for word in ["tis", "tisíc", "thousand", "tys"]):
        # If values are suspiciously small (e.g. 35 instead of 35000), multiply
        vals = [v * 1000 if v < 1000 else v for v in vals]
    
    # Determine from/to
    salary_from = None
    salary_to = None
    
    if len(vals) == 1:
        salary_from = vals[0]
    elif len(vals) >= 2:
        # Sort to ensure from < to
        salary_from = min(vals[0], vals[1])
        salary_to = max(vals[0], vals[1])
    
    return salary_from, salary_to, currency


def filter_out_junk(text: str) -> str:
    """
    Remove navigation, footers, and generic junk from job descriptions
    """
    if not text:
        return ""
    
    # Extensive list of junk tokens commonly found in navigation/footers
    junk_tokens = [
        "nabídky práce", "vytvořit si životopis", "jobs.cz", "prace.cz", "atmoskop",
        "profesia.sk", "profesia.cz", "práca za rohom", "práce za rohem", "nelisa.com",
        "arnold", "teamio", "seduo.cz", "seduo.sk", "platy.cz", "platy.sk", "paylab.com",
        "mojposao", "historie odpovědí", "uložené nabídky", "upozornění na nabídky",
        "hledám zaměstnance", "vložit brigádu", "ceník inzerce", "napište nám",
        "pro média", "zásady ochrany soukromí", "podmínky používání", "nastavení cookies",
        "reklama na portálech", "transparentnost", "nahlásit nezákonný obsah",
        "vzdělávací kurzy", "středoškolské nebo odborné", "typ pracovního poměru",
        "kontaktní údaje", "zadavatel", "časté pracovní cesty", "foto v medailonku",
        "the pulse of beauty", "nadnárodní struktury", "vlastní organizace",
        "vyhrazený čas na inovace", "kafetérie", "příspěvek na vzdělání",
        "stravenky/příspěvek na stravování", "zdravotní volno/sickdays",
        "možnost občasné práce z domova", "občerstvení na pracovišti",
        "příspěvek na sport/kulturu", "firemní akce", "bonusy/prémie",
        "flexibilní začátek/konec pracovní doby", "notebook", "sleva na firemní výrobky",
        "nabídky práce", "brigády", "inspirace", "zaměstnavatelé", "skvělý životopis",
        "můžete si ho uložit", "vytisknout nebo poslat do světa",
        # German
        "stellenangebote", "lebenslauf erstellen", "datenschutz", "impressum",
        "cookie-einstellungen", "agb", "kontakt", "über uns",
        # Polish
        "oferty pracy", "stwórz cv", "polityka prywatności", "regulamin",
        "ustawienia cookies", "kontakt", "o nas",
        # Slovak
        "ponuky práce", "vytvoriť životopis", "ochrana súkromia", "podmienky používania",
    ]
    
    lines = text.split("\n")
    filtered_lines = []
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            filtered_lines.append("")
            continue
        
        low = stripped.lower()
        
        # If line is too short (navigation link) and contains junk token
        if len(stripped) < 100:
            if any(tok in low for tok in junk_tokens):
                continue
        
        # Specific for exact matches
        if any(tok == low for tok in junk_tokens):
            continue
        
        filtered_lines.append(stripped)
    
    # Rejoin and clean empty lines at start/end
    result = "\n".join(filtered_lines).strip()
    
    # Remove multiple consecutive empty lines
    result = re.sub(r'\n{3,}', '\n\n', result)
    
    return result if result else "Popis není dostupný"


def scrape_page(url: str) -> Optional[BeautifulSoup]:
    """
    Download and parse a web page
    
    Args:
        url: URL to scrape
    
    Returns:
        BeautifulSoup object or None on error
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                         "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        resp = requests.get(url, headers=headers, timeout=12)
        resp.raise_for_status()
        return BeautifulSoup(resp.content, "html.parser")
    except Exception as e:
        print(f"❌ Chyba při stahování {url}: {e}")
        return None


def build_description(soup: BeautifulSoup, selectors: Dict[str, List]) -> str:
    """
    Build formatted job description from HTML using CSS selectors
    
    Args:
        soup: BeautifulSoup object of detail page
        selectors: Dict with 'paragraphs' and 'lists' keys containing CSS selectors
    
    Returns:
        Formatted description string
    """
    parts = []
    seen = set()
    
    # Try paragraph selectors
    for selector in selectors.get('paragraphs', []):
        elements = soup.select(selector)
        for elem in elements:
            txt = norm_text(elem.get_text())
            if txt and txt not in seen:
                seen.add(txt)
                parts.append(txt)
    
    # Try list selectors
    for selector in selectors.get('lists', []):
        lists = soup.select(selector)
        for ul in lists:
            items = ul.find_all('li')
            for item in items:
                txt = norm_text(item.get_text())
                if txt:
                    formatted = f"- {txt}"
                    if formatted not in seen:
                        seen.add(formatted)
                        parts.append(formatted)
    
    if parts:
        return filter_out_junk("\n\n".join(parts))
    
    return "Popis není dostupný"


def extract_benefits(
    soup: BeautifulSoup, 
    selectors: List[Any]
) -> List[str]:
    """
    Extract benefits from HTML using CSS selectors or callable extractors
    
    Args:
        soup: BeautifulSoup object of detail page
        selectors: List of CSS selectors or callable functions
    
    Returns:
        List of benefit strings
    """
    benefits = []
    
    for selector in selectors:
        if callable(selector):
            # Custom extractor function
            result = selector(soup)
            if result:
                benefits.extend(result)
        else:
            # CSS selector
            elements = soup.select(selector)
            for elem in elements:
                txt = norm_text(elem.get_text())
                if txt:
                    benefits.append(txt)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_benefits = []
    for b in benefits:
        if b not in seen:
            seen.add(b)
            unique_benefits.append(b)
    
    return unique_benefits if unique_benefits else ["Benefity nespecifikovány"]


def detect_work_type(title: str, description: str, location: str) -> str:
    """
    Detect work type (Remote/Hybrid/On-site) from job text
    
    Args:
        title: Job title
        description: Job description
        location: Job location
    
    Returns:
        Work type string
    """
    combined = f"{title} {description} {location}".lower()
    
    # Remote keywords (multi-language)
    remote_keywords = [
        'remote', 'vzdálená', 'vzdáleně', 'z domova', 'home office',
        'práce z domu', 'práca z domu', 'zdalna', 'fernarbeit'
    ]
    
    # Hybrid keywords
    hybrid_keywords = [
        'hybrid', 'hybridní', 'částečně z domova', 'částečně remote',
        'flexible', 'flexibilní'
    ]
    
    if any(kw in combined for kw in remote_keywords):
        # Check if it's actually hybrid
        if any(kw in combined for kw in hybrid_keywords):
            return 'Hybrid'
        return 'Remote'
    elif any(kw in combined for kw in hybrid_keywords):
        return 'Hybrid'
    
    return 'On-site'


def save_job_to_supabase(supabase: Optional[Client], job_data: Dict) -> bool:
    """
    Save job to Supabase with duplicate detection and geocoding
    
    Args:
        supabase: Supabase client instance
        job_data: Job data dictionary
    
    Returns:
        True if saved successfully, False otherwise
    """
    if not supabase:
        print("Chyba: Supabase klient není inicializován, data nebudou uložena.")
        return False
    
    # Check for duplicates
    try:
        response = (
            supabase.table("jobs").select("url").eq("url", job_data["url"]).execute()
        )
        if response.data:
            print(f"    --> Nabídka s URL {job_data['url']} již existuje, přeskočeno.")
            return True
    except Exception as e:
        print(f"Chyba při kontrole duplicity: {e}")
    
    # Extract source from URL
    parsed_url = urlparse(job_data["url"])
    job_data["source"] = parsed_url.netloc.replace("www.", "")
    job_data.setdefault("scraped_at", now_iso())
    job_data.setdefault("legality_status", "legal")  # Default to legal for scraped jobs
    
    # DETECT AND ASSIGN COUNTRY CODE based on domain
    if "country_code" not in job_data:
        domain = parsed_url.netloc.lower()
        if '.cz' in domain:
            job_data["country_code"] = "cs"
        elif '.sk' in domain:
            job_data["country_code"] = "sk"
        elif '.pl' in domain:
            job_data["country_code"] = "pl"
        elif '.de' in domain:
            job_data["country_code"] = "de"
        elif '.at' in domain:
            job_data["country_code"] = "at" # Correctly map .at to AT
        else:
            # Default to Czech if domain is unknown
            job_data["country_code"] = "cs"
    
    print(f"    🌍 Country code: {job_data['country_code']} (detected from {job_data.get('source', 'URL')})")
    
    # GEOCODE LOCATION: Convert location string to lat/lon for PostGIS
    if "location" in job_data and job_data["location"]:
        location_str = job_data["location"]
        print(f"    🌍 Geocodování lokality: {location_str}")
        
        geo_result = geocode_location(location_str)
        if geo_result:
            job_data["lat"] = geo_result["lat"]
            job_data["lng"] = geo_result["lon"]
            print(f"       ✅ Nalezeno: ({geo_result['lat']:.4f}, {geo_result['lon']:.4f}) [{geo_result['source']}]")
        else:
            print(f"       ⚠️ Geolokace selhala, uložím bez souřadnic")
            job_data["lat"] = None
            job_data["lng"] = None
    
            job_data["lng"] = None
    
    # TRUNCATE DESCRIPTION if too long (Supabase / Frontend performance protection)
    if "description" in job_data and job_data["description"] and len(job_data["description"]) > 9500:
        print(f"    ⚠️ Popis je příliš dlouhý ({len(job_data['description'])} znaků). Zkracuji na 9500.")
        job_data["description"] = job_data["description"][:9500] + "\n\n... (Popis byl zkrácen)"

    # Save to database
    try:
        response = supabase.table("jobs").insert(job_data).execute()
        if response.data:
            print(f"    --> Data pro '{job_data.get('title')}' úspěšně uložena.")
            return True
        else:
            print(f"    ❌ Chyba při ukládání dat: {job_data.get('title')}")
            return False
    except Exception as e:
        print(f"    ❌ Došlo k neočekávané chybě při ukládání: {e}")
        return False


# --- Base Scraper Class ---

class BaseScraper:
    """
    Base class for country-specific scrapers
    Provides common workflow and utilities
    """
    
    def __init__(self, country_code: str, supabase: Optional[Client] = None):
        """
        Initialize scraper
        
        Args:
            country_code: Two-letter country code (CZ, SK, PL, DE)
            supabase: Optional Supabase client (will create one if not provided)
        """
        self.country_code = country_code
        self.supabase = supabase or get_supabase_client()
        
        if not self.supabase:
            print(f"⚠️ VAROVÁNÍ: Supabase není dostupné pro {country_code} scraper")
    
    def is_duplicate(self, url: str) -> bool:
        """
        Check if job URL already exists in database
        """
        if not self.supabase:
            return False
            
        try:
            # Check for duplicates using the same logic as save_job_to_supabase
            response = str(self.supabase.table("jobs").select("url", count="exact").eq("url", url).execute())
            # If count > 0 or data returned
            if "url" in response and url in response:
                 # Logic depends on supabase-py specific return structure, simplified check:
                 pass
            
            # The most reliable way with supabase-py:
            res = self.supabase.table("jobs").select("id").eq("url", url).execute()
            if res.data and len(res.data) > 0:
                print(f"    --> (Cache) Nabídka již existuje: {url}")
                return True
            return False
        except Exception as e:
            print(f"⚠️ Chyba při kontrole duplicity: {e}")
            return False

    def scrape_page_jobs(self, soup: BeautifulSoup, site_name: str) -> int:
        """
        Scrape jobs from a single page (to be implemented by subclasses)
        
        Args:
            soup: BeautifulSoup object of the page
            site_name: Name of the website being scraped
        
        Returns:
            Number of jobs saved
        """
        raise NotImplementedError("Subclasses must implement scrape_page_jobs()")
    
    def scrape_website(self, site_name: str, base_url: str, max_pages: int = 10) -> int:
        """
        Scrape multiple pages from a website
        
        Args:
            site_name: Name of the website
            base_url: Base URL for scraping
            max_pages: Maximum number of pages to scrape
        
        Returns:
            Total number of jobs saved
        """
        total_saved = 0
        consecutive_zero_pages = 0
        
        for page_num in range(1, max_pages + 1):
            # Build page URL (different sites use different pagination formats)
            if '?' in base_url:
                url = f"{base_url}&page={page_num}"
            else:
                url = f"{base_url}?page={page_num}"
            
            print(f"\n📄 Scrapuji stránku {page_num}/{max_pages}: {url}")
            
            soup = scrape_page(url)
            if not soup:
                print(f"   ⚠️ Stránka {page_num} nedostupná, pokračuji na další...")
                continue
            
            jobs = self.scrape_page_jobs(soup, site_name)
            total_saved += jobs
            
            if jobs == 0:
                consecutive_zero_pages += 1
                print(f"   ℹ️ Žádné nové nabídky na stránce {page_num} ({consecutive_zero_pages}/3 prázdných stránek)")
                
                # Stop only after 3 consecutive pages with no new jobs
                if consecutive_zero_pages >= 3:
                    print(f"   ⏹️ 3 po sobě jdoucí prázdné stránky, končím.")
                    break
            else:
                # Reset counter when we find jobs
                consecutive_zero_pages = 0
            
            # Rate limiting between pages
            time.sleep(2)
        
        print(f"\n✅ Scrapování {site_name} dokončeno. Celkem uloženo: {total_saved}")
        return total_saved
    
    def run(self, websites: List[Dict]) -> int:
        """
        Run scraper on multiple websites
        
        Args:
            websites: List of dicts with 'name', 'base_url', 'max_pages' keys
        
        Returns:
            Total number of jobs saved across all websites
        """
        if not self.supabase:
            print(f"❌ Supabase není dostupné. Scrapování {self.country_code} zrušeno.")
            return 0
        
        grand_total = 0
        print(f"\n🚀 Spouštím {self.country_code} scraper: {now_iso()}")
        
        for site in websites:
            try:
                print(f"\n{'='*60}")
                print(f"🌐 Začínám scrapovat: {site['name']}")
                print(f"{'='*60}")
                
                total = self.scrape_website(
                    site['name'],
                    site['base_url'],
                    site.get('max_pages', 10)
                )
                grand_total += total
                
            except Exception as e:
                print(f"❌ Chyba při scrapování {site['name']}: {e}")
                import traceback
                traceback.print_exc()
        
        print(f"\n{'='*60}")
        print(f"✅ {self.country_code} scraper dokončen. Celkem uloženo: {grand_total} nabídek")
        print(f"{'='*60}\n")
        
        return grand_total
