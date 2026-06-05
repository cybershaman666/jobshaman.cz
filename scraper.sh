#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN=""
# Prefer an activated venv (developer workflow) and common repo venv locations
if [[ -f "$ROOT_DIR/backend/venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT_DIR/backend/venv/bin/activate"
elif [[ -f "$ROOT_DIR/.venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT_DIR/.venv/bin/activate"
elif [[ -f "$ROOT_DIR/backend/.venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT_DIR/backend/.venv/bin/activate"
fi

if [[ -n "${VIRTUAL_ENV:-}" ]]; then
  PYTHON_BIN="$VIRTUAL_ENV/bin/python"
elif [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
  PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
elif [[ -x "$ROOT_DIR/backend/.venv/bin/python" ]]; then
  PYTHON_BIN="$ROOT_DIR/backend/.venv/bin/python"
elif [[ -x "$ROOT_DIR/backend/venv/bin/python" ]]; then
  PYTHON_BIN="$ROOT_DIR/backend/venv/bin/python"
fi

if [[ -z "$PYTHON_BIN" ]]; then
  echo "❌ Python venv not found."
  echo "Expected one of:"
  echo "   source ./backend/venv/bin/activate"
  echo "   source ./.venv/bin/activate"
  exit 1
fi

load_env_file() {
  local env_path="$1"
  if [[ -f "$env_path" ]]; then
    while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
      local line="${raw_line%$'\r'}"
      line="${line#"${line%%[![:space:]]*}"}"
      [[ -z "$line" ]] && continue
      [[ "$line" == \#* ]] && continue
      [[ "$line" == export\ * ]] && line="${line#export }"
      export "$line"
    done < "$env_path"
  fi
}

load_env_file "$ROOT_DIR/.env"
load_env_file "$ROOT_DIR/backend/.env"

export SCRAPER_SUPABASE_FALLBACK_ENABLED=false
export PYTHONUNBUFFERED=1

# --- Azure Postgres Setup for Mobile/Dynamic IP Networks ---
ensure_azure_postgres_firewall() {
  local setup_script="$ROOT_DIR/setup_azure_postgres_firewall.py"
  if [[ ! -f "$setup_script" ]]; then
    return 0
  fi
  
  # Only run once per session
  if [[ "${_AZURE_FIREWALL_SETUP_DONE:-}" == "true" ]]; then
    return 0
  fi
  
  # Check if we're on a mobile/dynamic network (non-standard setup)
  if [[ -n "${MOBILE_NETWORK:-}" ]] || [[ -n "${SETUP_AZURE_FIREWALL:-}" ]]; then
    echo "🔧 Preparing Azure PostgreSQL firewall for mobile network..."
    if "$PYTHON_BIN" "$setup_script" --use-sdk 2>/dev/null || "$PYTHON_BIN" "$setup_script" --use-cli 2>/dev/null; then
      export _AZURE_FIREWALL_SETUP_DONE=true
      return 0
    else
      echo "⚠️  Could not auto-setup firewall. Run manually: python setup_azure_postgres_firewall.py"
      return 0
    fi
  fi
}

if [[ -z "${JOBS_POSTGRES_URL:-${NORTHFLANK_POSTGRES_URL:-${DATABASE_URL:-}}}" ]]; then
  echo "❌ Azure Postgres není nakonfigurovaný. Nastav JOBS_POSTGRES_URL nebo NORTHFLANK_POSTGRES_URL."
  exit 1
fi

ensure_azure_postgres_firewall

if [[ "${JOBS_POSTGRES_ENABLED:-true}" != "true" ]]; then
  echo "❌ JOBS_POSTGRES_ENABLED musí být true."
  exit 1
fi

if [[ "${JOBS_POSTGRES_WRITE_MAIN:-true}" != "true" ]]; then
  echo "❌ JOBS_POSTGRES_WRITE_MAIN musí být true."
  exit 1
fi

echo "🚀 Spouštím JobShaman Scraper (V2-ready)..."
echo "   Path: $ROOT_DIR/runtime-services/scraper"
echo "   Storage: Azure Postgres only"

# Export PYTHONPATH to include scraper directory and backend (at the end)
export PYTHONPATH="$ROOT_DIR/runtime-services/scraper:$ROOT_DIR/runtime-services:${PYTHONPATH:-}:$ROOT_DIR/backend"

# Runs all regions (CZ, SK, PL, DE/AT, Nordic) and API sources in PARALLEL
cd "$ROOT_DIR/runtime-services/scraper"
"$PYTHON_BIN" run_parallel.py "$@"

echo "🔄 Aktualizuji sitemapy (SEO)..."
cd "$ROOT_DIR/backend"
export PYTHONPATH="$ROOT_DIR/backend"
"$PYTHON_BIN" scripts/generate_sitemap.py

echo "✅ Hotovo!"
