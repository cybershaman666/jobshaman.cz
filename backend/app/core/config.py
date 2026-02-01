import os
from dotenv import load_dotenv

load_dotenv()

# API Base URL
API_BASE_URL = os.getenv("API_BASE_URL", "https://jobshaman-cz.onrender.com")

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_KEY"))

# Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# Stripe Price IDs (Used in Backend)
STRIPE_PRICE_PREMIUM = os.getenv("STRIPE_PRICE_PREMIUM", "price_1StDJuG2Aezsy59eqi584FWl")
STRIPE_PRICE_BUSINESS = os.getenv("STRIPE_PRICE_BUSINESS", "price_1StDKmG2Aezsy59e1eiG9bny")
STRIPE_PRICE_SINGLE_ASSESSMENT = os.getenv("STRIPE_PRICE_SINGLE_ASSESSMENT", "price_1StDLUG2Aezsy59eJaSeiWvY")
STRIPE_PRICE_ASSESSMENT_BUNDLE = os.getenv("STRIPE_PRICE_ASSESSMENT_BUNDLE", "price_1StDTGG2Aezsy59esZLgocHw")

# Other APIs
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
RESEND_API_KEY = os.getenv("RESEND_API_KEY") or os.getenv("VITE_RESEND_API_KEY")

# Security
SECRET_KEY = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "your-fallback-secret-key-for-dev"))

# CSRF
CSRF_TOKEN_EXPIRY = 3600  # 1 hour
