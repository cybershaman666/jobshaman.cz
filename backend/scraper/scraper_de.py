"""
JobShaman Scraper - Germany + Austria (DE/AT)
Scrapes German/Austrian job portals: Stellenanzeigen.de, Karriere.at, Willhaben.at
"""

try:
    # Try relative import first (when run as module)
    # Try relative import first (when run as module)
    from .scraper_base import (
        BaseScraper, scrape_page, norm_text, extract_salary,
        detect_work_type, save_job_to_supabase, build_description,
        extract_benefits, filter_out_junk, is_low_quality
    )
except ImportError:
    # Fallback to direct import (when run as script)
    from scraper_base import (
        BaseScraper, scrape_page, norm_text, extract_salary,
        detect_work_type, save_job_to_supabase, build_description,
        extract_benefits, filter_out_junk, is_low_quality
    )


from urllib.parse import urljoin
import time
import re
import json
from bs4 import BeautifulSoup


class GermanyScraper(BaseScraper):
    """Scraper for German and Austrian job portals"""
    
    def __init__(self, supabase=None):
        super().__init__('DE', supabase)  # DE covers both Germany and Austria
    
    def scrape_page_jobs(self, soup, site_name):
        """Route to appropriate site scraper"""
        site_lower = site_name.lower()
        if 'stellenanzeigen' in site_lower:
            return self.scrape_stellenanzeigen_de(soup)
        elif 'karriere' in site_lower:
            return self.scrape_karriere_at(soup)
        elif 'willhaben' in site_lower:
            return self.scrape_willhaben_at(soup)
        else:
            print(f"⚠️ Neznámý portál: {site_name}")
            return 0
    
    def scrape_stellenanzeigen_de(self, soup):
        """Scrape Stellenanzeigen.de (accessible DE alternative)"""
        jobs_saved = 0
        
        # Extract links using robust filtering (Stellenanzeigen has job list on left)
        base_url = 'https://www.stellenanzeigen.de'

        def normalize_job_url(href):
            if not href:
                return None
            url = urljoin(base_url, href)
            # Strip query/fragment
            url = url.split('#')[0].split('?')[0]
            # Require job detail pattern with numeric ID
            if not re.search(r"/job/[^/]*\d{5,}/?$", url):
                return None
            return url

        links = set()
        # Prefer explicit job teaser links
        for a in soup.select('a.jobTeaser-hitzone, a[data-testid="qa-hitzone"], a[href*="/job/"]'):
            href = a.get('href')
            job_url = normalize_job_url(href)
            if job_url:
                links.add(job_url)

        # Fallback: scan all anchors
        if not links:
            for a in soup.find_all('a', href=True):
                href = a['href']
                if '/job/' not in href:
                    continue
                job_url = normalize_job_url(href)
                if job_url:
                    links.add(job_url)

        for url in list(links):
            if self.is_duplicate(url):
                continue
                
            try:
                print(f"    📄 Stahuji detail: {url}")
                detail_soup = scrape_page(url)
                if not detail_soup:
                    continue

                # If the detail is rendered in an iframe, load it too
                detail_iframe_soup = None
                iframe = detail_soup.select_one('iframe[data-testid="qa-job-ad-iframe"], iframe[src*="/api/jobs/iframe/"]')
                if iframe and iframe.get('src'):
                    iframe_url = urljoin(base_url, iframe.get('src'))
                    detail_iframe_soup = scrape_page(iframe_url)
                    # Sometimes iframe content embeds another iframe (jobstatic)
                    if detail_iframe_soup:
                        inner_iframe = detail_iframe_soup.select_one('iframe[src]')
                        if inner_iframe and inner_iframe.get('src'):
                            inner_src = inner_iframe.get('src')
                            if any(h in inner_src for h in ['jobstatic', 'gohiring', 'anzeigen.jobstatic.de']):
                                inner_url = urljoin(iframe_url, inner_src)
                                inner_soup = scrape_page(inner_url)
                                if inner_soup:
                                    detail_iframe_soup = inner_soup
                
                # Defaults
                title = "Neznámá pozice"
                company = "Unbekanntes Unternehmen"
                location = "Deutschland"
                salary_from, salary_to = None, None
                contract_type = "Nicht spezifiziert"
                description = "Beschreibung nicht gefunden"
                
                # 1. JSON-LD Extraction (Primary Source)
                def find_json_ld(s: BeautifulSoup):
                    scripts = s.find_all('script', type='application/ld+json')
                    for sc in scripts:
                        try:
                            data = json.loads(sc.get_text())
                            if isinstance(data, dict) and data.get('@type') == 'JobPosting':
                                return data
                            if isinstance(data, list):
                                for item in data:
                                    if item.get('@type') == 'JobPosting':
                                        return item
                        except Exception:
                            continue
                    return None

                json_ld = find_json_ld(detail_soup)
                if not json_ld and detail_iframe_soup:
                    json_ld = find_json_ld(detail_iframe_soup)
                        
                if json_ld:
                    if 'title' in json_ld: title = norm_text(json_ld['title'])
                    
                    if 'hiringOrganization' in json_ld:
                        org = json_ld['hiringOrganization']
                        if isinstance(org, dict) and 'name' in org:
                            company = norm_text(org['name'])
                        elif isinstance(org, str):
                            company = norm_text(org)
                            
                    if 'jobLocation' in json_ld:
                        loc = json_ld['jobLocation']
                        if isinstance(loc, list) and len(loc) > 0: loc = loc[0]
                        if isinstance(loc, dict) and 'address' in loc:
                            addr = loc['address']
                            if isinstance(addr, dict):
                                city = addr.get('addressLocality')
                                region = addr.get('addressRegion')
                                if city: location = city
                                elif region: location = region
                                
                    if 'baseSalary' in json_ld:
                        try:
                            bs = json_ld['baseSalary']
                            if isinstance(bs, dict):
                                val = bs.get('value', {})
                                if isinstance(val, dict):
                                    # Check for annual salary
                                    is_annual = val.get('unitText') == 'YEAR'
                                    
                                    if 'minValue' in val and val['minValue']: 
                                        salary_from = float(val['minValue'])
                                        if is_annual and salary_from > 5000: salary_from = int(salary_from / 12)
                                        else: salary_from = int(salary_from)
                                        
                                    if 'maxValue' in val and val['maxValue']: 
                                        salary_to = float(val['maxValue'])
                                        if is_annual and salary_to > 5000: salary_to = int(salary_to / 12)
                                        else: salary_to = int(salary_to)
                        except: pass
                        
                    if 'employmentType' in json_ld:
                         ct = json_ld['employmentType']
                         if isinstance(ct, str): contract_type = ct
                         elif isinstance(ct, list): contract_type = ", ".join(ct)
                    
                    if 'description' in json_ld and json_ld['description']:
                        desc_html = json_ld['description']
                        # Clean HTML to text
                        desc_soup = BeautifulSoup(desc_html, 'html.parser')
                        # Extract structured text
                        parts = []
                        for elem in desc_soup.find_all(['p', 'li', 'h2', 'h3', 'div']):
                            txt = norm_text(elem.get_text())
                            if len(txt) > 2:
                                if elem.name == 'li': parts.append(f"- {txt}")
                                elif elem.name in ['h2', 'h3']: parts.append(f"\n### {txt}")
                                else: parts.append(txt)
                        description = "\n\n".join(parts) if parts else norm_text(desc_soup.get_text())
                        description = filter_out_junk(description)

                # 2. Fallbacks for Metadata
                if title == "Neznámá pozice":
                    h1 = detail_soup.find("h1")
                    if h1: title = norm_text(h1.get_text())
                    
                if company == "Unbekanntes Unternehmen":
                    comp_el = detail_soup.select_one('[data-testid="header-company-name"], .company-name')
                    if comp_el: company = norm_text(comp_el.get_text())
                
                if location == "Deutschland":
                    loc_el = detail_soup.select_one('[data-testid="job-location"], .job-location')
                    if loc_el: location = norm_text(loc_el.get_text())

                # Description Extraction (Fallback)
                def is_desc_weak(desc: str) -> bool:
                    if not desc:
                        return True
                    if desc in ["Beschreibung nicht gefunden", "Popis není dostupný"]:
                        return True
                    return len(desc) < 80

                if is_desc_weak(description):
                    # Stellenanzeigen uses dynamic classes (sc-...) so we search for content container
                    # First try structured extraction from iframe content
                    if detail_iframe_soup:
                        description = build_description(detail_iframe_soup, {
                            'paragraphs': [
                                '.job-ad p', '.job-ad-details p', '.job-description p', '.jobdetail p',
                                'article p', 'main p', 'section p', 'div p'
                            ],
                            'lists': [
                                '.job-ad ul', '.job-ad-details ul', '.job-description ul', '.jobdetail ul',
                                'article ul', 'main ul', 'section ul', 'div ul'
                            ]
                        })
                    
                if is_desc_weak(description):
                    # Then try structured extraction from main detail page
                    description = build_description(detail_soup, {
                        'paragraphs': [
                            '.job-ad p', '.job-ad-details p', '.job-description p', '.jobdetail p',
                            'article p', 'main p', 'section p'
                        ],
                        'lists': [
                            '.job-ad ul', '.job-ad-details ul', '.job-description ul', '.jobdetail ul',
                            'article ul', 'main ul', 'section ul'
                        ]
                    })

                if is_desc_weak(description):
                    
                    # Heuristic: Find div with significant text 
                    main_content = None
                    candidates = []
                    # Limit search to likely containers to speed up
                    container_candidates = detail_soup.select('div[class*="content"], div[class*="job"], main, article, .sc-bdnylx') 
                    if not container_candidates:
                        container_candidates = detail_soup.body.find_all('div')
                        
                    for div in container_candidates:
                        txt = div.get_text(strip=True)
                        if len(txt) < 300: continue
                        links_in_div = len(div.find_all('a'))
                        if links_in_div > 10: continue # Likely nav/footer
                        
                        score = len(txt)
                        candidates.append((div, score))
                    
                    candidates.sort(key=lambda x: x[1], reverse=True)
                    if candidates:
                        main_content = candidates[0][0]
                        
                    if main_content:
                        parts = []
                        for elem in main_content.find_all(['p', 'li', 'h2', 'h3']):
                            txt = norm_text(elem.get_text())
                            if len(txt) > 2:
                                if elem.name == 'li': parts.append(f"- {txt}")
                                elif elem.name in ['h2', 'h3']: parts.append(f"\n### {txt}")
                                else: parts.append(txt)
                        
                        if parts:
                            description = filter_out_junk("\n\n".join(parts))
                        else:
                            description = filter_out_junk(norm_text(main_content.get_text()))

                # Salary Fallback (if not in JSON)
                if not salary_from:
                    # Look in text for "€" or "Euro"
                    salary_source = detail_iframe_soup or detail_soup
                    sal_text = salary_source.find(lambda tag: tag.name == "div" and ("€" in tag.get_text() or "Euro" in tag.get_text()) and len(tag.get_text()) < 50)
                    if sal_text:
                        salary_from, salary_to, _ = extract_salary(sal_text.get_text(), currency='EUR')
                
                # Sanity check for annual salary in fallback
                if salary_from and salary_from > 12000:
                    salary_from = int(salary_from / 12)
                if salary_to and salary_to > 12000:
                    salary_to = int(salary_to / 12)

                # Contract type Fallback
                if contract_type == "Nicht spezifiziert":
                    if "vollzeit" in description.lower(): contract_type = "Vollzeit"
                    elif "teilzeit" in description.lower(): contract_type = "Teilzeit"
                
                # Work type
                work_type = detect_work_type(title, description, location)
                work_model = self._detect_work_model_de(detail_soup.get_text(" "))
                
                # Benefits
                benefits = self._extract_benefits_from_text(description)
                
                # Explicit DE Country Code
                country_code = 'de'

                job_data = {
                    'title': title,
                    'url': url,
                    'company': company,
                    'location': location,
                    'description': description,
                    'benefits': benefits,
                    'contract_type': contract_type,
                    'work_type': work_type,
                    'salary_from': salary_from,
                    'salary_to': salary_to,
                    'country_code': country_code,
                    'salary_currency': 'EUR'
                }
                
                if is_low_quality(job_data):
                    print(f"       ⚠️ Nízká kvalita, přeskakuji.")
                    continue

                if save_job_to_supabase(self.supabase, job_data):
                    jobs_saved += 1
                
                time.sleep(0.5)

            except Exception as e:
                print(f"       ❌ Chyba detailu {url}: {e}")
                continue
        
        return jobs_saved
    
    def scrape_karriere_at(self, soup):
        """Scrape Karriere.at (Austrian job portal)"""
        jobs_saved = 0
        
        # Parse listing items for richer fallbacks
        listing_fallbacks = {}
        listing_items = soup.select('ol.m-jobsList > li.m-jobsList__item')
        for li in listing_items:
            if 'm-jobsList__contentAd' in (li.get('class') or []):
                continue
            link_el = li.select_one('a.m-jobsListItem__titleLink')
            if not link_el:
                continue
            url = urljoin('https://www.karriere.at', link_el.get('href', ''))
            if not url or 'karriere.at' not in url:
                continue

            title = norm_text(link_el.get_text())
            company_el = li.select_one('.m-jobsListItem__companyName')
            company = norm_text(company_el.get_text()) if company_el else None

            locations = [norm_text(l.get_text()) for l in li.select('.m-jobsListItem__location') if norm_text(l.get_text())]
            location = ", ".join(locations) if locations else None

            pills = [norm_text(p.get_text()) for p in li.select('.m-jobsListItem__pill') if norm_text(p.get_text())]
            pills_text = " | ".join(pills).lower()

            contract_type = None
            for ct in ["vollzeit", "teilzeit", "geringfügig", "praktika", "lehre", "freelancer", "projektarbeit"]:
                if ct in pills_text:
                    # Preserve original casing if possible
                    for p in pills:
                        if ct in p.lower():
                            contract_type = p
                            break
                    if contract_type:
                        break

            work_model = None
            if "homeoffice" in pills_text or "remote" in pills_text:
                work_model = "hybrid"

            salary_from, salary_to, salary_timeframe = None, None, None
            for p in pills:
                if "€" in p or "eur" in p.lower():
                    salary_from, salary_to, _ = extract_salary(p, currency='EUR')
                    salary_timeframe = self._detect_salary_timeframe_de(p)
                    break

            working_time = self._detect_working_time_de(contract_type) if contract_type else None

            listing_fallbacks[url] = {
                'title': title,
                'company': company,
                'location': location,
                'contract_type': contract_type,
                'working_time': working_time,
                'work_model': work_model,
                'salary_from': salary_from,
                'salary_to': salary_to,
                'salary_timeframe': salary_timeframe,
            }

        # Link selector from inspection: m-jobsListItem__titleLink
        job_links = [li.select_one('a.m-jobsListItem__titleLink') for li in listing_items if li.select_one('a.m-jobsListItem__titleLink')]
        job_links = [l for l in job_links if l]

        # Fallback: collect links that look like job detail pages
        if not job_links:
            job_links = []
            for a in soup.find_all('a', href=True):
                href = a['href']
                if '/jobs/' in href and 'karriere.at' in urljoin('https://www.karriere.at', href):
                    # Skip listing/search pages
                    if '/jobs?' in href or href.endswith('/jobs'):
                        continue
                    job_links.append(a)
        
        for link_el in job_links:
            try:
                url = urljoin('https://www.karriere.at', link_el.get('href', ''))
                
                if not url or 'karriere.at' not in url:
                    continue

                # Skip duplicates early
                if self.is_duplicate(url):
                    continue

                fallback = listing_fallbacks.get(url, {})
                title = fallback.get('title') or norm_text(link_el.get_text())
                
                print(f"    📄 Stahuji detail: {title}")
                
                # Fetch detail
                detail_soup = scrape_page(url)
                if not detail_soup:
                    continue
                
                # Defaults
                company = fallback.get('company') or "Unbekanntes Unternehmen"
                location = fallback.get('location') or "Österreich"
                salary_timeframe = fallback.get('salary_timeframe')
                
                # 1. Try JSON-LD first (Highest Accuracy)
                json_ld = None
                scripts = detail_soup.find_all('script', type='application/ld+json')
                for s in scripts:
                    try:
                        data = json.loads(s.get_text())
                        # Check if it's JobPosting
                        if data.get('@type') == 'JobPosting':
                            json_ld = data
                            break
                        # Sometimes it's a list
                        if isinstance(data, list):
                            for item in data:
                                if item.get('@type') == 'JobPosting':
                                    json_ld = item
                                    break
                    except:
                        continue
                
                if json_ld:
                    # Extract from JSON-LD
                    if 'title' in json_ld: title = norm_text(json_ld['title'])
                    
                    if 'hiringOrganization' in json_ld:
                        org = json_ld['hiringOrganization']
                        if isinstance(org, dict) and 'name' in org:
                            company = norm_text(org['name'])
                        elif isinstance(org, str):
                            company = norm_text(org)
                            
                    if 'jobLocation' in json_ld:
                        loc = json_ld['jobLocation']
                        # Handle list of locations
                        if isinstance(loc, list) and len(loc) > 0: loc = loc[0]
                        
                        if isinstance(loc, dict) and 'address' in loc:
                            addr = loc['address']
                            if isinstance(addr, dict):
                                city = addr.get('addressLocality')
                                region = addr.get('addressRegion')
                                if city: location = city
                                elif region: location = region
                
                # 2. Fallback to selectors if not found in JSON
                if company == "Unbekanntes Unternehmen":
                    comp_el = detail_soup.select_one('.m-jobContent__companyName, .m-companyHeader__name, .company-name')
                    if comp_el: company = norm_text(comp_el.get_text())
                
                if location == "Österreich":
                    loc_el = detail_soup.select_one('.m-jobContent__jobLocation, .m-jobHeader__location')
                    if loc_el: location = norm_text(loc_el.get_text())
                
                # Description - Enhanced extraction with multiple fallbacks
                description = "Beschreibung nicht gefunden"
                
                # Try JSON-LD description first
                if json_ld and 'description' in json_ld and json_ld['description']:
                    try:
                        desc_html = json_ld['description']
                        desc_soup = BeautifulSoup(desc_html, 'html.parser')
                        parts = []
                        for elem in desc_soup.find_all(['p', 'li', 'h2', 'h3']):
                            txt = norm_text(elem.get_text())
                            if len(txt) > 2:
                                if elem.name == 'li': parts.append(f"- {txt}")
                                elif elem.name in ['h2', 'h3']: parts.append(f"\n### {txt}")
                                else: parts.append(txt)
                        if parts:
                            description = filter_out_junk("\n\n".join(parts))
                    except:
                        pass
                
                # Fallback to CSS selectors if not in JSON-LD
                if description == "Beschreibung nicht gefunden" or len(description) < 100:
                    description = build_description(detail_soup, {
                        'paragraphs': ['.m-jobContent__jobText p', '.m-jobContent__jobDetail p', '.content p', '.job-description p', 'main p', 'article p'],
                        'lists': ['.m-jobContent__jobText ul', '.m-jobContent__jobDetail ul', '.content ul', '.job-description ul', 'main ul', 'article ul']
                    })

                # Karriere.at sometimes embeds full HTML in srcdoc; parse it if present
                if description == "Beschreibung nicht gefunden" or len(description) < 100:
                    iframe = detail_soup.select_one('iframe.m-jobContent__iFrame--job')
                    if iframe and iframe.has_attr('srcdoc'):
                        try:
                            srcdoc = iframe['srcdoc']
                            src_soup = BeautifulSoup(srcdoc, 'html.parser')
                            description = build_description(src_soup, {
                                'paragraphs': ['.main-content p', '.job p', 'p'],
                                'lists': ['.main-content ul', '.job ul', 'ul']
                            })
                            if description == "Beschreibung nicht gefunden" or len(description) < 100:
                                description = filter_out_junk(norm_text(src_soup.get_text(" ")))
                        except Exception:
                            pass

                # Last resort: find largest text container
                if description == "Beschreibung nicht gefunden" or len(description) < 100:
                    candidates = []
                    for div in detail_soup.find_all(['div', 'main', 'article']):
                        txt = div.get_text(strip=True)
                        if 150 < len(txt) < 10000:  # Reasonable size
                            score = len(txt)
                            candidates.append((div, score))
                    
                    if candidates:
                        candidates.sort(key=lambda x: x[1], reverse=True)
                        best_div = candidates[0][0]
                        parts = []
                        for elem in best_div.find_all(['p', 'li', 'h2', 'h3']):
                            txt = norm_text(elem.get_text())
                            if len(txt) > 2:
                                if elem.name == 'li': parts.append(f"- {txt}")
                                elif elem.name in ['h2', 'h3']: parts.append(f"\n### {txt}")
                                else: parts.append(txt)
                        if parts:
                            description = filter_out_junk("\n\n".join(parts))
                        else:
                            description = filter_out_junk(norm_text(best_div.get_text()))
                
                # Benefits (Karriere.at has separate sections; avoid mixing requirements/salary)
                benefits = []
                try:
                    benefit_keywords = [
                        'benefit', 'benefits', 'wir bieten', 'unser angebot', 'angebot',
                        'vorteile', 'was wir bieten', 'das bieten wir', 'zusatzleistungen', 'leistungen'
                    ]
                    ignore_patterns = [
                        r'(gehalt|entgelt|verdienst|€|eur|brutto|monatsgehalt|jahresgehalt|salary|bezahlung|lohn)',
                        r'(anforder|profil|voraussetzung|qualifikation|aufgaben|tätigkeit|verantwortung|was sie mitbringen|ihr profil|ihre aufgaben|dein profil|deine aufgaben)'
                    ]

                    def is_benefit_line(text: str) -> bool:
                        t = text.lower().strip()
                        if not t or len(t) < 2:
                            return False
                        if len(t) > 200:
                            return False
                        for pat in ignore_patterns:
                            if re.search(pat, t):
                                return False
                        return True

                    # First: explicit benefits containers
                    benefits = extract_benefits(detail_soup, ['.m-benefits__list li', '.benefits-list li', '.benefits li'])

                    # If still empty, try to find a "benefits" section by heading
                    if not benefits:
                        for heading in detail_soup.find_all(['h2', 'h3', 'h4']):
                            htxt = norm_text(heading.get_text()).lower()
                            if any(k in htxt for k in benefit_keywords):
                                # Collect list items until next heading
                                items = []
                                for sib in heading.find_all_next():
                                    if sib.name in ['h2', 'h3', 'h4']:
                                        break
                                    for li in sib.find_all('li'):
                                        txt = norm_text(li.get_text())
                                        if is_benefit_line(txt):
                                            items.append(txt)
                                if items:
                                    benefits.extend(items)
                                    break

                    # Final cleanup
                    benefits = [b for b in benefits if is_benefit_line(b)]
                except Exception:
                    benefits = []

                if not benefits:
                    benefits = ["Nicht spezifiziert"]
                
                # Salary
                salary_from = fallback.get('salary_from')
                salary_to = fallback.get('salary_to')
                job_level = None
                
                # JSON-LD might have salary
                if json_ld and 'baseSalary' in json_ld:
                    try:
                        bs = json_ld['baseSalary']
                        val = bs.get('value', {})
                        if 'minValue' in val: salary_from = int(val['minValue'])
                        if 'maxValue' in val: salary_to = int(val['maxValue'])
                        unit_text = val.get('unitText') or val.get('valueUnitText') or bs.get('unitText')
                        if unit_text:
                            salary_timeframe = self._detect_salary_timeframe_de(unit_text)
                    except: pass

                if not salary_from:
                    sal_el = detail_soup.select_one('.m-salary__amount, .m-salary')
                    if sal_el:
                        salary_from, salary_to, _ = extract_salary(sal_el.get_text(), currency='EUR')
                        salary_timeframe = salary_timeframe or self._detect_salary_timeframe_de(sal_el.get_text())

                # Keyfact boxes in detail view
                keyfact_salary = detail_soup.select_one('.m-keyfactBox__jobSalaryRange, .m-mobileKeyfactBox__keyfactBoxItemInner')
                if keyfact_salary and (not salary_from or not salary_timeframe):
                    txt = norm_text(keyfact_salary.get_text())
                    if "€" in txt or "eur" in txt.lower():
                        salary_from, salary_to, _ = extract_salary(txt, currency='EUR')
                        salary_timeframe = salary_timeframe or self._detect_salary_timeframe_de(txt)

                keyfact_level = detail_soup.select_one('.m-keyfactBox__jobLevel')
                if keyfact_level:
                    job_level = self._map_job_level_de(norm_text(keyfact_level.get_text()))
                
                # Contract type
                contract_type = fallback.get('contract_type') or "Nicht spezifiziert"
                if json_ld and 'employmentType' in json_ld:
                     ct = json_ld['employmentType']
                     if isinstance(ct, str): contract_type = ct
                     elif isinstance(ct, list): contract_type = ", ".join(ct)
                elif "Vollzeit" in detail_soup.get_text(): contract_type = "Vollzeit"
                elif "Teilzeit" in detail_soup.get_text(): contract_type = "Teilzeit"

                working_time = fallback.get('working_time') or self._detect_working_time_de(contract_type)
                work_model = fallback.get('work_model') or self._detect_work_model_de(detail_soup.get_text(" "))
                
                # Work type
                work_type = detect_work_type(title, description, location)
                
                # Explicitly set country code for Austria
                country_code = 'at'
                
                job_data = {
                    'title': title,
                    'url': url,
                    'company': company,
                    'location': location,
                    'description': description,
                    'benefits': benefits,
                    'contract_type': contract_type,
                    'work_type': work_type,
                    'salary_from': salary_from,
                    'salary_to': salary_to,
                    'salary_min': salary_from,
                    'salary_max': salary_to,
                    'salary_timeframe': salary_timeframe,
                    'working_time': working_time,
                    'work_model': work_model,
                    'job_level': job_level,
                    'country_code': country_code, # Force AT
                    'salary_currency': 'EUR'
                }
                
                if is_low_quality(job_data):
                    print(f"       ⚠️ Nízká kvalita, přeskakuji.")
                    continue

                if save_job_to_supabase(self.supabase, job_data):
                    jobs_saved += 1
                
                time.sleep(0.3)
                
            except Exception as e:
                print(f"       ❌ Chyba: {e}")
                continue
        
        return jobs_saved

    def _detect_salary_timeframe_de(self, text: str):
        if not text:
            return None
        low = text.lower()
        if any(tok in low for tok in ["stunde", "std", "hour", "/h"]):
            return "hour"
        if any(tok in low for tok in ["tag", "täglich", "daily", "/tag"]):
            return "day"
        if any(tok in low for tok in ["woche", "weekly", "/woche"]):
            return "week"
        if any(tok in low for tok in ["monat", "monatlich", "month", "/monat"]):
            return "month"
        if any(tok in low for tok in ["jahr", "jähr", "year", "/jahr"]):
            return "year"
        return None

    def _detect_working_time_de(self, contract_type: str):
        if not contract_type:
            return None
        low = contract_type.lower()
        if "vollzeit" in low:
            return "full_time"
        if "teilzeit" in low:
            return "part_time"
        if "geringfügig" in low:
            return "mini_job"
        if "praktika" in low or "praktikum" in low:
            return "internship"
        if "lehre" in low:
            return "apprenticeship"
        if "freelancer" in low or "projektarbeit" in low:
            return "contract"
        return None

    def _detect_work_model_de(self, text: str):
        if not text:
            return None
        low = text.lower()
        if "homeoffice" in low or "home office" in low:
            return "hybrid"
        if "remote" in low or "fernarbeit" in low:
            return "remote"
        if "vor ort" in low or "on-site" in low:
            return "onsite"
        return None

    def _map_job_level_de(self, text: str):
        if not text:
            return None
        low = text.lower()
        if any(tok in low for tok in ["praktika", "praktikum"]):
            return "internship"
        if "lehre" in low:
            return "apprenticeship"
        if any(tok in low for tok in ["diplomarbeit", "dissertation"]):
            return "student"
        if "berufseinstieg" in low:
            return "junior"
        if "berufserfahrung" in low:
            return "mid"
        if "projekt" in low or "bereichsleitung" in low or "führung" in low:
            return "lead"
        if "unternehmensführung" in low:
            return "executive"
        if "selbst" in low:
            return "self_employed"
        return None

    def scrape_willhaben_at(self, soup):
        """Scrape Willhaben.at (Austrian job portal)"""
        jobs_saved = 0

        def _clean_url(raw_url: str) -> str:
            if not raw_url:
                return ""
            return raw_url.split("#")[0].split("?")[0]

        def _map_employment_type(raw_val: str) -> str:
            if not raw_val:
                return "Nicht spezifiziert"
            val = str(raw_val).strip().lower()
            if val in ["full_time", "vollzeit"]:
                return "Vollzeit"
            if val in ["part_time", "teilzeit", "geringfuegig", "geringfügig"]:
                return "Teilzeit"
            return str(raw_val)

        def _collect_urls(obj, out):
            if isinstance(obj, dict):
                url = obj.get("url")
                if isinstance(url, str) and "/jobs/job/" in url:
                    out.add(url)
                for v in obj.values():
                    _collect_urls(v, out)
            elif isinstance(obj, list):
                for v in obj:
                    _collect_urls(v, out)
            elif isinstance(obj, str):
                if "/jobs/job/" in obj:
                    out.add(obj)

        links = set()

        # 1) Try JSON-LD ItemList/JobPosting URLs
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.get_text())
            except Exception:
                continue
            _collect_urls(data, links)

        # 2) Try __NEXT_DATA__ (listing pages often store URLs there)
        if not links:
            next_script = soup.select_one("#__NEXT_DATA__")
            if next_script:
                try:
                    next_json = json.loads(next_script.get_text())
                    _collect_urls(next_json, links)
                except Exception:
                    pass

        # 2) Fallback: anchor tags
        if not links:
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "/jobs/job/" in href:
                    full = urljoin("https://www.willhaben.at", href)
                    if "willhaben.at" in full:
                        links.add(full)

        links = {_clean_url(u) for u in links if u}

        for url in links:
            if self.is_duplicate(url):
                continue

            try:
                print(f"    📄 Stahuji detail: {url}")
                detail_soup = scrape_page(url)
                if not detail_soup:
                    continue

                title = "Unbekannte Position"
                company = "Unbekanntes Unternehmen"
                location = "Österreich"
                description = "Beschreibung nicht gefunden"
                contract_type = "Nicht spezifiziert"
                salary_from, salary_to = None, None
                next_data = None

                # JSON-LD (primary)
                json_ld = None
                for s in detail_soup.find_all("script", type="application/ld+json"):
                    try:
                        data = json.loads(s.get_text())
                        if isinstance(data, list):
                            for item in data:
                                if isinstance(item, dict) and item.get("@type") == "JobPosting":
                                    json_ld = item
                                    break
                        elif isinstance(data, dict) and data.get("@type") == "JobPosting":
                            json_ld = data
                    except Exception:
                        continue
                    if json_ld:
                        break

                # __NEXT_DATA__ (rich data source on willhaben)
                next_script = detail_soup.select_one("#__NEXT_DATA__")
                if next_script:
                    try:
                        next_json = json.loads(next_script.get_text())
                        next_data = (
                            next_json
                            .get("props", {})
                            .get("pageProps", {})
                            .get("jobAdvertDetailsRoot", {})
                            .get("data", {})
                        )
                    except Exception:
                        next_data = None

                if next_data:
                    if next_data.get("title"):
                        title = norm_text(next_data["title"])
                    if next_data.get("company", {}).get("title"):
                        company = norm_text(next_data["company"]["title"])
                    if next_data.get("jobLocations"):
                        loc = next_data["jobLocations"][0]
                        if isinstance(loc, dict) and loc.get("name"):
                            location = norm_text(loc["name"])
                    if next_data.get("description"):
                        description = filter_out_junk(next_data["description"])
                    if next_data.get("employmentModes"):
                        contract_type = _map_employment_type(next_data["employmentModes"][0])
                    if next_data.get("salary"):
                        try:
                            salary_from = int(round(float(next_data["salary"])))
                        except Exception:
                            pass

                if json_ld:
                    if json_ld.get("title"):
                        title = norm_text(json_ld["title"])

                    org = json_ld.get("hiringOrganization")
                    if isinstance(org, dict) and org.get("name"):
                        company = norm_text(org["name"])
                    elif isinstance(org, str):
                        company = norm_text(org)

                    loc = json_ld.get("jobLocation")
                    if isinstance(loc, list) and loc:
                        loc = loc[0]
                    if isinstance(loc, dict) and loc.get("address"):
                        addr = loc["address"]
                        if isinstance(addr, dict):
                            city = addr.get("addressLocality")
                            region = addr.get("addressRegion")
                            if city:
                                location = city
                            elif region:
                                location = region

                    if json_ld.get("employmentType"):
                        ct = json_ld["employmentType"]
                        if isinstance(ct, str):
                            contract_type = _map_employment_type(ct)
                        elif isinstance(ct, list):
                            mapped = [_map_employment_type(x) for x in ct if x]
                            contract_type = ", ".join([m for m in mapped if m])

                    if json_ld.get("description"):
                        desc_html = json_ld["description"]
                        desc_soup = BeautifulSoup(desc_html, "html.parser")
                        parts = []
                        for elem in desc_soup.find_all(["p", "li", "h2", "h3", "div"]):
                            txt = norm_text(elem.get_text())
                            if len(txt) > 2:
                                if elem.name == "li":
                                    parts.append(f"- {txt}")
                                elif elem.name in ["h2", "h3"]:
                                    parts.append(f"\n### {txt}")
                                else:
                                    parts.append(txt)
                        if parts:
                            description = filter_out_junk("\n\n".join(parts))
                        else:
                            description = filter_out_junk(norm_text(desc_soup.get_text()))

                    # Salary in JSON-LD
                    bs = json_ld.get("baseSalary") or json_ld.get("estimatedSalary")
                    if isinstance(bs, dict):
                        val = bs.get("value", {})
                        if isinstance(val, dict):
                            if val.get("minValue"):
                                salary_from = int(float(val["minValue"]))
                            if val.get("maxValue"):
                                salary_to = int(float(val["maxValue"]))

                # Fallbacks
                if title == "Unbekannte Position":
                    h1 = detail_soup.find("h1")
                    if h1:
                        title = norm_text(h1.get_text())

                if company == "Unbekanntes Unternehmen":
                    comp_el = detail_soup.select_one("[data-testid*='company'], .company-name, .company")
                    if comp_el:
                        company = norm_text(comp_el.get_text())

                if location == "Österreich":
                    loc_el = detail_soup.select_one("[data-testid*='employment-locations'], [data-testid*='location'], .job-location, .location")
                    if loc_el:
                        location = norm_text(loc_el.get_text())

                if description == "Beschreibung nicht gefunden" or len(description) < 100:
                    description = build_description(
                        detail_soup,
                        {
                            "paragraphs": [
                                "[data-testid*='description'] p",
                                ".job-description p",
                                ".description p",
                                "main p",
                                "article p"
                            ],
                            "lists": [
                                "[data-testid*='description'] ul",
                                ".job-description ul",
                                ".description ul",
                                "main ul",
                                "article ul"
                            ]
                        }
                    )

                if description == "Beschreibung nicht gefunden" or len(description) < 100:
                    candidates = []
                    for div in detail_soup.find_all(["div", "main", "article", "section"]):
                        txt = div.get_text(strip=True)
                        if 200 < len(txt) < 15000:
                            candidates.append((div, len(txt)))
                    if candidates:
                        candidates.sort(key=lambda x: x[1], reverse=True)
                        best_div = candidates[0][0]
                        parts = []
                        for elem in best_div.find_all(["p", "li", "h2", "h3"]):
                            txt = norm_text(elem.get_text())
                            if len(txt) > 2:
                                if elem.name == "li":
                                    parts.append(f"- {txt}")
                                elif elem.name in ["h2", "h3"]:
                                    parts.append(f"\n### {txt}")
                                else:
                                    parts.append(txt)
                        if parts:
                            description = filter_out_junk("\n\n".join(parts))
                        else:
                            description = filter_out_junk(norm_text(best_div.get_text()))

                # Salary fallback if missing
                if not salary_from:
                    sal_el = detail_soup.select_one("[data-testid*='employment-salary']")
                    if not sal_el:
                        sal_el = detail_soup.find(
                            lambda tag: tag.name in ["div", "span", "p"]
                            and ("€" in tag.get_text() or "EUR" in tag.get_text())
                            and len(tag.get_text()) < 120
                        )
                    if sal_el:
                        salary_from, salary_to, _ = extract_salary(sal_el.get_text(), currency="EUR")

                # Contract type fallback
                if contract_type == "Nicht spezifiziert":
                    text_all = detail_soup.get_text(" ").lower()
                    if "vollzeit" in text_all:
                        contract_type = "Vollzeit"
                    elif "teilzeit" in text_all or "geringfügig" in text_all:
                        contract_type = "Teilzeit"

                work_type = detect_work_type(title, description, location)

                benefits = extract_benefits(detail_soup, [
                    "[data-testid*='benefit'] li",
                    ".benefits li",
                    ".benefits-list li",
                    ".job-benefits li"
                ])
                if not benefits:
                    benefits = self._extract_benefits_from_text(description)
                if not benefits:
                    benefits = ["Nicht spezifiziert"]

                job_data = {
                    "title": title,
                    "url": url,
                    "company": company,
                    "location": location,
                    "description": description,
                    "benefits": benefits,
                    "contract_type": contract_type,
                    "work_type": work_type,
                    "work_model": work_model,
                    "salary_from": salary_from,
                    "salary_to": salary_to,
                    "country_code": "at",
                    "salary_currency": "EUR",
                }

                if is_low_quality(job_data):
                    print(f"       ⚠️ Nízká kvalita, přeskakuji.")
                    continue

                if save_job_to_supabase(self.supabase, job_data):
                    jobs_saved += 1

                time.sleep(0.4)

            except Exception as e:
                print(f"       ❌ Chyba detailu {url}: {e}")
                continue

        return jobs_saved
    
    def _extract_benefits_from_text(self, text):
        """Extract benefits from description text (German keywords)"""
        benefits = []
        keywords = {
            'Home Office': r'home\s*office|remote|fernarbeit',
            'Flexible Arbeitszeiten': r'flexible?\s*arbeitszeiten|gleitzeit',
            'Weiterbildung': r'weiterbildung|schulung|training',
            '30 Tage Urlaub': r'30\s*tage\s*urlaub|6\s*wochen',
            'Betriebliche Altersvorsorge': r'betriebliche\s*altersvorsorge|pension',
            'Firmenfahrzeug': r'firmenfahrzeug|dienstwagen|firmenwagen',
            'Gym-Mitgliedschaft': r'fitnessstudio|gym|sportangebot',
            'Mitarbeiterrabatte': r'mitarbeiterrabatt|corporate\s*benefits',
        }
        
        text_lower = text.lower()
        for benefit, pattern in keywords.items():
            if re.search(pattern, text_lower):
                benefits.append(benefit)
        
        return benefits


def run_germany_scraper():
    """Main function to run Germany/Austria scraper"""
    scraper = GermanyScraper()
    
    websites = [
        {
            'name': 'Stellenanzeigen.de',
            # Full market (no keyword filter)
            'base_url': 'https://www.stellenanzeigen.de/suche/?q=',
            'max_pages': 50
        },
        {
            'name': 'Karriere.at',
            # Full market listing
            'base_url': 'https://www.karriere.at/jobs?focusResults=true&page={page}',
            'max_pages': 50
        },
        {
            'name': 'Willhaben.at',
            # Full market listing
            'base_url': 'https://www.willhaben.at/jobs/suche',
            'max_pages': 50
        }
    ]
    
    return scraper.run(websites)


if __name__ == '__main__':
    run_germany_scraper()
