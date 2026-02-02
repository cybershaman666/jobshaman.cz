"""
JobShaman Scraper - Slovakia (SK)
Scrapes Slovak job portals: Profesia.sk, Kariera.sk
"""

try:
    # Try relative import first (when run as module)
    from .scraper_base import (
        BaseScraper, scrape_page, norm_text, extract_salary,
        detect_work_type, save_job_to_supabase, build_description,
        extract_benefits
    )
except ImportError:
    # Fallback to direct import (when run as script)
    from scraper_base import (
        BaseScraper, scrape_page, norm_text, extract_salary,
        detect_work_type, save_job_to_supabase, build_description,
        extract_benefits
    )
from urllib.parse import urljoin
import time
import re


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
        """Scrape Profesia.sk (largest Slovak job portal)"""
        jobs_saved = 0
        
        # Link extraction using verified pattern
        links = []
        # Profesia job links usually follow /praca/[company-slug]/[id]
        for a in soup.find_all('a', href=True):
            href = a['href']
            txt = a.get_text(strip=True)
            if '/praca/' in href and not any(x in href for x in ['/praca/zoznam-lokalit', '/praca/zahranicie', '?', 'page_num', 'sort_by']):
                # Filter out short texts (nav links)
                if len(txt) > 5:
                     links.append(urljoin('https://www.profesia.sk', href))
        
        links = list(set(links))
        
        for url in links:
            if self.is_duplicate(url):
                continue
                
            try:
                print(f"    📄 Stahuji detail: {url}")
                detail_soup = scrape_page(url)
                if not detail_soup:
                    print(f"       ❌ Detail nedostupný, přeskočeno")
                    continue
                
                # Title
                title = "Neznámá pozice"
                h1 = detail_soup.find("h1")
                if h1:
                    title = norm_text(h1.get_text())
                
                # Company
                company = "Neznámá společnost"
                company_el = detail_soup.select_one('.company-name, .employer-name') or detail_soup.select_one('a[href*="/praca/"] img')
                if company_el:
                    if company_el.name == 'img':
                        company = "Logo společnosti" # Fallback if we only find logo
                        if company_el.get('alt'): company = norm_text(company_el.get('alt'))
                    else:
                        company = norm_text(company_el.get_text())
                
                # Location
                location = "Slovensko"
                # Look for "Miesto práce" / "Place of work"
                loc_marker = detail_soup.find(string=lambda x: x and ("Miesto práce" in x or "Place of work" in x))
                if loc_marker:
                    # Usually text in sibling or parent
                    parent = loc_marker.parent
                    # Often the label is in a dt/strong and value in dd/span/text node next to it
                    text_content = parent.parent.get_text() # Get context
                    # Basic extraction strategy: split by label and take next part
                    if "Miesto práce" in text_content:
                        location = text_content.split("Miesto práce")[-1].split("\n")[0].strip()
                    elif "Place of work" in text_content:
                        location = text_content.split("Place of work")[-1].split("\n")[0].strip()
                    location = location.strip(": ")
                    location = location.replace('Zobraziť na mape', '').strip()
                
                # Description - Robust extraction
                description = "Popis nenalezen"
                
                # Strategy: Find heading "Informácie o pracovnom mieste" / "Náplň práce" / "Information about the position"
                headings = ["Informácie o pracovnom mieste", "Náplň práce", "Information about the position", "Job description"]
                main_content = None
                
                for h_text in headings:
                    marker = detail_soup.find(lambda tag: tag.name in ['h2', 'h3', 'h4', 'strong'] and h_text in tag.get_text())
                    if marker:
                        # Go up to finding a container (col, row, or just parent)
                        curr = marker.parent
                        for _ in range(3):
                            if curr.name in ['div', 'section']:
                                main_content = curr
                                break
                            curr = curr.parent
                        if main_content: break
                
                if not main_content:
                    # Fallback to older selectors
                    main_content = detail_soup.select_one('.description, .job-description, .content, [itemprop="description"]')

                if main_content:
                    parts = []
                    # Extract text carefully
                    for elem in main_content.find_all(['p', 'li', 'h2', 'h3', 'h4', 'div']):
                        # Skip if it contains only the marker or navigation
                        txt = norm_text(elem.get_text())
                        if not txt or any(x in txt for x in ["Poslať spoločnosti životopis", "Uložiť ponuku", "Reagovať"]):
                            continue
                        
                        # Heuristic: Avoid duplicating huge blocks if parent already captured (simplified by just taking leaf nodes roughly)
                        # Actually base implementation usually iterates children. Here we iterate all descendants.
                        # Better to just use get_text() with separators if structural parsing fails, but let's try structural
                        if elem.name == 'li':
                            parts.append(f"- {txt}")
                        elif elem.name in ['h2', 'h3', 'h4']:
                            parts.append(f"\n### {txt}")
                        elif elem.name == 'p':
                            parts.append(txt)
                            
                    if parts:
                        description = filter_out_junk("\n\n".join(parts))
                    else:
                        description = filter_out_junk(norm_text(main_content.get_text())) # Fallback to raw text

                # Benefits - Use base extractor
                benefits = extract_benefits(detail_soup)

                # Salary
                salary_from, salary_to = None, None
                sal_marker = detail_soup.find(string=lambda x: x and ("Mzdové podmienky" in x or "Wage" in x))
                if sal_marker:
                    sal_context = sal_marker.parent.parent.get_text()
                    salary_from, salary_to, _ = extract_salary(sal_context, currency='EUR')
                
                # Contract type
                contract_type = "Nespecifikováno"
                # Search for "Druh pracovného pomeru" / "Contract type"
                ctype_marker = detail_soup.find(string=lambda x: x and ("Druh pracovného pomeru" in x or "Contract type" in x))
                if ctype_marker:
                     # Very heuristic
                     ctx = ctype_marker.parent.parent.get_text()
                     if "plný" in ctx or "full" in ctx: contract_type = "Plný úvazek"
                     elif "skrátený" in ctx or "part" in ctx: contract_type = "Zkrácený úvazek"
                     elif "dohodu" in ctx or "freelance" in ctx: contract_type = "Na dohodu / Freelance"

                # Detect work type
                work_type = detect_work_type(title, description, location)
                
                # Build job data
                job_data = {
                    'title': title,
                    'url': url,
                    'company': company,
                    'location': location,
                    'description': description,
                    'benefits': benefits,
                    'contract_type': contract_type,
                    'work_type': work_type,
                    'salary_from': salary_from,
                    'salary_to': salary_to,
                }
                
                if save_job_to_supabase(job_data):
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
                loc_el = detail_soup.select_one('.job-location, [itemprop="jobLocation"]')
                if loc_el:
                    location = norm_text(loc_el.get_text())
                
                # Description
                description = "Popis nenalezen"
                desc_div = detail_soup.select_one(".description, .offer-text, [itemprop='description']")
                
                if desc_div:
                     description = build_description(detail_soup, {
                         'paragraphs': ['.description p', '.offer-text p', '[itemprop="description"] p'],
                         'lists': ['.description ul', '.offer-text ul', '[itemprop="description"] ul']
                     })
                else:
                    # Fallback
                    main = detail_soup.select_one("main, .content")
                    if main:
                        description = filter_out_junk(norm_text(main.get_text()))

                # Salary
                salary_from, salary_to = None, None
                sal_el = detail_soup.select_one('.salary-value, .wage')
                if sal_el:
                    salary_from, salary_to, _ = extract_salary(sal_el.get_text(), currency='EUR')

                job_data = {
                    'title': title,
                    'url': url,
                    'company': company,
                    'location': location,
                    'description': description,
                    'benefits': ["Benefity nespecifikovány"], 
                    'contract_type': detect_work_type(title + " " + description + " " + location),
                    'salary_from': salary_from,
                    'salary_to': salary_to,
                }
                
                if save_job_to_supabase(job_data):
                    jobs_saved += 1
                    
                time.sleep(0.3)

            except Exception as e:
                print(f"       ❌ Chyba: {e}")
                continue
        
        return jobs_saved


def run_slovakia_scraper():
    """Main function to run Slovakia scraper"""
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
