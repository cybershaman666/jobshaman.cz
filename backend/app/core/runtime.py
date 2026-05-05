import os
from functools import lru_cache
from typing import List


TRUE_VALUES = {"1", "true", "yes", "on", "production"}


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _csv_env(name: str) -> List[str]:
    raw = _env(name)
    return [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]


@lru_cache(maxsize=1)
def runtime_environment() -> str:
    return (
        _env("V2_ENV")
        or "development"
    ).lower()


def is_production() -> bool:
    return runtime_environment() in {"production", "prod"}


def strict_production_mode() -> bool:
    return is_production() or _env("V2_STRICT_PRODUCTION").lower() in TRUE_VALUES


def require_database_url() -> bool:
    return strict_production_mode() or _env("V2_DB_REQUIRED").lower() in TRUE_VALUES


def allow_legacy_auth_fallback() -> bool:
    return _env("V2_AUTH_LEGACY_SUPABASE_FALLBACK").lower() in TRUE_VALUES


def get_cors_origins() -> List[str]:
    origins = _csv_env("V2_CORS_ORIGINS") or _csv_env("CORS_ORIGINS")
    if origins:
        return origins
    if strict_production_mode():
        # Allow regex to handle it if no explicit origins set
        return []
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]


def validate_runtime_config() -> None:
    if not strict_production_mode():
        return

    if not (_env("DATABASE_URL") or _env("EXTERNAL_POSTGRES_URI")):
        raise RuntimeError("DATABASE_URL or EXTERNAL_POSTGRES_URI must be set in production mode.")

    if not (_env("SUPABASE_JWT_SECRET") or _env("JWT_SECRET")):
        raise RuntimeError("SUPABASE_JWT_SECRET must be set in production mode.")

    get_cors_origins()
