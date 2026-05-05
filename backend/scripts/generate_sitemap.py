import asyncio
import os
import sys
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Add the parent directory to sys.path to allow importing app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import engine

SITEMAP_HEADER = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
"""

SITEMAP_FOOTER = "</urlset>"

BASE_URL = "https://jobshaman.cz"

def escape_xml(s):
    if not s: return ""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&apos;")

async def generate_sitemap():
    print("Generating sitemap...")
    urls = []
    
    # 1. Static Pages (English & Localized)
    static_pages = [
        "",
        "/marketplace",
        "/companies",
        "/terms",
        "/privacy",
        "/contact",
        # Localized paths from routing.ts
        "/firmy",
        "/kontakt",
        "/obchodni-podminky",
        "/ochrana-osobnich-udaju",
        "/podminky-uziti",
        "/privacy-policy",
        "/kurzy",
        "/uceni"
    ]
    for page in static_pages:
        urls.append(f"  <url>\n    <loc>{BASE_URL}{page}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>")

    # 2. Job Offers (Native & Scraped)
    async with AsyncSession(engine) as session:
        # Native Jobs (keep all active)
        native_query = text("SELECT id, updated_at FROM opportunities WHERE is_active = true AND status = 'published'")
        result = await session.execute(native_query)
        for row in result:
            job_id = str(row[0])
            lastmod = row[1].strftime("%Y-%m-%d") if row[1] else datetime.now().strftime("%Y-%m-%d")
            urls.append(f"  <url>\n    <loc>{BASE_URL}/candidate/role/{job_id}</loc>\n    <lastmod>{lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>")
            
        # Scraped Jobs (jobs_nf) - only last 30 days
        scraped_query = text("""
            SELECT id, updated_at, created_at 
            FROM jobs_nf 
            WHERE COALESCE(is_active, true) = true 
            AND COALESCE(status, 'active') NOT IN ('archived', 'deleted', 'inactive')
            AND (updated_at > NOW() - INTERVAL '30 days' OR created_at > NOW() - INTERVAL '30 days')
        """)
        result = await session.execute(scraped_query)
        for row in result:
            job_id = str(row[0])
            lastmod = (row[1] or row[2] or datetime.now()).strftime("%Y-%m-%d")
            urls.append(f"  <url>\n    <loc>{BASE_URL}/candidate/imported/{job_id}</loc>\n    <lastmod>{lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.5</priority>\n  </url>")

    # Write XML
    output_path_xml = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/public/sitemap.xml"))
    with open(output_path_xml, "w", encoding="utf-8") as f:
        f.write(SITEMAP_HEADER)
        f.write("\n".join(urls))
        f.write("\n" + SITEMAP_FOOTER)

    # Write TXT (plain list of URLs)
    output_path_txt = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/public/sitemap.txt"))
    with open(output_path_txt, "w", encoding="utf-8") as f:
        for url_block in urls:
            # Extract URL from <loc> tag
            import re
            loc_match = re.search(r"<loc>(.*?)</loc>", url_block)
            if loc_match:
                f.write(loc_match.group(1) + "\n")
    
    print(f"Sitemaps generated successfully at {output_path_xml} and {output_path_txt} with {len(urls)} URLs.")

if __name__ == "__main__":
    asyncio.run(generate_sitemap())
