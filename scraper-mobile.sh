#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# For mobile/dynamic networks, automatically setup firewall
export SETUP_AZURE_FIREWALL=1
export MOBILE_NETWORK=1

# Run firewall setup first
echo "📡 Preparing for mobile network scraping..."
echo "   Setting up Azure PostgreSQL firewall (allows all Azure services)"
echo ""

# Prefer an activated venv (common in developer workflows)
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
else
  echo "❌ Python venv not found"
  echo "Expected one of:"
  echo "   source ./backend/venv/bin/activate"
  echo "   source ./.venv/bin/activate"
  exit 1
fi

# Run setup (non-blocking, will try both SDK and CLI)
"$PYTHON_BIN" "$ROOT_DIR/setup_azure_postgres_firewall.py" 2>/dev/null || true

echo ""
echo "🚀 Starting scraper..."
echo ""

# Now run the main scraper
bash "$ROOT_DIR/scraper.sh" "$@"
