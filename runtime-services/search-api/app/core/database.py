<<<<<<< HEAD
from supabase import create_client, Client
from .config import SUPABASE_URL, SUPABASE_KEY

def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Supabase environment variables missing!")
        return None
    try:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        return None

supabase: Client = get_supabase_client()
=======
from supabase import create_client, Client
from .config import SUPABASE_URL, SUPABASE_KEY

def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Supabase environment variables missing!")
        return None
    try:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        return None

supabase: Client = get_supabase_client()
>>>>>>> 4c20d82 (Jobshaman MVP 2.0: Clean repo, i18n Nordic expansion & engine optimization)
