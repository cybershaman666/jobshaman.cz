
import requests
from bs4 import BeautifulSoup
import json
import sys

def inspect_url(url, site_name):
    print(f"\n--- Inspecting {site_name}: {url} ---")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        soup = BeautifulSoup(resp.content, "html.parser")
        
        print(f"Status Code: {resp.status_code}")
        
        if site_name == "Pracuj.pl":
            # Check for JSON-LD
            scripts = soup.find_all('script', type='application/ld+json')
            print(f"Found {len(scripts)} JSON-LD scripts")
            for i, s in enumerate(scripts):
                print(f"JSON-LD #{i}: {s.get_text()[:200]}...")

            # Check for Next.js data
            next_data = soup.select_one('#__NEXT_DATA__')
            if next_data:
                print("Found #__NEXT_DATA__ script!")
                try:
                    data = json.loads(next_data.get_text())
                    props = data.get('props', {}).get('pageProps', {})
                    print(f"pageProps keys: {list(props.keys())}")
                    
                    # Try to find offers in common places
                    if 'dehydratedState' in props:
                        print("Found dehydratedState (React Query?)")
                        # React Query often has 'queries' list
                        queries = props['dehydratedState'].get('queries', [])
                        print(f"Found {len(queries)} queries")
                        for q in queries:
                            print(f"  QueryKey: {q.get('queryKey')}")
                            # Check if state has data
                            data = q.get('state', {}).get('data', {})
                            if isinstance(data, dict):
                                print(f"    Data keys: {list(data.keys())}")
                                if 'offers' in data:
                                     print(f"    -> FOUND OFFERS! Count: {len(data['offers'])}")
                                elif 'listing' in data: # sometimes it is listing
                                     print(f"    -> FOUND LISTING in data!")
                            
                except Exception as e:
                    print(f"Error parsing Next data: {e}")
            
        elif site_name == "NoFluffJobs":
            # Check serverApp-state
            state_script = soup.select_one('#serverApp-state')
            if state_script:
                print("Found #serverApp-state script!")
                content = state_script.get_text()
                # Sometimes it is base64 or escaped JSON
                # Check start
                print(f"Content start: {content[:100]}...")
                
                try:
                    # It might be simple JSON
                    data = json.loads(content)
                    print(f"Root keys: {list(data.keys())}")
                    
                    # Look for postings
                    # Common paths: 'search', 'postings', 'jobs'
                    # Traverse a bit
                    if 'SEARCH' in data: # specific to NoFluff sometimes
                         print(f"Found SEARCH key. Keys: {list(data['SEARCH'].keys())}")
                    
                except:
                    # Maybe it requires decoding? Usually NoFluff is just JSON.
                    # Or it might be Angular's weird format.
                     pass
            
            # Check for raw content to see if it's SSR or completely empty

            # Search for a job title and print its hierarchy to find the container class
            print("\nSearching for job title container...")
            # Look for a common IT keyword
            keyword = 'developer'
            found = soup.find(lambda tag: tag.name in ['h3', 'h4', 'a', 'span'] and keyword in tag.get_text().lower())
            
            if found:
                print(f"Found element with '{keyword}': <{found.name} class='{found.get('class')}'>")
                print(f"  Text: {found.get_text().strip()[:50]}...")
                
                # Walk up parents to find the card container
                parent = found.parent
                for i in range(5):
                    if parent:
                        print(f"  Parent {i+1}: <{parent.name} class='{parent.get('class')}'> id='{parent.get('id')}'")
                        parent = parent.parent
            else:
                print(f"Could not find element with '{keyword}' text.")

            
        elif site_name == "NoFluffJobs":
            # Check JSON-LD
            scripts = soup.find_all('script', type='application/ld+json')
            print(f"Found {len(scripts)} JSON-LD scripts")
            for i, s in enumerate(scripts):
                content = s.get_text()
                print(f"JSON-LD #{i}: {content[:200]}...")
                try:
                    data = json.loads(content)
                    if isinstance(data, dict) and '@graph' in data:
                        print(f"  Types in @graph: {[x.get('@type') for x in data['@graph']]}")
                    elif isinstance(data, dict):
                         print(f"  Type: {data.get('@type')}")
                except:
                    pass

    except Exception as e:
        print(f"Error fetching {url}: {e}")

if __name__ == "__main__":
    inspect_url("https://www.pracuj.pl/praca?page=1", "Pracuj.pl")
    inspect_url("https://nofluffjobs.com/pl/jobs?page=1", "NoFluffJobs")
