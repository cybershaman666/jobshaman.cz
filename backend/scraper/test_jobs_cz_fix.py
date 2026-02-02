#!/usr/bin/env python3
"""
Test scraper for a single Jobs.cz job to verify description extraction
"""
import sys
sys.path.insert(0, '/home/misha/Stažené/jobshaman/backend')

from scraper.scraper_multi import scrape_page, norm_text, filter_out_junk

# Test with the specific job URL
url = "https://www.jobs.cz/rpd/2001023435/"

print(f"Testing description extraction for: {url}\n")
print("="*60)

detail_soup = scrape_page(url)
if not detail_soup:
    print("❌ Failed to fetch page")
    sys.exit(1)

# Try the new RichContent selector
main_content = detail_soup.find("div", class_="RichContent")

if main_content:
    print("✅ Found RichContent div")
    print(f"   Content length: {len(main_content.get_text())} chars")
    
    parts = []
    for elem in main_content.find_all(['p', 'li', 'h2', 'h3', 'h4', 'ul', 'ol']):
        if elem.name in ['ul', 'ol']:
            continue
        
        txt = norm_text(elem.get_text())
        if not txt:
            continue
        
        if elem.name == 'li':
            parts.append(f"- {txt}")
        elif elem.name in ['h2', 'h3', 'h4']:
            parts.append(f"\n### {txt}")
        else:
            parts.append(txt)
    
    if parts:
        description = filter_out_junk("\n\n".join(parts))
        print(f"\n   Extracted {len(parts)} content blocks")
        print(f"   Final description length: {len(description)} chars")
        print("\n" + "="*60)
        print("DESCRIPTION PREVIEW (first 800 chars):")
        print("="*60)
        print(description[:800])
        print("...")
    else:
        print("❌ No content blocks extracted")
else:
    print("❌ RichContent div not found")
    
    # Try fallback
    fallback = detail_soup.find("div", class_="JobDescriptionSection") or detail_soup.find("div", class_="JobDescription")
    if fallback:
        print("   But found fallback selector")
    else:
        print("   No fallback selector found either")
