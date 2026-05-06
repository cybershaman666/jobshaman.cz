import requests
from bs4 import BeautifulSoup
import json
import time
import base64
from dotenv import load_dotenv
from supabase import create_client, Client
import os
from pathlib import Path
from urllib.parse import urljoin, urlparse
import re
from datetime import datetime
import sys
try:
    from langdetect import detect, detect_langs, LangDetectException
    _LANGDETECT_AVAILABLE = True
except Exception:
    detect = None  # type: ignore
    detect_langs = None  # type: ignore
    LangDetectException = Exception  # type: ignore
    _LANGDETECT_AVAILABLE = False

# Add current and parent directory to path to import geocoding module
_here = os.path.dirname(os.path.abspath(__file__))
if _here not in sys.path:
    sys.path.insert(0, _here)
_parent = os.path.dirname(_here)
if _parent not in sys.path:
    sys.path.insert(0, _parent)

try:
    from geocoding import geocode_location
except ImportError:
    try:
        from .geocoding import geocode_location
    except ImportError:
        # Fallback for complex imports
        import geocoding
        geocode_location = geocoding.geocode_location
try:
    from .scraper_api_sources import run_external_api_sources
except ImportError:
    from scraper_api_sources import run_external_api_sources  # type: ignore
try:
    from .scraper_base import (
        save_job_to_supabase as shared_save_job_to_supabase,
        jobs_postgres_write_available,
    )
except ImportError:
    from scraper_base import (  # type: ignore
        save_job_to_supabase as shared_save_job_to_supabase,
        jobs_postgres_write_available,
    )
try:
    from scripts.backfill_remote_import_metadata import backfill as backfill_remote_import_metadata
except ImportError:
    try:
        from ..scripts.backfill_remote_import_metadata import backfill as backfill_remote_import_metadata  # type: ignore
    except ImportError:
        backfill_remote_import_metadata = None  # type: ignore

try:
    from scraper_nordic import run_nordic_scraper
except ImportError:
    from .scraper_nordic import run_nordic_scraper

def load_environment():
    """Robust environment variable loading matching scraper_base.py"""
    current_dir = Path.cwd()
    script_dir = Path(__file__).resolve().parent
    backend_dir = script_dir.parent
    
    candidates = [
        backend_dir / ".env",
        current_dir / ".env",
        current_dir / "backend" / ".env",
    ]
    
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
        load_dotenv()

load_environment()

SUPABASE_URL = os.getenv("SUPABASE_URL")


def _resolve_supabase_service_key():
    candidates = (
        ("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY")),
        ("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_SERVICE_KEY")),
        ("SUPABASE_KEY", os.getenv("SUPABASE_KEY")),
    )
    for name, value in candidates:
        if value:
            return value, name
    return None, None


def _infer_supabase_key_role(key):
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
SCRAPER_SUPABASE_FALLBACK_ENABLED = os.getenv("SCRAPER_SUPABASE_FALLBACK_ENABLED", "false").strip().lower() in {
    "1",
    "true",
    "yes",
}

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

def _get_page_cap(default: int = 10):
    raw = os.getenv("SCRAPER_MAX_PAGES", str(default)).strip()
    try:
        cap = int(raw)
    except ValueError:
        cap = default
    return cap if cap > 0 else None


