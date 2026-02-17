import os
from dotenv import load_dotenv

load_dotenv()

# Required runtime configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_KEY"))

SECRET_KEY = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY"))
if not SECRET_KEY:
    raise RuntimeError("Missing SECRET_KEY/JWT_SECRET environment variable")

CSRF_TOKEN_EXPIRY = int(os.getenv("CSRF_TOKEN_EXPIRY", "3600"))
