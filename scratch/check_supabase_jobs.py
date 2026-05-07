import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("❌ Supabase config missing.")
    exit(1)

supabase = create_client(url, key)

try:
    # Fetch one row to see columns
    resp = supabase.table("jobs").select("*").limit(1).execute()
    if resp.data:
        print(f"✅ Table 'jobs' columns: {list(resp.data[0].keys())}")
    else:
        print("ℹ️ Table 'jobs' is empty.")
except Exception as e:
    print(f"❌ Error checking table 'jobs': {e}")