def get_supabase_client():
    if not SCRAPER_SUPABASE_FALLBACK_ENABLED:
        return None
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print(
            "⚠️ VAROVÁNÍ: SUPABASE_URL nebo SUPABASE_SERVICE_KEY chybí. Scrapování bude fungovat, ale data se neuloží."
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
        # Create client with service role key (bypasses RLS policies)
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("✅ Úspěšně vytvořen klient Supabase (s právy service role).")
        return client
    except Exception as e:
        print(f"❌ Chyba při inicializaci Supabase klienta: {e}")
        return None


supabase: Client = get_supabase_client()


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


def _refresh_supabase_client():
    global supabase
    print("🔄 Obnovuji Supabase klienta po dočasné chybě připojení...")
    supabase = get_supabase_client()
    return supabase

# --- Pomocné funkce ---
def is_low_quality(job_data):
    """
    Checks if a job is low quality based on description length and blacklisted phrases.
    """
    description = job_data.get("description", "")
    if not description:
        return True
    
    # 1. Length check (User requested "500 words", but that's very strict. 
    # We'll start with 500 characters (~80 words) to filter out empty/one-line descriptions)
    if len(description) < 500:
        return True
        
    # 2. Blacklisted phrases
    blacklist = [
        "První kontakt: e-mail přes odpovědní formulář",
        "První kontakt: e-mail",
        "kontakt telefonem",
        "konec inzerátu",
        "konec inzeratu",
        "telefonem"
    ]
    
    desc_lower = description.lower()
    for phrase in blacklist:
        if phrase.lower() in desc_lower:
            return True
            
    return False


def is_external_listing(detail_soup, allowed_domains):
    """
    Heuristic detection of external (offsite) job listings.
    Returns True if canonical/og URL or apply links point outside allowed domains.
    """
    try:
        # Canonical / OG URL checks
        canonical = detail_soup.find("link", rel="canonical")
        if canonical and canonical.get("href"):
            canon_domain = urlparse(canonical["href"]).netloc.lower()
            if canon_domain and not any(d in canon_domain for d in allowed_domains):
                return True

        og_url = detail_soup.find("meta", property="og:url")
        if og_url and og_url.get("content"):
            og_domain = urlparse(og_url["content"]).netloc.lower()
            if og_domain and not any(d in og_domain for d in allowed_domains):
                return True

        # Apply / redirect links to external domains
        apply_keywords = ["apply", "odpoved", "odpově", "career", "job", "position", "recruitee",
                          "greenhouse", "workday", "icims", "successfactors", "taleo",
                          "smartrecruiters", "lever", "personio", "teamio", "nelisa"]
        for a in detail_soup.find_all("a", href=True):
            href = a["href"]
            if href.startswith("http"):
                domain = urlparse(href).netloc.lower()
                if domain and not any(d in domain for d in allowed_domains):
                    text = (a.get_text() or "").lower()
                    if any(k in href.lower() for k in apply_keywords) or any(k in text for k in apply_keywords):
                        return True
    except Exception:
        pass
    return False

def now_iso():
    return datetime.utcnow().isoformat()


def norm_text(s):
    if not s:
        return ""
    return re.sub(r"\s+", " ", s).strip()


def detect_language_code(text: str):
    if not _LANGDETECT_AVAILABLE:
        return None
    if not text:
        return None
    cleaned = norm_text(text)
    if len(cleaned) < 40:
        return None
    try:
        if detect_langs:
            langs = detect_langs(cleaned)
            if langs:
                return str(langs[0]).split(":")[0]
        return detect(cleaned)
    except LangDetectException:
        return None
    except Exception:
        return None


def detect_salary_timeframe_cz(text):
    if not text:
        return None
    low = text.lower()
    if any(tok in low for tok in ["kč/h", "kc/h", "/hod", "hodin", "hod."]):
        return "hour"
    if any(tok in low for tok in ["/den", "denně", "denne"]):
        return "day"
    if any(tok in low for tok in ["/týd", "/tyd", "týden", "tyden"]):
        return "week"
    if any(tok in low for tok in ["/měs", "/mes", "měsíc", "mesiac", "měsíčně", "mesicne"]):
        return "month"
    if any(tok in low for tok in ["/rok", "roč", "roc", "p.a."]):
        return "year"
    return None


def detect_working_time_cz(text):
    if not text:
        return None
    low = text.lower()
    if "plný" in low or "full" in low:
        return "full_time"
    if any(tok in low for tok in ["zkrácen", "zkracen", "částeč", "castec", "part"]):
        return "part_time"
    if any(tok in low for tok in ["brigád", "brigad", "dpp", "dpč", "dpc"]):
        return "temporary"
    if any(tok in low for tok in ["živnost", "zivnost", "ičo", "ico", "osvč", "osvc", "freelance"]):
        return "contract"
    if any(tok in low for tok in ["stáž", "staz", "intern", "trainee"]):
        return "internship"
    if any(tok in low for tok in ["učň", "ucn", "apprentice"]):
        return "apprenticeship"
    return None


def detect_work_model_cz(location, title, description):
    text = " ".join([location or "", title or "", description or ""]).lower()
    if any(tok in text for tok in ["hybrid", "částečně z domova", "castecne z domova", "kombinovan"]):
        return "hybrid"
    if any(tok in text for tok in ["home office", "homeoffice", "práce z domova", "praca z domu", "remote", "na dálku", "na dalku", "dálkov"]):
        return "remote"
    if location:
        return "onsite"
    return None


def detect_job_level_cz(title):
    if not title:
        return None
    low = title.lower()
    if any(tok in low for tok in ["stáž", "staz", "intern", "trainee"]):
        return "internship"
    if any(tok in low for tok in ["učň", "ucn", "apprentice"]):
        return "apprenticeship"
    if any(tok in low for tok in ["student", "diplom", "diserta", "phd", "doktorand"]):
        return "student"
    if any(tok in low for tok in ["junior", "jr.", "jr ", "absolvent", "bez praxe"]):
        return "junior"
    if any(tok in low for tok in ["mid", "medior"]):
        return "mid"
    if any(tok in low for tok in ["senior", "sr."]):
        return "senior"
    if any(tok in low for tok in ["lead", "head", "director", "vedouc", "veduci"]):
        return "lead"
    if any(tok in low for tok in ["chief", "ceo", "cto", "cfo"]):
        return "executive"
    if any(tok in low for tok in ["živnost", "zivnost", "freelance", "self-employed"]):
        return "self_employed"
    return None


def extract_required_skills_cz(detail_soup, description):
    """
    Extract required skills/requirements from CZ detail pages or description.
    Returns list of strings.
    """
    skills = []
    seen = set()

    def add_line(txt):
        if not txt:
            return
        if txt in seen:
            return
        if len(txt) > 200:
            return
        seen.add(txt)
        skills.append(txt)

    def collect_from_heading(head):
        lines = []
        for sib in head.next_siblings:
            name = getattr(sib, "name", None)
            if name in ["h2", "h3", "h4"]:
                break
            if name in ["ul", "ol"]:
                for li in sib.find_all("li"):
                    txt = norm_text(li.get_text())
                    if txt:
                        lines.append(txt)
            elif name in ["p", "div", "span"]:
                txt = norm_text(sib.get_text())
                if txt:
                    lines.append(txt)
        return lines

    if detail_soup:
        keywords = [
            "požadujeme", "pozadujeme", "požadavky", "pozadavky",
            "požadavky na", "pozadavky na", "co od vás očekáváme", "co od vas ocekavame",
            "znalosti", "dovednosti", "schopnosti", "kvalifikace",
            "profil", "requirements", "your profile", "skills"
        ]
        for head in detail_soup.find_all(["h2", "h3", "h4", "strong", "b"]):
            htxt = norm_text(head.get_text()).lower()
            if not htxt:
                continue
            if any(k in htxt for k in keywords):
                lines = collect_from_heading(head)
                for line in lines:
                    add_line(line)
                if skills:
                    break

    # Fallback: parse description bullets after keyword line
    if not skills and description:
        lines = [l.strip() for l in description.split("\n") if l.strip()]
        hit = False
        for line in lines:
            low = line.lower()
            if any(k in low for k in ["požadujeme", "pozadujeme", "požadavky", "pozadavky", "requirements", "your profile", "skills"]):
                hit = True
                continue
            if hit:
                if line.startswith("- "):
                    add_line(line[2:].strip())
                elif line.startswith("### "):
                    break
        # If still empty, take bullet lines that look like skills
        if not skills:
            for line in lines:
                if line.startswith("- "):
                    add_line(line[2:].strip())

    return skills


def normalize_required_skills_cz(skills):
    """
    Normalize and clean skill list for CZ market.
    Returns tuple (hard_skills, soft_skills).
    """
    if not skills:
        return [], []

    canonical_map = {
        "ms excel": "Excel",
        "microsoft excel": "Excel",
        "excel": "Excel",
        "ms word": "Word",
        "microsoft word": "Word",
        "word": "Word",
        "powerpoint": "PowerPoint",
        "ms powerpoint": "PowerPoint",
        "microsoft powerpoint": "PowerPoint",
        "ms office": "MS Office",
        "microsoft office": "MS Office",
        "office": "MS Office",
        "sql": "SQL",
        "mysql": "MySQL",
        "postgres": "PostgreSQL",
        "postgresql": "PostgreSQL",
        "mssql": "MS SQL",
        "t-sql": "MS SQL",
        "python": "Python",
        "java": "Java",
        "javascript": "JavaScript",
        "js": "JavaScript",
        "typescript": "TypeScript",
        "ts": "TypeScript",
        "c++": "C++",
        "c#": "C#",
        "c": "C",
        "php": "PHP",
        "html": "HTML",
        "css": "CSS",
        "html/css": "HTML, CSS",
        "react": "React",
        "react.js": "React",
        "angular": "Angular",
        "vue": "Vue.js",
        "node": "Node.js",
        "node.js": "Node.js",
        "docker": "Docker",
        "kubernetes": "Kubernetes",
        "k8s": "Kubernetes",
        "aws": "AWS",
        "azure": "Azure",
        "gcp": "GCP",
        "git": "Git",
        "linux": "Linux",
        "windows": "Windows",
        "jira": "Jira",
        "sap": "SAP",
        "erp": "ERP",
        "crm": "CRM",
        "autocad": "AutoCAD",
        "solidworks": "SolidWorks",
        "matlab": "MATLAB",
        "excel (pokročilý)": "Excel (pokročilý)",
        "angličtina": "Angličtina",
        "němčina": "Němčina",
        "nemcina": "Němčina",
        "ruština": "Ruština",
        "rustina": "Ruština",
        "čeština": "Čeština",
        "cestina": "Čeština",
        "slovenština": "Slovenština",
        "slovencina": "Slovenština",
    }

    soft_keywords = [
        "komunikativ", "samostatn", "spolehliv", "pečliv", "pecliv",
        "zodpovědn", "zodpovedn", "flexibil", "proaktiv", "týmov", "tymov",
        "odolnost", "asertiv", "organizac", "time management", "leadership",
        "prezentac", "motivac", "adaptabil", "kreativ", "loajal",
        "preciz", "empati", "multitasking"
    ]

    language_aliases = {
        "en": ["aj", "angličtina", "anglictina", "english", "en"],
        "de": ["nj", "němčina", "nemcina", "nemčina", "german", "de"],
        "fr": ["francouzština", "francouzstina", "fr", "french"],
        "es": ["španělština", "spanelstina", "es", "spanish"],
        "it": ["italština", "italstina", "it", "italian"],
        "ru": ["ruština", "rustina", "ru", "russian"],
        "cs": ["čeština", "cestina", "cz", "czech"],
        "sk": ["slovenština", "slovencina", "sk", "slovak"],
        "pl": ["polština", "polstina", "pl", "polish"],
    }
    language_names = {
        "en": "Angličtina",
        "de": "Němčina",
        "fr": "Francouzština",
        "es": "Španělština",
        "it": "Italština",
        "ru": "Ruština",
        "cs": "Čeština",
        "sk": "Slovenština",
        "pl": "Polština",
    }

    hard_skills = []
    soft_skills = []
    seen_hard = set()
    seen_soft = set()

    def clean_token(t):
        t = norm_text(t)
        t = re.sub(r"^[\-\•\*\d\)\.\s]+", "", t)
        t = t.strip()
        return t

    def is_noise(t):
        low = t.lower()
        if len(low) < 2:
            return True
        if len(low) > 120:
            return True
        noise_tokens = [
            "praxe", "zkušenost", "zkušenosti", "vzdelani", "vzdělání",
            "min.", "minim", "nutná", "nutne", "požadujeme", "požadavky",
            "pozadujeme", "pozadavky", "výhodou", "vyhodou"
        ]
        if any(tok in low for tok in noise_tokens):
            return True
        return False

    def parse_language_skill(t):
        low = t.lower()
        # Detect language
        lang_code = None
        for code, aliases in language_aliases.items():
            for alias in aliases:
                if re.search(rf"\b{re.escape(alias)}\b", low):
                    lang_code = code
                    break
            if lang_code:
                break
        if not lang_code:
            return None

        # Detect level (CEFR or descriptive)
        level = None
        levels = re.findall(r"\b([abc][12])\b", low)
        if levels:
            level = "/".join([l.upper() for l in levels])
        else:
            if re.search(r"rodil|native", low):
                level = "Native"
            elif re.search(r"plynul|fluent", low):
                level = "C1"
            elif re.search(r"pokroči|pokrocil", low):
                if re.search(r"středn|stredn", low):
                    level = "B2"
                elif re.search(r"mírn|mirn", low):
                    level = "B1"
                else:
                    level = "C1"
            elif re.search(r"aktivn", low):
                level = "B2"
            elif re.search(r"pasivn", low):
                level = "B1"
            elif re.search(r"základ|zaklad|beginner|basic", low):
                level = "A1/A2"

        name = language_names.get(lang_code, lang_code.upper())
        if level:
            return f"{name} ({level})"
        return name

    def add_skill(t):
        t = clean_token(t)
        if is_noise(t):
            return
        low = t.lower()
        # Language skills with levels
        lang_skill = parse_language_skill(t)
        if lang_skill:
            if lang_skill not in seen_hard:
                seen_hard.add(lang_skill)
                hard_skills.append(lang_skill)
            return
        mapped = canonical_map.get(low, t)
        if mapped == "HTML, CSS":
            for part in ["HTML", "CSS"]:
                if part not in seen_hard:
                    seen_hard.add(part)
                    hard_skills.append(part)
            return
        if any(k in low for k in soft_keywords):
            if mapped not in seen_soft:
                seen_soft.add(mapped)
                soft_skills.append(mapped)
        else:
            if mapped not in seen_hard:
                seen_hard.add(mapped)
                hard_skills.append(mapped)

    for skill in skills:
        if not skill:
            continue
        # split by common separators
        parts = [skill]
        if any(sep in skill for sep in [",", ";", " | ", "/", " / "]):
            if "http" not in skill.lower():
                tmp = skill.replace(" / ", "/")
                parts = re.split(r"[;,]|\s\|\s|/", tmp)
        for p in parts:
            add_skill(p)

    return hard_skills, soft_skills


def extract_salary_range(stxt):
    """
    Centralizovaná funkce pro extrakci platu z textu.
    Podporuje formáty: '35 000', '35.000', '35,000', '35-45 tis.' atd.
    """
    if not stxt:
        return None, None
    
    # Krok 1: Extrakce číselných segmentů včetně oddělovačů (tečka, čárka, mezera)
    nums = re.findall(r"\d[\d\s\.,]*", stxt)
    vals = []
    
    for x in nums:
        # Odstranění mezer a teček (často tisícové oddělovače v ČR)
        cleaned = x.replace(" ", "").replace("\u00a0", "").replace(".", "")
        
        # Ošetření čárky - pokud je za ní přesně 2 cifry na konci segmentu, jde o haléře
        if "," in cleaned:
            parts = cleaned.split(",")
            if len(parts) > 1 and len(parts[-1]) == 2:
                cleaned = parts[0] # Zahodíme haléře
            else:
                cleaned = cleaned.replace(",", "") # Jinak čárka jako oddělovač tisíců
        
        if cleaned:
            try:
                val = int(cleaned)
                # Filtrujeme nesmyslné hodnoty (např. '2024' z data nebo '1' z '1. patro')
                if val > 100:
                    vals.append(val)
            except ValueError:
                continue

    # Krok 2: Multiplikátor "tisíc"
    low_txt = stxt.lower()
    if "tis" in low_txt or "tisíc" in low_txt:
        # Pokud jsou hodnoty podezřele malé (např. 35 místo 35000), vynásobíme je
        vals = [v * 1000 if v < 1000 else v for v in vals]

    # Krok 3: Určení From/To
    salary_from = None
    salary_to = None
    
    if len(vals) == 1:
        salary_from = vals[0]
    elif len(vals) >= 2:
        # Seřadíme, aby from < to (pokud by byly v opačném pořadí v textu)
        salary_from = min(vals[0], vals[1])
        salary_to = max(vals[0], vals[1])
        
    return salary_from, salary_to


# --- Uložení do Supabase ---
def save_job_to_supabase(job_data):
    return shared_save_job_to_supabase(supabase, job_data)


# --- Stahování stránky ---
def scrape_page(url):
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        resp = requests.get(url, headers=headers, timeout=12)
        resp.raise_for_status()
        return BeautifulSoup(resp.content, "html.parser")
    except Exception as e:
        print(f"❌ Chyba při stahování {url}: {e}")
        return None


# --- Filtrování footeru ---
def filter_out_junk(text):
    """Odstraní navigaci, patičky a obecný balast z popisů pozic."""
    if not text:
        return ""
    
    # Rozsáhlý seznam "junk" tokenů, které se často objevují v navigaci nebo patičkách
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
        "můžete si ho uložit", "vytisknout nebo poslat do světa"
    ]
    
    lines = text.split("\n")
    filtered_lines = []
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            filtered_lines.append("")
            continue
            
        low = stripped.lower()
        
        # Pokud je řádek příliš krátký (navigační odkaz) a obsahuje junk token
        if len(stripped) < 100:
            if any(tok in low for tok in junk_tokens):
                continue
        
        # Specifické pro Jobs.cz navigaci (často dlouhé seznamy s krátkými řádky)
        if any(tok == low for tok in junk_tokens):
            continue
            
        filtered_lines.append(stripped)
    
    # Zpětné spojení a vyčištění prázdných řádků na začátku/konci
    result = "\n".join(filtered_lines).strip()
    
    # Odstranění vícenásobných prázdných řádků
    result = re.sub(r'\n{3,}', '\n\n', result)
    
    return result if result else "Popis není dostupný"


