
import requests
from bs4 import BeautifulSoup
import json
import time

def get_real_nofluff_url():
    list_url = "https://nofluffjobs.com/pl/jobs"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    print(f"Fetching list from {list_url}")
    resp = requests.get(list_url, headers=headers)
    if resp.status_code != 200:
        print(f"Failed to fetch list: {resp.status_code}")
        return None
        
    soup = BeautifulSoup(resp.content, "html.parser")
    
    # Try to find links in common places
    links = soup.select('a[href^="/pl/job/"]')
    if not links:
        # Try state
        state = soup.select_one('#serverApp-state')
        if state:
            try:
                data = json.loads(state.get_text())
                # deep search for slug
                s_data = str(data)
                import re
                slugs = re.findall(r'"url":"(.*?)"', s_data)
                valid_slugs = [s for s in slugs if 'pl/job/' in s or (not s.startswith('http') and len(s) > 10)]
                if valid_slugs:
                    if valid_slugs[0].startswith('http'): return valid_slugs[0]
                    return f"https://nofluffjobs.com/pl/job/{valid_slugs[0]}"
            except: pass
            
    if links:
        return "https://nofluffjobs.com" + links[0]['href']
        
    return None

target_url = get_real_nofluff_url()

if target_url:
    print(f"Testing with URL: {target_url}")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    resp = requests.get(target_url, headers=headers)
    if resp.status_code == 200:
        soup = BeautifulSoup(resp.content, "html.parser")
        
        selectors = {
            'common_body': ['#posting-description', '.posting-description', '[data-cy="posting-description"]', 'nfj-posting-description'],
            'common_reqs': ['#posting-requirements', '.posting-requirements', '[data-cy="posting-requirements"]', 'nfj-posting-requirements'],
        }
        
        found_any = False
        for name, sels in selectors.items():
            for sel in sels:
                els = soup.select(sel)
                if els:
                    print(f"MATCH {name}: {sel} -> {len(els)} elements")
                    print(f"Sample: {els[0].get_text()[:100]}...")
                    found_any = True
        
        if not found_any:
            print("No selectors matched. Dumping body stats:")
            print(f"Body length: {len(resp.content)}")
            print(f"Div count: {len(soup.find_all('div'))}")
            # print(soup.prettify()[:2000]) # Too long
    else:
        print(f"Failed to fetch detail: {resp.status_code}")
else:
    print("Could not find any job URL")
