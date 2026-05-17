#!/bin/bash
# Build, push a redeployne aktualizovaný backend do Azure Container Group

set -e

REGISTRY="jobshamanacr.azurecr.io"
IMAGE="$REGISTRY/jobshaman-api:latest"
RESOURCEGROUP="jobshaman-prod"
CONTAINERS="jobshaman-api-cg"

echo "=== Přihlášení k Azure ACR: $REGISTRY"
az acr login --name jobshamanacr

echo "=== Build backend Docker image ==="
docker build -t $IMAGE backend

echo "=== Push do ACR ==="
docker push $IMAGE

echo "=== Aktualizace Azure Container App: jobshaman-api ==="
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
az containerapp update --name jobshaman-api --resource-group $RESOURCEGROUP --image $IMAGE --set-env-vars V2_DEPLOY_TIME="$NOW"

echo "=== Restartování Azure Container Group ==="
# Nejpřímější restart = stop/start přes az CLI:
az container stop --name $CONTAINERS --resource-group $RESOURCEGROUP
sleep 5
az container start --name $CONTAINERS --resource-group $RESOURCEGROUP

echo "=== Hotovo. Nový backend nasazen na $IMAGE a Container App aktualizována na $NOW ==="