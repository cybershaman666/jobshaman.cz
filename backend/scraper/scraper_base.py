"""
JobShaman Scraper - Base Module
Shared utilities and base classes for all country-specific scrapers
Includes geocoding support for PostGIS spatial queries
"""

import requests
import random
from bs4 import BeautifulSoup
import json
import time
import base64
import uuid
from dotenv import load_dotenv
from supabase import create_client, Client
import os
from pathlib import Path
from urllib.parse import urljoin, urlparse, urlunparse, parse_qsl, urlencode
import re
from datetime import datetime
import sys
from typing import Optional, Dict, List, Tuple, Callable, Any
try:
    from langdetect import detect, detect_langs, LangDetectException
    _LANGDETECT_AVAILABLE = True
except Exception:
    detect = None  # type: ignore
    detect_langs = None  # type: ignore
    LangDetectException = Exception  # type: ignore
    _LANGDETECT_AVAILABLE = False
try:
    from ftfy import fix_text as ftfy_fix_text
    _FTFY_AVAILABLE = True
except Exception:
    ftfy_fix_text = None  # type: ignore
    _FTFY_AVAILABLE = False
try:
    from unstructured.partition.text import partition_text as unstructured_partition_text
    _UNSTRUCTURED_AVAILABLE = True
except Exception:
    unstructured_partition_text = None  # type: ignore
    _UNSTRUCTURED_AVAILABLE = False

# Add parent directory to path to import geocoding module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from geocoding import geocode_location
try:
    from app.services.jobs_postgres_store import (
        backfill_jobs_from_documents,
        get_job_by_url,
        jobs_postgres_enabled,
        jobs_postgres_main_write_enabled,
    )
except Exception:
    backfill_jobs_from_documents = None  # type: ignore
    get_job_by_url = None  # type: ignore
    jobs_postgres_enabled = None  # type: ignore
    jobs_postgres_main_write_enabled = None  # type: ignore

# --- Environment Setup ---

def load_environment():
    """
    Robust environment variable loading.
    1. Checks if SUPABASE_URL is already in env (e.g. Northflank).
    2. If not, or if .env exists, tries to load it from multiple candidate paths.
    """
    # Candidate paths for .env
    current_dir = Path.cwd()
    script_dir = Path(__file__).resolve().parent
    backend_dir = script_dir.parent
    
    candidates = [
        backend_dir / ".env",
        current_dir / ".env",
        current_dir / "backend" / ".env",
    ]
    
    # Also support .env.local if present
    for base_path in list(candidates):
        candidates.append(base_path.with_suffix(".env.local"))

    env_loaded = False
    for cp in candidates:
        if cp.exists():
            if not os.getenv("SUPABASE_URL"):
                print(f"🔍 Načítám environment z: {cp}")
            load_dotenv(dotenv_path=str(cp))
            env_loaded = True
            break
            
    if not env_loaded and not os.getenv("SUPABASE_URL"):
        # Fallback to default load_dotenv() if no specific file found and env is empty
        load_dotenv()

load_environment()

SUPABASE_URL = os.getenv("SUPABASE_URL")


def _resolve_supabase_service_key() -> tuple[Optional[str], Optional[str]]:
    candidates = (
        ("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY")),
        ("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_SERVICE_KEY")),
        ("SUPABASE_KEY", os.getenv("SUPABASE_KEY")),
    )
    for name, value in candidates:
        if value:
            return value, name
    return None, None


def _infer_supabase_key_role(key: Optional[str]) -> str:
    if not key:
        return "missing"
    if key.startswith("sb_publishable_"):
        return "publishable"
    if key.startswith("sb_secret_"):
        return "secret"
    parts = key.split(".")
    if len(parts) != 3:
        return "unknown"
    try:
        payload = parts[1] + "=" * (-len(parts[1]) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(payload))
        return str(decoded.get("role") or "unknown")
    except Exception:
        return "unknown"


SUPABASE_SERVICE_KEY, SUPABASE_SERVICE_KEY_SOURCE = _resolve_supabase_service_key()
SUPABASE_SERVICE_KEY_ROLE = _infer_supabase_key_role(SUPABASE_SERVICE_KEY)
SCRAPER_HTTP_PROXY = os.getenv("SCRAPER_HTTP_PROXY") or os.getenv("SCRAPER_PROXY")
SCRAPER_HTTPS_PROXY = os.getenv("SCRAPER_HTTPS_PROXY") or os.getenv("SCRAPER_PROXY")