# Ponecháváme filter_jenprace_footer pro zpětnou kompatibilitu, 
# ale interně volá filter_out_junk
def filter_jenprace_footer(text):
    return filter_out_junk(text)


# --- Jobs.cz ---
def scrape_jobs_cz(soup):
    jobs_saved = 0
    job_cards = soup.find_all("article")
    for card in job_cards:
        header = card.find("header")
        footer = card.find("footer")
        if not header or not footer:
            continue

        nazev_element = header.find("h2", class_="SearchResultCard__title")
        if not (nazev_element and nazev_element.a):
            continue
        title = norm_text(nazev_element.a.text)
        odkaz = urljoin("https://www.jobs.cz", nazev_element.a["href"])

        # Firma a lokalita
        company = "Neznámá společnost"
        comp_el = footer.find("li", class_="SearchResultCard__footerItem")
        if comp_el:
            span = comp_el.find("span", {"translate": "no"})
            if span:
                company = norm_text(span.text)
        location = "Neznámá lokalita"
        loc_el = footer.find(
            "li",
            class_="SearchResultCard__footerItem",
            attrs={"data-test": "serp-locality"},
        )
        if loc_el:
            location = norm_text(loc_el.text)

        print(f"    Stahuji detail pro: {title}")
        detail_soup = scrape_page(odkaz)
        if not detail_soup:
            print(f"    --> Detail stránka nedostupná, přeskočeno.")
            continue
        description = "Popis nenalezen"
        benefits = []
        salary_from = None
        salary_to = None
        salary_timeframe = None
        contract_type = "Nespecifikováno"
        employment_type = None
        job_level_notes = []

        if detail_soup:
            try:
                def extract_rich_text(container):
                    extracted = []
                    if not container:
                        return extracted
                    for elem in container.find_all(["p", "li", "h2", "h3", "h4", "ul", "ol"]):
                        if elem.name in ["ul", "ol"]:
                            continue
                        txt = norm_text(elem.get_text())
                        if not txt:
                            continue
                        if elem.name == "li":
                            extracted.append(f"- {txt}")
                        elif elem.name in ["h2", "h3", "h4"]:
                            extracted.append(f"\n### {txt}")
                        else:
                            extracted.append(txt)
                    return extracted

                parts = []
                header_intro = detail_soup.find("div", attrs={"data-test": "jd-header-text"})
                body_content = detail_soup.find("div", attrs={"data-jobad": "body"}) or detail_soup.find(
                    "div", attrs={"data-test": "jd-body-richtext"}
                )
                if not body_content:
                    body_content = detail_soup.find("div", class_="RichContent")
                if not body_content:
                    body_content = detail_soup.find("div", class_="JobDescriptionSection") or detail_soup.find(
                        "div", class_="JobDescription"
                    )

                parts.extend(extract_rich_text(header_intro))
                parts.extend(extract_rich_text(body_content))

                if parts:
                    description = filter_out_junk("\n\n".join(parts))


                # Benefity
                benefit_items = detail_soup.select("div.JobDescriptionBenefits [data-test='jd-benefits']")
                if benefit_items:
                    benefits = [norm_text(b.get_text()) for b in benefit_items if norm_text(b.get_text())]
                else:
                    btitle = detail_soup.find(
                        "p",
                        class_="typography-body-medium-text-regular JobDescriptionBenefits__title mb-600 text-secondary",
                    )
                    if btitle:
                        bdivs = btitle.find_next_siblings("div", class_="IconWithText")
                        benefits = [
                            norm_text(d.get_text())
                            for d in bdivs
                            if norm_text(d.get_text())
                        ]

                # Plat
                sal_div = detail_soup.find("div", {"data-test": "jd-salary"})
                if sal_div:
                    p = sal_div.find("p")
                    if p:
                        stxt = p.get_text(" ", strip=True)
                        salary_from, salary_to = extract_salary_range(stxt)
                        salary_timeframe = detect_salary_timeframe_cz(stxt)

                # Lokalita
                loc_link = detail_soup.find("a", {"data-test": "jd-info-location"})
                if loc_link:
                    location = norm_text(loc_link.get_text())

                # Typ smluvního vztahu / poměru + firma
                info_items = detail_soup.find_all("div", {"data-test": "jd-info-item"})
                for item in info_items:
                    label = item.find("span", class_="accessibility-hidden")
                    val = item.find("p")
                    if not (label and val):
                        continue
                    ltxt = label.get_text()
                    vtxt = norm_text(val.get_text())
                    if "Typ smluvního vztahu" in ltxt:
                        contract_type = vtxt
                    elif "Typ pracovního poměru" in ltxt:
                        employment_type = vtxt
                    elif "Společnost" in ltxt and vtxt:
                        company = vtxt
                    elif "Info" in ltxt and vtxt:
                        job_level_notes.append(vtxt)

                if not salary_timeframe and description:
                    salary_timeframe = detect_salary_timeframe_cz(description)
            except Exception as e:
                print(f"    ❌ Chyba detailu {odkaz}: {e}")

        if not benefits:
            benefits = ["Benefity nespecifikovány"]

        working_time = detect_working_time_cz(employment_type or contract_type)
        work_model = detect_work_model_cz(location, title, description)
        job_level = detect_job_level_cz(f"{title} {description} {' '.join(job_level_notes)}")
        required_skills_raw = extract_required_skills_cz(detail_soup, description)
        hard_skills, soft_skills = normalize_required_skills_cz(required_skills_raw)
        required_skills = hard_skills + soft_skills

        job_data = {
            "title": title,
            "url": odkaz,
            "company": company,
            "location": location,
            "description": description,
            "benefits": benefits,
            "contract_type": contract_type,
            "salary_from": salary_from,
            "salary_to": salary_to,
            "salary_min": salary_from,
            "salary_max": salary_to,
            "salary_timeframe": salary_timeframe,
            "working_time": working_time,
            "work_model": work_model,
            "job_level": job_level,
            "required_skills": required_skills if required_skills else [],
            "salary_currency": "CZK",
        }

        # Skip external listings with missing/short content
        if is_external_listing(detail_soup, {"jobs.cz"}) and (not description or len(description) < 400):
            print(f"    ⚠️ Externí inzerát bez popisu, přeskakuji: {title}")
            continue

        # Quality Check
        if is_low_quality(job_data):
            print(f"    ⚠️ Nízká kvalita, přeskakuji: {title}")
            continue

        if save_job_to_supabase(job_data):
            jobs_saved += 1
        time.sleep(0.3)
    return jobs_saved


