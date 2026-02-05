"""
JobShaman Scraper - Slovakia (SK)
Scrapes Slovak job portals: Profesia.sk, Kariera.sk
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
from urllib.parse import urljoin
import time
import re
from datetime import datetime


class SlovakiaScraper(BaseScraper):
    """Scraper for Slovak job portals"""
    
    def __init__(self, supabase=None):
        super().__init__('SK', supabase)
    
    def scrape_page_jobs(self, soup, site_name):
        """Route to appropriate site scraper"""
        if 'profesia' in site_name.lower():
            return self.scrape_profesia_sk(soup)
        elif 'kariera' in site_name.lower():
            return self.scrape_kariera_sk(soup)
        elif 'prace' in site_name.lower():
            return self.scrape_prace_sk(soup)
        else:
            print(f"⚠️ Neznámý portál: {site_name}")
            return 0
    
    def scrape_profesia_sk(self, soup):
        """Scrape Profesia.sk (structural extraction)"""
        jobs_saved = 0
        
        # Target job list items specifically
        items = soup.select('li.list-row')
        print(f"    🔍 Nalezeno {len(items)} nabídek na stránce")
        
        for item in items:
            try:
                # Extract basic info from list (can be fallback)
                title_list = norm_text(item.select_one('.title').get_text()) if item.select_one('.title') else None
                employer_list = norm_text(item.select_one('.employer').get_text()) if item.select_one('.employer') else None
                loc_list = norm_text(item.select_one('.job-location').get_text()) if item.select_one('.job-location') else None
                
                # Prefer offer detail link (avoid company profile links like /C12345)
                a_el = item.select_one('h2 a[id^="offer"][href*="/praca/"]')
                if not a_el:
                    a_el = item.select_one('a[id^="offer"][href*="/praca/"]')
                if not a_el:
                    for a in item.find_all('a', href=True):
                        href = a.get('href', '')
                        if '/praca/' in href and '/O' in href:
                            a_el = a
                            break
                if not a_el:
                    continue
                    
                url = urljoin('https://www.profesia.sk', a_el['href'])
                
                # Strip query params from URL for duplicate check
                clean_url = url.split('?')[0]
                
                if self.is_duplicate(clean_url):
                    # print(f"       --> (Cache) Nabídka již existuje: {clean_url}")
                    continue
                    
                print(f"    📄 Stahuji detail: {clean_url}")
                detail_soup = scrape_page(url) # Fetch with params to be safe
                if not detail_soup:
                    continue
                # Title
                title = title_list or "Neznámá pozice"
                h1 = detail_soup.find("h1")
                if h1:
                    title = norm_text(h1.get_text())
                
                # Company - Improved
                company = employer_list or "Neznámá společnost"
                company_el = detail_soup.select_one('.company-name, .employer-name, .employer-company-name, [itemprop="hiringOrganization"]')
                if company_el:
                    company = norm_text(company_el.get_text())
                else:
                    # Fallback to OG meta
                    meta_og = detail_soup.find("meta", property="og:title")
                    if meta_og:
                        og_title = meta_og.get('content', '')
                        if " - " in og_title:
                            # Usually "Pozice - Firma | PROFESIA.SK"
                            parts = og_title.split(" - ")
                            if len(parts) > 1:
                                if "PROFESIA.SK" in parts[-1]:
                                    company = parts[-1].split("|")[0].strip()
                                else:
                                    company = parts[0].strip()
                    
                    # Last resort logo alt
                    if company == "Neznámá společnost" or company == "Logo společnosti":
                        img = detail_soup.select_one('a[href*="/praca/"] img')
                        if img and img.get('alt'):
                            company = norm_text(img.get('alt'))
                
                # Location - Improved extraction
                location = loc_list or "Slovensko"
                loc_marker = detail_soup.find(string=lambda x: x and ("Miesto práce" in x or "Place of work" in x))
                if loc_marker:
                    p = loc_marker.parent
                    marker_text = str(loc_marker)
                    for _ in range(4):
                        if p and len(p.get_text()) > len(marker_text) + 5: break
                        if p: p = p.parent
                    
                    if p:
                        text_content = p.get_text()
                        if "Miesto práce" in text_content:
                            location = text_content.split("Miesto práce")[-1].strip(": \n\t").split("\n")[0].strip()
                        elif "Place of work" in text_content:
                            location = text_content.split("Place of work")[-1].strip(": \n\t").split("\n")[0].strip()
                    
                    location = location.replace('Zobraziť na mape', '').strip()
                
                # Description - Multi-strategy extraction
                description = "Popis nenalezen"
                
                main_content = detail_soup.select_one('.details, .details-desc, .description, .job-description, .content, [itemprop="description"], .offer-text')
                
                if main_content:
                    # Try structured extraction with build_description
                    description = build_description(detail_soup, {
                        'paragraphs': ['.details p', '.details-desc p', '.description p', '.job-description p', '.offer-text p', 'main p', 'article p'],
                        'lists': ['.details ul', '.details-desc ul', '.description ul', '.job-description ul', '.offer-text ul', 'main ul', 'article ul']
                    })
                    
                    if len(description) < 150:
                        # Fallback to raw text extraction (filtering out footer junk)
                        description = filter_out_junk(norm_text(main_content.get_text()))

                # Last resort: find largest text container
                if description == "Popis nenalezen" or len(description) < 100:
                    candidates = []
                    for div in detail_soup.find_all(['div', 'main', 'article', 'section']):
                        txt = div.get_text(strip=True)
                        if 200 < len(txt) < 20000:
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

                # Benefits - More specific extraction (separate from description)
                benefits = extract_benefits(detail_soup, [
                    '.benefits li', 
                    '.employment-benefits li', 
                    '.job-benefits li',
                    '[data-test="benefits"] li',
                    '.offer-benefits li'
                ])
                
                # Try marker-based extraction if not found
                if not benefits or len(benefits) < 1:
                    benefit_marker = detail_soup.find(string=lambda x: x and ("Zamestnanecké výhody" in x or "Benefits" in x or "Výhody" in x))
                    if benefit_marker:
                        curr = benefit_marker.parent
                        for _ in range(5):
                            if curr:
                                next_ul = curr.find_next(['ul'])
                                if next_ul and next_ul.name == 'ul':
                                    lis = next_ul.find_all('li', recursive=False)
                                    if lis and len(lis) > 0 and len(lis) < 20:  # Sanity check
                                        benefits = [norm_text(li.get_text()) for li in lis if len(li.get_text()) > 3]
                                        break
                                # Custom design often uses <br> instead of <ul>
                                next_desc = curr.find_next(class_='details-desc')
                                if next_desc:
                                    raw = next_desc.get_text("\n")
                                    lines = [norm_text(l) for l in raw.split("\n") if norm_text(l)]
                                    if lines and len(lines) < 30:
                                        benefits = lines
                                        break
                            if curr: curr = curr.parent
                
                if not benefits:
                    benefits = []

                # Salary
                salary_from, salary_to = None, None
                salary_timeframe = None
                sal_marker = detail_soup.find(string=lambda x: x and ("Mzdové podmienky" in x or "Wage" in x))
                if sal_marker:
                    p = sal_marker.parent
                    for _ in range(3):
                        # Stop if we find numbers (the actual salary)
                        if p and any(c.isdigit() for c in p.get_text()): break
                        if p: p = p.parent
                    
                    if p:
                        sal_context = p.get_text().replace('\xa0', ' ')
                        salary_from, salary_to, _ = extract_salary(sal_context, currency='EUR')
                        salary_timeframe = self._detect_salary_timeframe(sal_context)
                else:
                    # Try known salary label in overall info
                    salary_info = detail_soup.find(string=lambda x: x and ("Základná zložka mzdy" in x))
                    if salary_info:
                        ctx = salary_info.parent.get_text().replace('\xa0', ' ')
                        salary_from, salary_to, _ = extract_salary(ctx, currency='EUR')
                        salary_timeframe = self._detect_salary_timeframe(ctx)
                
                # Contract type
                contract_type = "Nespecifikováno"
                ctype_marker = detail_soup.find(string=lambda x: x and ("Druh pracovného pomeru" in x or "Contract type" in x))
                if ctype_marker:
                     p = ctype_marker.parent
                     for _ in range(3):
                         # Look for common contract keywords
                         ctx = p.get_text().lower()
                         if any(kw in ctx for kw in ["plný", "skrátený", "dohodu", "živnosť", "full", "part", "brigáda"]): break
                         if p: p = p.parent
                     
                     if p:
                        ctx = p.get_text().lower()
                        if "plný" in ctx or "full" in ctx: contract_type = "Plný úvazek"
                        elif "skrátený" in ctx or "part" in ctx: contract_type = "Zkrácený úvazek"
                        elif "na dohodu" in ctx or "brigáda" in ctx or "temporary" in ctx: contract_type = "Na dohodu / Brigáda"
                        elif "živnosť" in ctx or "freelance" in ctx or "contract" in ctx: contract_type = "Na živnost / Freelance"

                # Working time (full-time / part-time)
                working_time = self._detect_working_time(contract_type)

                # Detect work type
                work_type = detect_work_type(title, description, location)

                # Work model (remote / hybrid / onsite)
                work_model = self._detect_work_model(location, title, description)

                # Job level (junior / mid / senior / lead / etc.)
                job_level = self._detect_job_level(title)

                # Category / industry
                category = None
                industry_el = detail_soup.select_one('[itemprop="industry"]')
                if industry_el:
                    category = norm_text(industry_el.get_text())

                # Education level
                education_level = self._extract_detail_section_text(
                    detail_soup,
                    ["Pozícii vyhovujú uchádzači so vzdelaním", "Vzdelanie", "Education level"]
                )

                # Required skills (from "Osobnostné predpoklady a zručnosti")
                required_skills = self._extract_detail_section_lines(
                    detail_soup,
                    ["Osobnostné predpoklady a zručnosti", "Zručnosti", "Skills"]
                )

                # Contact person + email
                contact_person = None
                contact_email = None
                contact_block = self._extract_detail_section_text(
                    detail_soup,
                    ["Kontakt", "Kontaktná osoba", "Contact"]
                )
                if contact_block:
                    m = re.search(r"Kontaktná osoba:\s*([^\n\r]+)", contact_block)
                    if m:
                        contact_person = norm_text(m.group(1))
                # Find first email in the whole detail (often in selection section)
                email_match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", detail_soup.get_text(" "), re.I)
                if email_match:
                    contact_email = email_match.group(0)

                # Workplace address (if location looks like a real address)
                workplace_address = None
                if location and any(ch.isdigit() for ch in location):
                    workplace_address = location

                # Build job data
                job_data = {
                    'title': title,
                    'url': clean_url,
                    'company': company,
                    'location': location,
                    'description': description,
                    'benefits': benefits,
                    'contract_type': contract_type,
                    'work_type': work_type,
                    'education_level': education_level,
                    'category': category,
                    'salary_from': salary_from,
                    'salary_to': salary_to,
                    'salary_min': salary_from,
                    'salary_max': salary_to,
                    'salary_currency': 'EUR',
                    'salary_timeframe': salary_timeframe,
                    'job_level': job_level,
                    'working_time': working_time,
                    'work_model': work_model,
                    'required_skills': required_skills if required_skills else [],
                    'contact_person': contact_person,
                    'contact_email': contact_email,
                    'workplace_address': workplace_address,
                    'country_code': 'sk'
                }
                
                if is_low_quality(job_data):
                    print(f"       ⚠️ Nízká kvalita, přeskakuji.")
                    continue

                if save_job_to_supabase(self.supabase, job_data):
                    jobs_saved += 1
                
                time.sleep(0.3)
                
            except Exception as e:
                print(f"       ❌ Chyba při zpracování nabídky: {e}")
                continue
        
        return jobs_saved

    def _extract_detail_section_text(self, soup, heading_texts):
        if not soup or not heading_texts:
            return None
        for h in soup.find_all(['h3', 'h4']):
            h_text = norm_text(h.get_text())
            if any(t.lower() in h_text.lower() for t in heading_texts):
                desc = h.find_next(class_='details-desc')
                if desc:
                    text = norm_text(desc.get_text("\n"))
                    return text
        return None

    def _extract_detail_section_lines(self, soup, heading_texts):
        text = self._extract_detail_section_text(soup, heading_texts)
        if not text:
            return []
        lines = [norm_text(l) for l in text.split("\n") if norm_text(l)]
        # If it's a long sentence, keep as single item
        if len(lines) == 1 and len(lines[0]) > 120:
            return [lines[0]]
        return lines

    def _detect_salary_timeframe(self, text: str):
        if not text:
            return None
        low = text.lower()
        if any(tok in low for tok in ["/hod", "hodin", "hour"]):
            return "hour"
        if any(tok in low for tok in ["/den", "denne", "day"]):
            return "day"
        if any(tok in low for tok in ["/týž", "/tyz", "week", "týždeň", "tyzden"]):
            return "week"
        if any(tok in low for tok in ["/mesiac", "/mes", "month"]):
            return "month"
        if any(tok in low for tok in ["/rok", "roč", "year"]):
            return "year"
        return None

    def _detect_working_time(self, contract_type: str):
        if not contract_type:
            return None
        low = contract_type.lower()
        if "plný" in low or "full" in low:
            return "full_time"
        if "skrátený" in low or "part" in low:
            return "part_time"
        if "brigáda" in low or "dohodu" in low or "temporary" in low:
            return "temporary"
        if "živnost" in low or "freelance" in low or "contract" in low:
            return "contract"
        return None

    def _detect_work_model(self, location: str, title: str, description: str):
        text = " ".join([location or "", title or "", description or ""]).lower()
        if any(tok in text for tok in ["práca z domu", "praca z domu", "home office", "remote"]):
            if any(tok in text for tok in ["občas", "obcas", "čiasto", "castec", "hybrid", "occasion"]):
                return "hybrid"
            return "remote"
        # If location is a concrete place and no remote hints, assume onsite
        if location and len(location) > 0 and not any(tok in text for tok in ["hybrid", "remote", "home office"]):
            return "onsite"
        return None

    def _detect_job_level(self, title: str):
        if not title:
            return None
        low = title.lower()
        if any(tok in low for tok in ["stáž", "staz", "intern", "trainee"]):
            return "internship"
        if any(tok in low for tok in ["učň", "ucn", "apprentice"]):
            return "apprenticeship"
        if any(tok in low for tok in ["diplom", "diserta", "phd", "doktorand"]):
            return "student"
        if any(tok in low for tok in ["junior", "jr.", "jr "]):
            return "junior"
        if any(tok in low for tok in ["mid", "medior"]):
            return "mid"
        if any(tok in low for tok in ["senior", "sr."]):
            return "senior"
        if any(tok in low for tok in ["lead", "head", "director", "vedúci", "veduci"]):
            return "lead"
        if any(tok in low for tok in ["chief", "ceo", "cto", "cfo"]):
            return "executive"
        if any(tok in low for tok in ["živnosť", "zivnost", "freelance", "self-employed"]):
            return "self_employed"
        return None
    
    def scrape_kariera_sk(self, soup):
        """Scrape Kariera.sk"""
        jobs_saved = 0
        
        links = []
        # Kariera uses /pracovna-ponuka/ID/slug
        for a in soup.find_all('a', href=True):
            href = a['href']
            if 'pracovna-ponuka/' in href:
                links.append(urljoin('https://kariera.zoznam.sk', href))
            
        links = list(set(links))
        
        for url in links:
            if self.is_duplicate(url):
                continue
                
            try:
                print(f"    📄 Stahuji detail: {url}")
                detail_soup = scrape_page(url)
                if not detail_soup:
                    continue
                
                # Title
                title = "Neznámá pozice"
                h1 = detail_soup.find("h1")
                if h1:
                     title = norm_text(h1.get_text())
                
                # Company
                company = "Neznámá společnost"
                # Try specific class or meta
                comp_el = detail_soup.select_one('.employer-name, .company, [itemprop="hiringOrganization"]')
                if comp_el:
                    company = norm_text(comp_el.get_text())

                # Location
                location = "Slovensko"
                loc_marker = detail_soup.find(string=lambda x: x and ("Miesto práce" in x or "Place of work" in x or "Mesto" in x))
                if loc_marker:
                    p = loc_marker.parent
                    for _ in range(3):
                        if p and len(p.get_text()) > 20: break
                        if p: p = p.parent
                    if p:
                        txt = p.get_text()
                        if ":" in txt:
                            location = txt.split(":")[-1].strip().split("\n")[0].strip()
                        else:
                            location = txt.replace(str(loc_marker), "").strip().split("\n")[0].strip()

                # Description
                description = "Popis nenalezen"
                desc_div = detail_soup.select_one(".description, .offer-text, [itemprop='description'], #job-description")
                
                if desc_div:
                     description = build_description(detail_soup, {
                         'paragraphs': ['.description p', '.offer-text p', '[itemprop="description"] p', '#job-description p'],
                         'lists': ['.description ul', '.offer-text ul', '[itemprop="description"] ul', '#job-description ul']
                     })
                
                if len(description) < 150:
                    main = detail_soup.select_one("main, .content, #offer-detail")
                    if main:
                        description = filter_out_junk(norm_text(main.get_text()))

                # Salary
                salary_from, salary_to = None, None
                sal_marker = detail_soup.find(string=lambda x: x and ("Mzda" in x or "Plat" in x or "Mzdové" in x))
                if sal_marker:
                    p = sal_marker.parent
                    for _ in range(3):
                        if p and any(c.isdigit() for c in p.get_text()): break
                        if p: p = p.parent
                    if p:
                        salary_from, salary_to, _ = extract_salary(p.get_text(), currency='EUR')

                # Detect work type
                work_type = detect_work_type(title, description, location)
                
                # Build job data
                job_data = {
                    'title': title,
                    'url': url,
                    'company': company,
                    'location': location,
                    'description': description,
                    'benefits': ["Benefity nespecifikovány"], 
                    'contract_type': "Nespecifikováno", # Default, ideally extract
                    'work_type': work_type,
                    'work_model': work_model,
                    'salary_from': salary_from,
                    'salary_to': salary_to,
                    'salary_currency': 'EUR',
                    'country_code': 'sk'
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
    
    def scrape_prace_sk(self, soup):
        """Scrape Prace.sk (Slovak job portal)"""
        jobs_saved = 0
        
        # Prace.sk uses standard job listing links
        job_links = soup.select('a[href*="/pozicia/"], a.job-link, a[data-cy="job-link"]')
        
        if not job_links:
            # Try more generic selectors
            job_links = []
            for a in soup.find_all('a', href=True):
                href = a['href']
                if '/pozicia/' in href or '/job/' in href:
                    job_links.append(a)
        
        print(f"    🔍 Nalezeno {len(job_links)} nabídek na stránce")
        
        for link in job_links:
            try:
                url = link.get('href', '')
                if not url.startswith('http'):
                    url = urljoin('https://www.prace.sk', url)
                
                if not url or 'prace.sk' not in url:
                    continue
                
                clean_url = url.split('?')[0]
                
                if self.is_duplicate(clean_url):
                    continue
                
                print(f"    📄 Stahuji detail: {clean_url}")
                detail_soup = scrape_page(url)
                if not detail_soup:
                    continue
                
                # Title
                title = "Neznámá pozice"
                h1 = detail_soup.find("h1")
                if h1:
                    title = norm_text(h1.get_text())
                
                # Company
                company = "Neznámá společnost"
                comp_el = detail_soup.select_one('.company-name, .employer-name, [itemprop="hiringOrganization"], .pozicia-firma')
                if comp_el:
                    company = norm_text(comp_el.get_text())
                
                # Location
                location = "Slovensko"
                loc_el = detail_soup.select_one('[data-cy="job-location"], .job-location, .pozicia-miesto, [itemprop="jobLocation"]')
                if loc_el:
                    location = norm_text(loc_el.get_text())
                
                # Description
                description = "Popis nenalezen"
                description = build_description(detail_soup, {
                    'paragraphs': ['.job-description p', '.pozicia-popis p', '[data-cy="job-description"] p', '[itemprop="description"] p', 'main p', 'article p'],
                    'lists': ['.job-description ul', '.pozicia-popis ul', '[data-cy="job-description"] ul', '[itemprop="description"] ul', 'main ul', 'article ul']
                })
                
                # Last resort
                if description == "Popis nenalezen" or len(description) < 100:
                    candidates = []
                    for div in detail_soup.find_all(['div', 'main', 'article', 'section']):
                        txt = div.get_text(strip=True)
                        if 200 < len(txt) < 20000:
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
                
                # Benefits
                benefits = extract_benefits(detail_soup, [
                    '.benefits li',
                    '[data-cy="benefits"] li',
                    '.pozicia-vyhody li',
                    '[itemprop="benefits"] li'
                ])
                
                # Salary
                salary_from, salary_to = None, None
                sal_text = detail_soup.select_one('.salary, [data-cy="salary"], .pozicia-mzda')
                if sal_text:
                    salary_from, salary_to, _ = extract_salary(sal_text.get_text(), currency='EUR')
                
                # Contract type
                contract_type = "Nespecifikováno"
                contract_el = detail_soup.select_one('.contract-type, [data-cy="contract-type"], .pozicia-typ')
                if contract_el:
                    contract_type = norm_text(contract_el.get_text())
                
                # Work type
                work_type = detect_work_type(title, description, location)
                work_model = self._detect_work_model(location, title, description)
                
                job_data = {
                    'title': title,
                    'url': clean_url,
                    'company': company,
                    'location': location,
                    'description': description,
                    'benefits': benefits if benefits else [],
                    'contract_type': contract_type,
                    'work_type': work_type,
                    'work_model': work_model,
                    'salary_from': salary_from,
                    'salary_to': salary_to,
                    'salary_currency': 'EUR',
                    'country_code': 'sk'
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


def run_slovakia_scraper():
    """Main function to run Slovakia scraper"""
    curr_time = datetime.now().isoformat()
    print(f"🚀 Spouštím SK scraper: {curr_time}", flush=True)
    scraper = SlovakiaScraper()
    
    websites = [
        {
            'name': 'Profesia.sk',
            'base_url': 'https://www.profesia.sk/praca/?page_num=1',
            'max_pages': 15
        },
        {
            'name': 'Kariera.sk',
            'base_url': 'https://kariera.zoznam.sk/pracovne-ponuky/za-1-den',
            'max_pages': 10
        },
        {
            'name': 'Prace.sk',
            'base_url': 'https://www.prace.sk/pozicie',
            'max_pages': 10
        }
    ]
    
    return scraper.run(websites)


if __name__ == '__main__':
    run_slovakia_scraper()
