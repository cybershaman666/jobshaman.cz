#!/usr/bin/env python3
"""
Script to find one valid job detail URL for each target website
by scraping their listing pages.
"""
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import sys

# Define sites and their listing pages + link selectors
SITES = [
    # Poland
    {
        "name": "Pracuj.pl",
        "url": "https://www.pracuj.pl/praca",
        "link_selector": "a[data-test='link-offer']" # From scraper_pl.py
    },
    {
        "name": "NoFluffJobs",
        "url": "https://nofluffjobs.com/pl/jobs",
        "link_selector": "a[href*='/job/']" # From scraper_pl.py
    },
    {
        "name": "JustJoin.it",
        "url": "https://justjoin.it/offers",
        "link_selector": "a.offer_list_offer_link" # Hypothethical, scraper_pl says a[href] inside cards
    },
    
    # Germany/Austria
    {
        "name": "StepStone.de",
        "url": "https://www.stepstone.de/stellenangebote",
        "link_selector": "a[data-at='job-item-title']" # From scraper_de.py
    },
    {
        "name": "Indeed.de",
        "url": "https://de.indeed.com/jobs?q=developer",
        "link_selector": "a.jcs-JobTitle" # Common indeed selector, scraper_de says a[data-jk]
    },
    {
        "name": "Karriere.at",
        "url": "https://www.karriere.at/jobs",
        "link_selector": "a.m-jobsListItem__dataLink" # From scraper_de.py
    },

    # Slovakia
    {
        "name": "Profesia.sk",
        "url": "https://www.profesia.sk/praca/",
        "link_selector": "a.title" # From scraper_sk.py
    },
    {
        "name": "Kariera.sk",
        "url": "https://www.kariera.sk/ponuky/",
        "link_selector": "a.title" # From scraper_sk.py
    }
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

def get_real_url(site):
    print(f"Scanning {site['name']}...")
    try:
        resp = requests.get(site['url'], headers=headers, timeout=15)
        if resp.status_code != 200:
            print(f"❌ {site['name']} returned {resp.status_code}")
            return None
            
        soup = BeautifulSoup(resp.content, "html.parser")
        
        # Try finding link
        link_el = soup.select_one(site['link_selector'])
        
        # Special handling for JustJoin.it which is React based and might need different logic or verify selector
        if site['name'] == "JustJoin.it" and not link_el:
             # JustJoin might use different classes or structure now
             link_el = soup.select_one("div[data-index] a")

        if link_el and link_el.get('href'):
            full_url = urljoin(site['url'], link_el.get('href'))
            print(f"✅ Found URL: {full_url}")
            return full_url
        else:
            print(f"❌ No link found with selector: {site['link_selector']}")
            # Debug: print first few links found to help find correct selector
            print(f"   Debug: First 3 links found on page:")
            for a in soup.find_all('a', href=True)[:3]:
                print(f"   - {a.get('href')}")
            return None
            
    except Exception as e:
        print(f"❌ Error scraping {site['name']}: {e}")
        return None

print("Finding valid job detail URLs for inspection...\n")
found_urls = {}

for site in SITES:
    url = get_real_url(site)
    if url:
        found_urls[site['name']] = url

print("\n" + "="*60)
print("VALID URLS FOUND:")
print("="*60)
for name, url in found_urls.items():
    print(f"'{name}': '{url}',")
