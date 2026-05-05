"""
JobShaman Scraper - Master Orchestrator
Run all country-specific scrapers
"""

import sys
import time
from datetime import datetime

# Import country scrapers with fallback
try:
    from .scraper_de import run_germany_scraper as run_de
    from .scraper_nordic import run_nordic_scraper as run_nordic
except ImportError:
    # Fallback to direct imports
    from scraper_multi import run_all_scrapers as run_cz
    from scraper_sk import run_slovakia_scraper as run_sk
    from scraper_pl import run_poland_scraper as run_pl
    from scraper_de import run_germany_scraper as run_de
    from scraper_nordic import run_nordic_scraper as run_nordic


def print_header(title):
    """Print formatted header"""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}\n")


def print_summary(results):
    """Print final summary"""
    print_header("📊 SCRAPING SUMMARY")
    
    total = 0
    for country, count in results.items():
        status = "✅" if count > 0 else "⚠️"
        print(f"  {status} {country}: {count} jobs")
        total += count
    
    print(f"\n  {'='*66}")
    print(f"  🎯 TOTAL: {total} jobs scraped")
    print(f"  {'='*66}\n")


def run_all_scrapers(countries=None):
    """
    Run scrapers for selected countries
    
    Args:
        countries: List of country codes (CZ, SK, PL, DE) or None for all
    
    Returns:
        dict: Results per country
    """
    if countries is None:
        countries = ['CZ', 'SK', 'PL', 'DE', 'DK', 'SE', 'NO', 'FI']
    
    # Map country codes to scraper functions
    scrapers = {
        'CZ': ('Czech Republic', run_cz),
        'SK': ('Slovakia', run_sk),
        'PL': ('Poland', run_pl),
        'DE': ('Germany + Austria', run_de),
        'DK': ('Denmark', lambda: run_nordic('dk')),
        'SE': ('Sweden', lambda: run_nordic('se')),
        'NO': ('Norway', lambda: run_nordic('no')),
        'FI': ('Finland', lambda: run_nordic('fi')),
    }
    
    results = {}
    start_time = time.time()
    
    print_header("🚀 JOBSHAMAN MULTI-COUNTRY SCRAPER")
    print(f"  Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Countries: {', '.join(countries)}")
    print()
    
    for code in countries:
        if code not in scrapers:
            print(f"⚠️ Unknown country code: {code}, skipping...")
            continue
        
        name, scraper_func = scrapers[code]
        
        print_header(f"🌍 SCRAPING: {name} ({code})")
        
        try:
            count = scraper_func()
            results[code] = count
            print(f"\n✅ {name} completed: {count} jobs\n")
        except Exception as e:
            print(f"\n❌ ERROR in {name}: {e}\n")
            import traceback
            traceback.print_exc()
            results[code] = 0
        
        # Pause between countries
        if code != countries[-1]:  # Not last country
            print(f"⏸️  Pausing 5 seconds before next country...\n")
            time.sleep(5)
    
    # Print summary
    elapsed = time.time() - start_time
    elapsed_min = int(elapsed / 60)
    elapsed_sec = int(elapsed % 60)
    
    print_summary(results)
    print(f"  ⏱️  Total time: {elapsed_min}m {elapsed_sec}s")
    print(f"  🏁 Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    return results


def run_single_country(country_code):
    """
    Run scraper for a single country
    
    Args:
        country_code: Country code (CZ, SK, PL, DE)
    
    Returns:
        int: Number of jobs scraped
    """
    return run_all_scrapers([country_code.upper()]).get(country_code.upper(), 0)


if __name__ == '__main__':
    # Check command line arguments
    if len(sys.argv) > 1:
        # Run specific countries
        countries = [c.upper() for c in sys.argv[1:]]
        print(f"Running scrapers for: {', '.join(countries)}")
        run_all_scrapers(countries)
    else:
        # Run all countries
        print("No countries specified, running ALL scrapers...")
        print("Usage: python run_all.py CZ SK PL DE")
        print("       or run without arguments for all\n")
        run_all_scrapers()
