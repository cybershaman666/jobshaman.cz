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
import json
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
        """Scrape Pracuj.pl (via __NEXT_DATA__)"""
        jobs_saved = 0
        
        next_data = soup.select_one('#__NEXT_DATA__')
        if not next_data:
            print("    ⚠️ Pracuj.pl: __NEXT_DATA__ not found")
            return 0
            
        try:
            data = json.loads(next_data.get_text())
            props = data.get('props', {}).get('pageProps', {})
            queries = props.get('dehydratedState', {}).get('queries', [])
            
            offers = []
            
            # Find the query that contains job offers
            for q in queries:
                # Query key for offers usually contains 'jobOffers'
                # e.g. ['jobOffers', {'pn': 1, ...}, ...]
                query_key = q.get('queryKey', [])
                if isinstance(query_key, list) and len(query_key) > 0 and query_key[0] == 'jobOffers':
                    state_data = q.get('state', {}).get('data', {})
                    if 'groupedOffers' in state_data:
                        offers = state_data['groupedOffers']
                        break
            
            print(f"    ℹ️ Nalezeno {len(offers)} nabídek v JSON datech.")
            
            for offer in offers:
                try:
                    # Pracuj.pl groups offers, sometimes valid offer is inside a group
                    # But usually 'groupedOffers' is a list of offers directly
                    
                    # Extract basic info
                    title = offer.get('jobTitle')
                    company = offer.get('companyName')
                    
                    # URL construction
                    offer_url = offer.get('offers', [{}])[0].get('offerUrl')
                    if not offer_url:
                        # Fallback
                        slug = offer.get('companyProfileUrl')
                        if slug:
                            offer_url = f"https://www.pracuj.pl{slug}"
                    
                    if not offer_url or not title:
                        continue
                        
                    # Normalize URL
                    if offer_url.startswith('/'):
                        offer_url = f"https://www.pracuj.pl{offer_url}"
                        
                    if self.is_duplicate(offer_url):
                        continue
                        
                    print(f"    📄 Zpracovávám: {title}")
                    
                    # Extract details from JSON object directly (no need to fetch detail page mostly!)
                    # But description is usually NOT in the list view JSON.
                    # We might need to fetch detail.
                    
                    # Location
                    location = offer.get('displayWorkplace', 'Polska')
                    
                    # Salary
                    salary_txt = offer.get('salaryText', '')
                    salary_from, salary_to, _ = extract_salary(salary_txt, currency='PLN')
                    
                    # Fetch Detail Page for Description
                    detail_soup = scrape_page(offer_url)
                    description = "Popis není dostupný"
                    benefits = []
                    contract_type = "Nespecifikováno"
                    work_type = detect_work_type(title, "", location) # initial check
                    
                    if detail_soup:
                        # Parse Detail Page
                        # Pracuj detail also has __NEXT_DATA__ usually, but let's use selectors for fallback or JSON if consistent
                        
                        # Try JSON-LD on detail page first
                        json_ld = None
                        scripts = detail_soup.find_all('script', type='application/ld+json')
                        for s in scripts:
                            try:
                                ld = json.loads(s.get_text())
                                if ld.get('@type') == 'JobPosting':
                                    json_ld = ld
                                    break
                            except: pass
                            
                        if json_ld:
                            if 'description' in json_ld:
                                desc_html = json_ld['description']
                                desc_soup = BeautifulSoup(desc_html, 'html.parser')
                                description = filter_out_junk(desc_soup.get_text('\n\n'))
                            
                            if 'employmentType' in json_ld:
                                contract_type = str(json_ld['employmentType'])
                                
                        else:
                             # Fallback HTML extraction
                             description = build_description(
                                detail_soup,
                                {
                                    'paragraphs': ['[data-test="section-responsibilities"] p', '[data-test="section-requirements"] p', '[data-test="text-benefit"]'],
                                    'lists': ['[data-test="section-responsibilities"] ul', '[data-test="section-requirements"] ul']
                                }
                            )
                            
                        # Benefits from detail
                        benefits = extract_benefits(detail_soup, ['[data-test="section-benefits"] li', '.benefits-list li'])
                        
                        # Refine work type
                        work_type = detect_work_type(title, description, location)

                    job_data = {
                        'title': title,
                        'url': offer_url,
                        'company': company,
                        'location': location,
                        'description': description,
                        'benefits': benefits,
                        'contract_type': contract_type,
                        'work_type': work_type,
                        'salary_from': salary_from,
                        'salary_to': salary_to,
                        'currency': 'PLN',
                        'country_code': 'pl'
                    }
                    
                    if save_job_to_supabase(self.supabase, job_data):
                        jobs_saved += 1
                        
                    time.sleep(0.2)
                    
                except Exception as e:
                    print(f"       ❌ Chyba u nabídky: {e}")
                    continue

        except Exception as e:
            print(f"    ❌ Chyba při parsování Pracuj.pl JSON: {e}")
            
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
                    
                    if detail_soup:
                         description = build_description(
                            detail_soup,
                            {
                                'paragraphs': ['.job-description p', 'nfj-posting-description p'],
                                'lists': ['.job-description ul', 'nfj-posting-requirements ul']
                            }
                        )
                         benefits = extract_benefits(detail_soup, ['nfj-posting-benefits li', '.benefits-list li'])
                    
                    work_type = 'On-site'
                    if job.get('fullyRemote'): work_type = 'Remote'
                    
                    job_data = {
                        'title': title,
                        'url': url,
                        'company': company,
                        'location': location,
                        'description': description,
                        'benefits': benefits,
                        'contract_type': 'B2B/Contract', # NoFluff default often
                        'work_type': work_type,
                        'salary_from': salary_from,
                        'salary_to': salary_to,
                        'currency': 'PLN',
                        'country_code': 'pl'
                    }
                    
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
        # {
        #     'name': 'JustJoin.it',
        #     'base_url': 'https://justjoin.it/offers',
        #     'max_pages': 10
        # }
    ]
    
    return scraper.run(websites)


if __name__ == '__main__':
    run_poland_scraper()
