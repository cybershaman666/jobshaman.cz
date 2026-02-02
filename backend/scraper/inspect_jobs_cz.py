#!/usr/bin/env python3
"""
Quick script to inspect Jobs.cz HTML structure
"""
import requests
from bs4 import BeautifulSoup

# Get a job detail page
url = "https://www.jobs.cz/rpd/2001023435/"  # Project Manager v Developmentu

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

print(f"Fetching: {url}")
resp = requests.get(url, headers=headers, timeout=12)
soup = BeautifulSoup(resp.content, "html.parser")

print("\n" + "="*60)
print("LOOKING FOR JOB DESCRIPTION CONTENT")
print("="*60)

# Look for JobDescriptionHeading and its siblings
heading = soup.find("div", class_="JobDescriptionHeading")
if heading:
    print("\n✅ Found JobDescriptionHeading")
    print(f"   Text: {heading.get_text()[:100]}")
    
    # Look at parent
    parent = heading.parent
    print(f"\n   Parent tag: {parent.name}, classes: {parent.get('class')}")
    
    # Look at all siblings
    print("\n   Siblings after heading:")
    for i, sibling in enumerate(heading.find_next_siblings()):
        if i > 10:  # Limit to first 10
            break
        if sibling.name:
            classes = sibling.get('class', [])
            text_preview = sibling.get_text()[:100].replace('\n', ' ')
            print(f"   {i+1}. <{sibling.name}> classes={classes}")
            print(f"      Text: {text_preview}...")

# Look for any div with rich text content
print("\n" + "="*60)
print("LOOKING FOR CONTENT CONTAINERS")
print("="*60)

# Common patterns for job descriptions
patterns = [
    "div[class*='Content']",
    "div[class*='Text']",
    "div[class*='Body']",
    "div[class*='Rich']",
]

for pattern in patterns:
    elements = soup.select(pattern)
    if elements:
        print(f"\n✅ Pattern '{pattern}' found {len(elements)} elements")
        for i, elem in enumerate(elements[:3]):  # Show first 3
            classes = elem.get('class', [])
            text = elem.get_text()[:150].replace('\n', ' ')
            print(f"   {i+1}. Classes: {classes}")
            print(f"      Text: {text}...")

# Try to find the actual description by looking for long text blocks
print("\n" + "="*60)
print("LOOKING FOR LONG TEXT BLOCKS (likely job description)")
print("="*60)

all_divs = soup.find_all("div")
long_text_divs = []

for div in all_divs:
    text = div.get_text(strip=True)
    # Look for divs with substantial text (>500 chars) that might be the description
    if len(text) > 500:
        # Count direct children to avoid containers
        direct_children = [c for c in div.children if c.name]
        if len(direct_children) < 20:  # Not a container with many children
            long_text_divs.append((div, len(text)))

# Sort by text length
long_text_divs.sort(key=lambda x: x[1], reverse=True)

print(f"\nFound {len(long_text_divs)} divs with >500 chars of text")
for i, (div, length) in enumerate(long_text_divs[:5]):
    classes = div.get('class', [])
    print(f"\n{i+1}. Length: {length} chars, Classes: {classes}")
    print(f"   Preview: {div.get_text()[:200]}...")
    
    # Show structure
    children = [c.name for c in div.children if c.name]
    print(f"   Children tags: {children[:10]}")

