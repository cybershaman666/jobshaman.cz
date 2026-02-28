import os
from dotenv import load_dotenv

load_dotenv()


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_str(name: str, default: str | None = None) -> str | None:
    """Gets an environment variable, returning default if it's None or empty string."""
    raw = os.getenv(name)
    if raw is None:
        return default
    val = raw.strip()
    # Handle quoted values
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
        val = val[1:-1].strip()
    return val if val else default


def _resolve_secret_key() -> str:
    candidates = ("JWT_SECRET", "SECRET_KEY", "jwt_secret", "secret_key")
    for key in candidates:
        val = _env_str(key)
        if val:
            return val

    raise RuntimeError(
        "Missing SECRET_KEY/JWT_SECRET environment variable. "
        f"Checked: {', '.join(candidates)}"
    )

# API Base URL
API_BASE_URL = _env_str("API_BASE_URL", "")
# Public site URL (for canonical/sitemap)
APP_PUBLIC_URL = _env_str("APP_PUBLIC_URL", "https://jobshaman.cz")

# Supabase
SUPABASE_URL = _env_str("SUPABASE_URL")
# Use SERVICE_KEY if available, fallback to public KEY
SUPABASE_KEY = _env_str("SUPABASE_SERVICE_KEY") or _env_str("SUPABASE_KEY")

# Stripe
STRIPE_SECRET_KEY = _env_str("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = _env_str("STRIPE_WEBHOOK_SECRET")

# Stripe Price IDs (Used in Backend)
STRIPE_PRICE_PREMIUM = _env_str("STRIPE_PRICE_PREMIUM", "price_1T3H2JG2Aezsy59eljFlBDtY")
STRIPE_PRICE_STARTER = _env_str("STRIPE_PRICE_STARTER", "price_1T3JalG2Aezsy59eiMxZNXMU")
STRIPE_PRICE_GROWTH = _env_str("STRIPE_PRICE_GROWTH", "price_1T3JbcG2Aezsy59ehNtLW9ZV")
STRIPE_PRICE_PROFESSIONAL = _env_str("STRIPE_PRICE_PROFESSIONAL", "price_1T3JcHG2Aezsy59ela9PmnH7")

# Other APIs
GEMINI_API_KEY = _env_str("GEMINI_API_KEY")
RESEND_API_KEY = _env_str("RESEND_API_KEY") or _env_str("VITE_RESEND_API_KEY")

# Web Push (VAPID)
VAPID_PUBLIC_KEY = _env_str("VAPID_PUBLIC_KEY")
VAPID_PRIVATE_KEY = _env_str("VAPID_PRIVATE_KEY")
VAPID_SUBJECT = _env_str("VAPID_SUBJECT", "mailto:floki@jobshaman.cz")

# Admin / internal
SCRAPER_TOKEN = _env_str("SCRAPER_TOKEN")

# Security
SECRET_KEY = _resolve_secret_key()

# CSRF
CSRF_TOKEN_EXPIRY = 3600  # 1 hour

# JCFPM access control
JCFPM_REQUIRE_PREMIUM = _env_bool("JCFPM_REQUIRE_PREMIUM", False)

# JCFPM items provider
JCFPM_ITEMS_PROVIDER = _env_str("JCFPM_ITEMS_PROVIDER", "auto").lower()
MONGODB_URI = _env_str("MONGODB_URI")
MONGODB_DB = _env_str("MONGODB_DB", "jobshaman")
MONGODB_JCFPM_COLLECTION = _env_str("MONGODB_JCFPM_COLLECTION", "jcfpm_items")
