"""
JobShaman Scraper - Poland (PL)
Scrapes Polish job portals: Pracuj.pl, Praca.pl, NoFluffJobs, JustJoin.it
"""

try:
    # Try relative import first (when run as module)
    from .scraper_base import (
        BaseScraper, scrape_page, norm_text, extract_salary,
        detect_work_type, save_job_to_supabase, build_description,
        extract_benefits, filter_out_junk, is_low_quality
    )
except ImportError:
    # Fallback to direct import (when run as script)
    from scraper_base import (
        BaseScraper, scrape_page, norm_text, extract_salary,
        detect_work_type, save_job_to_supabase, build_description,
        extract_benefits, filter_out_junk, is_low_quality
    )
import json
from urllib.parse import urljoin
import time
import re
from bs4 import BeautifulSoup


class PolandScraper(BaseScraper):
    """Scraper for Polish job portals"""
    
    def __init__(self, supabase=None):
        super().__init__('PL', supabase)
    
    def _detect_work_model_pl(self, title, location, description, explicit_text=None):
        text = " ".join([explicit_text or "", title or "", location or "", description or ""]).lower()
        # Remote / Home-office
        if any(tok in text for tok in [
            "praca zdalna", "zdalnie", "zdalna", "remote", "home office", "homeoffice",
            "work from home", "wfh", "na odległość", "na odleglosc"
        ]):
            return "remote"
        # Hybrid
        if any(tok in text for tok in [
            "hybryd", "hybrid", "częściowo zdal", "czesciowo zdal", "częściowo", "czesciowo"
        ]):
            return "hybrid"
        # On-site
        if any(tok in text for tok in ["stacjonarn", "on-site", "onsite", "biuro"]):
            return "onsite"
        return None
    
    def scrape_page_jobs(self, soup, site_name):
        """Route to appropriate site scraper"""
        site_lower = site_name.lower()
        if 'pracuj' in site_lower:
            return self.scrape_pracuj_pl(soup)
        elif 'praca.pl' in site_lower or site_lower.strip() == 'praca.pl':
            return self.scrape_praca_pl(soup)
        elif 'nofluff' in site_lower:
            return self.scrape_nofluffjobs(soup)
        elif 'justjoin' in site_lower:
            return self.scrape_justjoin_it(soup)
        else:
            print(f"⚠️ Neznámý portál: {site_name}")
            return 0
    
    def scrape_pracuj_pl(self, soup):
        """Scrape Pracuj.pl (via __NEXT_DATA__)"""
        jobs_saved = 0
        
        offers = []

        next_data = soup.select_one('#__NEXT_DATA__')
        if next_data:
            try:
                data = json.loads(next_data.get_text())
                props = data.get('props', {}).get('pageProps', {})
                queries = props.get('dehydratedState', {}).get('queries', [])

                for q in queries:
                    query_key = q.get('queryKey', [])
                    if isinstance(query_key, list) and len(query_key) > 0 and query_key[0] == 'jobOffers':
                        state_data = q.get('state', {}).get('data', {})
                        if 'groupedOffers' in state_data:
                            offers = state_data['groupedOffers']
                            break
                        if 'offers' in state_data:
                            offers = state_data['offers']
                            break
            except Exception as e:
                print(f"    ❌ Chyba při parsování Pracuj.pl JSON: {e}")

        if not offers:
            try:
                scripts = soup.find_all('script')
                for s in scripts:
                    txt = s.get_text() or ""
                    if '"jobTitle"' in txt and '"offerAbsoluteUri"' in txt:
                        data = json.loads(txt)
                        def _collect(d):
                            found = []
                            if isinstance(d, dict):
                                for v in d.values():
                                    found.extend(_collect(v))
                            elif isinstance(d, list):
                                for v in d:
                                    found.extend(_collect(v))
                            return [d] if isinstance(d, dict) and d.get('jobTitle') else found
                        offers = [o for o in _collect(data) if isinstance(o, dict) and o.get('jobTitle')]
                        if offers:
                            break
            except Exception:
                pass

        if not offers:
            for a in soup.find_all('a', href=True):
                href = a['href']
                if '/praca/' in href:
                    offers.append({
                        'jobTitle': norm_text(a.get_text()),
                        'offerUrl': href
                    })

        print(f"    ℹ️ Nalezeno {len(offers)} nabídek v datech.")

        for offer in offers:
            try:
                title = offer.get('jobTitle') or offer.get('title')
                company = offer.get('companyName') or offer.get('company')

                offer_url = None
                offer_objs = offer.get('offers', [{}]) if isinstance(offer.get('offers'), list) else []
                if offer_objs and len(offer_objs) > 0:
                    offer_url = offer_objs[0].get('offerUrl') or offer_objs[0].get('offerAbsoluteUri')

                if not offer_url:
                    offer_url = offer.get('offerUrl') or offer.get('offerAbsoluteUri')

                if not offer_url:
                    slug = offer.get('companyProfileUrl')
                    if slug:
                        offer_url = f"https://www.pracuj.pl{slug}"

                if not offer_url or not title:
                    continue

                if offer_url.startswith('/'):
                    offer_url = f"https://www.pracuj.pl{offer_url}"

                if self.is_duplicate(offer_url):
                    continue

                print(f"    📄 Zpracovávám: {title}")

                location = offer.get('displayWorkplace')
                if not location and offer_objs:
                    location = offer_objs[0].get('displayWorkplace')
                if not location:
                    location = 'Polska'

                salary_txt = offer.get('salaryText', '')
                salary_from, salary_to, _ = extract_salary(salary_txt, currency='PLN')

                detail_soup = scrape_page(offer_url)
                description = "Popis není dostupný"
                benefits = []
                contract_type = "Nespecifikováno"
                work_type = detect_work_type(title, "", location)

                if detail_soup:
                    json_ld = None
                    scripts = detail_soup.find_all('script', type='application/ld+json')
                    for s in scripts:
                        try:
                            ld = json.loads(s.get_text())
                            if isinstance(ld, list):
                                for item in ld:
                                    if item.get('@type') == 'JobPosting':
                                        json_ld = item
                                        break
                            elif ld.get('@type') == 'JobPosting':
                                json_ld = ld
                                break
                        except:
                            pass

                    if json_ld:
                        if 'description' in json_ld and json_ld['description']:
                            desc_html = json_ld['description']
                            desc_soup = BeautifulSoup(desc_html, 'html.parser')
                            parts = []
                            for elem in desc_soup.find_all(['p', 'li', 'h2', 'h3']):
                                txt = norm_text(elem.get_text())
                                if len(txt) > 2:
                                    if elem.name == 'li': parts.append(f"- {txt}")
                                    elif elem.name in ['h2', 'h3']: parts.append(f"\n### {txt}")
                                    else: parts.append(txt)
                            description = filter_out_junk("\n\n".join(parts)) if parts else filter_out_junk(desc_soup.get_text('\n\n'))

                        if 'employmentType' in json_ld:
                            contract_type = str(json_ld['employmentType'])
                    else:
                        description = build_description(
                            detail_soup,
                            {
                                'paragraphs': ['[data-test="section-responsibilities"] p', '[data-test="section-requirements"] p', '.job-description p', '.offer-description p', '.content p', 'main p', 'article p'],
                                'lists': ['[data-test="section-responsibilities"] ul', '[data-test="section-requirements"] ul', '.job-description ul', '.offer-description ul']
                            }
                        )

                        if description == "Popis není dostupný" or len(description) < 100:
                            candidates = []
                            for div in detail_soup.find_all(['div', 'main', 'article', 'section']):
                                txt = div.get_text(strip=True)
                                if 200 < len(txt) < 15000:
                                    score = len(txt)
                                    candidates.append((div, score))
                            if candidates:
                                candidates.sort(key=lambda x: x[1], reverse=True)
                                best_div = candidates[0][0]
                                parts = []
                                for elem in best_div.find_all(['p', 'li', 'h2', 'h3']):
                                    txt = norm_text(elem.get_text())
                                    if len(txt) > 2:
                                        if elem.name == 'li': parts.append(f"- {txt}")
                                        elif elem.name in ['h2', 'h3']: parts.append(f"\n### {txt}")
                                        else: parts.append(txt)
                                if parts:
                                    description = filter_out_junk("\n\n".join(parts))

                    benefits = extract_benefits(detail_soup, [
                        '[data-test="section-benefits"] li',
                        '.benefits-list li',
                        '.job-benefits li',
                        '[data-test="benefits"] li',
                        '.offer-benefits li'
                    ])
                    if not benefits:
                        benefits = []

                    work_type = detect_work_type(title, description, location)
                    work_model = self._detect_work_model_pl(title, location, description)

                job_data = {
                    'title': title,
                    'url': offer_url,
                    'company': company,
                    'location': location,
                    'description': description,
                    'benefits': benefits,
                    'contract_type': contract_type,
                    'work_type': work_type,
                    'work_model': work_model,
                    'salary_from': salary_from,
                    'salary_to': salary_to,
                    'salary_currency': 'PLN',
                    'country_code': 'pl'
                }

                if is_low_quality(job_data):
                    print(f"       ⚠️ Nízká kvalita, přeskakuji.")
                    continue

                if save_job_to_supabase(self.supabase, job_data):
                    jobs_saved += 1

                time.sleep(0.2)

            except Exception as e:
                print(f"       ❌ Chyba u nabídky: {e}")
                continue

        return jobs_saved

    def scrape_praca_pl(self, soup):
        """Scrape Praca.pl listing page"""
        jobs_saved = 0

        def _clean_text(text: str) -> str:
            return norm_text(text).replace("\xa0", " ")

        def _extract_from_details(details_text: str) -> dict:
            low = details_text.lower()
            contract_type = "Nespecifikováno"
            if "umowa o pracę tymczasową" in low:
                contract_type = "umowa o pracę tymczasową"
            elif "umowa o pracę" in low:
                contract_type = "umowa o pracę"
            elif "umowa zlecenie" in low:
                contract_type = "umowa zlecenie"
            elif "umowa o dzieło" in low:
                contract_type = "umowa o dzieło"
            elif "umowa agencyjna" in low:
                contract_type = "umowa agencyjna"
            elif "kontrakt b2b" in low or "b2b" in low:
                contract_type = "B2B"

            return {
                "contract_type": contract_type
            }

        items = soup.select("li.listing__item")
        if not items:
            print("    ⚠️ Praca.pl: žádné položky v listingu nenalezeny")
            return 0

        for item in items:
            try:
                title_el = item.select_one("a.listing__title")
                title_btn = item.select_one("button.listing__title")

                title = ""
                if title_el:
                    title = _clean_text(title_el.get_text())
                elif title_btn:
                    title = _clean_text(title_btn.get_text())

                if not title:
                    continue

                # company
                company = "Nieznana firma"
                origin = item.select_one(".listing__origin")
                if origin:
                    origin_text = _clean_text(origin.get_text(" "))
                    # Try to split by dot separator
                    company = origin_text.split("•")[0].strip() if "•" in origin_text else origin_text.split(".")[0].strip()
                    if not company:
                        company = "Nieznana firma"

                # salary + contract/work time from main details
                details_el = item.select_one(".listing__main-details")
                details_text = _clean_text(details_el.get_text(" ")) if details_el else ""
                salary_from, salary_to, _ = extract_salary(details_text, currency="PLN")
                details_parsed = _extract_from_details(details_text)
                contract_type = details_parsed["contract_type"]

                # teaser description (short)
                teaser = item.select_one(".listing__teaser")
                description = _clean_text(teaser.get_text(" ")) if teaser else "Popis není dostupný"

                # handle multiple locations
                location_links = item.select(".listing__locations a")
                if location_links:
                    targets = []
                    for loc_link in location_links:
                        href = loc_link.get("href", "")
                        if href:
                            targets.append((href, _clean_text(loc_link.get_text())))
                else:
                    href = title_el.get("href", "") if title_el else ""
                    loc_el = item.select_one(".listing__location-name")
                    loc = _clean_text(loc_el.get_text(" ")) if loc_el else "Polska"
                    targets = [(href, loc)]

                for href, loc in targets:
                    if not href:
                        continue
                    url = href if href.startswith("http") else urljoin("https://www.praca.pl", href)

                    if self.is_duplicate(url):
                        continue
                    
                    # Praca.pl is rate-limited; slow down before detail fetch
                    time.sleep(1.0)

                    # fetch detail for full description when possible
                    detail_soup = scrape_page(url, max_retries=4)
                    full_description = description
                    benefits = []
                    detail_company = None
                    detail_location = None
                    detail_salary_from = None
                    detail_salary_to = None
                    detail_contract_type = None
                    detail_job_level = None
                    detail_working_time = None
                    detail_work_model = None
                    detail_salary_timeframe = None

                    if detail_soup:
                        json_ld = None
                        scripts = detail_soup.find_all("script", type="application/ld+json")
                        for s in scripts:
                            try:
                                ld = json.loads(s.get_text())
                                if isinstance(ld, list):
                                    for item_ld in ld:
                                        if isinstance(item_ld, dict) and item_ld.get("@type") == "JobPosting":
                                            json_ld = item_ld
                                            break
                                elif isinstance(ld, dict) and ld.get("@type") == "JobPosting":
                                    json_ld = ld
                            except Exception:
                                continue
                            if json_ld:
                                break

                        if json_ld and json_ld.get("description"):
                            desc_html = json_ld["description"]
                            desc_soup = BeautifulSoup(desc_html, "html.parser")
                            parts = []
                            for elem in desc_soup.find_all(["p", "li", "h2", "h3"]):
                                txt = norm_text(elem.get_text())
                                if len(txt) > 2:
                                    if elem.name == "li":
                                        parts.append(f"- {txt}")
                                    elif elem.name in ["h2", "h3"]:
                                        parts.append(f"\n### {txt}")
                                    else:
                                        parts.append(txt)
                            full_description = filter_out_junk("\n\n".join(parts)) if parts else filter_out_junk(desc_soup.get_text("\n\n"))
                        else:
                            full_description = build_description(
                                detail_soup,
                                {
                                    "paragraphs": [
                                        ".app-offer__content p",
                                        ".szcont p",
                                        ".content p",
                                        ".offer-description p",
                                        ".job-description p",
                                        "main p",
                                        "article p"
                                    ],
                                    "lists": [
                                        ".app-offer__content ul",
                                        ".szcont ul",
                                        ".content ul",
                                        ".offer-description ul",
                                        ".job-description ul",
                                        "main ul",
                                        "article ul"
                                    ],
                                },
                            )

                        if not full_description or len(full_description) < 100:
                            # Last resort: extract from app-offer__content
                            offer_content = detail_soup.select_one(".app-offer__content")
                            if offer_content:
                                for tag in offer_content.find_all(["style", "script"]):
                                    tag.decompose()
                                full_description = filter_out_junk(norm_text(offer_content.get_text(" ")))
                            if not full_description or len(full_description) < 100:
                                full_description = description

                        # Detail: company, location, salary, contract type
                        comp_el = detail_soup.select_one(".app-offer__employer-data, .app-offer__profile-employer")
                        if comp_el:
                            detail_company = _clean_text(comp_el.get_text())

                        loc_el = detail_soup.select_one(".app-offer__main-item--location")
                        if loc_el:
                            detail_location = _clean_text(loc_el.get_text())

                        sal_el = detail_soup.select_one(".app-offer__salary")
                        if sal_el:
                            detail_salary_from, detail_salary_to, _ = extract_salary(sal_el.get_text(), currency="PLN")
                            if "mies" in sal_el.get_text().lower():
                                detail_salary_timeframe = "monthly"
                            elif "rok" in sal_el.get_text().lower() or "rocznie" in sal_el.get_text().lower():
                                detail_salary_timeframe = "yearly"

                        contract_el = detail_soup.select_one(".app-offer__header-item--employment-type")
                        if contract_el:
                            detail_contract_type = _clean_text(contract_el.get_text())

                        job_level_el = detail_soup.select_one(".app-offer__header-item--job-level")
                        if job_level_el:
                            detail_job_level = _clean_text(job_level_el.get_text())

                        working_time_el = detail_soup.select_one(".app-offer__header-item--working-time")
                        if working_time_el:
                            detail_working_time = _clean_text(working_time_el.get_text())

                        work_model_el = detail_soup.select_one(".app-offer__header-item--home")
                        if work_model_el:
                            detail_work_model = _clean_text(work_model_el.get_text())

                        benefits = extract_benefits(detail_soup, [
                            ".benefits li",
                            ".offer-benefits li",
                            ".job-benefits li"
                        ]) or []

                    if detail_company:
                        company = detail_company
                    if detail_location:
                        loc = detail_location
                    if detail_salary_from:
                        salary_from = detail_salary_from
                        salary_to = detail_salary_to
                    if detail_contract_type:
                        contract_type = detail_contract_type
                    job_level = detail_job_level
                    working_time = detail_working_time
                    work_model = self._detect_work_model_pl(title, loc, full_description, detail_work_model)
                    salary_timeframe = detail_salary_timeframe

                    work_type = detect_work_type(title, full_description, loc)

                    job_data = {
                        "title": title,
                        "url": url,
                        "company": company,
                        "location": loc,
                        "description": full_description,
                        "benefits": benefits,
                        "contract_type": contract_type,
                        "work_type": work_type,
                        "salary_from": salary_from,
                        "salary_to": salary_to,
                        "job_level": job_level,
                        "working_time": working_time,
                        "work_model": work_model,
                        "salary_timeframe": salary_timeframe,
                        "salary_currency": "PLN",
                        "country_code": "pl",
                    }

                    if is_low_quality(job_data):
                        print(f"       ⚠️ Nízká kvalita, přeskakuji.")
                        continue

                    if save_job_to_supabase(self.supabase, job_data):
                        jobs_saved += 1

                    time.sleep(0.2)

            except Exception as e:
                print(f"       ❌ Chyba u Praca.pl nabídky: {e}")
                continue

        return jobs_saved
    
    def scrape_nofluffjobs(self, soup):
        """Scrape NoFluffJobs.com (via #serverApp-state)"""
        jobs_saved = 0
        
        state_script = soup.select_one('#serverApp-state')
        if not state_script:
            print("    ⚠️ NoFluff: serverApp-state not found")
            return 0
            
        try:
            # The script content is usually properly escaped JSON content
            # Angular Universal transfer state
            content = state_script.get_text()
            # Unescape if needed (often &qout; etc are resolved by BeautifulSoup get_text automatically)
            
            data = json.loads(content)
            
            postings = []
            
            # Find the key holding the list of positions
            # Heuristic: search for list values where items have 'id' and 'title' or 'name'
            for key, value in data.items():
                if isinstance(value, dict) and 'postings' in value:
                     # sometimes data structure is { ... 'postings': [...] }
                     postings = value['postings']
                     break
                if isinstance(value, list) and len(value) > 0:
                     if isinstance(value[0], dict) and 'title' in value[0] and 'id' in value[0]:
                         postings = value
                         break
                         
            # Fallback: check map entries
            if not postings:
                 # Check if any value looks like a search result
                 for key, value in data.items():
                     if 'posting' in key.lower() and isinstance(value, list):
                         postings = value
                         break

            print(f"    ℹ️ Nalezeno {len(postings)} nabídek v NoFluff datech.")

            for job in postings:
                try:
                    title = job.get('title') or job.get('name')
                    job_id = job.get('id') or job.get('postingId')
                    
                    if not title or not job_id:
                        continue
                        
                    # Build URL
                    # Pattern: https://nofluffjobs.com/pl/job/<slug>
                    slug = job.get('url', '')
                    if not slug:
                        slug = f"{title.lower().replace(' ', '-')}-{job_id}"
                    
                    if not slug.startswith('http'):
                        url = f"https://nofluffjobs.com/pl/job/{slug}"
                    else:
                        url = slug
                        
                    if self.is_duplicate(url):
                        continue
                        
                    print(f"    📄 Zpracovávám: {title}")
                    
                    company = job.get('company', {}).get('name', 'Unknown') if isinstance(job.get('company'), dict) else job.get('name', 'Unknown')
                    
                    # Location
                    location_list = job.get('location', {}).get('places', [])
                    location = "Poland"
                    if location_list:
                        # format: [{'city': 'Warsaw', ...}]
                        location = location_list[0].get('city', 'Poland')
                        
                    # Salary
                    # usually in 'salary' object
                    salary_from, salary_to = None, None
                    salary_obj = job.get('salary', {})
                    if salary_obj:
                        salary_from = salary_obj.get('from')
                        salary_to = salary_obj.get('to')
                        if salary_obj.get('currency') != 'PLN':
                             # simple conversion or ignore? keeping straightforward for now
                             pass
                             
                    # Extract description from HTML details is still best if JSON doesn't provide full html
                    # But NoFluff JSON often has 'description' field? Not always in list view.
                    
                    # Fetch detail to be safe and get full description
                    detail_soup = scrape_page(url)
                    description = "Popis není dostupný"
                    benefits = []
                    contract_type = "B2B/Contract"  # NoFluff default often
                    
                    if detail_soup:
                         # Try JSON-LD first
                         json_ld = None
                         scripts = detail_soup.find_all('script', type='application/ld+json')
                         for s in scripts:
                             try:
                                 ld = json.loads(s.get_text())
                                 if isinstance(ld, list):
                                     for item in ld:
                                         if item.get('@type') == 'JobPosting':
                                             json_ld = item
                                             break
                                 elif ld.get('@type') == 'JobPosting':
                                     json_ld = ld
                                     break
                             except: pass
                         
                         if json_ld and 'description' in json_ld and json_ld['description']:
                             desc_html = json_ld['description']
                             desc_soup = BeautifulSoup(desc_html, 'html.parser')
                             parts = []
                             for elem in desc_soup.find_all(['p', 'li', 'h2', 'h3']):
                                 txt = norm_text(elem.get_text())
                                 if len(txt) > 2:
                                     if elem.name == 'li': parts.append(f"- {txt}")
                                     elif elem.name in ['h2', 'h3']: parts.append(f"\n### {txt}")
                                     else: parts.append(txt)
                             description = filter_out_junk("\n\n".join(parts)) if parts else filter_out_junk(desc_soup.get_text('\n\n'))
                         else:
                             # Enhanced selectors for NoFluffJobs
                             description = build_description(
                                detail_soup,
                                {
                                    'paragraphs': [
                                        '#posting-description p', 
                                        '.posting-description p',
                                        'nfj-posting-description p',
                                        '[data-cy="posting-description"] p',
                                        '.job-description p',
                                        'main p',
                                        'article p'
                                    ],
                                    'lists': [
                                        '#posting-requirements ul',
                                        '.posting-requirements ul',
                                        'nfj-posting-requirements ul',
                                        '[data-cy="posting-requirements"] ul',
                                        '.job-description ul',
                                        'main ul',
                                        'article ul'
                                    ]
                                }
                            )
                         
                         # Last resort fallback
                         if not description or description == "Popis není dostupný" or len(description) < 100:
                             candidates = []
                             for div in detail_soup.find_all(['div', 'main', 'article', 'section']):
                                 txt = div.get_text(strip=True)
                                 if 200 < len(txt) < 15000 and "cookies" not in txt.lower():
                                     score = len(txt)
                                     candidates.append((div, score))
                             
                             if candidates:
                                 candidates.sort(key=lambda x: x[1], reverse=True)
                                 best_div = candidates[0][0]
                                 parts = []
                                 for elem in best_div.find_all(['p', 'li', 'h2', 'h3']):
                                     txt = norm_text(elem.get_text())
                                     if len(txt) > 2:
                                         if elem.name == 'li': parts.append(f"- {txt}")
                                         elif elem.name in ['h2', 'h3']: parts.append(f"\n### {txt}")
                                         else: parts.append(txt)
                                 if parts:
                                     description = filter_out_junk("\n\n".join(parts))
                         
                         benefits = extract_benefits(detail_soup, [
                            'nfj-posting-benefits li', 
                            '.benefits-list li',
                            '[data-cy="posting-benefits"] li',
                            '#posting-benefits li',
                            '.benefits li',
                            '[data-test="benefits"] li'
                        ])
                    
                    work_type = 'On-site'
                    if job.get('fullyRemote'):
                        work_type = 'Remote'

                    explicit_work_model = 'Remote' if job.get('fullyRemote') else None
                    work_model = self._detect_work_model_pl(
                        title,
                        location,
                        description,
                        explicit_work_model
                    )
                    
                    job_data = {
                        'title': title,
                        'url': url,
                        'company': company,
                        'location': location,
                        'description': description,
                        'benefits': benefits,
                        'contract_type': 'B2B/Contract', # NoFluff default often
                        'work_type': work_type,
                        'work_model': work_model,
                        'salary_from': salary_from,
                        'salary_to': salary_to,
                        'salary_currency': 'PLN',
                        'country_code': 'pl'
                    }
                    
                    if is_low_quality(job_data):
                        print(f"       ⚠️ Nízká kvalita, přeskakuji.")
                        continue

                    if save_job_to_supabase(self.supabase, job_data):
                        jobs_saved += 1
                        
                    time.sleep(0.2)
                    
                except Exception as e:
                    print(f"       ❌ Chyba u NoFluff nabídky: {e}")
                    continue

        except Exception as e:
            print(f"    ❌ Chyba při parsování NoFluff JSON: {e}")
            
        return jobs_saved
    
    def scrape_justjoin_it(self, soup):
        """Scrape JustJoin.it (IT jobs in Poland)"""
        jobs_saved = 0
        
        # JustJoin.it has modern React-based structure
        # Might need to adjust selectors based on actual HTML
        job_cards = soup.select('[data-test-id="offer-item"]')
        
        for card in job_cards:
            try:
                # Extract link
                link_el = card.select_one('a')
                if not link_el:
                    continue
                
                title_el = card.select_one('h2, .title')
                title = norm_text(title_el.get_text()) if title_el else "Pozice bez názvu"
                url = urljoin('https://justjoin.it', link_el.get('href', ''))
                
                print(f"    📄 Stahuji detail: {title}")
                
                # Fetch detail
                detail_soup = scrape_page(url)
                if not detail_soup:
                    continue
                
                # Company
                company = "Neznámá společnost"
                comp_el = detail_soup.select_one('[data-test-id="company-name"]')
                if comp_el:
                    company = norm_text(comp_el.get_text())
                
                # Location
                location = "Neznámá lokalita"
                loc_el = detail_soup.select_one('[data-test-id="location"]')
                if loc_el:
                    location = norm_text(loc_el.get_text())
                
                # Description
                description = build_description(
                    detail_soup,
                    {
                        'paragraphs': [
                            '[data-test-id="description"] p',
                            '.description p'
                        ],
                        'lists': [
                            '[data-test-id="description"] ul',
                            '.tech-stack li'
                        ]
                    }
                )
                
                # Benefits
                benefits = extract_benefits(
                    detail_soup,
                    [
                        '[data-test-id="benefits"] li',
                        '.benefits-list li'
                    ]
                )
                
                # Salary
                salary_from, salary_to = None, None
                sal_el = detail_soup.select_one('[data-test-id="salary"]')
                if sal_el:
                    salary_text = sal_el.get_text()
                    salary_from, salary_to, _ = extract_salary(salary_text, currency='PLN')
                
                # Contract type
                contract_type = "Nespecifikováno"
                
                # Work type
                work_type = detect_work_type(title, description, location)
                work_model = self._detect_work_model_pl(title, location, description)
                
                job_data = {
                    'title': title,
                    'url': url,
                    'company': company,
                    'location': location,
                    'description': description,
                    'benefits': benefits,
                    'contract_type': contract_type,
                    'work_type': work_type,
                    'work_model': work_model,
                    'salary_from': salary_from,
                    'salary_to': salary_to,
                    'salary_currency': 'PLN',
                    'country_code': 'pl'
                }
                
                if is_low_quality(job_data):
                    print(f"       ⚠️ Nízká kvalita, přeskakuji.")
                    continue

                if save_job_to_supabase(self.supabase, job_data):
                    jobs_saved += 1
                
                time.sleep(0.3)
                
            except Exception as e:
                print(f"       ❌ Chyba: {e}")
                continue
        
        return jobs_saved


def run_poland_scraper():
    """Main function to run Poland scraper"""
    scraper = PolandScraper()
    
    websites = [
        {
            'name': 'Pracuj.pl',
            # Full market (no keyword filter)
            'base_url': 'https://www.pracuj.pl/praca?pn={page}',
            'max_pages': 30
        },
        {
            'name': 'Praca.pl',
            # Full market listing
            'base_url': 'https://www.praca.pl/oferty-pracy.html',
            'max_pages': 20
        },
        {
            'name': 'NoFluffJobs',
            # Full market listing
            'base_url': 'https://nofluffjobs.com/pl/jobs?page={page}',
            'max_pages': 20
        },
        # {
        #     'name': 'JustJoin.it',
        #     'base_url': 'https://justjoin.it/offers',
        #     'max_pages': 10
        # }
    ]
    
    return scraper.run(websites)


if __name__ == '__main__':
    run_poland_scraper()
