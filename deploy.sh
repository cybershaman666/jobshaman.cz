#!/bin/bash
# Kompletní deploy FE i BE na Azure (production)
# POZOR: musíš být přihlášen přes az login a mít potřebná práva na ACR i SWA i Container App!

set -euo pipefail

# Nastavení proměnných
RESOURCE_GROUP="jobshaman-prod"
SUBSCRIPTION_ID="11888792-a2ac-495b-b5d4-0210ea95dd52"

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
# Předpokládá se build/push docker image a update Azure Container App
CONTAINER_APP_NAME="jobshaman-api"
ACR_NAME="mangorock"
IMAGE_NAME="jobshaman-api"
IMAGE_TAG=$(git rev-parse --short HEAD)

echo "Docker build..."
docker build -t $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG ./backend

echo "Docker přihlášení k ACR..."
az acr login --name "$ACR_NAME"

echo "Push image do ACR..."
docker push $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG

echo "Update Azure Container App na novou image..."
az containerapp update \
    --name "$CONTAINER_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG" \
    --subscription "$SUBSCRIPTION_ID"

echo
echo "==== HOTOVO ===="
echo "FE: https://delightful-rock-0214a0903.7.azurestaticapps.net/"
echo "BE: https://jobshaman-api.mangorock-7014fb1a.northeurope.azurecontainerapps.io/health"