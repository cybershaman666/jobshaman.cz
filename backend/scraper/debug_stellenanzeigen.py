#!/usr/bin/env python3
"""
Debug script for Stellenanzeigen.de Location, Company, Benefits and Metadata
"""
import requests
from bs4 import BeautifulSoup
import json
import re

job_url = "https://www.stellenanzeigen.de/job/sachbearbeiter-m-w-d-fuer-die-zentrale-vergabestelle-im-bauverwaltungs-und-bauordnungsamt-leonberg-16070417/"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}
print(f"Fetching failing detail: {job_url}")
detail_resp = requests.get(job_url, headers=headers)
detail_soup = BeautifulSoup(detail_resp.content, "html.parser")

print("\n--- JSON-LD ANALYSIS ---")
json_scripts = detail_soup.find_all('script', type='application/ld+json')
found_json = False
for i, s in enumerate(json_scripts):
    try:
        data = json.loads(s.get_text())
        print(f"Script {i} Type: {data.get('@type') if isinstance(data, dict) else 'List'}")
        if isinstance(data, dict) and data.get('@type') == 'JobPosting':
            print("✅ Found JobPosting JSON-LD!")
            print(f"   Name: {data.get('title')}")
            print(f"   Org: {data.get('hiringOrganization', {}).get('name') if isinstance(data.get('hiringOrganization'), dict) else data.get('hiringOrganization')}")
            
            # Safe location access
            loc = data.get('jobLocation')
            if isinstance(loc, list) and loc: loc = loc[0]
            if isinstance(loc, dict):
                 print(f"   Loc: {loc.get('address', {}).get('addressLocality')}")
            
            print(f"   Salary: {data.get('baseSalary')}")
            
            desc = data.get('description')
            if desc:
                print(f"   ✅ Description Found! Length: {len(desc)} chars")
                print(f"   Sample: {desc[:100]}...")
            else:
                 print("   ❌ Description NOT in JSON-LD")
                 
            found_json = True
    except Exception as e:
        print(f"Script {i} - Failed to parse/access JSON: {e}")

if not found_json:
    print("❌ No JobPosting JSON-LD found.")

print("\n--- METADATA SELECTOR ANALYSIS ---")
# Company
comp_el = detail_soup.select_one('[data-testid="header-company-name"], .company-name')
print(f"Company Selector: {comp_el.get_text(strip=True) if comp_el else 'Not Found'}")

# Location
loc_el = detail_soup.select_one('[data-testid="job-location"], .job-location')
print(f"Location Selector: {loc_el.get_text(strip=True) if loc_el else 'Not Found'}")

# Benefits
print("\n--- BENEFITS ANALYSIS ---")
# Check for common benefit containers
benefit_lists = detail_soup.select('ul.benefits, .benefits-list, .benefit-items')
print(f"Found {len(benefit_lists)} potential benefit lists")
for ul in benefit_lists:
    print(f"Items: {[li.get_text(strip=True) for li in ul.find_all('li')]}")
    
