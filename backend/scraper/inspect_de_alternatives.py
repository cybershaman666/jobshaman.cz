#!/usr/bin/env python3
"""
Scout for accessible German/Austrian job portals (checking for 403 blocks)
"""
import requests
from bs4 import BeautifulSoup
import time

CANDIDATES = [
    # Germany
    ("Jobware.de", "https://www.jobware.de/jobsuche?q=software"),
    ("Meinestadt.de", "https://jobs.meinestadt.de/deutschland/suche?words=developer"),
    ("Arbeitsagentur.de", "https://www.arbeitsagentur.de/jobsuche/suche?angebotsart=1&was=Softwareentwickler"),
    ("Kimeta.de", "https://www.kimeta.de/sz/softwareentwickler"),
    ("Stellenanzeigen.de", "https://www.stellenanzeigen.de/suche/?q=software"),

    # Austria
    ("DerStandard.at", "https://jobs.derstandard.at/jobsuche?q=software"),
    ("Karriere.at (Retry)", "https://www.karriere.at/jobs/software"),
    ("Gastrojobs.at", "https://www.gastrojobs.at/jobs?search=kellner"), # Niche but popular
    ("Metajob.at", "https://www.metajob.at/IT"),
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"
}

print(f"{'='*60}")
print(f"SCOUTING ALTERNATIVE DE/AT PORTALS")
print(f"{'='*60}\n")

accessible_sites = []

for name, url in CANDIDATES:
    print(f"Checking {name}...", end=" ", flush=True)
    try:
        start = time.time()
        resp = requests.get(url, headers=headers, timeout=10)
        duration = time.time() - start
        
        status = resp.status_code
        if status == 200:
            print(f"✅ OK ({duration:.2f}s)")
            
            # Basic analysis
            soup = BeautifulSoup(resp.content, "html.parser")
            
            # Look for job links
            # Naive heuristic: count links
            links = soup.find_all('a', href=True)
            job_links = [l for l in links if len(l.get_text(strip=True)) > 10 and ('stellen' in l['href'] or 'job' in l['href'] or 'angebot' in l['href'])]
            
            print(f"   - Response size: {len(resp.content)/1024:.1f} KB")
            print(f"   - Potential job links found: {len(job_links)}")
            
            accessible_sites.append((name, url, len(job_links)))
            
        elif status == 403:
            print(f"❌ BLOCKED (403)")
        else:
            print(f"⚠️ Status {status}")
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    time.sleep(1)

print(f"\n{'='*60}")
print(f"SUMMARY OF ACCESSIBLE SITES")
print(f"{'='*60}")

if not accessible_sites:
    print("No sites accessible! This is bad.")
else:
    # Sort by number of links
    accessible_sites.sort(key=lambda x: x[2], reverse=True)
    for name, url, count in accessible_sites:
        print(f"✅ {name}: {count} potential links")
        print(f"   URL: {url}")