# --- Prace.cz ---
def scrape_prace_cz(soup):
    jobs_saved = 0
    job_links = soup.find_all("a", attrs={"data-jd": True})
    for link in job_links:
        title = norm_text(link.get_text())
        odkaz = urljoin("https://www.prace.cz", link["href"])
        print(f"    Stahuji detail pro: {title}")
        detail_soup = scrape_page(odkaz)
        if not detail_soup:
            print(f"    --> Detail stránka nedostupná, přeskočeno.")
            continue

        company = "Neznámá společnost"
        location = "Neznámá lokalita"
        employment_type = "Nespecifikováno"
        contract_type = "Nespecifikováno"
        benefits = []
        description = "Popis nenalezen"
        salary_from = None
        salary_to = None
        salary_timeframe = None

        if detail_soup:
            try:
                # Firma
                comp_el = detail_soup.find("dd", class_="advert__list--company-name")
                if comp_el:
                    strong = comp_el.find("strong")
                    if strong:
                        company = norm_text(strong.get_text())

                # Lokalita
                loc_el = detail_soup.find("dd", class_="advert__list--location")
                if loc_el:
                    span = loc_el.find("span", class_="data")
                    if span:
                        location = norm_text(span.get_text())

                # Druh úvazku
                empl_el = detail_soup.find("dd", class_="advert__list--employment-type")
                if empl_el:
                    div = empl_el.find("div", class_="data")
                    if div:
                        employment_type = norm_text(div.get_text())

                # Smluvní vztah
                contract_el = detail_soup.find(
                    "dd", class_="advert__list--contract-type"
                )
                if contract_el:
                    div = contract_el.find("div", class_="data")
                    if div:
                        contract_type = norm_text(div.get_text())

                # Benefity
                benefit_el = detail_soup.find("dd", class_="advert__list--benefit")
                if benefit_el:
                    span = benefit_el.find("span", class_="data")
                    if span:
                        benefits = [
                            b.strip() for b in span.get_text().split(",") if b.strip()
                        ]

                # Plat
                sal_h3 = detail_soup.find("h3", class_="advert__salary")
                if sal_h3:
                    stxt = sal_h3.get_text(" ", strip=True)
                    salary_from, salary_to = extract_salary_range(stxt)
                    salary_timeframe = detect_salary_timeframe_cz(stxt)

                # Popis
                desc_el = detail_soup.find("div", class_="advert__richtext")
                if desc_el:
                    parts = []
                    for child in desc_el.find_all(["p", "li", "h2", "h3"], recursive=True):
                        txt = norm_text(child.get_text())
                        if not txt:
                            continue
                        if child.name == "li":
                            parts.append(f"- {txt}")
                        elif child.name in ["h2", "h3"]:
                            parts.append(f"### {txt}")
                        else:
                            parts.append(txt)
                    
                    if parts:
                        description = filter_out_junk("\n\n".join(parts))
            except Exception as e:
                print(f"    ❌ Chyba detailu {odkaz}: {e}")

        if not benefits:
            benefits = ["Benefity nespecifikovány"]

        working_time = detect_working_time_cz(contract_type or employment_type)
        work_model = detect_work_model_cz(location, title, description)
        job_level = detect_job_level_cz(title)
        required_skills_raw = extract_required_skills_cz(detail_soup, description)
        hard_skills, soft_skills = normalize_required_skills_cz(required_skills_raw)
        required_skills = hard_skills + soft_skills

        job_data = {
            "title": title,
            "url": odkaz,
            "company": company,
            "location": location,
            "description": description,
            "benefits": benefits,
            "contract_type": contract_type,
            "work_type": employment_type,
            "salary_from": salary_from,
            "salary_to": salary_to,
            "salary_min": salary_from,
            "salary_max": salary_to,
            "salary_timeframe": salary_timeframe,
            "working_time": working_time,
            "work_model": work_model,
            "job_level": job_level,
            "required_skills": required_skills if required_skills else [],
            "salary_currency": "CZK",
        }

        # Skip external listings with missing/short content
        if is_external_listing(detail_soup, {"prace.cz"}) and (not description or len(description) < 400):
            print(f"    ⚠️ Externí inzerát bez popisu, přeskakuji: {title}")
            continue

        if is_low_quality(job_data):
            print(f"    ⚠️ Nízká kvalita, přeskakuji: {title}")
            continue

        if save_job_to_supabase(job_data):
            jobs_saved += 1
        time.sleep(0.3)
    return jobs_saved


