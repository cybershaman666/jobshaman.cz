#!/usr/bin/env python3
"""
Final verification of fixed scrapers (PL, SK)
"""
import sys
sys.path.insert(0, '/home/misha/Stažené/jobshaman/backend')
from scraper.scraper_pl import PolandScraper
from scraper.scraper_sk import SlovakiaScraper
from scraper.scraper_base import scrape_page

def verify_scraper(scraper_name, valid_url, scraper_method):
    print(f"\nEvaluating {scraper_name}...")
    print(f"URL: {valid_url}")
    
    try:
        soup = scrape_page(valid_url)
        if not soup:
            print("❌ Failed to fetch page")
            return
            
        # Mock scraper instance context if needed (not needed for simple method call if I extracted methods, 
        # but here I'm calling the method on the instance passing the soup)
        
        # We need to effectively run the scraper logic on this soup.
        # Since the methods in the classes iterate over lists of links usually, 
        # I should just check if the extraction logic works.
        # But the extraction logic is embedded in the `scrape_X` methods which do the iteration.
        
        # Checking if I can call a specific parsing function? 
        # No, the code is monolithic in the methods.
        # I will manually run the extraction logic I wrote using the soup to verify it works.
        pass 
         
    except Exception as e:
        print(f"❌ Error: {e}")

# Actually, better to just run the scraper class on a mock list of URLs?
# Or just run the scraper with a mock website config that points to a specific URL?
# But BaseScraper.run() loops over pages.

# Let's just create a quick test that assumes the logic I wrote.
# I will copy-paste the critical EXTRACTION logic here and test it against the soup 
# to see if it finds data. 

# TEST PRACUJ.PL
print("\n" + "="*60)
print("TESTING PRACUJ.PL EXTRACTION")
url_pl = "https://www.pracuj.pl/praca/zastepca-kierownika-sklepu-m-k-nowy-konik-pow-minski-terespolska-4a,oferta,1004604403"
soup_pl = scrape_page(url_pl)

if soup_pl:
    # Test selectors I put in scraper_pl.py
    title = soup_pl.select_one('[data-test="text-positionName"]')
    print(f"Title found: {title.get_text() if title else '❌'}")
    
    company = soup_pl.select_one('[data-test="text-employerName"], [data-test="text-companyName"]')
    print(f"Company found: {company.get_text() if company else '❌'}")

    desc_sections = soup_pl.select('[data-test="section-responsibilities"], [data-test="section-requirements"], [data-test="section-offered"], [data-test="block-description"]')
    print(f"Description sections found: {len(desc_sections)}")

# TEST PROFESIA.SK
print("\n" + "="*60)
print("TESTING PROFESIA.SK EXTRACTION")
url_sk = "https://www.profesia.sk/praca/netcore-j-s-a/O5218251"
soup_sk = scrape_page(url_sk)

if soup_sk:
    # Test selectors I put in scraper_sk.py
    headings = ["Informácie o pracovnom mieste", "Náplň práce", "Information about the position", "Job description"]
    found_marker = False
    for h in headings:
        marker = soup_sk.find(lambda tag: tag.name in ['h2', 'h3', 'h4', 'strong'] and h in tag.get_text())
        if marker:
            print(f"✅ Found description marker: '{h}'")
            found_marker = True
            break
    if not found_marker:
        print("❌ Description marker not found")

    loc_marker = soup_sk.find(string=lambda x: x and ("Miesto práce" in x or "Place of work" in x))
    print(f"Location marker found: {'✅' if loc_marker else '❌'}")
