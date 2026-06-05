#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOURCE_GROUP=${RESOURCE_GROUP:-jobshaman-prod}
SERVER_NAME=${SERVER_NAME:-jobshaman-db-np}

# detect public IP (prefer IPv4)
PUBLIC_IP=""
PUBLIC_IP=$(curl -4 -s https://ifconfig.co || true)
if [[ -z "$PUBLIC_IP" ]]; then
  PUBLIC_IP=$(curl -6 -s https://ifconfig.co || curl -s https://ipinfo.io/ip || true)
fi
if [[ -z "$PUBLIC_IP" ]]; then
  echo "❌ Could not detect public IP. Ensure you have network access to ifconfig.co or ipinfo.io"
  exit 1
fi
# Sanitize rule name: allow only [0-9A-Za-z_-], replace others with '_', limit length
SANITIZED_IP=$(echo "$PUBLIC_IP" | sed 's/[^0-9A-Za-z]/_/g')
RULE_NAME_RAW="temp_${SANITIZED_IP}_$(date +%s)"
RULE_NAME=$(echo "$RULE_NAME_RAW" | cut -c1-60)
RULE_NAME=$(echo "$RULE_NAME" | sed 's/[-_]$//')

echo "Detected public IP: $PUBLIC_IP"
echo "Creating temporary firewall rule $RULE_NAME for $PUBLIC_IP..."

# If AZURE_CLIENT_* env vars are set, az may attempt service-principal auth using
# them (which can fail). Temporarily unset them so az uses the existing login token.
_AZ_BACKUP_CLIENT_ID=${AZURE_CLIENT_ID-}
_AZ_BACKUP_CLIENT_SECRET=${AZURE_CLIENT_SECRET-}
_AZ_BACKUP_TENANT_ID=${AZURE_TENANT_ID-}
_AZ_BACKUP_SUBSCRIPTION_ID=${AZURE_SUBSCRIPTION_ID-}
unset AZURE_CLIENT_ID AZURE_CLIENT_SECRET AZURE_TENANT_ID AZURE_SUBSCRIPTION_ID || true

# Create firewall rule (flexible server)
az postgres flexible-server firewall-rule create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$SERVER_NAME" \
  --rule-name "$RULE_NAME" \
  --start-ip-address "$PUBLIC_IP" \
  --end-ip-address "$PUBLIC_IP" \
  -o none

# Restore AZURE_* env vars
if [[ -n "${_AZ_BACKUP_CLIENT_ID}" ]]; then export AZURE_CLIENT_ID="${_AZ_BACKUP_CLIENT_ID}"; fi
if [[ -n "${_AZ_BACKUP_CLIENT_SECRET}" ]]; then export AZURE_CLIENT_SECRET="${_AZ_BACKUP_CLIENT_SECRET}"; fi
if [[ -n "${_AZ_BACKUP_TENANT_ID}" ]]; then export AZURE_TENANT_ID="${_AZ_BACKUP_TENANT_ID}"; fi
if [[ -n "${_AZ_BACKUP_SUBSCRIPTION_ID}" ]]; then export AZURE_SUBSCRIPTION_ID="${_AZ_BACKUP_SUBSCRIPTION_ID}"; fi

cleanup() {
  echo "Cleaning up firewall rule $RULE_NAME..."
  az postgres flexible-server firewall-rule delete \
    --resource-group "$RESOURCE_GROUP" \
    --name "$SERVER_NAME" \
    --rule-name "$RULE_NAME" \
    -y -o none || true
}

trap cleanup EXIT

# Activate project venv if available
if [[ -f "$ROOT_DIR/backend/venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT_DIR/backend/venv/bin/activate"
elif [[ -f "$ROOT_DIR/backend/.venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT_DIR/backend/.venv/bin/activate"
elif [[ -f "$ROOT_DIR/.venv/bin/activate" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT_DIR/.venv/bin/activate"
fi

# Run scraper (use mobile wrapper if set)
echo "Running scraper (will use venv's python)..."

# Prefer scraper-mobile if MOBILE_NETWORK is desired
if [[ -n "${MOBILE_NETWORK:-}" ]]; then
  bash "$ROOT_DIR/scraper-mobile.sh" "$@"
else
  bash "$ROOT_DIR/scraper.sh" "$@"
fi

# cleanup will run automatically via trap
