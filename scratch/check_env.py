import os
from dotenv import load_dotenv

# Path logic from main.py
_here = os.path.dirname(os.path.abspath(__file__))
# Note: we are in scratch/, so backend is at ../backend/
backend_env = os.path.join(_here, "../backend/.env")
root_env = os.path.join(_here, "../.env")

print(f"Checking {backend_env} exists: {os.path.exists(backend_env)}")
print(f"Checking {root_env} exists: {os.path.exists(root_env)}")

load_dotenv(backend_env)
load_dotenv(root_env)

keys = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_JWT_SECRET",
    "DATABASE_URL",
    "EXTERNAL_POSTGRES_URI"
]

for k in keys:
    val = os.environ.get(k)
    if val:
        mask = val[:10] + "..." if len(val) > 10 else "***"
        print(f"{k}: {mask} (len={len(val)})")
    else:
        print(f"{k}: MISSING")
