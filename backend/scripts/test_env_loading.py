import os
from pathlib import Path
from dotenv import load_dotenv

def test_loading():
    print("--- Environment Loading Test ---")
    
    # Simulate current logic in scraper_base.py
    script_dir = Path(__file__).resolve().parent
    # In scraper_base.py: backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # For this script in backend/scripts, parent of parent is backend/
    backend_dir = script_dir.parent 
    env_path = backend_dir / ".env"
    
    print(f"Current script: {__file__}")
    print(f"Calculated backend_dir: {backend_dir}")
    print(f"Fragment of scraper_base logic (env_path): {env_path}")
    print(f"Does it exist? {env_path.exists()}")

    # Check for keys (before loading .env)
    print("\nInitial environment (from shell):")
    print(f"  SUPABASE_URL: {'✅' if os.getenv('SUPABASE_URL') else '❌'}")
    print(f"  SUPABASE_SERVICE_KEY: {'✅' if os.getenv('SUPABASE_SERVICE_KEY') else '❌'}")
    print(f"  SUPABASE_KEY: {'✅' if os.getenv('SUPABASE_KEY') else '❌'}")

    # Simulate loading
    if env_path.exists():
        print(f"\nLoading .env from: {env_path}")
        load_dotenv(dotenv_path=str(env_path))
    else:
        print("\n.env not found at calculated path, trying default load_dotenv()...")
        load_dotenv()

    # Final check
    url = os.getenv("SUPABASE_URL")
    svc_key = os.getenv("SUPABASE_SERVICE_KEY")
    pub_key = os.getenv("SUPABASE_KEY")
    
    effective_key = svc_key or pub_key
    
    print("\nAfter loading:")
    print(f"  SUPABASE_URL: {'✅' if url else '❌'}")
    print(f"  SUPABASE_SERVICE_KEY: {'✅' if svc_key else '❌'}")
    print(f"  SUPABASE_KEY: {'✅' if pub_key else '❌'}")
    print(f"  Effective key (fallback): {'✅' if effective_key else '❌'} ({'SERVICE' if svc_key else 'PUBLIC' if pub_key else 'NONE'})")

if __name__ == "__main__":
    test_loading()
