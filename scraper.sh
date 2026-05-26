#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$ROOT_DIR/backend/.venv/bin/python"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "❌ Backend venv python not found at $PYTHON_BIN"
  echo "Run: cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
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

if [[ -z "${JOBS_POSTGRES_URL:-${NORTHFLANK_POSTGRES_URL:-${DATABASE_URL:-}}}" ]]; then
  echo "❌ Azure Postgres není nakonfigurovaný. Nastav JOBS_POSTGRES_URL nebo NORTHFLANK_POSTGRES_URL."
  exit 1
fi

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
