#!/usr/bin/env bash
set -euo pipefail

# Smoke-check script for Azure migration
# Usage: 
#   AZ_KEYVAULT_NAME=jobshaman-vault \ 
#   KEYVAULT_SECRET_NAME=DATABASE-URL \ 
#   API_URL=https://api.jobshaman.cz \ 
#   RG=jobshaman-prod \ 
#   CONTAINERAPP_NAME=jobshaman-api \ 
#   STORAGE_ACCOUNT=<name> \ 
#   STORAGE_CONTAINER=<container> \
#   ./scripts/smoke_check_azure.sh

# This script attempts non-destructive checks:
# - retrieve DATABASE-URL from Key Vault (or use DB_CONN env)
# - test DB connectivity and counts for critical tables
# - call API health endpoint
# - verify Container App env references to secrets
# - check ACR repository and latest image
# - check storage blob listing (optional)
# - fetch App Insights instrumentation key

KEYVAULT_NAME=${AZ_KEYVAULT_NAME:-}
KEYVAULT_SECRET_NAME=${KEYVAULT_SECRET_NAME:-DATABASE-URL}
DB_CONN=${DB_CONN:-}
API_URL=${API_URL:-https://api.jobshaman.cz}
FRONTEND_URL=${FRONTEND_URL:-https://jobshaman.cz}
RG=${RG:-jobshaman-prod}
CONTAINERAPP_NAME=${CONTAINERAPP_NAME:-jobshaman-api}
ACR_NAME=${ACR_NAME:-jobshamanacr}
STORAGE_ACCOUNT=${STORAGE_ACCOUNT:-}
STORAGE_CONTAINER=${STORAGE_CONTAINER:-}
CRITICAL_TABLES=${CRITICAL_TABLES:-jobs,users,candidates,profiles}

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

info(){ printf "%b\n" "${GREEN}[INFO]${NC} $*"; }
warn(){ printf "%b\n" "${YELLOW}[WARN]${NC} $*"; }
err(){ printf "%b\n" "${RED}[ERR]${NC} $*"; }

# Timeouts (seconds) for external calls to avoid hangs
TIMEOUT_SECS=${TIMEOUT_SECS:-20}

# Helper to run az with a timeout so script doesn't hang if az blocks
az_with_timeout(){
  if command -v timeout >/dev/null 2>&1; then
    timeout "${TIMEOUT_SECS}" az "$@"
  else
    # fallback: run az directly (may hang)
    az "$@"
  fi
}

if ! command -v az >/dev/null 2>&1; then
  err "az CLI not found in PATH. Install or run this on a machine with az CLI."
  exit 2
fi
if ! command -v psql >/dev/null 2>&1; then
  warn "psql not found. DB checks will be skipped unless psql is available in PATH."
fi

echo
info "Azure Smoke-check starting"
echo

# 1) Retrieve DB connection string
if [ -z "${DB_CONN}" ]; then
  if [ -n "${KEYVAULT_NAME}" ]; then
    info "Fetching ${KEYVAULT_SECRET_NAME} from Key Vault ${KEYVAULT_NAME}"
    DB_CONN=$(az keyvault secret show --vault-name "${KEYVAULT_NAME}" --name "${KEYVAULT_SECRET_NAME}" --query value -o tsv 2>/dev/null || true)
    if [ -z "${DB_CONN}" ]; then
      err "Failed to retrieve DATABASE-URL from Key Vault. Ensure az is logged in and you have access."
    fi
  else
    warn "No DB_CONN and no AZ_KEYVAULT_NAME provided — DB checks will be skipped"
  fi
else
  info "Using DB_CONN from environment"
fi

# 2) Parse DB_CONN into components (host,user,port,db,password)
parse_db_conn(){
  python3 - <<PY
import os
from urllib.parse import urlparse, parse_qs
conn = os.environ.get('DB_CONN','')
if not conn:
    raise SystemExit(0)
u = urlparse(conn)
user = u.username or ''
passwd = u.password or ''
host = u.hostname or ''
port = u.port or 5432
path = u.path[1:] if u.path else ''
print(user)
print(passwd)
print(host)
print(port)
print(path)
PY
}

if [ -n "${DB_CONN}" ] && command -v python3 >/dev/null 2>&1; then
  read -r DB_USER DB_PASS DB_HOST DB_PORT DB_NAME <<<"$(parse_db_conn)"
  if [ -z "${DB_HOST}" ]; then
    warn "Could not parse DB host from connection string — skipping psql checks"
  fi
else
  DB_USER=${DB_USER:-}
  DB_PASS=${DB_PASS:-}
  DB_HOST=${DB_HOST:-}
  DB_PORT=${DB_PORT:-5432}
  DB_NAME=${DB_NAME:-jobshaman}
fi

# helper to run psql safely
run_psql(){
  if ! command -v psql >/dev/null 2>&1; then
    warn "psql not available; skipping DB checks"
    return 1
  fi
  if [ -z "${DB_HOST}" ] || [ -z "${DB_USER}" ]; then
    warn "DB connection details missing; skipping DB checks"
    return 1
  fi
  export PGPASSWORD="${DB_PASS}"
  psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -c "$1"
}

echo
info "== DATABASE CHECKS =="
if [ -n "${DB_HOST}" ] && command -v psql >/dev/null 2>&1; then
  info "Testing DB connectivity to ${DB_HOST}:${DB_PORT}/${DB_NAME} as ${DB_USER}"
  if run_psql "SELECT 1;" >/dev/null 2>&1; then
    info "DB connectivity OK"
  else
    err "DB connectivity FAILED"
  fi

  IFS=',' read -r -a tables <<<"${CRITICAL_TABLES}"
  for t in "${tables[@]}"; do
    t_trim=$(echo "$t" | xargs)
    printf "Checking table %s... " "$t_trim"
    if run_psql "SELECT count(*) FROM ${t_trim};" 2>/dev/null | sed -n '3p' >/dev/null 2>&1; then
      cnt=$(run_psql "SELECT count(*) FROM ${t_trim};" 2>/dev/null | sed -n '3p' | xargs)
      printf "%b\n" "${GREEN}${cnt}${NC}"
    else
      printf "%b\n" "${YELLOW}TABLE MISSING or query failed${NC}"
    fi
  done
else
  warn "Skipping DB checks (psql missing or DB details unavailable)"
fi

echo
info "== API HEALTH CHECK =="
info "GET ${API_URL}/health"
if curl -sS -o /tmp/smoke_health_resp -w "%{http_code}" "${API_URL}/health" | grep -q "200"; then
  info "health => 200"
  printf "Response excerpt:\n"
  sed -n '1,200p' /tmp/smoke_health_resp || true
else
  err "health did not return 200. See full response below:" 
  sed -n '1,200p' /tmp/smoke_health_resp || true
fi

echo
info "== CONTAINER APP CHECKS =="
if az containerapp show --name "${CONTAINERAPP_NAME}" --resource-group "${RG}" >/dev/null 2>&1; then
  info "Container App ${CONTAINERAPP_NAME} exists in ${RG}"
  echo "Env vars (secretRef redacted):"
  az containerapp show --name "${CONTAINERAPP_NAME}" --resource-group "${RG}" --query "properties.template.containers[0].env" -o json | jq '.[] | {name: .name, secretRef: (.secretRef // null), value: (if has("value") then "<value>" else null end) }'
else
  warn "Container App ${CONTAINERAPP_NAME} not found in ${RG}"
fi

echo
info "== ACR CHECK =="
if az acr show --name "${ACR_NAME}" --resource-group "${RG}" >/dev/null 2>&1; then
  info "ACR ${ACR_NAME} found"
  info "Listing jobshaman-api manifests (top 10)"
  az acr repository show-manifests --name "${ACR_NAME}" --repository jobshaman-api --top 10 -o table || warn "Could not list manifests or repository missing"
else
  warn "ACR ${ACR_NAME} not found or access denied"
fi

if [ -n "${STORAGE_ACCOUNT}" ] && [ -n "${STORAGE_CONTAINER}" ]; then
  echo
  info "== STORAGE CHECK =="
  info "Listing blobs in ${STORAGE_CONTAINER}@${STORAGE_ACCOUNT} (top 20)"
  az storage blob list --account-name "${STORAGE_ACCOUNT}" --container-name "${STORAGE_CONTAINER}" --num-results 20 -o table || warn "Storage list failed"
else
  warn "Storage account/container not provided — skipping storage checks"
fi

echo
info "== APP INSIGHTS =="
if az monitor app-insights component show --app jobshaman-insights --resource-group "${RG}" >/dev/null 2>&1; then
  ikey=$(az monitor app-insights component show --app jobshaman-insights --resource-group "${RG}" --query instrumentationKey -o tsv 2>/dev/null || true)
  info "App Insights found; instrumentationKey: ${ikey:-<not-available>}"
else
  warn "App Insights jobshaman-insights not found in ${RG}"
fi

echo
info "== AZURE AI CONFIG CHECK =="
if [ -n "${KEYVAULT_NAME}" ]; then
  for secret in AZURE-OPENAI-API-KEY AZURE-OPENAI-ENDPOINT AZURE-OPENAI-DEPLOYMENT-NAME AZURE-AI-EMBEDDING-MODEL AZURE-AI-EMBEDDING-DIMENSIONS; do
    if az keyvault secret show --vault-name "${KEYVAULT_NAME}" --name "${secret}" --query id -o tsv >/dev/null 2>&1; then
      info "Key Vault secret present: ${secret}"
    else
      warn "Key Vault secret missing or inaccessible: ${secret}"
    fi
  done
else
  warn "No AZ_KEYVAULT_NAME provided — skipping Azure AI Key Vault checks"
fi

if az containerapp show --name "${CONTAINERAPP_NAME}" --resource-group "${RG}" >/dev/null 2>&1; then
  info "Checking Container App AI env bindings"
  az containerapp show --name "${CONTAINERAPP_NAME}" --resource-group "${RG}" \
    --query "properties.template.containers[0].env[?starts_with(name, 'AZURE_') || name=='AI_PROVIDER'].{name:name,secretRef:secretRef,value:value}" \
    -o table || warn "Could not inspect Azure AI env bindings"
fi

echo
info "Smoke-check finished. Review outputs above."
info "Next recommended steps: compare critical table rowcounts to source, inspect container logs (az containerapp logs), and monitor App Insights for anomalies."
