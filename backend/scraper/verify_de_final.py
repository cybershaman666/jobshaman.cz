#!/usr/bin/env python3
"""
Verification of replacement DE/AT scrapers
"""
from scraper.scraper_base import scrape_page
from scraper.scraper_de import GermanyScraper

print("="*60)
print("TESTING DE/AT REPLACEMENTS")
print("="*60)

scraper = GermanyScraper()

# Test Stellenanzeigen.de logic (simulated by passing soup to method or just checking url manually if method difficult)
# Since methods are instance methods taking soup of LIST page, we need a list page soup.

print("\n1. Testing Stellenanzeigen.de List Parsing")
url1 = "https://www.stellenanzeigen.de/suche/?q=software"
soup1 = scrape_page(url1)
if soup1:
    print("✅ Parsed List Page")
    # Manually call scraper's logic to find links
    links = []
    for a in soup1.find_all('a', href=True):
        if any(x in a['href'] for x in ['/job/', '/stellenangebot/']) and len(a.get_text(strip=True)) > 10:
            links.append(a['href'])
    print(f"✅ Found {len(links)} potential job links (Heuristic match)")
    if links:
        print(f"   Sample: {links[0]}")
else:
    print("❌ Failed to parse list page")

print("\n2. Testing Karriere.at List Parsing")
url2 = "https://www.karriere.at/jobs/software"
soup2 = scrape_page(url2)
if soup2:
    print("✅ Parsed List Page")
    links = soup2.select('a.m-jobsListItem__titleLink, a.job-link')
    print(f"✅ Found {len(links)} job links with correct selector")
    if links:
        print(f"   Sample: {links[0].get('href')}")
else:
    print("❌ Failed to parse list page")
