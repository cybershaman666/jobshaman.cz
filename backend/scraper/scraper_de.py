"""
JobShaman Scraper - Germany + Austria (DE/AT)
Scrapes German/Austrian job portals: StepStone, Indeed.de, Karriere.at
"""

try:
    # Try relative import first (when run as module)
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
import json
from bs4 import BeautifulSoup


class GermanyScraper(BaseScraper):
    """Scraper for German and Austrian job portals"""
    
    def __init__(self, supabase=None):
        super().__init__('DE', supabase)  # DE covers both Germany and Austria
    
    def scrape_page_jobs(self, soup, site_name):
        """Route to appropriate site scraper"""
        site_lower = site_name.lower()
        if 'stellenanzeigen' in site_lower:
            return self.scrape_stellenanzeigen_de(soup)
        elif 'karriere' in site_lower:
            return self.scrape_karriere_at(soup)
        else:
            print(f"⚠️ Neznámý portál: {site_name}")
            return 0
    
    def scrape_stellenanzeigen_de(self, soup):
        """Scrape Stellenanzeigen.de (accessible DE alternative)"""
        jobs_saved = 0
        
        # Extract links using robust filtering
        links = []
        for a in soup.find_all('a', href=True):
            href = a['href']
            # Pattern: /job/ID or /stellenangebot/ID
            if any(x in href for x in ['/job/', '/stellenangebot/']) and len(a.get_text(strip=True)) > 10:
                links.append(urljoin('https://www.stellenanzeigen.de', href))
        
        links = list(set(links))
        
        for url in links:
            if self.is_duplicate(url):
                continue
                
            try:
                print(f"    📄 Stahuji detail: {url}")
                detail_soup = scrape_page(url)
                if not detail_soup:
                    continue
                
                # Defaults
                title = "Neznámá pozice"
                company = "Unbekanntes Unternehmen"
                location = "Deutschland"
                salary_from, salary_to = None, None
                contract_type = "Nicht spezifiziert"
                description = "Beschreibung nicht gefunden"
                
                # 1. JSON-LD Extraction (Primary Source)
                json_ld = None
                scripts = detail_soup.find_all('script', type='application/ld+json')
                for s in scripts:
                    try:
                        data = json.loads(s.get_text())
                        if isinstance(data, dict) and data.get('@type') == 'JobPosting':
                            json_ld = data
                            break
                        if isinstance(data, list):
                            for item in data:
                                if item.get('@type') == 'JobPosting':
                                    json_ld = item
                                    break
                    except:
                        continue
                        
                if json_ld:
                    if 'title' in json_ld: title = norm_text(json_ld['title'])
                    
                    if 'hiringOrganization' in json_ld:
                        org = json_ld['hiringOrganization']
                        if isinstance(org, dict) and 'name' in org:
                            company = norm_text(org['name'])
                        elif isinstance(org, str):
                            company = norm_text(org)
                            
                    if 'jobLocation' in json_ld:
                        loc = json_ld['jobLocation']
                        if isinstance(loc, list) and len(loc) > 0: loc = loc[0]
                        if isinstance(loc, dict) and 'address' in loc:
                            addr = loc['address']
                            if isinstance(addr, dict):
                                city = addr.get('addressLocality')
                                region = addr.get('addressRegion')
                                if city: location = city
                                elif region: location = region
                                
                    if 'baseSalary' in json_ld:
                        try:
                            bs = json_ld['baseSalary']
                            if isinstance(bs, dict):
                                val = bs.get('value', {})
                                if isinstance(val, dict):
                                    # Check for annual salary
                                    is_annual = val.get('unitText') == 'YEAR'
                                    
                                    if 'minValue' in val and val['minValue']: 
                                        salary_from = float(val['minValue'])
                                        if is_annual and salary_from > 5000: salary_from = int(salary_from / 12)
                                        else: salary_from = int(salary_from)
                                        
                                    if 'maxValue' in val and val['maxValue']: 
                                        salary_to = float(val['maxValue'])
                                        if is_annual and salary_to > 5000: salary_to = int(salary_to / 12)
                                        else: salary_to = int(salary_to)
                        except: pass
                        
                    if 'employmentType' in json_ld:
                         ct = json_ld['employmentType']
                         if isinstance(ct, str): contract_type = ct
                         elif isinstance(ct, list): contract_type = ", ".join(ct)
                    
                    if 'description' in json_ld and json_ld['description']:
                        desc_html = json_ld['description']
                        # Clean HTML to text
                        desc_soup = BeautifulSoup(desc_html, 'html.parser')
                        # Extract structured text
                        parts = []
                        for elem in desc_soup.find_all(['p', 'li', 'h2', 'h3', 'div']):
                            txt = norm_text(elem.get_text())
                            if len(txt) > 2:
                                if elem.name == 'li': parts.append(f"- {txt}")
                                elif elem.name in ['h2', 'h3']: parts.append(f"\n### {txt}")
                                else: parts.append(txt)
                        description = "\n\n".join(parts) if parts else norm_text(desc_soup.get_text())
                        description = filter_out_junk(description)

                # 2. Fallbacks for Metadata
                if title == "Neznámá pozice":
                    h1 = detail_soup.find("h1")
                    if h1: title = norm_text(h1.get_text())
                    
                if company == "Unbekanntes Unternehmen":
                    comp_el = detail_soup.select_one('[data-testid="header-company-name"], .company-name')
                    if comp_el: company = norm_text(comp_el.get_text())
                
                if location == "Deutschland":
                    loc_el = detail_soup.select_one('[data-testid="job-location"], .job-location')
                    if loc_el: location = norm_text(loc_el.get_text())

                # Description Extraction (Fallback)
                if description == "Beschreibung nicht gefunden":
                    # Stellenanzeigen uses dynamic classes (sc-...) so we search for content container
                    
                    # Heuristic: Find div with significant text 
                    main_content = None
                    candidates = []
                    # Limit search to likely containers to speed up
                    container_candidates = detail_soup.select('div[class*="content"], div[class*="job"], main, article, .sc-bdnylx') 
                    if not container_candidates:
                        container_candidates = detail_soup.body.find_all('div')
                        
                    for div in container_candidates:
                        txt = div.get_text(strip=True)
                        if len(txt) < 300: continue
                        links_in_div = len(div.find_all('a'))
                        if links_in_div > 10: continue # Likely nav/footer
                        
                        score = len(txt)
                        candidates.append((div, score))
                    
                    candidates.sort(key=lambda x: x[1], reverse=True)
                    if candidates:
                        main_content = candidates[0][0]
                        
                    if main_content:
                        parts = []
                        for elem in main_content.find_all(['p', 'li', 'h2', 'h3']):
                            txt = norm_text(elem.get_text())
                            if len(txt) > 2:
                                if elem.name == 'li': parts.append(f"- {txt}")
                                elif elem.name in ['h2', 'h3']: parts.append(f"\n### {txt}")
                                else: parts.append(txt)
                        
                        if parts:
                            description = filter_out_junk("\n\n".join(parts))
                        else:
                            description = filter_out_junk(norm_text(main_content.get_text()))

                # Salary Fallback (if not in JSON)
                if not salary_from:
                    # Look in text for "€" or "Euro"
                    sal_text = detail_soup.find(lambda tag: tag.name == "div" and ("€" in tag.get_text() or "Euro" in tag.get_text()) and len(tag.get_text()) < 50)
                    if sal_text:
                        salary_from, salary_to, _ = extract_salary(sal_text.get_text(), currency='EUR')
                
                # Sanity check for annual salary in fallback
                if salary_from and salary_from > 12000:
                    salary_from = int(salary_from / 12)
                if salary_to and salary_to > 12000:
                    salary_to = int(salary_to / 12)

                # Contract type Fallback
                if contract_type == "Nicht spezifiziert":
                    if "vollzeit" in description.lower(): contract_type = "Vollzeit"
                    elif "teilzeit" in description.lower(): contract_type = "Teilzeit"
                
                # Work type
                work_type = detect_work_type(title, description, location)
                
                # Benefits
                benefits = self._extract_benefits_from_text(description)
                
                # Explicit DE Country Code
                country_code = 'de'

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
                    'country_code': country_code,
                    'salary_currency': 'EUR'
                }
                
                if is_low_quality(job_data):
                    print(f"       ⚠️ Nízká kvalita, přeskakuji.")
                    continue

                if save_job_to_supabase(self.supabase, job_data):
                    jobs_saved += 1
                
                time.sleep(0.5)

            except Exception as e:
                print(f"       ❌ Chyba detailu {url}: {e}")
                continue
        
        return jobs_saved
    
    def scrape_karriere_at(self, soup):
        """Scrape Karriere.at (Austrian job portal)"""
        jobs_saved = 0
        
        # Link selector from inspection: m-jobsListItem__titleLink
        job_links = soup.select('a.m-jobsListItem__titleLink, a.job-link')

        # Fallback: collect links that look like job detail pages
        if not job_links:
            job_links = []
            for a in soup.find_all('a', href=True):
                href = a['href']
                if '/jobs/' in href and 'karriere.at' in urljoin('https://www.karriere.at', href):
                    # Skip listing/search pages
                    if '/jobs?' in href or href.endswith('/jobs'):
                        continue
                    job_links.append(a)
        
        for link_el in job_links:
            try:
                title = norm_text(link_el.get_text())
                url = urljoin('https://www.karriere.at', link_el.get('href', ''))
                
                if not url or 'karriere.at' not in url:
                    continue
                
                print(f"    📄 Stahuji detail: {title}")
                
                # Fetch detail
                detail_soup = scrape_page(url)
                if not detail_soup:
                    continue
                
                # Defaults
                company = "Unbekanntes Unternehmen"
                location = "Österreich"
                
                # 1. Try JSON-LD first (Highest Accuracy)
                json_ld = None
                scripts = detail_soup.find_all('script', type='application/ld+json')
                for s in scripts:
                    try:
                        data = json.loads(s.get_text())
                        # Check if it's JobPosting
                        if data.get('@type') == 'JobPosting':
                            json_ld = data
                            break
                        # Sometimes it's a list
                        if isinstance(data, list):
                            for item in data:
                                if item.get('@type') == 'JobPosting':
                                    json_ld = item
                                    break
                    except:
                        continue
                
                if json_ld:
                    # Extract from JSON-LD
                    if 'title' in json_ld: title = norm_text(json_ld['title'])
                    
                    if 'hiringOrganization' in json_ld:
                        org = json_ld['hiringOrganization']
                        if isinstance(org, dict) and 'name' in org:
                            company = norm_text(org['name'])
                        elif isinstance(org, str):
                            company = norm_text(org)
                            
                    if 'jobLocation' in json_ld:
                        loc = json_ld['jobLocation']
                        # Handle list of locations
                        if isinstance(loc, list) and len(loc) > 0: loc = loc[0]
                        
                        if isinstance(loc, dict) and 'address' in loc:
                            addr = loc['address']
                            if isinstance(addr, dict):
                                city = addr.get('addressLocality')
                                region = addr.get('addressRegion')
                                if city: location = city
                                elif region: location = region
                
                # 2. Fallback to selectors if not found in JSON
                if company == "Unbekanntes Unternehmen":
                    comp_el = detail_soup.select_one('.m-jobContent__companyName, .m-companyHeader__name, .company-name')
                    if comp_el: company = norm_text(comp_el.get_text())
                
                if location == "Österreich":
                    loc_el = detail_soup.select_one('.m-jobContent__jobLocation, .m-jobHeader__location')
                    if loc_el: location = norm_text(loc_el.get_text())
                
                # Description - Enhanced extraction with multiple fallbacks
                description = "Beschreibung nicht gefunden"
                
                # Try JSON-LD description first
                if json_ld and 'description' in json_ld and json_ld['description']:
                    try:
                        desc_html = json_ld['description']
                        desc_soup = BeautifulSoup(desc_html, 'html.parser')
                        parts = []
                        for elem in desc_soup.find_all(['p', 'li', 'h2', 'h3']):
                            txt = norm_text(elem.get_text())
                            if len(txt) > 2:
                                if elem.name == 'li': parts.append(f"- {txt}")
                                elif elem.name in ['h2', 'h3']: parts.append(f"\n### {txt}")
                                else: parts.append(txt)
                        if parts:
                            description = filter_out_junk("\n\n".join(parts))
                    except:
                        pass
                
                # Fallback to CSS selectors if not in JSON-LD
                if description == "Beschreibung nicht gefunden" or len(description) < 100:
                    description = build_description(detail_soup, {
                        'paragraphs': ['.m-jobContent__jobDetail p', '.content p', '.job-description p', 'main p', 'article p'],
                        'lists': ['.m-jobContent__jobDetail ul', '.content ul', '.job-description ul', 'main ul', 'article ul']
                    })
                
                # Last resort: find largest text container
                if description == "Beschreibung nicht gefunden" or len(description) < 100:
                    candidates = []
                    for div in detail_soup.find_all(['div', 'main', 'article']):
                        txt = div.get_text(strip=True)
                        if 150 < len(txt) < 10000:  # Reasonable size
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
                        else:
                            description = filter_out_junk(norm_text(best_div.get_text()))
                
                # Benefits
                benefits = extract_benefits(detail_soup, ['.m-benefits__list li', '.benefits-list li', '.benefits li', 'ul li'])
                if not benefits:
                    benefits = ["Nicht spezifiziert"]
                
                # Salary
                salary_from, salary_to = None, None
                
                # JSON-LD might have salary
                if json_ld and 'baseSalary' in json_ld:
                    try:
                        bs = json_ld['baseSalary']
                        val = bs.get('value', {})
                        if 'minValue' in val: salary_from = int(val['minValue'])
                        if 'maxValue' in val: salary_to = int(val['maxValue'])
                    except: pass

                if not salary_from:
                    sal_el = detail_soup.select_one('.m-salary__amount, .m-salary')
                    if sal_el:
                        salary_from, salary_to, _ = extract_salary(sal_el.get_text(), currency='EUR')
                
                # Contract type
                contract_type = "Nicht spezifiziert"
                if json_ld and 'employmentType' in json_ld:
                     ct = json_ld['employmentType']
                     if isinstance(ct, str): contract_type = ct
                     elif isinstance(ct, list): contract_type = ", ".join(ct)
                elif "Vollzeit" in detail_soup.get_text(): contract_type = "Vollzeit"
                elif "Teilzeit" in detail_soup.get_text(): contract_type = "Teilzeit"
                
                # Work type
                work_type = detect_work_type(title, description, location)
                
                # Explicitly set country code for Austria
                country_code = 'at'
                
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
                    'country_code': country_code, # Force AT
                    'salary_currency': 'EUR'
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
    
    def _extract_benefits_from_text(self, text):
        """Extract benefits from description text (German keywords)"""
        benefits = []
        keywords = {
            'Home Office': r'home\s*office|remote|fernarbeit',
            'Flexible Arbeitszeiten': r'flexible?\s*arbeitszeiten|gleitzeit',
            'Weiterbildung': r'weiterbildung|schulung|training',
            '30 Tage Urlaub': r'30\s*tage\s*urlaub|6\s*wochen',
            'Betriebliche Altersvorsorge': r'betriebliche\s*altersvorsorge|pension',
            'Firmenfahrzeug': r'firmenfahrzeug|dienstwagen|firmenwagen',
            'Gym-Mitgliedschaft': r'fitnessstudio|gym|sportangebot',
            'Mitarbeiterrabatte': r'mitarbeiterrabatt|corporate\s*benefits',
        }
        
        text_lower = text.lower()
        for benefit, pattern in keywords.items():
            if re.search(pattern, text_lower):
                benefits.append(benefit)
        
        return benefits


def run_germany_scraper():
    """Main function to run Germany/Austria scraper"""
    scraper = GermanyScraper()
    
    websites = [
        {
            'name': 'Stellenanzeigen.de',
            # Full market (no keyword filter)
            'base_url': 'https://www.stellenanzeigen.de/suche/?q=',
            'max_pages': 50
        },
        {
            'name': 'Karriere.at',
            # Full market listing
            'base_url': 'https://www.karriere.at/jobs?page={page}',
            'max_pages': 50
        }
    ]
    
    return scraper.run(websites)


if __name__ == '__main__':
    run_germany_scraper()
