
import requests
from bs4 import BeautifulSoup
import json

url = "https://www.pracuj.pl/praca?page=1"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

resp = requests.get(url, headers=headers)
soup = BeautifulSoup(resp.content, "html.parser")

next_data = soup.select_one('#__NEXT_DATA__')
if next_data:
    data = json.loads(next_data.get_text())
    props = data.get('props', {}).get('pageProps', {})
    queries = props.get('dehydratedState', {}).get('queries', [])
    
    offers = []
    for q in queries:
        query_key = q.get('queryKey', [])
        # Relaxed check
        if isinstance(query_key, list) and 'jobOffers' in str(query_key):
            print(f"Found queryKey: {query_key}")
            state_data = q.get('state', {}).get('data', {})
            if 'groupedOffers' in state_data:
                offers = state_data['groupedOffers']
                print(f"Found {len(offers)} offers in groupedOffers")
                if offers:
                    print("Sample offer keys:", offers[0].keys())
                    print("Sample offer content:", json.dumps(offers[0], indent=2))
                    
                    # Check extraction logic
                    offer = offers[0]
                    title = offer.get('jobTitle')
                    offer_url = offer.get('offers', [{}])[0].get('offerUrl')
                    print(f"Title: {title}")
                    print(f"URL: {offer_url}")
                    
            elif 'offers' in state_data:
                 print("Found 'offers' key instead of groupedOffers")
else:
    print("No __NEXT_DATA__ found")