# Debug output
if SUPABASE_URL:
    print(f"   SUPABASE_URL: ✅ NAČTENO")
else:
    print(f"   SUPABASE_URL: ❌ CHYBÍ")

if SUPABASE_SERVICE_KEY:
    print(
        f"   SUPABASE_SERVICE_KEY: ✅ NAČTENO "
        f"({SUPABASE_SERVICE_KEY_SOURCE}, role={SUPABASE_SERVICE_KEY_ROLE})"
    )
else:
    print(
        "   SUPABASE_SERVICE_KEY: ❌ CHYBÍ "
        "(nenalezen SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SERVICE_KEY ani SUPABASE_KEY)"
    )

if SCRAPER_HTTP_PROXY or SCRAPER_HTTPS_PROXY:
    print("   SCRAPER_PROXY: ✅ NAČTENO")
else:
    print("   SCRAPER_PROXY: ❌ NENASTAVENO")

def _get_page_cap(default: int = 10) -> Optional[int]:
    """
    Read global max-pages cap from env. Return None if disabled or invalid.
    """
    raw = os.getenv("SCRAPER_MAX_PAGES", str(default)).strip()
    try:
        cap = int(raw)
    except ValueError:
        cap = default
    return cap if cap > 0 else None


# --- Supabase Client Initialization ---

