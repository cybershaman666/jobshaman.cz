#!/usr/bin/env python3
"""
Deep inspection of Stellenanzeigen.de and Karriere.at to find selectors
"""
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import time

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"
}

def inspect_site_details(list_url, base_url, site_name, link_selector_guess=None):
    print(f"\n{'='*70}")
    print(f"ANALYZING: {site_name}")
    print(f"List URL: {list_url}")
    print(f"{'='*70}")
    
    try:
        # 1. Get List Page
        resp = requests.get(list_url, headers=headers, timeout=10)
        soup = BeautifulSoup(resp.content, "html.parser")
        
        # 2. Find a Job Link
        job_link = None
        
        # Try finding links
        if link_selector_guess:
             links = soup.select(link_selector_guess)
             if links:
                 job_link = urljoin(base_url, links[0]['href'])
                 print(f"✅ Found link using selector '{link_selector_guess}': {job_link}")
        
        if not job_link:
            # Fallback heuristic
            for a in soup.find_all('a', href=True):
                href = a['href']
                if any(x in href for x in ['/job/', '/stellenangebot/', '/jobs/']):
                    if len(a.get_text(strip=True)) > 10:
                        job_link = urljoin(base_url, href)
                        print(f"⚠️ Found link using heuristic: {job_link}")
                        break
        
        if not job_link:
            print("❌ No job link found!")
            return

        # 3. Inspect Detail Page
        print(f"Fetching detail: {job_link}")
        time.sleep(1) # Be nice
        resp_detail = requests.get(job_link, headers=headers, timeout=10)
        detail_soup = BeautifulSoup(resp_detail.content, "html.parser")
        
        # 4. Analyze Detail Page Structure
        
        # Title
        h1 = detail_soup.find('h1')
        print(f"Title (h1): {h1.get_text(strip=True) if h1 else 'NOT FOUND'}")
        
        # Description Candidate
        print("\nSearching for Description Container...")
        # Look for div with most text or specific classes
        candidates = []
        for div in detail_soup.body.find_all('div'): # Restrict to body
             # Scoring: +length, +keywords in class
             txt = div.get_text(strip=True)
             if len(txt) < 500: continue
             
             score = len(txt)
             cls = " ".join(div.get('class', []))
             if any(x in cls.lower() for x in ['description', 'content', 'job', 'angebot', 'profil', 'aufgabe']):
                 score += 5000 # Boost for keywords
             # Penalize if it contains too many links (nav/footer)
             if len(div.find_all('a')) > 10:
                 score -= 5000
             
             # Don't include huge wrappers (like 'body' or 'main' usually) if we can find smaller specific ones
             # Strategy: find specific 'semantic' containers first
             
             candidates.append((div, score, cls))
        
        candidates.sort(key=lambda x: x[1], reverse=True)
        
        for i, (div, score, cls) in enumerate(candidates[:3]):
            print(f"\nCandidate {i+1} (Score {score}):")
            print(f"   Class: {cls}")
            print(f"   Text len: {len(div.get_text(strip=True))}")
            print(f"   Preview: {div.get_text(strip=True)[:100]}...")
            
        # Continue to specific checks instead of returning early

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

    # Refined Inspection for Stellenanzeigen (looking for iframes or stable attributes)
    if "stellenanzeigen" in site_name.lower():
        print("\nSpecific inspection for Stellenanzeigen.de:")
        
        # Check for iframe
        iframe = detail_soup.find("iframe", id="sas_jobad")
        if iframe:
            print(f"✅ Found content iframe: {iframe.get('src')}")
        else:
            print("❌ No main job iframe found")
            
        # Check for data attributes
        data_els = detail_soup.select("[data-testid], [data-qa]")
        if data_els:
            print(f"✅ Found {len(data_els)} elements with data-testid/data-qa")
            for el in data_els[:5]:
                print(f"   {el.name} data-testid='{el.get('data-testid')}' data-qa='{el.get('data-qa')}'")


# Stellenanzeigen.de
inspect_site_details(
    "https://www.stellenanzeigen.de/suche/?q=software",
    "https://www.stellenanzeigen.de",
    "Stellenanzeigen.de",
    link_selector_guess=".job-item__title"
)

# Karriere.at
# inspect_site_details(
#     "https://www.karriere.at/jobs/software",
#     "https://www.karriere.at",
#     "Karriere.at",
#     link_selector_guess="a.m-jobsListItem__titleLink" # Based on previous scraping attempts
# )
