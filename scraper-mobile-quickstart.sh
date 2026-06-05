#!/usr/bin/env bash
# Quick Start Guide for Mobile Network Scraping
# ==============================================

echo "📡 JobShaman Scraper - Mobile Network Quick Start"
echo "=================================================="
echo ""

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "1️⃣  Checking prerequisites..."
if [[ ! -f "$REPO_ROOT/Azure IDs.txt" ]]; then
  echo "   ❌ Azure IDs.txt not found"
  exit 1
fi
echo "   ✅ Azure IDs.txt found"

PYTHON_BIN=""
if [[ -x "$REPO_ROOT/.venv/bin/python" ]]; then
  PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
elif [[ -x "$REPO_ROOT/backend/.venv/bin/python" ]]; then
  PYTHON_BIN="$REPO_ROOT/backend/.venv/bin/python"
fi

if [[ -z "$PYTHON_BIN" ]]; then
  # Try to source common venv locations (prefer backend/venv)
  if [[ -f "$REPO_ROOT/backend/venv/bin/activate" ]]; then
    # shellcheck source=/dev/null
    source "$REPO_ROOT/backend/venv/bin/activate"
  elif [[ -f "$REPO_ROOT/.venv/bin/activate" ]]; then
    # shellcheck source=/dev/null
    source "$REPO_ROOT/.venv/bin/activate"
  elif [[ -f "$REPO_ROOT/backend/.venv/bin/activate" ]]; then
    # shellcheck source=/dev/null
    source "$REPO_ROOT/backend/.venv/bin/activate"
  fi

  if [[ -n "${VIRTUAL_ENV:-}" ]]; then
    PYTHON_BIN="$VIRTUAL_ENV/bin/python"
  fi

  if [[ -z "$PYTHON_BIN" ]]; then
    echo "   ❌ Python venv not found. Run: python -m venv .venv && source .venv/bin/activate"
    exit 1
  fi
fi
echo "   ✅ Python venv found"

echo ""
echo "2️⃣  Checking Azure libraries..."
if ! "$PYTHON_BIN" -c "import azure.identity" 2>/dev/null; then
  echo "   ⚠️  Azure SDK not installed"
  echo "   Installing: pip install azure-identity azure-mgmt-rdbms"
  "$PYTHON_BIN" -m pip install azure-identity azure-mgmt-rdbms -q
  echo "   ✅ Azure SDK installed"
else
  echo "   ✅ Azure SDK available"
fi

echo ""
echo "3️⃣  Setting up Azure PostgreSQL firewall..."
"$PYTHON_BIN" "$REPO_ROOT/setup_azure_postgres_firewall.py" --use-sdk

if [[ $? -ne 0 ]]; then
  echo ""
  echo "❌ Firewall setup failed"
  echo ""
  echo "Try manual setup:"
  echo "  python setup_azure_postgres_firewall.py"
  echo ""
  echo "Or see MOBILE_NETWORK_SETUP.md for alternatives"
  exit 1
fi

echo ""
echo "4️⃣  Starting scraper..."
echo ""
bash "$REPO_ROOT/scraper.sh" "$@"
