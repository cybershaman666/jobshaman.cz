"""
JobShaman Parallel Orchestrator
Runs all country scrapers concurrently to save time.
"""

import multiprocessing
import time
from datetime import datetime
import sys
import os

# Import country scrapers
try:
    from scraper_multi import run_all_scrapers as run_cz
    from scraper_sk import run_slovakia_scraper as run_sk
    from scraper_pl import run_poland_scraper as run_pl
    from scraper_de import run_germany_scraper as run_de
except ImportError:
    # Handle if run as script from parent or elsewhere
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from scraper_multi import run_all_scrapers as run_cz
    from scraper_sk import run_slovakia_scraper as run_sk
    from scraper_pl import run_poland_scraper as run_pl
    from scraper_de import run_germany_scraper as run_de

def run_scraper_process(name, func, results_dict):
    """Wrapper to run a scraper in a separate process"""
    start_time = time.time()
    print(f"\n🚀 [STARTED] {name}")
    try:
        count = func()
        results_dict[name] = count
        elapsed = time.time() - start_time
        print(f"✅ [FINISHED] {name}: {count} jobs (took {int(elapsed/60)}m {int(elapsed%60)}s)")
    except Exception as e:
        print(f"❌ [ERROR] {name}: {e}")
        import traceback
        traceback.print_exc()
        results_dict[name] = 0

def run_all_parallel():
    """Run all scrapers in parallel using multiprocessing"""
    start_time = time.time()
    
    # Manager for shared dictionary between processes
    manager = multiprocessing.Manager()
    results = manager.dict()
    
    scrapers = [
        ('Czech Republic (CZ)', run_cz),
        ('Slovakia (SK)', run_sk),
        ('Poland (PL)', run_pl),
        ('Germany + Austria (DE/AT)', run_de),
    ]
    
    processes = []
    
    print(f"\n{'='*70}")
    print(f"  JOBSHAMAN PARALLEL ORCHESTRATOR")
    print(f"  Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}")
    print(f"  Spawning {len(scrapers)} scraper processes...")
    
    for name, func in scrapers:
        p = multiprocessing.Process(target=run_scraper_process, args=(name, func, results))
        processes.append(p)
        p.start()
        # Slight staggered start to avoid connection bursts
        time.sleep(1.5)
        
    # Wait for all processes to finish
    for p in processes:
        p.join()
        
    # Final Summary Report
    elapsed_total = time.time() - start_time
    print(f"\n{'='*70}")
    print(f"  📊 PARALLEL SCRAPING SUMMARY")
    print(f"{'='*70}")
    
    total_jobs = 0
    # Use original order for report
    for name, _ in scrapers:
        count = results.get(name, 0)
        status = "✅" if count > 0 else "⚠️"
        print(f"  {status} {name:30}: {count:>5} jobs")
        total_jobs += count
        
    print(f"\n  🎯 TOTAL JOBS COLLECTED: {total_jobs}")
    print(f"  ⏱️  TOTAL ELAPSED TIME:  {int(elapsed_total/60)}m {int(elapsed_total%60)}s")
    print(f"  🏁 Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}\n")

if __name__ == '__main__':
    # On Windows, multiprocessing needs this guard. On Linux it's good practice.
    multiprocessing.freeze_support()
    run_all_parallel()
