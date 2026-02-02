
import requests
from bs4 import BeautifulSoup

# Use a specific job URL from the log or a general one
url = "https://nofluffjobs.com/pl/job/senior-java-developer-remote-software-studio-krakow-tvv683p0" 
# Note: This URL might expire, but let's try to hit the listing page and get a fresh URL if needed.
# Better: Scrape listing first to get a real valid URL.

def get_real_nofluff_url():
    list_url = "https://nofluffjobs.com/pl/jobs"
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(list_url, headers=headers)
    soup = BeautifulSoup(resp.content, "html.parser")
    # Quick dirty link extraction
    links = soup.select('a[href^="/pl/job/"]')
    if links:
        return "https://nofluffjobs.com" + links[0]['href']
    return None

target_url = get_real_nofluff_url()
if not target_url:
    target_url = "https://nofluffjobs.com/pl/job/middle-senior-system-analyst-dal-sol-it-solutions-warsaw-b2b-uof6mp3k" # fallback

print(f"Debugging URL: {target_url}")

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}
resp = requests.get(target_url, headers=headers)
soup = BeautifulSoup(resp.content, "html.parser")

print("Validating selectors...")
selectors = {
    'description_p': ['.job-description p', 'nfj-posting-description p', 'section#posting-description p'],
    'description_ul': ['.job-description ul', 'nfj-posting-requirements ul', 'section#posting-requirements ul'],
    'benefits': ['nfj-posting-benefits li', '.benefits-list li', 'section#posting-benefits li']
}

for name, sels in selectors.items():
    found = False
    for sel in sels:
        els = soup.select(sel)
        if els:
            print(f"✅ Selector '{sel}' found {len(els)} elements for {name}")
            print(f"   Sample: {els[0].get_text()[:50]}...")
            found = True
    if not found:
        print(f"❌ No selector worked for {name}")

# Dump some structure if failed
if not found:
    print("\nDumping main classes:")
    for tag in soup.find_all(['div', 'section'], class_=True):
         classes = tag.get('class')
         if any('desc' in c for c in classes) or any('req' in c for c in classes):
             print(f"Tag: {tag.name}, Classes: {classes}")

