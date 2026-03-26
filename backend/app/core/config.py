import os
from urllib.parse import quote_plus
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


def _resolve_jobs_postgres_url() -> str | None:
    direct = (
        _env_str("JOBS_POSTGRES_URL")
        or _env_str("NORTHFLANK_POSTGRES_URL")
        or _env_str("EXTERNAL_POSTGRES_URI_ADMIN")
        or _env_str("EXTERNAL_POSTGRES_URI")
        or _env_str("POSTGRES_URI_ADMIN")
        or _env_str("POSTGRES_URI")
        or _env_str("DATABASE_URL")
    )
    if direct:
        return direct

    username = _env_str("POSTGRES_USER") or _env_str("JOBS_POSTGRES_USER")
    password = _env_str("POSTGRES_PASSWORD") or _env_str("JOBS_POSTGRES_PASSWORD")
    host = _env_str("POSTGRES_HOST") or _env_str("JOBS_POSTGRES_HOST")
    port = _env_str("POSTGRES_PORT") or _env_str("JOBS_POSTGRES_PORT") or "5432"
    database = _env_str("POSTGRES_DB") or _env_str("JOBS_POSTGRES_DB")

    if not (username and password and host and database):
        return None

    return f"postgresql://{quote_plus(username)}:{quote_plus(password)}@{host}:{port}/{quote_plus(database)}"


def _resolve_jobs_postgres_sslmode() -> str:
    explicit = _env_str("JOBS_POSTGRES_SSLMODE")
    if explicit:
        return explicit
    tls_enabled = _env_bool("TLS_ENABLED", True)
    return "require" if tls_enabled else "disable"


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
# Use service-role/secret key if available, fallback to legacy names.
SUPABASE_KEY = (
    _env_str("SUPABASE_SERVICE_ROLE_KEY")
    or _env_str("SUPABASE_SERVICE_KEY")
    or _env_str("SUPABASE_KEY")
)

