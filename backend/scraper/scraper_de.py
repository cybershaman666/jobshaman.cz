"""
JobShaman Scraper - Germany + Austria (DE/AT)
Scrapes German/Austrian job portals: StepStone, Indeed.de, Karriere.at
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


class GermanyScraper(BaseScraper):
    """Scraper for German and Austrian job portals"""
    
    def __init__(self, supabase=None):
        super().__init__('DE', supabase)  # DE covers both Germany and Austria
    
    def scrape_page_jobs(self, soup, site_name):
        """Route to appropriate site scraper"""
        if 'stepstone' in site_name.lower():
            return self.scrape_stepstone(soup)
        elif 'indeed' in site_name.lower():
            return self.scrape_indeed_de(soup)
        elif 'karriere' in site_name.lower():
            return self.scrape_karriere_at(soup)
        else:
            print(f"⚠️ Neznámý portál: {site_name}")
            return 0
    
    def scrape_stepstone(self, soup):
        """Scrape StepStone.de (largest German job portal)"""
        jobs_saved = 0
        
        # StepStone uses article tags for job cards
        job_cards = soup.select('article[data-at="job-item"]')
        
        for card in job_cards:
            try:
                # Extract link
                link_el = card.select_one('a[data-at="job-item-title"]')
                if not link_el:
                    continue
                
                title = norm_text(link_el.get_text())
                url = urljoin('https://www.stepstone.de', link_el.get('href', ''))
                
                if not url or 'stepstone.de' not in url:
                    continue
                
                print(f"    📄 Stahuji detail: {title}")
                
                # Fetch detail
                detail_soup = scrape_page(url)
                if not detail_soup:
                    continue
                
                # Company
                company = "Unbekanntes Unternehmen"
                comp_el = detail_soup.select_one('[data-at="header-company-name"]')
                if comp_el:
                    company = norm_text(comp_el.get_text())
                
                # Location
                location = "Unbekannter Standort"
                loc_el = detail_soup.select_one('[data-at="job-location"]')
                if loc_el:
                    location = norm_text(loc_el.get_text())
                
                # Description
                description = build_description(
                    detail_soup,
                    {
                        'paragraphs': [
                            '[data-at="jobad-content"] p',
                            '.jobad-content p'
                        ],
                        'lists': [
                            '[data-at="jobad-content"] ul',
                            '.jobad-content ul'
                        ]
                    }
                )
                
                # Benefits
                benefits = extract_benefits(
                    detail_soup,
                    [
                        '[data-at="benefits"] li',
                        '.benefits-list li'
                    ]
                )
                
                # Salary
                salary_from, salary_to = None, None
                sal_el = detail_soup.select_one('[data-at="salary"]')
                if sal_el:
                    salary_text = sal_el.get_text()
                    salary_from, salary_to, _ = extract_salary(salary_text, currency='EUR')
                
                # Contract type
                contract_type = "Nicht spezifiziert"
                contract_el = detail_soup.select_one('[data-at="employment-type"]')
                if contract_el:
                    contract_type = norm_text(contract_el.get_text())
                
                # Work type
                work_type = detect_work_type(title, description, location)
                
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
                
                if save_job_to_supabase(self.supabase, job_data):
                    jobs_saved += 1
                
                time.sleep(0.5)  # StepStone might be stricter on rate limiting
                
            except Exception as e:
                print(f"       ❌ Chyba: {e}")
                continue
        
        return jobs_saved
    
    def scrape_indeed_de(self, soup):
        """Scrape Indeed.de"""
        jobs_saved = 0
        
        # Indeed uses specific div structure
        job_cards = soup.select('.job_seen_beacon, .resultContent')
        
        for card in job_cards:
            try:
                # Extract link
                link_el = card.select_one('a[data-jk], h2 a')
                if not link_el:
                    continue
                
                title_el = link_el.select_one('.jobTitle, span[title]')
                title = norm_text(title_el.get_text()) if title_el else norm_text(link_el.get_text())
                
                url = urljoin('https://de.indeed.com', link_el.get('href', ''))
                
                if not url or 'indeed.com' not in url:
                    continue
                
                print(f"    📄 Stahuji detail: {title}")
                
                # Fetch detail
                detail_soup = scrape_page(url)
                if not detail_soup:
                    continue
                
                # Company
                company = "Unbekanntes Unternehmen"
                comp_el = detail_soup.select_one('[data-company-name="true"], .companyName')
                if comp_el:
                    company = norm_text(comp_el.get_text())
                
                # Location
                location = "Unbekannter Standort"
                loc_el = detail_soup.select_one('[data-testid="job-location"], .location')
                if loc_el:
                    location = norm_text(loc_el.get_text())
                
                # Description
                description = build_description(
                    detail_soup,
                    {
                        'paragraphs': [
                            '#jobDescriptionText p',
                            '.jobsearch-jobDescriptionText p'
                        ],
                        'lists': [
                            '#jobDescriptionText ul',
                            '.jobsearch-jobDescriptionText ul'
                        ]
                    }
                )
                
                # Benefits (Indeed sometimes has these in description)
                benefits = extract_benefits(
                    detail_soup,
                    [
                        '.benefit-item',
                        lambda s: self._extract_benefits_from_text(description)
                    ]
                )
                
                # Salary
                salary_from, salary_to = None, None
                sal_el = detail_soup.select_one('.salary-snippet, [data-testid="salary"]')
                if sal_el:
                    salary_text = sal_el.get_text()
                    salary_from, salary_to, _ = extract_salary(salary_text, currency='EUR')
                
                # Contract type
                contract_type = "Nicht spezifiziert"
                
                # Work type
                work_type = detect_work_type(title, description, location)
                
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
                
                if save_job_to_supabase(self.supabase, job_data):
                    jobs_saved += 1
                
                time.sleep(0.4)
                
            except Exception as e:
                print(f"       ❌ Chyba: {e}")
                continue
        
        return jobs_saved
    
    def scrape_karriere_at(self, soup):
        """Scrape Karriere.at (Austrian job portal)"""
        jobs_saved = 0
        
        # Karriere.at structure
        job_cards = soup.select('.m-jobsListItem, .job-item')
        
        for card in job_cards:
            try:
                # Extract link
                link_el = card.select_one('a.m-jobsListItem__dataLink, a.job-link')
                if not link_el:
                    continue
                
                title = norm_text(link_el.get_text())
                url = urljoin('https://www.karriere.at', link_el.get('href', ''))
                
                if not url or 'karriere.at' not in url:
                    continue
                
                print(f"    📄 Stahuji detail: {title}")
                
                # Fetch detail
                detail_soup = scrape_page(url)
                if not detail_soup:
                    continue
                
                # Company
                company = "Unbekanntes Unternehmen"
                comp_el = detail_soup.select_one('.m-companyHeader__name, .company-name')
                if comp_el:
                    company = norm_text(comp_el.get_text())
                
                # Location
                location = "Unbekannter Standort"
                loc_el = detail_soup.select_one('.m-jobHeader__location, .location')
                if loc_el:
                    location = norm_text(loc_el.get_text())
                
                # Description
                description = build_description(
                    detail_soup,
                    {
                        'paragraphs': [
                            '.m-jobContent p',
                            '.job-description p'
                        ],
                        'lists': [
                            '.m-jobContent ul',
                            '.requirements ul'
                        ]
                    }
                )
                
                # Benefits
                benefits = extract_benefits(
                    detail_soup,
                    [
                        '.m-benefits li',
                        '.benefits-list li'
                    ]
                )
                
                # Salary
                salary_from, salary_to = None, None
                sal_el = detail_soup.select_one('.m-salary, .salary-info')
                if sal_el:
                    salary_text = sal_el.get_text()
                    salary_from, salary_to, _ = extract_salary(salary_text, currency='EUR')
                
                # Contract type
                contract_type = "Nicht spezifiziert"
                contract_el = detail_soup.select_one('.employment-type')
                if contract_el:
                    contract_type = norm_text(contract_el.get_text())
                
                # Work type
                work_type = detect_work_type(title, description, location)
                
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
            'name': 'StepStone.de',
            'base_url': 'https://www.stepstone.de/stellenangebote',
            'max_pages': 15
        },
        {
            'name': 'Indeed.de',
            'base_url': 'https://de.indeed.com/jobs',
            'max_pages': 15
        },
        {
            'name': 'Karriere.at',
            'base_url': 'https://www.karriere.at/jobs',
            'max_pages': 10
        }
    ]
    
    return scraper.run(websites)


if __name__ == '__main__':
    run_germany_scraper()
