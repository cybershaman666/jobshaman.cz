#!/usr/bin/env python3
"""
Inspect HTML structure of German/Austrian job portals
"""
import requests
from bs4 import BeautifulSoup

def inspect_site(url, site_name):
    print(f"\n{'='*70}")
    print(f"INSPECTING: {site_name}")
    print(f"URL: {url}")
    print(f"{'='*70}")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    try:
        resp = requests.get(url, headers=headers, timeout=12)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "html.parser")
        
        # Look for long text blocks
        all_divs = soup.find_all("div")
        long_text_divs = []
        
        for div in all_divs:
            text = div.get_text(strip=True)
            if len(text) > 500:
                direct_children = [c for c in div.children if c.name]
                if len(direct_children) < 20:
                    long_text_divs.append((div, len(text)))
        
        long_text_divs.sort(key=lambda x: x[1], reverse=True)
        
        print(f"\n✅ Found {len(long_text_divs)} divs with >500 chars")
        
        for i, (div, length) in enumerate(long_text_divs[:3]):
            classes = div.get('class', [])
            data_at = div.get('data-at', '')
            print(f"\n{i+1}. Length: {length} chars")
            print(f"   Classes: {classes}")
            if data_at:
                print(f"   data-at: {data_at}")
            print(f"   Preview: {div.get_text()[:150]}...")
            
            p_count = len(div.find_all('p'))
            li_count = len(div.find_all('li'))
            print(f"   Contains: {p_count} paragraphs, {li_count} list items")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

print("\n" + "="*70)
print("GERMAN/AUSTRIAN JOB PORTALS INSPECTION")
print("="*70)

# StepStone.de
inspect_site(
    "https://www.stepstone.de/stellenangebote--Project-Manager-m-w-d-FERCHAU-GmbH-Muenchen-10004001.html",
    "StepStone.de"
)

# Indeed.de
inspect_site(
    "https://de.indeed.com/viewjob?jk=example",
    "Indeed.de"
)

# Karriere.at
inspect_site(
    "https://www.karriere.at/jobs/6789012/project-manager",
    "Karriere.at"
)
