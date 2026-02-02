#!/usr/bin/env python3
"""
Inspect JustJoin.it to fix 404s
"""
import requests
from bs4 import BeautifulSoup

url = "https://justjoin.it/offers?page=1"
print(f"Checking {url}...")
try:
    resp = requests.get(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    })
    print(f"Status: {resp.status_code}")
    print(f"URL: {resp.url}")
    if resp.status_code == 200:
        print("Success!")
    else:
        print("Failed.")
        
    # Check "all" page
    url_all = "https://justjoin.it/all-locations/javascript"
    print(f"\nChecking alternate: {url_all}...")
    resp_all = requests.get(url_all, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    })
    print(f"Status: {resp_all.status_code}")
    
    if resp_all.status_code == 200:
        soup = BeautifulSoup(resp_all.content, "html.parser")
        print(f"Title: {soup.title.get_text() if soup.title else 'No Title'}")
        
        # Check for NEXT_DATA
        next_data = soup.find("script", id="__NEXT_DATA__")
        if next_data:
            print("✅ Found __NEXT_DATA__ (React hydration data)")
            print(f"   Data length: {len(next_data.get_text())} chars")
        else:
            print("❌ No __NEXT_DATA__ found")
            
        # Check API directly
        url_api = "https://justjoin.it/api/offers"
        print(f"\nChecking API: {url_api}...")
        resp_api = requests.get(url_api, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "application/json"
        })
        print(f"Status: {resp_api.status_code}")
        if resp_api.status_code == 200:
            try:
                data = resp_api.json()
                count = len(data) if isinstance(data, list) else len(data.get('offers', [])) # Guess structure
                print(f"✅ API works! Found {count} offers")
                if count > 0:
                    print("DEBUG SAMPLE:", str(data[0])[:200])
            except:
                print("❌ Failed to parse JSON")
            
        # Check for job links
        links = soup.select('a[href*="/offers/"]')
        print(f"Found {len(links)} job links via selector a[href*='/offers/']")
    
except Exception as e:
    print(e)
