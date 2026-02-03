"""
JobShaman Scraper - Slovakia (SK)
Scrapes Slovak job portals: Profesia.sk, Kariera.sk
"""

try:
    # Try relative import first (when run as module)
    from .scraper_base import (
        BaseScraper, scrape_page, norm_text, extract_salary,
        detect_work_type, save_job_to_supabase, build_description,
        extract_benefits, filter_out_junk
    )
except ImportError:
    # Fallback to direct import (when run as script)
    from scraper_base import (
        BaseScraper, scrape_page, norm_text, extract_salary,
        detect_work_type, save_job_to_supabase, build_description,
        extract_benefits, filter_out_junk
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
                
                a_el = item.select_one('a[href*="/praca/"]')
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
                
                main_content = detail_soup.select_one('.details, .description, .job-description, .content, [itemprop="description"], .offer-text')
                
                if main_content:
                    # Try structured extraction with build_description
                    description = build_description(detail_soup, {
                        'paragraphs': ['.details p', '.description p', '.job-description p', '.details-desc p', '.offer-text p'],
                        'lists': ['.details ul', '.description ul', '.job-description ul', '.details-desc ul', '.details li', '.offer-text ul']
                    })
                    
                    if len(description) < 150:
                        # Fallback to raw text extraction (filtering out footer junk)
                        description = filter_out_junk(norm_text(main_content.get_text()))

                # Benefits
                benefits = extract_benefits(detail_soup, ['.benefits li', '.employment-benefits li', '.job-benefits li', '.details-desc li'])
                if not benefits or len(benefits) < 1:
                    benefit_marker = detail_soup.find(string=lambda x: x and ("Zamestnanecké výhody" in x or "Benefits" in x))
                    if benefit_marker:
                        curr = benefit_marker.parent
                        for _ in range(3):
                            if curr:
                                next_ul = curr.find_next(['ul', 'div'])
                                if next_ul and (next_ul.name == 'ul' or (next_ul.name == 'div' and 'details-desc' in next_ul.get('class', []))):
                                    lis = next_ul.find_all('li')
                                    if lis:
                                        benefits = [norm_text(li.get_text()) for li in lis if len(li.get_text()) > 3]
                                        break
                            if curr: curr = curr.parent
                
                if not benefits:
                    benefits = ["Benefity nespecifikovány"]

                # Salary
                salary_from, salary_to = None, None
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

                # Detect work type
                work_type = detect_work_type(title, description, location)
                
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
                    'salary_from': salary_from,
                    'salary_to': salary_to,
                    'salary_currency': 'EUR',
                    'country_code': 'sk'
                }
                
                if save_job_to_supabase(self.supabase, job_data):
                    jobs_saved += 1
                
                time.sleep(0.3)
                
            except Exception as e:
                print(f"       ❌ Chyba při zpracování nabídky: {e}")
                continue
        
        return jobs_saved
    
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
                    'salary_from': salary_from,
                    'salary_to': salary_to,
                    'salary_currency': 'EUR',
                    'country_code': 'sk'
                }
                
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
            'base_url': 'https://www.profesia.sk/praca/?page_num=1', # Start at first page
            'max_pages': 5
        },
        {
            'name': 'Kariera.sk',
            'base_url': 'https://kariera.zoznam.sk/pracovne-ponuky/za-1-den', # Use verified list page
            'max_pages': 5
        }
    ]
    
    return scraper.run(websites)


if __name__ == '__main__':
    run_slovakia_scraper()
