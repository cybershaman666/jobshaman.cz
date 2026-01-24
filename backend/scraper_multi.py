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

# --- 1. Načtení přístupů a inicializace klienta ---
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

try:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Nastav prosím SUPABASE_URL a SUPABASE_KEY v souboru .env.")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Úspěšně vytvořen klient Supabase.")
except Exception as e:
    print(f"❌ Chyba při inicializaci Supabase klienta: {e}")
    supabase = None


# --- Pomocné funkce ---
def now_iso():
    return datetime.utcnow().isoformat()


def norm_text(s):
    if not s:
        return ""
    return re.sub(r"\s+", " ", s).strip()


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
                # Popis
                desc_ps = detail_soup.find_all(
                    "p", class_="typography-body-large-text-regular"
                )
                parts = [norm_text(p.text) for p in desc_ps if norm_text(p.text)]
                if parts:
                    description = "\n\n".join(parts)

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
                        nums = re.findall(r"\d[\d\s]*", stxt)
                        if nums:
                            vals = [
                                int(
                                    x.replace(" ", "")
                                    .replace("\u00a0", "")
                                    .replace(".", "")
                                )
                                for x in nums
                            ]
                            if len(vals) == 1:
                                salary_from = vals[0]
                            elif len(vals) >= 2:
                                salary_from, salary_to = vals[0], vals[1]

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
                    nums = re.findall(r"\d[\d\s]*", stxt)
                    if nums:
                        vals = [
                            int(
                                x.replace(" ", "")
                                .replace("\u00a0", "")
                                .replace(".", "")
                            )
                            for x in nums
                        ]
                        if len(vals) == 1:
                            salary_from = vals[0]
                        elif len(vals) >= 2:
                            salary_from, salary_to = vals[0], vals[1]

                # Popis
                desc_el = detail_soup.find("div", class_="advert__richtext")
                if desc_el:
                    parts = [
                        norm_text(t.get_text())
                        for t in desc_el.find_all(["p", "li"])
                        if norm_text(t.get_text())
                    ]
                    if parts:
                        description = "\n\n".join(parts)
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
                parts = [
                    norm_text(e.get_text())
                    for e in desc.find_all(["p", "li"])
                    if norm_text(e.get_text())
                ]
                if parts:
                    description = "\n\n".join(parts)
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
                nums = re.findall(r"\d[\d\s]*", stxt)
                if nums:
                    vals = [
                        int(x.replace(" ", "").replace("\u00a0", "").replace(".", ""))
                        for x in nums
                    ]
                    if len(vals) == 1:
                        salary_from = vals[0]
                    elif len(vals) >= 2:
                        salary_from, salary_to = vals[0], vals[1]

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


if __name__ == "__main__":
    if not supabase:
        print("❌ Supabase není dostupné.")
    else:
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
        choice = input("Zadej číslo volby (1=all,2=jobs,3=prace,4=jenprace): ").strip()
        grand_total = 0
        if choice == "1":
            for site in websites:
                grand_total += scrape_website(
                    site["name"], site["base_url"], site["max_pages"]
                )
        elif choice in ["2", "3", "4"]:
            idx = int(choice) - 2
            site = websites[idx]
            grand_total = scrape_website(
                site["name"], site["base_url"], site["max_pages"]
            )
        print(f"Celkem uloženo {grand_total} nabídek.")