# --- Jenprace.cz --- (ponecháno z předchozí verze s benefity)
def scrape_jenprace_cz(soup):
    jobs_saved = 0
    job_cards = soup.find_all("a", class_="container-link")
    for card in job_cards:
        odkaz = card.get("href")
        if not odkaz or odkaz == "#":
            continue
        title_element = card.find("span", class_="offer-link")
        title = norm_text(title_element.text if title_element else "Neznámý název")
        detail_url = urljoin("https://www.jenprace.cz", odkaz)
        detail_soup = scrape_page(detail_url)
        if not detail_soup:
            print(f"    --> Detail stránka nedostupná, přeskočeno.")
            continue

        # Oprava: hledej lokaci v detail_soup místo soup + použij fix_duplicated_city
        location = None
        if detail_soup:
            location_tag = detail_soup.select_one(
                "div.value[data-cy='locality-detail-value']"
            )
            if location_tag:
                location_text = location_tag.get_text(strip=True)
                location = fix_duplicated_city(location_text.split("(")[0].strip())
            else:
                location_tag = detail_soup.select_one(
                    "span.locality[data-cy='offer-locality']"
                )
                if location_tag:
                    location_text = location_tag.get_text(strip=True)
                    location = fix_duplicated_city(location_text.split("(")[0].strip())

        company = "Neznámá společnost"
        if detail_soup:
            comp = detail_soup.find("div", {"data-cy": "company-value"})
            if comp:
                a = comp.find("a")
                company = norm_text(a.get_text() if a else comp.get_text())

        description = "Popis nenalezen"
        contract_type = "Nespecifikováno"
        education_level = "Nespecifikováno"
        benefits = []
        salary_from = None
        salary_to = None
        salary_timeframe = None

        if detail_soup:
            # Popis
            desc = detail_soup.find("div", class_="offer-content")
            if desc:
                parts = []
                for child in desc.find_all(["p", "li"], recursive=True):
                    txt = norm_text(child.get_text())
                    if not txt:
                        continue
                    if child.name == "li":
                        parts.append(f"- {txt}")
                    else:
                        parts.append(txt)
                
                if parts:
                    description = filter_out_junk("\n\n".join(parts))
            # Benefity
            blist = detail_soup.find("ul", {"data-cy": "offer-benefit-list"})
            if blist:
                items = blist.find_all("li", {"data-cy": "offer-benefit-item"})
                benefits = [
                    norm_text(i.get_text()) for i in items if norm_text(i.get_text())
                ]
            if not benefits:
                benefits = ["Benefity nespecifikovány"]
            # Contract
            ct = detail_soup.find("div", {"data-cy": "relation-value"})
            if ct:
                contract_type = norm_text(ct.get_text())
            # Education
            edu = detail_soup.find("div", {"data-cy": "education-value"})
            if edu:
                education_level = norm_text(edu.get_text())

            # Plat
            sal_div = detail_soup.find("div", class_="label-reward")
            if sal_div:
                stxt = sal_div.get_text(" ", strip=True)
                salary_from, salary_to = extract_salary_range(stxt)
                salary_timeframe = detect_salary_timeframe_cz(stxt)

        required_skills_raw = extract_required_skills_cz(detail_soup, description)
        hard_skills, soft_skills = normalize_required_skills_cz(required_skills_raw)
        required_skills = hard_skills + soft_skills

        job_data = {
            "title": title,
            "url": detail_url,
            "company": company,
            "location": location,
            "description": description,
            "benefits": benefits,
            "contract_type": contract_type,
            "education_level": education_level,
            "salary_from": salary_from,
            "salary_to": salary_to,
            "salary_min": salary_from,
            "salary_max": salary_to,
            "salary_timeframe": salary_timeframe,
            "working_time": detect_working_time_cz(contract_type),
            "work_model": detect_work_model_cz(location, title, description),
            "job_level": detect_job_level_cz(title),
            "required_skills": required_skills if required_skills else [],
            "salary_currency": "CZK",
        }
        if is_low_quality(job_data):
            print(f"    ⚠️ Nízká kvalita, přeskakuji: {title}")
            continue
        if save_job_to_supabase(job_data):
            jobs_saved += 1
        time.sleep(0.3)
    return jobs_saved


