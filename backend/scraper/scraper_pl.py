"""
JobShaman Scraper - Poland (PL)
Scrapes Polish job portals: Pracuj.pl, NoFluffJobs, JustJoin.it
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


class PolandScraper(BaseScraper):
    """Scraper for Polish job portals"""
    
    def __init__(self, supabase=None):
        super().__init__('PL', supabase)
    
    def scrape_page_jobs(self, soup, site_name):
        """Route to appropriate site scraper"""
        if 'pracuj' in site_name.lower():
            return self.scrape_pracuj_pl(soup)
        elif 'nofluff' in site_name.lower():
            return self.scrape_nofluffjobs(soup)
        elif 'justjoin' in site_name.lower():
            return self.scrape_justjoin_it(soup)
        else:
            print(f"⚠️ Neznámý portál: {site_name}")
            return 0
    
    def scrape_pracuj_pl(self, soup):
        """Scrape Pracuj.pl (largest Polish job portal)"""
        jobs_saved = 0
        
        # Pracuj.pl uses specific card structure
        job_cards = soup.select('[data-test="section-offer"]')
        
        for card in job_cards:
            try:
                # Extract link
                link_el = card.select_one('a[data-test="link-offer"]')
                if not link_el:
                    continue
                
                title = norm_text(link_el.get_text())
                url = urljoin('https://www.pracuj.pl', link_el.get('href', ''))
                
                if not url or url == 'https://www.pracuj.pl':
                    continue
                
                print(f"    📄 Stahuji detail: {title}")
                
                # Fetch detail
                detail_soup = scrape_page(url)
                if not detail_soup:
                    continue
                
                # Company
                company = "Neznámá společnost"
                comp_el = detail_soup.select_one('[data-test="text-companyName"]')
                if comp_el:
                    company = norm_text(comp_el.get_text())
                
                # Location
                location = "Neznámá lokalita"
                loc_el = detail_soup.select_one('[data-test="text-region"]')
                if loc_el:
                    location = norm_text(loc_el.get_text())
                
                # Description
                description = build_description(
                    detail_soup,
                    {
                        'paragraphs': [
                            '[data-test="section-description"] p',
                            '.offer-description p'
                        ],
                        'lists': [
                            '[data-test="section-description"] ul',
                            '.offer-requirements ul'
                        ]
                    }
                )
                
                # Benefits
                benefits = extract_benefits(
                    detail_soup,
                    [
                        '[data-test="section-benefits"] li',
                        '.benefits-list li'
                    ]
                )
                
                # Salary
                salary_from, salary_to = None, None
                sal_el = detail_soup.select_one('[data-test="text-salary"]')
                if sal_el:
                    salary_text = sal_el.get_text()
                    salary_from, salary_to, _ = extract_salary(salary_text, currency='PLN')
                
                # Contract type
                contract_type = "Nespecifikováno"
                contract_el = detail_soup.select_one('[data-test="text-contractType"]')
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
    
    def scrape_nofluffjobs(self, soup):
        """Scrape NoFluffJobs.com (IT jobs in Poland)"""
        jobs_saved = 0
        
        # NoFluffJobs has a clean structure
        job_cards = soup.select('.posting-list-item, [data-cy="job-item"]')
        
        for card in job_cards:
            try:
                # Extract link
                link_el = card.select_one('a[href*="/job/"]')
                if not link_el:
                    continue
                
                title = norm_text(link_el.get_text())
                url = urljoin('https://nofluffjobs.com', link_el.get('href', ''))
                
                print(f"    📄 Stahuji detail: {title}")
                
                # Fetch detail
                detail_soup = scrape_page(url)
                if not detail_soup:
                    continue
                
                # Company
                company = "Neznámá společnost"
                comp_el = detail_soup.select_one('.company-name, h2.company')
                if comp_el:
                    company = norm_text(comp_el.get_text())
                
                # Location
                location = "Neznámá lokalita"
                loc_el = detail_soup.select_one('.location-name, .job-location')
                if loc_el:
                    location = norm_text(loc_el.get_text())
                
                # Description
                description = build_description(
                    detail_soup,
                    {
                        'paragraphs': [
                            '.job-description p',
                            '.posting-details p'
                        ],
                        'lists': [
                            '.job-description ul',
                            '.requirements ul',
                            '.tech-stack-list'
                        ]
                    }
                )
                
                # Benefits
                benefits = extract_benefits(
                    detail_soup,
                    [
                        '.benefits li',
                        '.perks li'
                    ]
                )
                
                # Salary (NoFluffJobs always shows salary ranges)
                salary_from, salary_to = None, None
                sal_el = detail_soup.select_one('.salary, .salary-range')
                if sal_el:
                    salary_text = sal_el.get_text()
                    salary_from, salary_to, _ = extract_salary(salary_text, currency='PLN')
                
                # Contract type
                contract_type = "Nespecifikováno"
                contract_el = detail_soup.select_one('.contract-type')
                if contract_el:
                    contract_type = norm_text(contract_el.get_text())
                
                # Work type (NoFluffJobs explicitly shows this)
                work_type = 'On-site'
                work_el = detail_soup.select_one('.work-mode')
                if work_el:
                    work_text = work_el.get_text().lower()
                    if 'remote' in work_text or 'zdalna' in work_text:
                        work_type = 'Remote'
                    elif 'hybrid' in work_text:
                        work_type = 'Hybrid'
                
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


def run_poland_scraper():
    """Main function to run Poland scraper"""
    scraper = PolandScraper()
    
    websites = [
        {
            'name': 'Pracuj.pl',
            'base_url': 'https://www.pracuj.pl/praca',
            'max_pages': 15
        },
        {
            'name': 'NoFluffJobs',
            'base_url': 'https://nofluffjobs.com/pl/jobs',
            'max_pages': 10
        },
        {
            'name': 'JustJoin.it',
            'base_url': 'https://justjoin.it/offers',
            'max_pages': 10
        }
    ]
    
    return scraper.run(websites)


if __name__ == '__main__':
    run_poland_scraper()
