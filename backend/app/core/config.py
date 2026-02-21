import os
from dotenv import load_dotenv

load_dotenv()

# API Base URL
API_BASE_URL = os.getenv("API_BASE_URL", "https://jobshaman-cz.onrender.com")
# Public site URL (for canonical/sitemap)
APP_PUBLIC_URL = os.getenv("APP_PUBLIC_URL", "https://jobshaman.cz")

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_KEY"))

# Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# Stripe Price IDs (Used in Backend)
STRIPE_PRICE_PREMIUM = os.getenv("STRIPE_PRICE_PREMIUM", "price_1T3H2JG2Aezsy59eljFlBDtY")
STRIPE_PRICE_STARTER = os.getenv("STRIPE_PRICE_STARTER", "price_1T3JalG2Aezsy59eiMxZNXMU")
STRIPE_PRICE_GROWTH = os.getenv("STRIPE_PRICE_GROWTH", "price_1T3JbcG2Aezsy59ehNtLW9ZV")
STRIPE_PRICE_PROFESSIONAL = os.getenv("STRIPE_PRICE_PROFESSIONAL", "price_1T3JcHG2Aezsy59ela9PmnH7")

# Other APIs
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
RESEND_API_KEY = os.getenv("RESEND_API_KEY") or os.getenv("VITE_RESEND_API_KEY")

# Web Push (VAPID)
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:floki@jobshaman.cz")

# Admin / internal
SCRAPER_TOKEN = os.getenv("SCRAPER_TOKEN")

# Security
SECRET_KEY = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY"))
if not SECRET_KEY:
    raise RuntimeError("Missing SECRET_KEY/JWT_SECRET environment variable")

# CSRF
CSRF_TOKEN_EXPIRY = 3600  # 1 hour
