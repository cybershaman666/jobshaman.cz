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

# Add parent directory to path to import geocoding module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from geocoding import geocode_location

# --- 1. Načtení přístupů a inicializace klienta ---

# Explicitly load .env from backend directory (fix for local development)
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
# Use SERVICE_KEY instead of ANON_KEY to bypass RLS policies
# The service role key has full access to all tables and ignores row-level security
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Debug output
print(f"   SUPABASE_URL: {'✅ NAČTENO' if SUPABASE_URL else '❌ CHYBÍ'}")
print(f"   SUPABASE_SERVICE_KEY: {'✅ NAČTENO' if SUPABASE_SERVICE_KEY else '❌ CHYBÍ'}")


def get_supabase_client():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print(
            "⚠️ VAROVÁNÍ: SUPABASE_URL nebo SUPABASE_SERVICE_KEY chybí. Scrapování bude fungovat, ale data se neuloží."
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
        "První kontakt: e-mail"
    ]
    
    desc_lower = description.lower()
    for phrase in blacklist:
        if phrase.lower() in desc_lower:
            return True
            
    return False

def now_iso():
    return datetime.utcnow().isoformat()


def norm_text(s):
    if not s:
        return ""
    return re.sub(r"\s+", " ", s).strip()


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
    if not supabase:
        print("Chyba: Supabase klient není inicializován, data nebudou uložena.")
        return False

    try:
        response = (
            supabase.table("jobs").select("url").eq("url", job_data["url"]).execute()
        )
        if response.data:
            print(f"    --> Nabídka s URL {job_data['url']} již existuje, přeskočeno.")
            return True
    except Exception as e:
        print(f"Chyba při kontrole duplicity: {e}")

    parsed_url = urlparse(job_data["url"])
    job_data["source"] = parsed_url.netloc.replace("www.", "")
    job_data.setdefault("scraped_at", now_iso())
    job_data.setdefault("legality_status", "legal") # Default to legal for scraped jobs
    
    # DETECT AND ASSIGN COUNTRY CODE based on domain
    domain = parsed_url.netloc.lower()
    if '.cz' in domain:
        job_data["country_code"] = "cs"
    elif '.sk' in domain:
        job_data["country_code"] = "sk"
    elif '.pl' in domain:
        job_data["country_code"] = "pl"
    elif '.de' in domain:
        job_data["country_code"] = "de"
    else:
        # Default to Czech if domain is unknown
        job_data["country_code"] = "cs"
    
    print(f"    🌍 Country code: {job_data['country_code']} (detected from {domain})")
    
    # GEOCODE LOCATION: Convert location string to lat/lon
    if "location" in job_data and job_data["location"]:
        location_str = job_data["location"]
        print(f"    🌍 Geocodování lokality: {location_str}")
        
        geo_result = geocode_location(location_str)
        if geo_result:
            job_data["lat"] = geo_result["lat"]
            job_data["lng"] = geo_result["lon"]
            print(f"       ✅ Nalezeno: ({geo_result['lat']:.4f}, {geo_result['lon']:.4f}) [{geo_result['source']}]")
        else:
            print(f"       ⚠️ Geolokace selhala, ulož sem bez souřadnic")
            job_data["lat"] = None
            job_data["lng"] = None

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
        contract_type = "Nespecifikováno"

        if detail_soup:
            try:
                # Popis - Jobs.cz uses RichContent class for job descriptions
                # This is the main container with all the formatted job description content
                main_content = detail_soup.find("div", class_="RichContent")
                
                # Fallback to older selectors if RichContent not found
                if not main_content:
                    main_content = detail_soup.find("div", class_="JobDescriptionSection") or detail_soup.find("div", class_="JobDescription")
                
                parts = []
                if main_content:
                    # Extract all meaningful content: paragraphs, headings, and list items
                    for elem in main_content.find_all(['p', 'li', 'h2', 'h3', 'h4', 'ul', 'ol']):
                        # Skip ul/ol containers themselves, we only want their li children
                        if elem.name in ['ul', 'ol']:
                            continue
                            
                        txt = norm_text(elem.get_text())
                        if not txt:
                            continue
                        
                        # Format based on element type
                        if elem.name == 'li':
                            parts.append(f"- {txt}")
                        elif elem.name in ['h2', 'h3', 'h4']:
                            parts.append(f"\n### {txt}")
                        else:  # p tags
                            parts.append(txt)

                if parts:
                    description = filter_out_junk("\n\n".join(parts))


                # Benefity
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

                # Typ smluvního vztahu
                info_items = detail_soup.find_all("div", {"data-test": "jd-info-item"})
                for item in info_items:
                    label = item.find("span", class_="accessibility-hidden")
                    val = item.find("p")
                    if label and "Typ smluvního vztahu" in label.get_text():
                        if val:
                            contract_type = norm_text(val.get_text())
            except Exception as e:
                print(f"    ❌ Chyba detailu {odkaz}: {e}")

        if not benefits:
            benefits = ["Benefity nespecifikovány"]

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
        }

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
        }

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
        }
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
    for page_num in range(1, max_pages + 1):
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
        time.sleep(2)
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
    if not supabase:
        print("❌ Supabase není dostupné. Scrapování zrušeno.")
        return 0

    websites = [
        {
            "name": "jobs.cz",
            "base_url": "https://www.jobs.cz/prace/?language-skill=cs",
            "max_pages": 15,
        },
        {
            "name": "prace.cz",
            "base_url": "https://www.prace.cz/nabidky",
            "max_pages": 15,
        },
        {
            "name": "jenprace.cz",
            "base_url": "https://www.jenprace.cz/nabidky",
            "max_pages": 15,
        },
    ]

    grand_total = 0
    print(f"🚀 Spouštím hromadné scrapování: {now_iso()}")
    for site in websites:
        try:
            grand_total += scrape_website(
                site["name"], site["base_url"], site["max_pages"]
            )
        except Exception as e:
            print(f"❌ Chyba při scrapování {site['name']}: {e}")

    print(f"✅ Scrapování dokončeno. Celkem uloženo {grand_total} nabídek.")
    return grand_total


if __name__ == "__main__":
    run_all_scrapers()
