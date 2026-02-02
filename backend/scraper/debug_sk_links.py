#!/usr/bin/env python3
"""
Deep inspection of Slovak job portals to find correct link selectors
"""
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

def inspect_links(url, site_name):
    print(f"\n{'='*70}")
    print(f"INSPECTING LINKS: {site_name}")
    print(f"URL: {url}")
    print(f"{'='*70}")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        resp = requests.get(url, headers=headers, timeout=12)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "html.parser")
        
        print("\nSearching for potential job links...")
        
        # Look for any links that might be job offers
        # Profesia: look for links containing "praca" or "ponuka" in href or class
        candidates = []
        for a in soup.find_all('a', href=True):
            href = a.get('href')
            text = a.get_text(strip=True)
            classes = a.get('class', [])
            
            # Profesia specific heuristics
            if 'profesia' in site_name.lower():
                # Look for title class specifically
                if 'list-row__title' in classes or 'title' in classes:
                     candidates.append((text, href, classes))
                # Or links that look like offers
                elif '/praca/' in href and len(text) > 10:
                     # Filter out navigation links
                     if not any(x in href for x in ['zahranicie', 'region', 'kraj', 'odvetvie']):
                        candidates.append((text, href, classes))
            
            # Kariera specific heuristics
            elif 'kariera' in site_name.lower():
                # Look for title class
                if 'title' in classes:
                    candidates.append((text, href, classes))
                elif '/ponuka/' in href:
                    candidates.append((text, href, classes))
            
        print(f"Found {len(candidates)} candidate links")
        
        for i, (text, href, classes) in enumerate(candidates[:5]):
            print(f"\n{i+1}. Text: {text}")
            print(f"   Href: {href}")
            print(f"   Classes: {classes}")
            
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

# Profesia.sk - try search result page with specific selector
inspect_links(
    "https://www.profesia.sk/praca/?page_num=1", 
    "Profesia.sk Search Results"
)

# Kariera.sk - try work category page
inspect_links(
    "https://kariera.zoznam.sk/ponuky", 
    "Kariera.sk Ponuky"
)
