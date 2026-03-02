import os
import sys
from pathlib import Path

# Add backend to path so we can import scraper modules
backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

def verify_scrapers():
    print("=== Scraper Environment Verification ===")
    
    # 1. Test scraper_base
    print("\n--- Testing scraper_base.py ---")
    import scraper.scraper_base as base
    print(f"Base SUPABASE_URL: {'✅' if base.SUPABASE_URL else '❌'}")
    print(f"Base SUPABASE_SERVICE_KEY: {'✅' if base.SUPABASE_SERVICE_KEY else '❌'}")
    
    # 2. Test scraper_multi
    print("\n--- Testing scraper_multi.py ---")
    import scraper.scraper_multi as multi
    print(f"Multi SUPABASE_URL: {'✅' if multi.SUPABASE_URL else '❌'}")
    print(f"Multi SUPABASE_SERVICE_KEY: {'✅' if multi.SUPABASE_SERVICE_KEY else '❌'}")

    # Check for client initialization (optional, might fail if no internet but helps check if keys were accepted)
    try:
        from scraper.scraper_base import init_supabase
        client = init_supabase()
        print(f"\nSupabase Client Initialized: {'✅' if client else '❌'}")
    except Exception as e:
        print(f"\nSupabase Client Init Error (expected if keys are invalid): {e}")

if __name__ == "__main__":
    verify_scrapers()
