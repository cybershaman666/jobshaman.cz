#!/usr/bin/env python3
"""
Inspect HTML structure of Polish job portals with REAL URLs
"""
import requests
from bs4 import BeautifulSoup

def inspect_site(url, site_name):
    print(f"\n{'='*70}")
    print(f"INSPECTING: {site_name}")
    print(f"URL: {url}")
    print(f"{'='*70}")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        resp = requests.get(url, headers=headers, timeout=12)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "html.parser")
        
        # Look for Job Description specific containers
        # Pracuj.pl often uses data-test="section-description" or similar
        print("Checking description containers...")
        desc_containers = [
            ("div[data-test='section-descriptkon']", "Pracuj.pl data-test"),
            ("div.offer-view", "Generic offer view"),
            ("div[id='jobDescriptionText']", "Indeed style"),
            ("div.job-description", "Generic class"),
        ]
        
        for selector, name in desc_containers:
            el = soup.select_one(selector)
            if el:
                print(f"✅ Found {name}: {selector}")
                print(f"   Preview: {el.get_text()[:100]}...")

        # Look for stable data-test attributes
        print("Checking for data-test attributes...")
        data_test_elements = soup.select("[data-test]")
        print(f"Found {len(data_test_elements)} elements with data-test attribute")
        
        seen_tests = set()
        for el in data_test_elements:
            test_val = el.get('data-test')
            if test_val and test_val not in seen_tests:
                seen_tests.add(test_val)
                # print interesting ones
                if any(x in test_val for x in ['desc', 'offer', 'job', 'text', 'section', 'benefit', 'salary']):
                     print(f"   data-test='{test_val}' -> <{el.name}>")

        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

# Test Polish job portals with REAL URLs found previously
print("\n" + "="*70)
print("POLISH JOB PORTALS INSPECTION")
print("="*70)

# Pracuj.pl
inspect_site(
    "https://www.pracuj.pl/praca/zastepca-kierownika-sklepu-m-k-nowy-konik-pow-minski-terespolska-4a,oferta,1004604403",
    "Pracuj.pl"
)

# NoFluffJobs
inspect_site(
    "https://nofluffjobs.com/pl/job/lead-cost-and-contracts-manager-hsbc-technology-poland-krakow",
    "NoFluffJobs"
)