# Stripe
STRIPE_SECRET_KEY = _env_str("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = _env_str("STRIPE_WEBHOOK_SECRET")

# Stripe Price IDs (Used in Backend)
STRIPE_PRICE_PREMIUM = _env_str("STRIPE_PRICE_PREMIUM", "price_1T920yG2Aezsy59ellHCgZMq")
STRIPE_PRICE_STARTER = _env_str("STRIPE_PRICE_STARTER", "price_1T3JalG2Aezsy59eiMxZNXMU")
STRIPE_PRICE_GROWTH = _env_str("STRIPE_PRICE_GROWTH", "price_1T3JbcG2Aezsy59ehNtLW9ZV")
STRIPE_PRICE_PROFESSIONAL = _env_str("STRIPE_PRICE_PROFESSIONAL", "price_1T3JcHG2Aezsy59ela9PmnH7")

# Other APIs
GEMINI_API_KEY = _env_str("GEMINI_API_KEY")
MISTRAL_API_KEY = _env_str("MISTRAL_API_KEY")
RESEND_API_KEY = _env_str("RESEND_API_KEY") or _env_str("VITE_RESEND_API_KEY")
APPLICATION_NOTIFICATION_EMAIL = _env_str("APPLICATION_NOTIFICATION_EMAIL", "floki@jobshaman.cz")

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
MONGODB_DIALOGUE_AI_SUMMARIES_COLLECTION = _env_str("MONGODB_DIALOGUE_AI_SUMMARIES_COLLECTION", "dialogue_ai_summaries")
MONGODB_DIALOGUE_TRANSCRIPTS_COLLECTION = _env_str("MONGODB_DIALOGUE_TRANSCRIPTS_COLLECTION", "dialogue_transcripts")
MONGODB_DIALOGUE_FIT_EVIDENCE_COLLECTION = _env_str("MONGODB_DIALOGUE_FIT_EVIDENCE_COLLECTION", "dialogue_fit_evidence")
MONGODB_JOBSPY_COLLECTION = _env_str("MONGODB_JOBSPY_COLLECTION", "jobspy_jobs")
MONGODB_JOBSPY_ENABLED = _env_bool("MONGODB_JOBSPY_ENABLED", False)
MONGODB_JOBSPY_TTL_DAYS = max(1, int(_env_str("MONGODB_JOBSPY_TTL_DAYS", "14") or "14"))
MONGODB_JOBSPY_ENRICHED_COLLECTION = _env_str("MONGODB_JOBSPY_ENRICHED_COLLECTION", "jobspy_jobs_enriched")
MONGODB_JOBSPY_COMPANY_COLLECTION = _env_str("MONGODB_JOBSPY_COMPANY_COLLECTION", "jobspy_company_snapshots")
JOBS_POSTGRES_URL = _resolve_jobs_postgres_url()
JOBS_POSTGRES_SSLMODE = _resolve_jobs_postgres_sslmode()
JOBS_POSTGRES_JOBS_TABLE = _env_str("JOBS_POSTGRES_JOBS_TABLE", "jobs_nf")
JOBS_POSTGRES_EXTERNAL_CACHE_TABLE = _env_str("JOBS_POSTGRES_EXTERNAL_CACHE_TABLE", "external_live_search_cache_nf")
JOBS_POSTGRES_JOBSPY_TABLE = _env_str("JOBS_POSTGRES_JOBSPY_TABLE", "jobspy_jobs_nf")
JOBS_POSTGRES_CANONICAL_ROLES_TABLE = _env_str("JOBS_POSTGRES_CANONICAL_ROLES_TABLE", "canonical_roles_nf")
JOBS_POSTGRES_CANONICAL_ROLE_ALIASES_TABLE = _env_str("JOBS_POSTGRES_CANONICAL_ROLE_ALIASES_TABLE", "canonical_role_aliases_nf")
JOBS_POSTGRES_JOB_INTELLIGENCE_TABLE = _env_str("JOBS_POSTGRES_JOB_INTELLIGENCE_TABLE", "job_intelligence_nf")
JOBS_POSTGRES_SIGNAL_OUTPUTS_TABLE = _env_str("JOBS_POSTGRES_SIGNAL_OUTPUTS_TABLE", "job_signal_outputs_nf")
JOBS_POSTGRES_ENABLED = _env_bool("JOBS_POSTGRES_ENABLED", bool(JOBS_POSTGRES_URL))
JOBS_POSTGRES_SERVE_EXTERNAL = _env_bool("JOBS_POSTGRES_SERVE_EXTERNAL", JOBS_POSTGRES_ENABLED)
JOBS_POSTGRES_WRITE_EXTERNAL = _env_bool("JOBS_POSTGRES_WRITE_EXTERNAL", JOBS_POSTGRES_ENABLED)
JOBS_POSTGRES_SERVE_MAIN = _env_bool("JOBS_POSTGRES_SERVE_MAIN", JOBS_POSTGRES_ENABLED)
JOBS_POSTGRES_WRITE_MAIN = _env_bool("JOBS_POSTGRES_WRITE_MAIN", JOBS_POSTGRES_ENABLED)
JOBS_POSTGRES_IMPORTED_RETENTION_DAYS = max(1, int(_env_str("JOBS_POSTGRES_IMPORTED_RETENTION_DAYS", "15") or "15"))
JOBS_POSTGRES_NATIVE_RETENTION_DAYS = max(1, int(_env_str("JOBS_POSTGRES_NATIVE_RETENTION_DAYS", "30") or "30"))
JOBS_POSTGRES_SEARCH_TIMING_LOG_ENABLED = _env_bool("JOBS_POSTGRES_SEARCH_TIMING_LOG_ENABLED", True)
JOBS_POSTGRES_SEARCH_SLOW_MS = max(50, int(_env_str("JOBS_POSTGRES_SEARCH_SLOW_MS", "350") or "350"))
JOBS_POSTGRES_SEARCH_EXPLAIN_ENABLED = _env_bool("JOBS_POSTGRES_SEARCH_EXPLAIN_ENABLED", False)
JOB_INTELLIGENCE_AI_THRESHOLD = max(0.0, min(1.0, float(_env_str("JOB_INTELLIGENCE_AI_THRESHOLD", "0.56") or "0.56")))
JOB_INTELLIGENCE_BATCH_LIMIT = max(100, int(_env_str("JOB_INTELLIGENCE_BATCH_LIMIT", "4000") or "4000"))

# External asset storage
EXTERNAL_ASSET_STORAGE_MODE = _env_str("EXTERNAL_ASSET_STORAGE_MODE", "local").lower()
EXTERNAL_ASSET_LOCAL_DIR = _env_str("EXTERNAL_ASSET_LOCAL_DIR", "data/external_assets")
EXTERNAL_ASSET_UPLOAD_SESSION_TTL_SECONDS = int(_env_str("EXTERNAL_ASSET_UPLOAD_SESSION_TTL_SECONDS", "900") or "900")
EXTERNAL_ASSET_DOWNLOAD_URL_TTL_SECONDS = int(_env_str("EXTERNAL_ASSET_DOWNLOAD_URL_TTL_SECONDS", "15552000") or "15552000")
EXTERNAL_ASSET_S3_ENDPOINT = _env_str("EXTERNAL_ASSET_S3_ENDPOINT")
EXTERNAL_ASSET_S3_REGION = _env_str("EXTERNAL_ASSET_S3_REGION", "auto")
EXTERNAL_ASSET_S3_BUCKET = _env_str("EXTERNAL_ASSET_S3_BUCKET")
EXTERNAL_ASSET_S3_ACCESS_KEY_ID = _env_str("EXTERNAL_ASSET_S3_ACCESS_KEY_ID")
EXTERNAL_ASSET_S3_SECRET_ACCESS_KEY = _env_str("EXTERNAL_ASSET_S3_SECRET_ACCESS_KEY")