# --- Hlavní funkce ---
def scrape_website(site_name, base_url, max_pages=10):
    total_saved = 0
    scrapers = {
        "jobs.cz": scrape_jobs_cz,
        "prace.cz": scrape_prace_cz,
        "jenprace.cz": scrape_jenprace_cz,
    }
    scraper_func = scrapers.get(site_name)
    if not scraper_func:
        print(f"❌ Nepodporovaný web: {site_name}")
        return 0
    cap = _get_page_cap()
    effective_max_pages = min(max_pages, cap) if cap else max_pages
    if effective_max_pages != max_pages:
        print(f"   ℹ️ Omezení stránek: {max_pages} → {effective_max_pages} (SCRAPER_MAX_PAGES={cap})")
    for page_num in range(1, effective_max_pages + 1):
        url = (
            f"{base_url}&page={page_num}"
            if site_name == "jobs.cz"
            else f"{base_url}?page={page_num}"
        )
        soup = scrape_page(url)
        if not soup:
            continue
        jobs = scraper_func(soup)
        total_saved += jobs
        if jobs == 0:
            break
        time.sleep(3)
    print(f"Scrapování {site_name} dokončeno. Celkem {total_saved}.")
    return total_saved


def fix_duplicated_city(text):
    """Opraví duplicitní město (OlomoucOlomouc -> Olomouc) a odstraní 'zobrazit na mapě'"""
    # Odstranění textu "zobrazit na mapě" a podobných
    text = text.replace("zobrazit na mapě", "").replace("Zobrazit na mapě", "").strip()

    # Oprava duplicitního města
    if len(text) > 1 and len(text) % 2 == 0:
        half = len(text) // 2
        if text[:half] == text[half:]:
            return text[:half]
    return text


