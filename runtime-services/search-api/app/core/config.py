import os
from dotenv import load_dotenv

load_dotenv()


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
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1].strip()
        if value:
            return value
    raise RuntimeError(
        "Missing SECRET_KEY/JWT_SECRET environment variable. "
        f"Checked: {', '.join(checked)}"
    )

# Required runtime configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_KEY"))
APP_PUBLIC_URL = os.getenv("APP_PUBLIC_URL", "https://jobshaman.cz")

SECRET_KEY = _resolve_secret_key()

CSRF_TOKEN_EXPIRY = int(os.getenv("CSRF_TOKEN_EXPIRY", "3600"))
