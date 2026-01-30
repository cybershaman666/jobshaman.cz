import requests
from bs4 import BeautifulSoup
import re

def norm_text(s):
    if not s:
        return ""
    return re.sub(r"\s+", " ", s).strip()

def scrape_jobs_cz_debug():
    # 1. Get a job link from the listing page
    base_url = "https://www.jobs.cz/prace/?language=cs"
    print(f"Fetching listing from {base_url}...")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        resp = requests.get(base_url, headers=headers, timeout=10)
        soup = BeautifulSoup(resp.content, "html.parser")
        
        # Find first job card
        article = soup.find("article")
        if not article:
            print("No job cards found on listing page.")
            return

        header = article.find("header")
        if not header:
            print("No header in job card.")
            return

        title_tag = header.find("h2", class_="SearchResultCard__title")
        if not title_tag or not title_tag.a:
            print("No title link found.")
            return

        job_url = title_tag.a["href"]
        if not job_url.startswith("http"):
            job_url = "https://www.jobs.cz" + job_url
            
        print(f"Testing Job URL: {job_url}")
        
        # 2. Scrape the detail page
        resp_detail = requests.get(job_url, headers=headers, timeout=10)
        detail_soup = BeautifulSoup(resp_detail.content, "html.parser")
        
        # Debug: Print structure of description
        # Standard selector
        main_content = detail_soup.find("div", class_="JobDescriptionSection")
        
        print("\n--- RAW DESCRIPTION DIV FOUND? ---")
        if main_content:
            print("YES, class='JobDescriptionSection' found.")
            # print(main_content.prettify()[:1000]) # Print first 1000 chars of HTML
        else:
            print("NO, trying fallback 'JobDescription'...")
            main_content = detail_soup.find("div", class_="JobDescription")
            if main_content:
                print("YES, class='JobDescription' found.")
            else:
                print("NO description container found.")
                return

        print("\n--- CURRENT PARSING LOGIC RESULT ---")
        parts = []
        # Simulate current logic: strict class check
        for elem in main_content.find_all(["p", "li"], class_=lambda x: x and "typography-body-large" in x):
            txt = norm_text(elem.get_text())
            if not txt: continue
            if elem.name == "li":
                parts.append(f"- {txt}")
            else:
                parts.append(txt)
        
        print(f"Extracted {len(parts)} blocks.")
        print("\n".join(parts))
        
        print("\n--- PROPOSED PARSING LOGIC RESULT ---")
        # Proposed: Relaxed selector, inclusive of h2/h3 and regular li
        new_parts = []
        for elem in main_content.find_all(['p', 'li', 'h2', 'h3', 'h4']):
            # Skip if it's purely empty or structural wrapper without text
            if not elem.get_text(strip=True):
                continue
                
            # Logic to avoid duplicates if nested (e.g. p inside div) - usually find_all is recursive
            # We might want recursive=False if we iterate sections, but simpler:
            # Check if parent is also in the list? No, find_all flattens.
            
            # Better approach: Iterate over children or use semantic extraction
            txt = norm_text(elem.get_text())
            
            # Simple heuristic: if it's a list item, prefix it.
            if elem.name == 'li':
                new_parts.append(f"- {txt}")
            elif elem.name in ['h2', 'h3', 'h4']:
                new_parts.append(f"\n### {txt}")
            elif elem.name == 'p':
                new_parts.append(txt)
                
        # Deduplication/Cleanup might be needed if find_all captures nested items
        # But let's see output first.
        print("\n".join(new_parts[:20])) # Print first 20 lines
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    scrape_jobs_cz_debug()