def run_all_scrapers():
    if not supabase and not jobs_postgres_write_available():
        print("❌ Není dostupný zapisovatelný backend. Scrapování zrušeno.")
        return 0
    if not supabase and jobs_postgres_write_available():
        print("ℹ️ Supabase není dostupné, pokračuji v postgres-only režimu.")

def run_czech_scrapers():
    """Runs only Czech-specific website scrapers (jobs.cz, prace.cz, jenprace.cz)"""
    websites = [
        {
            "name": "jobs.cz",
            "base_url": "https://www.jobs.cz/prace/?language-skill=cs",
            "max_pages": 10,
        },
        {
            "name": "prace.cz",
            "base_url": "https://www.prace.cz/nabidky",
            "max_pages": 10,
        },
        {
            "name": "jenprace.cz",
            "base_url": "https://www.jenprace.cz/nabidky",
            "max_pages": 10,
        },
    ]
    total = 0
    for site in websites:
        try:
            total += scrape_website(
                site["name"], site["base_url"], site["max_pages"]
            )
        except Exception as e:
            print(f"❌ Chyba při scrapování {site['name']}: {e}")
    return total


def run_all_api_sources():
    """Runs external API sources (WWR, Jooble, etc.)"""
    try:
        return run_external_api_sources(supabase)
    except Exception as e:
        print(f"❌ Chyba při ingestu API zdrojů: {e}")
        return 0


