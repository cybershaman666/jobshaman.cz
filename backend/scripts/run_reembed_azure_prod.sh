#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

export DATABASE_URL
export AZURE_OPENAI_API_KEY
export AZURE_OPENAI_ENDPOINT="${AZURE_OPENAI_ENDPOINT:-https://jobshaman.cognitiveservices.azure.com}"
export AZURE_OPENAI_DEPLOYMENT_NAME="${AZURE_OPENAI_DEPLOYMENT_NAME:-gpt-5-mini}"
export AZURE_AI_EMBEDDING_MODEL="${AZURE_AI_EMBEDDING_MODEL:-text-embedding-3-large}"
export AZURE_AI_EMBEDDING_DIMENSIONS="${AZURE_AI_EMBEDDING_DIMENSIONS:-1024}"
export AZURE_AI_EMBEDDING_BATCH_SIZE="${AZURE_AI_EMBEDDING_BATCH_SIZE:-100}"
export UV_CACHE_DIR="${UV_CACHE_DIR:-/tmp/uv-cache}"

DATABASE_URL="$(az keyvault secret show --vault-name jobshaman-vault --name DATABASE-URL --query value -o tsv)"
AZURE_OPENAI_API_KEY="$(az keyvault secret show --vault-name jobshaman-vault --name AZURE-OPENAI-API-KEY --query value -o tsv)"

exec uv run \
  --with sqlalchemy \
  --with sqlmodel \
  --with asyncpg \
  --with requests \
  --with python-dotenv \
  --with pydantic \
  --with supabase \
  --with pymongo \
  python backend/scripts/reembed_azure_jobs.py \
    --force \
    --batch-size "${REEMBED_BATCH_SIZE:-500}" \
    --refresh-recommendations
