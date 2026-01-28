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
        
        # Find job listings
        # Profesia uses <a> tags with specific classes
        job_links = soup.select('a.title')  # Adjust selector based on actual HTML
        
        for link in job_links:
            try:
                # Extract basic info
                title = norm_text(link.get_text())
                url = urljoin('https://www.profesia.sk', link.get('href', ''))
                
                if not url or url == 'https://www.profesia.sk':
                    continue
                
                print(f"    📄 Stahuji detail: {title}")
                
                # Fetch detail page
                detail_soup = scrape_page(url)
                if not detail_soup:
                    print(f"       ❌ Detail nedostupný, přeskočeno")
                    continue
                
                # Extract company
                company = "Neznámá společnost"
                company_el = detail_soup.select_one('.company-name, .employer-name')
                if company_el:
                    company = norm_text(company_el.get_text())
                
                # Extract location
                location = "Neznámá lokalita"
                loc_el = detail_soup.select_one('.location, .job-location')
                if loc_el:
                    location = norm_text(loc_el.get_text())
                    # Remove "Zobrazit na mape" etc
                    location = location.replace('Zobraziť na mape', '').strip()
                
                # Extract description
                description = build_description(
                    detail_soup,
                    {
                        'paragraphs': [
                            '.description p',
                            '.job-description p',
                            '.content p'
                        ],
                        'lists': [
                            '.description ul',
                            '.description ol',
                            '.job-description ul'
                        ]
                    }
                )
                
                # Extract benefits
                benefits = extract_benefits(
                    detail_soup,
                    [
                        '.benefits li',
                        '.benefit-item',
                        lambda s: [norm_text(b.get_text()) 
                                   for b in s.select('.benefit-name')]
                    ]
                )
                
                # Extract salary
                salary_from = None
                salary_to = None
                salary_el = detail_soup.select_one('.salary, .wage')
                if salary_el:
                    salary_text = salary_el.get_text()
                    salary_from, salary_to, _ = extract_salary(salary_text, currency='EUR')
                
                # Extract contract type
                contract_type = "Nespecifikováno"
                contract_el = detail_soup.select_one('.contract-type, .employment-type')
                if contract_el:
                    contract_type = norm_text(contract_el.get_text())
                
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
                
                # Save to database
                if save_job_to_supabase(self.supabase, job_data):
                    jobs_saved += 1
                
                # Rate limiting
                time.sleep(0.3)
                
            except Exception as e:
                print(f"       ❌ Chyba při zpracování nabídky: {e}")
                continue
        
        return jobs_saved
    
    def scrape_kariera_sk(self, soup):
        """Scrape Kariera.sk"""
        jobs_saved = 0
        
        # Similar structure to Profesia
        job_cards = soup.select('.job-card, .offer-item')
        
        for card in job_cards:
            try:
                # Extract link
                link_el = card.select_one('a.job-title, a.title')
                if not link_el:
                    continue
                
                title = norm_text(link_el.get_text())
                url = urljoin('https://www.kariera.sk', link_el.get('href', ''))
                
                if not url or url == 'https://www.kariera.sk':
                    continue
                
                print(f"    📄 Stahuji detail: {title}")
                
                # Fetch detail
                detail_soup = scrape_page(url)
                if not detail_soup:
                    continue
                
                # Company
                company = "Neznámá společnost"
                comp_el = detail_soup.select_one('.company, .employer')
                if comp_el:
                    company = norm_text(comp_el.get_text())
                
                # Location
                location = "Neznámá lokalita"
                loc_el = detail_soup.select_one('.location')
                if loc_el:
                    location = norm_text(loc_el.get_text())
                
                # Description
                description = build_description(
                    detail_soup,
                    {
                        'paragraphs': ['.job-content p', '.description p'],
                        'lists': ['.job-content ul', '.requirements ul']
                    }
                )
                
                # Benefits
                benefits = extract_benefits(
                    detail_soup,
                    ['.benefits li', '.benefit']
                )
                
                # Salary
                salary_from, salary_to = None, None
                sal_el = detail_soup.select_one('.salary')
                if sal_el:
                    salary_from, salary_to, _ = extract_salary(
                        sal_el.get_text(), currency='EUR'
                    )
                
                # Contract
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


def run_slovakia_scraper():
    """Main function to run Slovakia scraper"""
    scraper = SlovakiaScraper()
    
    websites = [
        {
            'name': 'Profesia.sk',
            'base_url': 'https://www.profesia.sk/praca',
            'max_pages': 15
        },
        {
            'name': 'Kariera.sk',
            'base_url': 'https://www.kariera.sk/ponuky',
            'max_pages': 10
        }
    ]
    
    return scraper.run(websites)


if __name__ == '__main__':
    run_slovakia_scraper()
