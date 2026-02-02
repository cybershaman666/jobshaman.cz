import requests
import json
from bs4 import BeautifulSoup

def debug_pracuj_location():
    url = 'https://www.pracuj.pl/praca?page=1'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        resp = requests.get(url, headers=headers)
        soup = BeautifulSoup(resp.content, 'html.parser')
        next_data = soup.select_one('#__NEXT_DATA__')
        
        if not next_data:
            print("No __NEXT_DATA__ found")
            return
            
        data = json.loads(next_data.get_text())
        queries = data.get('props', {}).get('pageProps', {}).get('dehydratedState', {}).get('queries', [])
        
        for q in queries:
            query_key = q.get('queryKey', [])
            if isinstance(query_key, list) and len(query_key) > 0 and query_key[0] == 'jobOffers':
                state_data = q.get('state', {}).get('data', {})
                offers = state_data.get('groupedOffers', [])
                
                if offers:
                    offer = offers[0]
                    print("Structure of first offer:")
                    # print(json.dumps(offer, indent=2))
                    
                    print("\nLocation related fields:")
                    for key, val in offer.items():
                        if any(x in key.lower() for x in ['loc', 'work', 'place', 'city', 'region', 'display']):
                            print(f"  {key}: {val}")
                            
                    # Check nested offers
                    nested = offer.get('offers', [])
                    if nested:
                        print("\nFirst nested offer location fields:")
                        for key, val in nested[0].items():
                            if any(x in key.lower() for x in ['loc', 'work', 'place', 'city', 'region', 'display']):
                                print(f"    {key}: {val}")
                    return
        
        print("No jobOffers found in queries")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    debug_pracuj_location()
