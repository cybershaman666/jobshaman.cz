import os
from dotenv import load_dotenv

load_dotenv()


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _resolve_secret_key() -> str:
    candidates = ("JWT_SECRET", "SECRET_KEY", "jwt_secret", "secret_key")
    checked: list[str] = []
    for key in candidates:
        raw = os.getenv(key)
        checked.append(f"{key}={'set' if raw is not None else 'missing'}")
        if raw is None:
            continue
        value = raw.strip()
        if not value:
            continue
        # Accept quoted values copied from dashboard UIs.
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1].strip()
        if value:
            return value
    raise RuntimeError(
        "Missing SECRET_KEY/JWT_SECRET environment variable. "
        f"Checked: {', '.join(checked)}"
    )

# API Base URL
API_BASE_URL = os.getenv("API_BASE_URL", "https://jobshaman-cz-8d0p.onrender.com")
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
SECRET_KEY = _resolve_secret_key()

# CSRF
CSRF_TOKEN_EXPIRY = 3600  # 1 hour

# JCFPM access control
# Temporary switch to allow JCFPM for authenticated users without premium token issues.
# Set JCFPM_REQUIRE_PREMIUM=true to restore strict premium gate.
JCFPM_REQUIRE_PREMIUM = _env_bool("JCFPM_REQUIRE_PREMIUM", False)

# JCFPM items provider
# auto = MongoDB primary + Supabase fallback
JCFPM_ITEMS_PROVIDER = os.getenv("JCFPM_ITEMS_PROVIDER", "auto").strip().lower() or "auto"
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB = os.getenv("MONGODB_DB", "jobshaman")
MONGODB_JCFPM_COLLECTION = os.getenv("MONGODB_JCFPM_COLLECTION", "jcfpm_items")