def get_supabase_client() -> Optional[Client]:
    """Initialize Supabase client with service role key"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print(
            "⚠️ VAROVÁNÍ: SUPABASE_URL nebo SUPABASE_SERVICE_KEY chybí. "
            "Scrapování bude fungovat, ale data se neuloží."
        )
        return None
    if SUPABASE_SERVICE_KEY_ROLE in {"anon", "authenticated", "publishable"}:
        print(
            "❌ SUPABASE klíč pro scraper nemá dostatečná práva "
            f"(zdroj={SUPABASE_SERVICE_KEY_SOURCE}, role={SUPABASE_SERVICE_KEY_ROLE}). "
            "Na Northflanku nastav `SUPABASE_SERVICE_ROLE_KEY` nebo `SUPABASE_SERVICE_KEY` "
            "na service-role/secret klíč, jinak insert do `jobs` zablokuje RLS."
        )
        return None
    try:
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("✅ Úspěšně vytvořen klient Supabase (s právy service role).")
        return client
    except Exception as e:
        print(f"❌ Chyba při inicializaci Supabase klienta: {e}")
        return None


def jobs_postgres_write_available() -> bool:
    try:
        if callable(jobs_postgres_main_write_enabled):
            return bool(jobs_postgres_main_write_enabled())
        return bool(jobs_postgres_enabled()) if callable(jobs_postgres_enabled) else False
    except Exception:
        return False


def guess_currency(country_code: str) -> str:
    """Guess currency based on country code"""
    if not country_code:
        return 'Kč'
    
    code = country_code.lower()
    if code == 'cs' or code == 'cz':
        return 'Kč'
    if code == 'sk' or code == 'de' or code == 'at':
        return 'EUR'
    if code == 'pl':
        return 'PLN'
    return 'Kč'


def normalize_country_code(country_code: Any) -> Optional[str]:
    raw = str(country_code or "").strip()
    if not raw:
        return None
    normalized = raw.upper()
    aliases = {
        "CS": "CZ",
        "UK": "GB",
    }
    return aliases.get(normalized, normalized)


def normalize_jobs_country_code(country_code: Any) -> Optional[str]:
    normalized = normalize_country_code(country_code)
    if not normalized:
        return None
    allowed = {
        "CZ": "cz",
        "SK": "sk",
        "PL": "pl",
        "DE": "de",
        "AT": "at",
        "DK": "dk",
        "SE": "se",
        "NO": "no",
        "FI": "fi",
    }
    return allowed.get(normalized)


_COUNTRY_CENTROIDS: Dict[str, Dict[str, Any]] = {
    "cz": {"lat": 49.8175, "lon": 15.4730, "country": "CZ", "source": "country_centroid"},
    "sk": {"lat": 48.6690, "lon": 19.6990, "country": "SK", "source": "country_centroid"},
    "pl": {"lat": 51.9194, "lon": 19.1451, "country": "PL", "source": "country_centroid"},
    "de": {"lat": 51.1657, "lon": 10.4515, "country": "DE", "source": "country_centroid"},
    "at": {"lat": 47.5162, "lon": 14.5501, "country": "AT", "source": "country_centroid"},
    "dk": {"lat": 56.2639, "lon": 9.5018, "country": "DK", "source": "country_centroid"},
    "se": {"lat": 60.1282, "lon": 18.6435, "country": "SE", "source": "country_centroid"},
    "no": {"lat": 60.4720, "lon": 8.4689, "country": "NO", "source": "country_centroid"},
    "fi": {"lat": 61.9241, "lon": 25.7482, "country": "FI", "source": "country_centroid"},
}

_COUNTRY_LOCATION_ALIASES: Dict[str, str] = {
    "czech republic": "cz",
    "ceska republika": "cz",
    "czechia": "cz",
    "cz": "cz",
    "slovakia": "sk",
    "slovensko": "sk",
    "sk": "sk",
    "poland": "pl",
    "polska": "pl",
    "pl": "pl",
    "germany": "de",
    "deutschland": "de",
    "de": "de",
    "austria": "at",
    "osterreich": "at",
    "österreich": "at",
    "at": "at",
    "denmark": "dk",
    "danmark": "dk",
    "dk": "dk",
    "sweden": "se",
    "sverige": "se",
    "se": "se",
    "norway": "no",
    "norge": "no",
    "no": "no",
    "finland": "fi",
    "suomi": "fi",
    "fi": "fi",
}


def get_country_centroid(country_code: Any = None, location: str = "") -> Optional[Dict[str, Any]]:
    normalized_country = normalize_jobs_country_code(country_code)
    if normalized_country and normalized_country in _COUNTRY_CENTROIDS:
        return dict(_COUNTRY_CENTROIDS[normalized_country])

    normalized_location = norm_text(location).lower()
    if normalized_location:
        mapped_country = _COUNTRY_LOCATION_ALIASES.get(normalized_location)
        if mapped_country and mapped_country in _COUNTRY_CENTROIDS:
            return dict(_COUNTRY_CENTROIDS[mapped_country])

    return None


# --- HTTP Session (reuse connections + more realistic headers) ---

_SESSION = requests.Session()
_SESSION.headers.update({
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,cs;q=0.6,de;q=0.6",
    "Connection": "keep-alive",
})
if SCRAPER_HTTP_PROXY or SCRAPER_HTTPS_PROXY:
    _SESSION.proxies.update({
        "http": SCRAPER_HTTP_PROXY or "",
        "https": SCRAPER_HTTPS_PROXY or SCRAPER_HTTP_PROXY or "",
    })

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

_DOMAIN_MIN_DELAY = {
    "praca.pl": 6.0,
    "pracuj.pl": 6.0,
    "nofluffjobs.com": 3.0,
    "justjoin.it": 3.0,
}
_DOMAIN_LAST_REQUEST: Dict[str, float] = {}
_DOMAIN_COOLDOWN_UNTIL: Dict[str, float] = {}


def _is_transient_db_error(exc: Exception) -> bool:
    if isinstance(exc, BrokenPipeError):
        return True
    if isinstance(exc, OSError) and getattr(exc, "errno", None) == 32:
        return True
    text = str(exc).lower()
    transient_markers = (
        "broken pipe",
        "connection reset",
        "server disconnected",
        "eof",
        "temporarily unavailable",
        "timeout",
        "timed out",
    )
    return any(marker in text for marker in transient_markers)


def _refresh_supabase_client() -> Optional[Client]:
    print("🔄 Obnovuji Supabase klienta po dočasné chybě připojení...")
    return get_supabase_client()


def _get_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.lower()
    except Exception:
        return ""


def _get_headers(url: str) -> Dict[str, str]:
    domain = _get_domain(url)
    referer = f"https://{domain}/" if domain else ""
    return {
        "User-Agent": random.choice(_USER_AGENTS),
        "Referer": referer,
    }


def _respect_domain_throttle(domain: str) -> None:
    if not domain:
        return
    now_ts = time.time()
    cooldown_until = _DOMAIN_COOLDOWN_UNTIL.get(domain, 0.0)
    if cooldown_until > now_ts:
        time.sleep(max(0.0, cooldown_until - now_ts))
    min_delay = _DOMAIN_MIN_DELAY.get(domain, 1.5)
    last_at = _DOMAIN_LAST_REQUEST.get(domain, 0.0)
    wait_for = min_delay - (now_ts - last_at)
    if wait_for > 0:
        time.sleep(wait_for + random.uniform(0.2, 0.8))
    _DOMAIN_LAST_REQUEST[domain] = time.time()

# --- Utility Functions ---

def now_iso() -> str:
    """Return current UTC time in ISO format"""
    return datetime.utcnow().isoformat()


def norm_text(s: str) -> str:
    """Normalize text by removing extra whitespace"""
    if not s:
        return ""
    return re.sub(r"\s+", " ", s).strip()


def detect_language_code(text: str) -> Optional[str]:
    """
    Detect language code (ISO 639-1) from text.
    Returns None if text is too short or detection fails.
    """
    if not _LANGDETECT_AVAILABLE:
        return None
    if not text:
        return None
    cleaned = norm_text(text)
    if len(cleaned) < 40:
        return None
    try:
        # Prefer probabilistic detection when available
        if detect_langs:
            langs = detect_langs(cleaned)
            if langs:
                return str(langs[0]).split(":")[0]
        return detect(cleaned)  # fallback
    except LangDetectException:
        return None
    except Exception:
        return None


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


def normalize_description_for_storage(text: str) -> str:
    """
    Normalize scraped description text with optional external tools.

    Pipeline:
    1) `ftfy` repair for mojibake/encoding issues.
    2) `unstructured` partitioning when available (better block/list recovery).
    3) Conservative inline-list recovery for one-line " - " bullet payloads.
    """
    if not text:
        return ""

    normalized = str(text).replace("\r\n", "\n").replace("\r", "\n")
    normalized = normalized.replace("\u00a0", " ").replace("\u200b", "")

    if _FTFY_AVAILABLE and ftfy_fix_text:
        try:
            normalized = ftfy_fix_text(normalized, normalization="NFC")
        except Exception as e:
            print(f"⚠️ ftfy normalize failed: {e}")

    if _UNSTRUCTURED_AVAILABLE and unstructured_partition_text:
        try:
            blocks: List[str] = []
            for element in unstructured_partition_text(text=normalized):
                raw = norm_text(str(element))
                if not raw:
                    continue
                category = str(getattr(element, "category", "") or "").lower()
                if category in ("listitem", "list-item"):
                    if not raw.startswith("- "):
                        raw = f"- {raw}"
                elif category in ("title", "header") and len(raw) <= 120:
                    raw = f"### {raw.rstrip(':')}"
                blocks.append(raw)
            if blocks:
                normalized = "\n\n".join(blocks)
        except Exception as e:
            print(f"⚠️ unstructured normalize failed: {e}")

    # Recover bullet structure from one-line descriptions with many " - " markers.
    if "\n- " not in normalized:
        inline_parts = [norm_text(part) for part in re.split(r"\s[-–—]\s", normalized) if norm_text(part)]
        if len(inline_parts) >= 3:
            intro = inline_parts[0]
            rest = inline_parts[1:]
            if len(intro.split()) >= 8 or intro.endswith((".", "!", "?", ":")):
                normalized = intro + "\n\n" + "\n".join(f"- {item}" for item in rest)
            else:
                normalized = "\n".join(f"- {item}" for item in inline_parts)

    # Final cleanup of multiple newlines should be careful not to squash everything
    # Collapse multiple spaces but preserve newlines
    normalized = re.sub(r"[^\S\r\n]{2,}", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized).strip()
    return normalized


def scrape_page(url: str, max_retries: int = 2) -> Optional[BeautifulSoup]:
    """
    Download and parse a web page
    
    Args:
        url: URL to scrape
    
    Returns:
        BeautifulSoup object or None on error
    """
    backoff = 1.5
    domain = _get_domain(url)
    for attempt in range(max_retries + 1):
        try:
            _respect_domain_throttle(domain)
            headers = _get_headers(url)
            resp = _SESSION.get(url, timeout=20, headers=headers)
            if resp.status_code in (403, 429, 503):
                wait = backoff
                if resp.status_code == 429:
                    retry_after = resp.headers.get("Retry-After")
                    if retry_after:
                        try:
                            wait = min(int(retry_after), 120)
                        except ValueError:
                            wait = backoff
                    # Increase domain delay after 429s
                    if domain:
                        _DOMAIN_MIN_DELAY[domain] = min(_DOMAIN_MIN_DELAY.get(domain, 2.0) * 1.5, 30.0)
                        _DOMAIN_COOLDOWN_UNTIL[domain] = time.time() + wait
                print(f"⚠️  Blokace/limit ({resp.status_code}) pro {url}, pokus {attempt + 1}/{max_retries + 1} (čekám {wait}s)")
                time.sleep(wait)
                backoff *= 1.8
                continue
            resp.raise_for_status()
            return BeautifulSoup(resp.content, "html.parser")
        except Exception as e:
            if attempt < max_retries:
                time.sleep(backoff)
                backoff *= 1.8
                continue
            print(f"❌ Chyba při stahování {url}: {e}")
            return None


def build_page_url(base_url: str, page_num: int) -> str:
    """
    Build a page URL from a base URL by replacing/adding pagination params.

    Supports:
    - Template: "{page}" in base_url
    - Query params: page, page_num, pn, p, pageNum, pageNumber, strana
    """
    if "{page}" in base_url:
        return base_url.format(page=page_num)

    parsed = urlparse(base_url)
    query_pairs = parse_qsl(parsed.query, keep_blank_values=True)
    query = dict(query_pairs)

    # Map lower-case keys to original keys to preserve casing
    lower_map = {k.lower(): k for k in query.keys()}
    candidates = ["page", "page_num", "pn", "p", "pagenum", "pagenumber", "strana"]

    chosen_key = None
    for cand in candidates:
        if cand in lower_map:
            chosen_key = lower_map[cand]
            break

    if not chosen_key:
        chosen_key = "page"

    query[chosen_key] = str(page_num)
    new_query = urlencode(query, doseq=True)
    rebuilt = parsed._replace(query=new_query)
    return urlunparse(rebuilt)


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


def is_low_quality(job_data: Dict) -> bool:
    """
    Checks if a job is low quality based on description length and blacklisted phrases.
    """
    description = job_data.get("description", "")
    if not description:
        return True
    
    # 1. Length check (tune by country/source; some PL/AT sources are shorter in practice)
    country = (job_data.get("country_code") or "").lower()
    url = (job_data.get("url") or "").lower()
    min_len = 500
    if country in {"de"}:
        min_len = 350
    elif country in {"at", "pl"}:
        min_len = 200
    elif country in {"sk"}:
        min_len = 450

    if len(description) < min_len:
        return True
        
    # 2. Blacklisted phrases (Extendable list)
    # These are Czech phrases, but won't hurt to check in others. 
    # Ideally should be localized, but user asked to apply "this" logic.
    blacklist = [
        "První kontakt: e-mail přes odpovědní formulář",
        "První kontakt: e-mail"
    ]
    
    desc_lower = description.lower()
    for phrase in blacklist:
        if phrase.lower() in desc_lower:
            return True
            
    return False


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


def save_job_to_supabase(supabase: Optional[Client], job_data: Dict, seen_urls: Optional[set] = None) -> bool:
    """
    Save job to Supabase with duplicate detection and geocoding
    
    Args:
        supabase: Supabase client instance
        job_data: Job data dictionary
        seen_urls: Optional set from BaseScraper._seen_urls - if URL already pre-checked,
                   skip the redundant duplicate SELECT query.
    
    Returns:
        True if saved successfully, False otherwise
    """
    def _mirror_row_to_jobs_postgres(row: Optional[Dict]) -> None:
        if not row or not isinstance(row, dict):
            return
        if not callable(backfill_jobs_from_documents):
            return
        try:
            enabled = (
                bool(jobs_postgres_main_write_enabled())
                if callable(jobs_postgres_main_write_enabled)
                else (bool(jobs_postgres_enabled()) if callable(jobs_postgres_enabled) else False)
            )
        except Exception:
            enabled = False
        if not enabled:
            return
        try:
            backfill_jobs_from_documents([dict(row)])
        except Exception as exc:
            print(f"    ⚠️ Jobs Postgres mirror failed: {exc}")

    def _upsert_direct_to_jobs_postgres(payload: Dict) -> bool:
        if not isinstance(payload, dict):
            return False
        if not callable(backfill_jobs_from_documents):
            return False
        try:
            enabled = (
                bool(jobs_postgres_main_write_enabled())
                if callable(jobs_postgres_main_write_enabled)
                else (bool(jobs_postgres_enabled()) if callable(jobs_postgres_enabled) else False)
            )
        except Exception:
            enabled = False
        if not enabled:
            return False

        normalized_url = str(payload.get("url") or "").strip()
        existing_row: Optional[Dict] = None
        if normalized_url and callable(get_job_by_url):
            try:
                existing = get_job_by_url(normalized_url)
                if isinstance(existing, dict) and existing:
                    existing_row = dict(existing)
            except Exception as exc:
                print(f"    ⚠️ Jobs Postgres duplicate lookup failed: {exc}")

        doc = dict(existing_row or {})
        doc.update(payload)
        if existing_row and existing_row.get("id") and not payload.get("id"):
            doc["id"] = existing_row["id"]
        if not doc.get("id"):
            doc["id"] = str(uuid.uuid5(uuid.NAMESPACE_URL, normalized_url or json.dumps(payload, sort_keys=True, default=str)))
        doc["source_kind"] = "external"
        doc.setdefault("status", "active")
        doc.setdefault("is_active", True)
        doc.setdefault("scraped_at", now_iso())
        doc.setdefault("created_at", doc.get("scraped_at"))
        doc["updated_at"] = now_iso()

        try:
            result = backfill_jobs_from_documents([doc])
            imported_count = int(result.get("imported_count") or 0)
            matched_count = int(result.get("matched_count") or 0)
            if imported_count > 0 or matched_count > 0:
                print(f"    --> Data pro '{doc.get('title')}' uložena přímo do Jobs Postgres.")
                return True
        except Exception as exc:
            print(f"    ⚠️ Direct Jobs Postgres write failed: {exc}")
        return False

    url = job_data["url"]
    
    # If is_duplicate() was already called for this URL (cache hit), skip the DB check.
    # Positive duplicates (url in seen_urls) should have been filtered by the caller,
    # but we handle them defensively here. Negative pre-checks are marked as __new__{url}.
    already_pre_checked = seen_urls is not None and f"__new__{url}" in seen_urls
    
    response = None
    if not already_pre_checked:
        # Check for duplicates (with transient DB retry)
        for attempt in range(2):
            try:
                response = (
                    supabase.table("jobs")
                    .select("*")
                    .eq("url", url)
                    .execute()
                )
                break
            except Exception as e:
                if attempt == 0 and _is_transient_db_error(e):
                    print(f"⚠️ Chyba při kontrole duplicity (pokus 1/2): {e}")
                    refreshed = _refresh_supabase_client()
                    if refreshed:
                        supabase = refreshed
                    time.sleep(0.4)
                    continue
                print(f"Chyba při kontrole duplicity: {e}")
                break

    if response and response.data:
        print(f"    --> Nabídka s URL {url} již existuje, přeskočeno.")
        # If language_code is missing, try to backfill it
        row = response.data[0]
        if row.get("language_code") is None:
            lang_text = f"{job_data.get('title', '')} {job_data.get('description', '')}"
            detected_lang = detect_language_code(lang_text)
            if not detected_lang:
                cc = (job_data.get("country_code") or "").lower()
                if cc in ("cz", "cs"):
                    detected_lang = "cs"
                elif cc == "sk":
                    detected_lang = "sk"
                elif cc == "pl":
                    detected_lang = "pl"
                elif cc in ("de", "at"):
                    detected_lang = "de"
            if detected_lang:
                try:
                    supabase.table("jobs").update({"language_code": detected_lang}).eq("id", row["id"]).execute()
                    row["language_code"] = detected_lang
                    print(f"    🈯 Language backfilled for existing job: {detected_lang}")
                except Exception as e:
                    print(f"    ⚠️ Language backfill failed: {e}")
        _mirror_row_to_jobs_postgres(row)
        return False
    
    # Extract source from URL
    parsed_url = urlparse(job_data["url"])
    job_data["source"] = parsed_url.netloc.replace("www.", "")
    job_data.setdefault("scraped_at", now_iso())
    job_data.setdefault("legality_status", "legal")  # Default to legal for scraped jobs

    # Centralized description normalization for all country scrapers.
    if "description" in job_data:
        normalized_description = normalize_description_for_storage(job_data.get("description", ""))
        job_data["description"] = filter_out_junk(normalized_description)
    
    # Sync 'currency' and 'salary_currency' for compatibility
    # The database uses salary_currency, but frontend might use currency
    if 'salary_currency' in job_data:
        job_data['currency'] = job_data['salary_currency']
    elif 'currency' in job_data:
        job_data['salary_currency'] = job_data['currency']
    elif 'salary_currency' not in job_data and 'currency' not in job_data:
        # We will assign this after country_code detection below
        pass
    
    # DETECT AND ASSIGN COUNTRY CODE based on domain when it is truly known.
    # Do not silently default unknown/global sources to Czechia.
    if "country_code" not in job_data:
        domain = parsed_url.netloc.lower()
        if '.cz' in domain:
            job_data["country_code"] = "cz"
        elif '.sk' in domain:
            job_data["country_code"] = "sk"
        elif '.pl' in domain:
            job_data["country_code"] = "pl"
        elif '.de' in domain:
            job_data["country_code"] = "de"
        elif '.at' in domain:
            job_data["country_code"] = "at" # Correctly map .at to AT
    elif not job_data.get("country_code"):
        job_data.pop("country_code", None)
    normalized_country_code = normalize_jobs_country_code(job_data.get("country_code"))
    if normalized_country_code:
        job_data["country_code"] = normalized_country_code
    else:
        job_data.pop("country_code", None)
            
    # Final currency fallback based on country code
    if not job_data.get('salary_currency') and not job_data.get('currency'):
        guessed = guess_currency(job_data.get('country_code'))
        job_data['salary_currency'] = guessed
        job_data['currency'] = guessed
    elif not job_data.get('currency'):
        job_data['currency'] = job_data['salary_currency']
    elif not job_data.get('salary_currency'):
        job_data['salary_currency'] = job_data['currency']
    
    print(f"    🌍 Country code: {job_data.get('country_code') or 'unknown'} (detected from {job_data.get('source', 'URL')})")

    # Detect language of the job text (title + description)
    if "language_code" not in job_data:
        lang_text = f"{job_data.get('title', '')} {job_data.get('description', '')}"
        detected_lang = detect_language_code(lang_text)
        if not detected_lang:
            # Fallback: map from country_code if detection is uncertain
            cc = (job_data.get("country_code") or "").lower()
            if cc in ("cz", "cs"):
                detected_lang = "cs"
            elif cc == "sk":
                detected_lang = "sk"
            elif cc == "pl":
                detected_lang = "pl"
            elif cc in ("de", "at"):
                detected_lang = "de"
        if detected_lang:
            job_data["language_code"] = detected_lang
            print(f"    🈯 Detected language: {detected_lang}")

    # GEOCODE LOCATION: Convert location string to lat/lon for PostGIS
    if "location" in job_data and job_data["location"]:
        location_str = job_data["location"]
        print(f"    🌍 Geocodování lokality: {location_str}")
        
        geo_result = geocode_location(location_str)
        if not geo_result:
            geo_result = get_country_centroid(job_data.get("country_code"), location_str)
        if geo_result:
            job_data["lat"] = geo_result["lat"]
            job_data["lng"] = geo_result["lon"]
            print(f"       ✅ Nalezeno: ({geo_result['lat']:.4f}, {geo_result['lon']:.4f}) [{geo_result['source']}]")
            if not job_data.get("country_code"):
                normalized_geo_country = normalize_jobs_country_code(geo_result.get("country"))
                if normalized_geo_country:
                    job_data["country_code"] = normalized_geo_country
        else:
            print(f"       ⚠️ Geolokace selhala, uložím bez souřadnic")
            job_data["lat"] = None
            job_data["lng"] = None
    
            job_data["lng"] = None
    
    # TRUNCATE DESCRIPTION if too long (Supabase / Frontend performance protection)
    if "description" in job_data and job_data["description"] and len(job_data["description"]) > 9500:
        print(f"    ⚠️ Popis je příliš dlouhý ({len(job_data['description'])} znaků). Zkracuji na 9500.")
        job_data["description"] = job_data["description"][:9500] + "\n\n... (Popis byl zkrácen)"

    if _upsert_direct_to_jobs_postgres(job_data):
        return True

    if callable(jobs_postgres_enabled):
        try:
            postgres_enabled = bool(jobs_postgres_enabled())
        except Exception:
            postgres_enabled = False
        if postgres_enabled and not jobs_postgres_write_available():
            print(
                "    ⚠️ Jobs Postgres je nakonfigurovaný, ale zapis do main tabulky není aktivní. "
                "Nastav `JOBS_POSTGRES_WRITE_MAIN=true`, jinak scraper spadne do Supabase fallbacku."
            )

    if not supabase:
        print("Chyba: Supabase klient není inicializován, data nebudou uložena.")
        return False

    # Save to database
    for attempt in range(2):
        try:
            response = supabase.table("jobs").insert(job_data).execute()
            if response.data:
                inserted_row = response.data[0] if isinstance(response.data, list) and response.data else None
                _mirror_row_to_jobs_postgres(inserted_row)
                print(f"    --> Data pro '{job_data.get('title')}' úspěšně uložena.")
                return True
            print(f"    ❌ Chyba při ukládání dat: {job_data.get('title')}")
            return False
        except Exception as e:
            if attempt == 0 and _is_transient_db_error(e):
                print(f"    ⚠️ Dočasná DB chyba při ukládání (pokus 1/2): {e}")
                refreshed = _refresh_supabase_client()
                if refreshed:
                    supabase = refreshed
                time.sleep(0.6)
                continue
            error_text = str(e)
            if "row-level security" in error_text.lower() or "42501" in error_text:
                print(
                    "    ❌ Insert do `jobs` zablokovala RLS politika. "
                    f"Aktivní key source={SUPABASE_SERVICE_KEY_SOURCE}, role={SUPABASE_SERVICE_KEY_ROLE}. "
                    "Zkontroluj, že Northflank posílá `SUPABASE_SERVICE_ROLE_KEY` "
                    "nebo `SUPABASE_SERVICE_KEY`, ne public/anon key."
                )
            print(f"    ❌ Došlo k neočekávané chybě při ukládání: {e}")
            return False
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
        # In-memory cache of seen URLs to avoid redundant DB lookups within one run
        self._seen_urls: set = set()
        
        if not self.supabase:
            print(f"⚠️ VAROVÁNÍ: Supabase není dostupné pro {country_code} scraper")
    
    def is_duplicate(self, url: str) -> bool:
        """
        Check if job URL already exists in database.
        Results are cached in memory so each URL hits the DB at most once per run.
        """
        # Fast path: already seen in this run
        if url in self._seen_urls:
            print(f"    --> (Cache) Nabídka již existuje: {url}")
            return True
        if not self.supabase:
            return False
            
        for attempt in range(2):
            try:
                res = self.supabase.table("jobs").select("id").eq("url", url).execute()
                if res.data and len(res.data) > 0:
                    self._seen_urls.add(url)  # cache positive result
                    print(f"    --> (DB) Nabídka již existuje: {url}")
                    return True
                # Cache negative result too so save_job_to_supabase can skip its own check
                self._seen_urls.add(f"__new__{url}")
                return False
            except Exception as e:
                if attempt == 0 and _is_transient_db_error(e):
                    print(f"⚠️ Chyba při kontrole duplicity (pokus 1/2): {e}")
                    refreshed = _refresh_supabase_client()
                    if refreshed:
                        self.supabase = refreshed
                    time.sleep(0.4)
                    continue
                print(f"⚠️ Chyba při kontrole duplicity: {e}")
                return False
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
        cap = _get_page_cap()
        effective_max_pages = min(max_pages, cap) if cap else max_pages
        if effective_max_pages != max_pages:
            print(f"   ℹ️ Omezení stránek: {max_pages} → {effective_max_pages} (SCRAPER_MAX_PAGES={cap})")
        
        for page_num in range(1, effective_max_pages + 1):
            # Build page URL (different sites use different pagination formats)
            url = build_page_url(base_url, page_num)
            
            print(f"\n📄 Scrapuji stránku {page_num}/{effective_max_pages}: {url}")
            
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
            time.sleep(3)
        
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
        if not self.supabase and not jobs_postgres_write_available():
            print(f"❌ Supabase ani Jobs Postgres nejsou dostupné. Scrapování {self.country_code} zrušeno.")
            return 0
        if not self.supabase and jobs_postgres_write_available():
            print(f"ℹ️ {self.country_code} scraper běží v postgres-only režimu bez Supabase klienta.")
        
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
