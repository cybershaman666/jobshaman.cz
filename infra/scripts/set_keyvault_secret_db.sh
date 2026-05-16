#!/bin/bash
set -euo pipefail

usage(){
  cat <<EOF
Usage: $0 --vault-name <vault> --secret-name <name> --db-user <user> --db-pass <pass> --db-host <host> [--db-port 5432] --db-name <name>
This script sets DATABASE-URL in Azure Key Vault using az cli.
EOF
  exit 2
}

while [[ $# -gt 0 ]]; do
  key="$1"; shift
  case $key in
    --vault-name) VAULT_NAME="$1"; shift;;
    --secret-name) SECRET_NAME="$1"; shift;;
    --db-user) DB_USER="$1"; shift;;
    --db-pass) DB_PASS="$1"; shift;;
    --db-host) DB_HOST="$1"; shift;;
    --db-port) DB_PORT="$1"; shift;;
    --db-name) DB_NAME="$1"; shift;;
    *) echo "Unknown arg: $key"; usage;;
  esac
done

if [ -z "${VAULT_NAME:-}" ] || [ -z "${SECRET_NAME:-}" ] || [ -z "${DB_USER:-}" ] || [ -z "${DB_PASS:-}" ] || [ -z "${DB_HOST:-}" ] || [ -z "${DB_NAME:-}" ]; then
  usage
fi

DB_PORT=${DB_PORT:-5432}

CONN="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require"

echo "Setting secret ${SECRET_NAME} in vault ${VAULT_NAME}"
az keyvault secret set --vault-name "${VAULT_NAME}" --name "${SECRET_NAME}" --value "${CONN}"

echo "Secret set successfully"
