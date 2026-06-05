#!/bin/bash
# Kompletní deploy FE i BE na Azure (production)
# POZOR: musíš být přihlášen přes az login a mít potřebná práva na ACR i SWA i Container App!

set -euo pipefail

# Nastavení proměnných
RESOURCE_GROUP="jobshaman-prod"
SUBSCRIPTION_ID="11888792-a2ac-495b-b5d4-0210ea95dd52"

echo "==== NASTAVENÍ AZURE SUBSCRIPTION ===="
az account set --subscription "$SUBSCRIPTION_ID"

### --- FRONTEND --- ###
echo "==== BUILD FRONTENDU ===="
cd frontend
npm install
npm run build
cd ..

echo "==== DEPLOY FRONTENDU NA AZURE SWA ===="
# Nutné mít nainstalovaný @azure/static-web-apps-cli
APP_NAME="jobshaman-web"

DEPLOYMENT_TOKEN=$(az staticwebapp secrets list --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query properties.apiKey -o tsv)
SWA_CLI_DEPLOYMENT_TOKEN="$DEPLOYMENT_TOKEN" npx -y @azure/static-web-apps-cli deploy ./frontend/dist --env production --app-name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --subscription-id "$SUBSCRIPTION_ID" --no-use-keychain

### --- BACKEND --- ###
echo "==== BUILD & DEPLOY BACKENDU ===="
CONTAINER_APP_NAME="jobshaman-api"
ACR_NAME="jobshamanacr"
IMAGE_NAME="jobshaman-api"
IMAGE_TAG=$(git rev-parse --short HEAD)

echo "Build a push image v cloudu přes Azure ACR build..."
az acr build \
    --registry "$ACR_NAME" \
    --image "$IMAGE_NAME:$IMAGE_TAG" \
    --image "$IMAGE_NAME:latest" \
    --file backend/Dockerfile \
    .

echo "Update Azure Container App na novou image..."
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
az containerapp update \
    --name "$CONTAINER_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG" \
    --subscription "$SUBSCRIPTION_ID" \
    --set-env-vars V2_DEPLOY_TIME="$NOW"

echo
echo "==== HOTOVO ===="
echo "FE: https://delightful-rock-0214a0903.7.azurestaticapps.net/"
echo "BE: https://jobshaman-api.mangorock-7014fb1a.northeurope.azurecontainerapps.io/health"