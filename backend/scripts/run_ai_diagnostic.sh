#!/usr/bin/env bash
set -euo pipefail

# Simple diagnostic script to help reproduce /api/v2/mentor/chat 500 locally
# Usage:
#   backend/scripts/run_ai_diagnostic.sh --vault <KEYVAULT_NAME> --token <TEST_JWT>
# If --vault is provided, the script will attempt to read these secrets from Azure Key Vault:
#   AZURE-OPENAI-API-KEY -> exported as AZURE_OPENAI_API_KEY
#   AZURE-OPENAI-ENDPOINT -> exported as AZURE_OPENAI_ENDPOINT
#   AZURE-OPENAI-DEPLOYMENT-NAME (optional) -> exported as AZURE_OPENAI_DEPLOYMENT_NAME
# Otherwise you may export those env vars manually before running.

VAULT_NAME=""
TEST_TOKEN=""
PORT=8000
LOGFILE="../backend_run.log"
PIDFILE="../backend_run.pid"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --vault)
      VAULT_NAME="$2"; shift 2;;
    --token)
      TEST_TOKEN="$2"; shift 2;;
    --port)
      PORT="$2"; shift 2;;
    --help|-h)
      sed -n '1,120p' "$0"; exit 0;;
    *)
      echo "Unknown arg: $1"; exit 1;;
  esac
done

echo "Starting AI diagnostic..."

if [[ -n "$VAULT_NAME" ]]; then
  echo "Fetching secrets from Key Vault: $VAULT_NAME"
  if ! command -v az >/dev/null 2>&1; then
    echo "az CLI not found. Install Azure CLI or run script without --vault and set env vars manually." >&2
    exit 2
  fi
  export AZURE_OPENAI_API_KEY=$(az keyvault secret show --vault-name "$VAULT_NAME" --name "AZURE-OPENAI-API-KEY" --query value -o tsv)
  export AZURE_OPENAI_ENDPOINT=$(az keyvault secret show --vault-name "$VAULT_NAME" --name "AZURE-OPENAI-ENDPOINT" --query value -o tsv)
  # optional; ignore error if missing
  DEPLOY=$(az keyvault secret show --vault-name "$VAULT_NAME" --name "AZURE-OPENAI-DEPLOYMENT-NAME" --query value -o tsv 2>/dev/null || true)
  if [[ -n "$DEPLOY" ]]; then
    export AZURE_OPENAI_DEPLOYMENT_NAME="$DEPLOY"
  fi
fi

echo "Using endpoint: ${AZURE_OPENAI_ENDPOINT:-<not-set>}"
echo "Using deployment: ${AZURE_OPENAI_DEPLOYMENT_NAME:-<not-set>}"

if [[ -z "${AZURE_OPENAI_API_KEY:-}" || -z "${AZURE_OPENAI_ENDPOINT:-}" ]]; then
  echo "AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT must be set (either in env or via --vault)." >&2
  exit 2
fi

if [[ -z "$TEST_TOKEN" ]]; then
  echo "Warning: no test token provided. The endpoint may require authentication. Use --token <JWT> to provide one." >&2
fi

echo "Installing python deps into venv if needed..."
if ! command -v uvicorn >/dev/null 2>&1; then
  echo "uvicorn not found in PATH — ensure you have python deps installed (pip install -r backend/requirements.txt)" >&2
fi

pushd "$(dirname "$0")/.." >/dev/null

echo "Starting uvicorn (logs -> $LOGFILE)"
uvicorn backend.app.main:app --reload --port "$PORT" --log-level debug > "$LOGFILE" 2>&1 &
UVICORN_PID=$!
echo "$UVICORN_PID" > "$PIDFILE"
echo "uvicorn started (pid=$UVICORN_PID). Waiting 3s for startup..."
sleep 3

echo "Running test POST to /api/v2/mentor/chat"
curl_args=( -s -S -X POST "http://127.0.0.1:${PORT}/api/v2/mentor/chat" -H "Content-Type: application/json" )
if [[ -n "$TEST_TOKEN" ]]; then
  curl_args+=( -H "Authorization: Bearer ${TEST_TOKEN}" )
fi
curl_args+=( -d '{"message":"Ahoj test","recent_messages":[]}' )

set +e
HTTP_OUT=$(curl "${curl_args[@]}" -w "\n__HTTP_STATUS__:%{http_code}\n" 2>&1)
RET=$?
set -e

echo "--- curl output start ---"
echo "$HTTP_OUT"
echo "--- curl output end ---"

echo "--- last 200 lines of backend log ---"
tail -n 200 "$LOGFILE" || true

echo "Stopping uvicorn (pid=$UVICORN_PID)"
kill "$UVICORN_PID" || true
rm -f "$PIDFILE"

popd >/dev/null

echo "Diagnostic finished. Share the curl output and the log excerpt above for analysis."
