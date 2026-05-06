#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$ROOT_DIR/backend/.venv/bin/python"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "❌ Backend venv python not found at $PYTHON_BIN"
  echo "Run: cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

echo "🚀 Spouštím JobShaman Scraper (V2-ready)..."
echo "   Path: $ROOT_DIR/runtime-services/scraper"

# Export PYTHONPATH to include scraper directory
export PYTHONPATH="$ROOT_DIR/runtime-services/scraper:$ROOT_DIR/runtime-services:${PYTHONPATH:-}"

# Runs all regions (CZ, SK, PL, DE/AT, Nordic) and API sources in PARALLEL
cd "$ROOT_DIR/runtime-services/scraper"
"$PYTHON_BIN" run_parallel.py "$@"

echo "🔄 Aktualizuji sitemapy (SEO)..."
cd "$ROOT_DIR/backend"
# Load .env file safely (handles values with commas/spaces)
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi
export PYTHONPATH="$ROOT_DIR/backend"
"$PYTHON_BIN" scripts/generate_sitemap.py

echo "✅ Hotovo!"
