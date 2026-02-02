#!/usr/bin/env python3
"""
Specific debug script for SK portals to nail down selectors
"""
import requests
from bs4 import BeautifulSoup

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

def debug_kariera_links():
    print("\n" + "="*50)
    print("DEBUGGING KARIERA LINKS")
    print("="*50)
    url = "https://kariera.zoznam.sk/pracovne-ponuky/za-1-den"
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(resp.content, "html.parser")
        
        # Find all links inside the main area
        # Just get the first 20 links from the whole page to see patterns
        links = soup.find_all('a', href=True)
        print(f"Dumping first 20 links from page:")
        for i, a in enumerate(links[:20]):
             print(f"{i+1}. Text: '{a.get_text(strip=True)[:50]}'")
             print(f"   Href: {a['href']}")
            
    except Exception as e:
        print(f"Error: {e}")

def debug_profesia_content():
    print("\n" + "="*50)
    print("DEBUGGING PROFESIA CONTENT CONTAINER")
    print("="*50)
    url = "https://www.profesia.sk/praca/netcore-j-s-a/O5218251"
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(resp.content, "html.parser")
        
        # Look for English heading since the job is in English
        marker = soup.find(string=lambda x: x and "Place of work" in x)
        if marker:
             print("✅ Found 'Place of work' text")
             # Traverse up to find a container
             node = marker.parent
             for _ in range(5): # Go up 5 levels
                 if node.name == 'div':
                     print(f"   Ancestor div classes: {node.get('class')}")
                     # If it has a specific class like 'card-body' or 'col', it might be the one
                     if node.get('class') and any(x in node.get('class') for x in ['row', 'container', 'col', 'main', 'description']):
                         print(f"   -> POTENTIAL CONTAINER: {node.get('class')}")
                 node = node.parent
                 if not node: break
    except Exception as e:
        print(f"Error: {e}")

debug_kariera_links()
debug_profesia_content()