def run_all_scrapers():

    grand_total = 0
    print(f"🚀 Spouštím hromadné scrapování (Sequential): {now_iso()}")
    
    grand_total += run_czech_scrapers()
    grand_total += run_all_api_sources()

    try:
        print("🌍 Spouštím Nordic scraper (TheHub + Jooble)...")
        grand_total += run_nordic_scraper()
    except Exception as e:
        print(f"❌ Chyba při scrapování Nordic regionu: {e}")

    should_backfill_remote_metadata = os.getenv("SCRAPER_REMOTE_METADATA_BACKFILL", "true").strip().lower() not in {"0", "false", "no", "off"}
    if should_backfill_remote_metadata and backfill_remote_import_metadata:
        try:
            backfill_stats = backfill_remote_import_metadata(
                dry_run=False,
                batch_size=int(os.getenv("SCRAPER_REMOTE_METADATA_BACKFILL_BATCH_SIZE", "200")),
                sleep_seconds=float(os.getenv("SCRAPER_REMOTE_METADATA_BACKFILL_SLEEP_SECONDS", "0.05")),
                start_id=0,
                max_rows=int(os.getenv("SCRAPER_REMOTE_METADATA_BACKFILL_MAX_ROWS", "5000")),
            )
            print(
                "✅ Remote metadata normalization finished. "
                f"scanned={backfill_stats['scanned']} updated={backfill_stats['updated']} skipped={backfill_stats['skipped']}"
            )
        except Exception as e:
            print(f"❌ Chyba při post-import normalizaci remote metadata: {e}")

    print(f"✅ Scrapování dokončeno. Celkem uloženo {grand_total} nabídek.")
    return grand_total


if __name__ == "__main__":
    run_all_scrapers()
