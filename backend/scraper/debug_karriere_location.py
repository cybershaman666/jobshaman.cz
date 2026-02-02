#!/usr/bin/env python3
"""
Debug script for Karriere.at Location and Description
"""
import requests
from bs4 import BeautifulSoup
import json

url = "https://www.karriere.at/jobs/software" # List page to find link

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

print(f"Fetching list: {url}")
resp = requests.get(url, headers=headers)
soup = BeautifulSoup(resp.content, "html.parser")

# Find a job link
link = soup.select_one('a.m-jobsListItem__titleLink')
if not link:
    print("❌ No job link found on list page")
    exit(1)

job_url = link['href']
if not job_url.startswith('http'):
    job_url = "https://www.karriere.at" + job_url

print(f"Fetching detail: {job_url}")
detail_resp = requests.get(job_url, headers=headers)
detail_soup = BeautifulSoup(detail_resp.content, "html.parser")

print("\n--- LOCATION ANALYSIS ---")
# Try to find location text
# Metadata usually in header
meta_locs = detail_soup.select(".m-jobHeader__location, .m-jobContent__jobLocation, .job-location, li.location, [itemprop='addressLocality']")
for i, el in enumerate(meta_locs):
    print(f"Selector match {i}: '{el.get_text(strip=True)}' (Class: {el.get('class')})")

# Look for JSON-LD
json_scripts = detail_soup.find_all('script', type='application/ld+json')
for s in json_scripts:
    try:
        data = json.loads(s.get_text())
        if 'jobLocation' in data:
            print(f"✅ Found JSON-LD Location: {data['jobLocation']}")
    except:
        pass

print("\n--- DESCRIPTION ANALYSIS ---")
# Check what's in m-jobContent__jobDetail vs generic
detail_div = detail_soup.select_one('.m-jobContent__jobDetail')
if detail_div:
    print(f"Specific Div (.m-jobContent__jobDetail): {len(detail_div.get_text())} chars")
    print(f"Start: {detail_div.get_text(strip=True)[:100]}")
else:
    print("❌ Specific Div .m-jobContent__jobDetail NOT FOUND")

# Check generic wrapper
generic_div = detail_soup.select_one('.m-jobContent')
if generic_div:
    print(f"Generic Div (.m-jobContent): {len(generic_div.get_text())} chars")
    # Check if header info is inside
    if "Gehalt" in generic_div.get_text() or "Salary" in generic_div.get_text():
        print("⚠️ Generic div contains Salary info")
    if "Standort" in generic_div.get_text():
         print("⚠️ Generic div contains Location info")
