#!/bin/bash
# Script to setup secrets in Azure Key Vault
# Usage: ./setup_keyvault_secrets.sh

set -e

KEYVAULT_NAME="${AZURE_KEYVAULT_NAME:-jobshaman-vault}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-jobshaman-prod}"

echo "🔐 Setting up Azure Key Vault secrets for JobShaman"
echo ""
echo "Reading from .env files in:"
echo "  - .env (root)"
echo "  - backend/.env"
echo ""

# Function to set secret safely
set_secret() {
  local secret_name=$1
  local secret_value=$2
  
  if [ -z "$secret_value" ]; then
    echo "⏭️  Skipping empty secret: $secret_name"
    return
  fi
  
  # Convert to Azure-friendly name (uppercase, hyphens)
  azure_name=$(echo "$secret_name" | tr '_' '-')
  
  az keyvault secret set \
    --vault-name "$KEYVAULT_NAME" \
    --name "$azure_name" \
    --value "$secret_value" \
    --output none
  
  echo "✅ Set secret: $azure_name"
}

# Load from root .env
echo "Loading secrets from .env..."
if [ -f .env ]; then
  source .env
fi

# Load from backend/.env
echo "Loading secrets from backend/.env..."
if [ -f backend/.env ]; then
  source backend/.env
fi

# List of required secrets
echo ""
echo "Setting up required secrets..."

# Supabase
[ -n "$SUPABASE_URL" ] && set_secret "SUPABASE-URL" "$SUPABASE_URL"
[ -n "$SUPABASE_SERVICE_ROLE_KEY" ] && set_secret "SUPABASE-SERVICE-ROLE-KEY" "$SUPABASE_SERVICE_ROLE_KEY"
[ -n "$SUPABASE_KEY" ] && set_secret "SUPABASE-KEY" "$SUPABASE_KEY"

# Database
[ -n "$DATABASE_URL" ] && set_secret "DATABASE-URL" "$DATABASE_URL"
[ -n "$EXTERNAL_POSTGRES_URI" ] && set_secret "DATABASE-URL" "$EXTERNAL_POSTGRES_URI"

# JWT & Security
[ -n "$SECRET_KEY" ] && set_secret "JWT-SECRET" "$SECRET_KEY"
[ -n "$JWT_SECRET" ] && set_secret "JWT-SECRET" "$JWT_SECRET"

# Stripe
[ -n "$STRIPE_SECRET_KEY" ] && set_secret "STRIPE-SECRET-KEY" "$STRIPE_SECRET_KEY"
[ -n "$STRIPE_WEBHOOK_SECRET" ] && set_secret "STRIPE-WEBHOOK-SECRET" "$STRIPE_WEBHOOK_SECRET"

# Azure AI / OpenAI
[ -n "$AI_PROVIDER" ] && set_secret "AI-PROVIDER" "$AI_PROVIDER"
[ -n "$AZURE_OPENAI_API_KEY" ] && set_secret "AZURE-OPENAI-API-KEY" "$AZURE_OPENAI_API_KEY"
[ -n "$AZURE_OPENAI_ENDPOINT" ] && set_secret "AZURE-OPENAI-ENDPOINT" "$AZURE_OPENAI_ENDPOINT"
[ -n "$AZURE_OPENAI_DEPLOYMENT_NAME" ] && set_secret "AZURE-OPENAI-DEPLOYMENT-NAME" "$AZURE_OPENAI_DEPLOYMENT_NAME"
[ -n "$AZURE_OPENAI_API_VERSION" ] && set_secret "AZURE-OPENAI-API-VERSION" "$AZURE_OPENAI_API_VERSION"
[ -n "$AZURE_AI_API_KEY" ] && set_secret "AZURE-AI-API-KEY" "$AZURE_AI_API_KEY"
[ -n "$AZURE_AI_FOUNDRY_ENDPOINT" ] && set_secret "AZURE-AI-FOUNDRY-ENDPOINT" "$AZURE_AI_FOUNDRY_ENDPOINT"
[ -n "$AZURE_AI_ENDPOINT" ] && set_secret "AZURE-AI-ENDPOINT" "$AZURE_AI_ENDPOINT"
[ -n "$AZURE_AI_DEPLOYMENT_NAME" ] && set_secret "AZURE-AI-DEPLOYMENT-NAME" "$AZURE_AI_DEPLOYMENT_NAME"
[ -n "$AZURE_AI_API_VERSION" ] && set_secret "AZURE-AI-API-VERSION" "$AZURE_AI_API_VERSION"
[ -n "$AZURE_AI_EMBEDDING_MODEL" ] && set_secret "AZURE-AI-EMBEDDING-MODEL" "$AZURE_AI_EMBEDDING_MODEL"
[ -n "$AZURE_AI_EMBEDDING_DIMENSIONS" ] && set_secret "AZURE-AI-EMBEDDING-DIMENSIONS" "$AZURE_AI_EMBEDDING_DIMENSIONS"
[ -n "$OPENAI_API_KEY" ] && set_secret "OPENAI-API-KEY" "$OPENAI_API_KEY"
[ -n "$OPENAI_MODEL" ] && set_secret "OPENAI-MODEL" "$OPENAI_MODEL"
[ -n "$OPENAI_FALLBACK_MODEL" ] && set_secret "OPENAI-FALLBACK-MODEL" "$OPENAI_FALLBACK_MODEL"

# Email
[ -n "$RESEND_API_KEY" ] && set_secret "RESEND-API-KEY" "$RESEND_API_KEY"

# Monitoring
[ -n "$SENTRY_DSN" ] && set_secret "SENTRY-DSN" "$SENTRY_DSN"

# Google
[ -n "$GOOGLE_GENAI_API_KEY" ] && set_secret "GOOGLE-GENAI-API-KEY" "$GOOGLE_GENAI_API_KEY"

echo ""
echo "✅ All secrets configured in Key Vault: $KEYVAULT_NAME"
echo ""
echo "View secrets:"
echo "  az keyvault secret list --vault-name $KEYVAULT_NAME"
