#!/bin/bash
# Deploy backend to Azure Container Apps
# Prerequisites:
#   - Azure Container Registry must have the image built
#   - Container Apps Environment must exist
#   - Key Vault must be configured with secrets

set -e

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-jobshaman-prod}"
ACR_NAME="${AZURE_ACR_NAME:-jobshamanacr}"
CONTAINER_APP_ENV="${AZURE_CONTAINER_APP_ENV:-jobshaman-env}"
CONTAINER_APP_NAME="${AZURE_CONTAINER_APP_NAME:-jobshaman-api}"
KEYVAULT_NAME="${AZURE_KEYVAULT_NAME:-jobshaman-vault}"
IMAGE="${ACR_NAME}.azurecr.io/jobshaman-api:latest"

echo "🚀 Deploying JobShaman Backend to Azure Container Apps"
echo "   Environment: $CONTAINER_APP_ENV"
echo "   App: $CONTAINER_APP_NAME"
echo ""

# Build and push image
echo "📦 Building Docker image..."
az acr build \
  --registry "$ACR_NAME" \
  --image jobshaman-api:latest \
  --file backend/Dockerfile \
  .

echo "✅ Image built and pushed"
echo ""

# Create or update Container App
echo "🌐 Creating/updating Container App..."

# Get current user ID for Key Vault access
CURRENT_USER_ID=$(az account show --query id -o tsv)

# Create Container App YAML
cat > /tmp/container_app.yaml << 'EOF'
apiVersion: containerapp.k8s.io/v1beta1
kind: ContainerApp
metadata:
  name: CONTAINER_APP_NAME
  resourceGroup: RESOURCE_GROUP
  managedEnvironmentId: /subscriptions/{subscription}/resourceGroups/RESOURCE_GROUP/providers/Microsoft.App/managedEnvironments/CONTAINER_APP_ENV
spec:
  template:
    containers:
    - name: api
      image: IMAGE
      resources:
        cpu: 0.5
        memory: 1.0Gi
      env:
      - name: PORT
        value: "8080"
      - name: ENABLE_BACKGROUND_SCHEDULER
        value: "true"
      - name: ENABLE_DAILY_DIGESTS
        value: "true"
      - name: SUPABASE_URL
        secretRef: supabase-url
      - name: SUPABASE_SERVICE_ROLE_KEY
        secretRef: supabase-service-role-key
      - name: DATABASE_URL
        secretRef: database-url
      - name: JWT_SECRET
        secretRef: jwt-secret
      - name: STRIPE_SECRET_KEY
        secretRef: stripe-secret-key
      - name: STRIPE_WEBHOOK_SECRET
        secretRef: stripe-webhook-secret
      - name: OPENAI_API_KEY
        secretRef: openai-api-key
      - name: AI_PROVIDER
        value: "azure"
      - name: AZURE_OPENAI_API_KEY
        secretRef: azure-openai-api-key
      - name: AZURE_OPENAI_ENDPOINT
        secretRef: azure-openai-endpoint
      - name: AZURE_OPENAI_DEPLOYMENT_NAME
        value: "gpt-5-mini"
      - name: AZURE_OPENAI_API_VERSION
        value: "2024-10-21"
      - name: AZURE_AI_API_VERSION
        value: "2024-05-01-preview"
      - name: AZURE_AI_EMBEDDING_MODEL
        value: "text-embedding-3-large"
      - name: AZURE_AI_EMBEDDING_DIMENSIONS
        value: "1024"
      - name: RESEND_API_KEY
        secretRef: resend-api-key
      - name: SENTRY_DSN
        secretRef: sentry-dsn
      - name: API_BASE_URL
        value: "https://api.jobshaman.cz"
      - name: APP_PUBLIC_URL
        value: "https://jobshaman.cz"
      - name: ALLOWED_ORIGINS
        value: "https://jobshaman.cz,https://www.jobshaman.cz"
      probes:
      - type: Liveness
        httpGet:
          path: /health
          port: 8080
        initialDelaySeconds: 10
        periodSeconds: 10
        failureThreshold: 3
      - type: Readiness
        httpGet:
          path: /health
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 5
        failureThreshold: 2
    scale:
      minReplicas: 2
      maxReplicas: 5
      rules:
      - name: cpu
        custom:
          rule: cpu
          target: "70"
      - name: memory
        custom:
          rule: memory
          target: "80"
  configuration:
    ingress:
      external: true
      targetPort: 8080
      allowInsecure: false
      traffic:
      - latest: 100
    registries:
    - server: ACR_NAME.azurecr.io
      identity: /subscriptions/{subscription}/resourceGroups/RESOURCE_GROUP/providers/Microsoft.ManagedIdentity/userAssignedIdentities/jobshaman-acr-identity
    secrets:
    - name: supabase-url
      keyVaultUrl: https://KEYVAULT_NAME.vault.azure.net/secrets/SUPABASE-URL/
      identity: /subscriptions/{subscription}/resourceGroups/RESOURCE_GROUP/providers/Microsoft.ManagedIdentity/userAssignedIdentities/jobshaman-keyvault-identity
    - name: supabase-service-role-key
      keyVaultUrl: https://KEYVAULT_NAME.vault.azure.net/secrets/SUPABASE-SERVICE-ROLE-KEY/
      identity: /subscriptions/{subscription}/resourceGroups/RESOURCE_GROUP/providers/Microsoft.ManagedIdentity/userAssignedIdentities/jobshaman-keyvault-identity
    - name: database-url
      keyVaultUrl: https://KEYVAULT_NAME.vault.azure.net/secrets/DATABASE-URL/
      identity: /subscriptions/{subscription}/resourceGroups/RESOURCE_GROUP/providers/Microsoft.ManagedIdentity/userAssignedIdentities/jobshaman-keyvault-identity
    - name: jwt-secret
      keyVaultUrl: https://KEYVAULT_NAME.vault.azure.net/secrets/JWT-SECRET/
      identity: /subscriptions/{subscription}/resourceGroups/RESOURCE_GROUP/providers/Microsoft.ManagedIdentity/userAssignedIdentities/jobshaman-keyvault-identity
    - name: stripe-secret-key
      keyVaultUrl: https://KEYVAULT_NAME.vault.azure.net/secrets/STRIPE-SECRET-KEY/
      identity: /subscriptions/{subscription}/resourceGroups/RESOURCE_GROUP/providers/Microsoft.ManagedIdentity/userAssignedIdentities/jobshaman-keyvault-identity
    - name: stripe-webhook-secret
      keyVaultUrl: https://KEYVAULT_NAME.vault.azure.net/secrets/STRIPE-WEBHOOK-SECRET/
      identity: /subscriptions/{subscription}/resourceGroups/RESOURCE_GROUP/providers/Microsoft.ManagedIdentity/userAssignedIdentities/jobshaman-keyvault-identity
    - name: openai-api-key
      keyVaultUrl: https://KEYVAULT_NAME.vault.azure.net/secrets/OPENAI-API-KEY/
      identity: /subscriptions/{subscription}/resourceGroups/RESOURCE_GROUP/providers/Microsoft.ManagedIdentity/userAssignedIdentities/jobshaman-keyvault-identity
    - name: azure-openai-api-key
      keyVaultUrl: https://KEYVAULT_NAME.vault.azure.net/secrets/AZURE-OPENAI-API-KEY/
      identity: /subscriptions/{subscription}/resourceGroups/RESOURCE_GROUP/providers/Microsoft.ManagedIdentity/userAssignedIdentities/jobshaman-keyvault-identity
    - name: azure-openai-endpoint
      keyVaultUrl: https://KEYVAULT_NAME.vault.azure.net/secrets/AZURE-OPENAI-ENDPOINT/
      identity: /subscriptions/{subscription}/resourceGroups/RESOURCE_GROUP/providers/Microsoft.ManagedIdentity/userAssignedIdentities/jobshaman-keyvault-identity
    - name: resend-api-key
      keyVaultUrl: https://KEYVAULT_NAME.vault.azure.net/secrets/RESEND-API-KEY/
      identity: /subscriptions/{subscription}/resourceGroups/RESOURCE_GROUP/providers/Microsoft.ManagedIdentity/userAssignedIdentities/jobshaman-keyvault-identity
    - name: sentry-dsn
      keyVaultUrl: https://KEYVAULT_NAME.vault.azure.net/secrets/SENTRY-DSN/
      identity: /subscriptions/{subscription}/resourceGroups/RESOURCE_GROUP/providers/Microsoft.ManagedIdentity/userAssignedIdentities/jobshaman-keyvault-identity
EOF

# Use Azure CLI to create/update the container app directly
az containerapp create \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$CONTAINER_APP_ENV" \
  --image "$IMAGE" \
  --target-port 8080 \
  --ingress external \
  --cpu 0.5 \
  --memory 1.0 \
  --min-replicas 2 \
  --max-replicas 5 \
  --env-vars \
    PORT=8080 \
    ENABLE_BACKGROUND_SCHEDULER=true \
    ENABLE_DAILY_DIGESTS=true \
    AI_PROVIDER=azure \
    AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5-mini \
    AZURE_OPENAI_API_VERSION=2024-10-21 \
    AZURE_AI_API_VERSION=2024-05-01-preview \
    AZURE_AI_EMBEDDING_MODEL=text-embedding-3-large \
    AZURE_AI_EMBEDDING_DIMENSIONS=1024 \
    AZURE_OPENAI_API_KEY=secretref:azure-openai-api-key \
    AZURE_OPENAI_ENDPOINT=secretref:azure-openai-endpoint \
    API_BASE_URL=https://api.jobshaman.cz \
    APP_PUBLIC_URL=https://jobshaman.cz \
    ALLOWED_ORIGINS="https://jobshaman.cz,https://www.jobshaman.cz" \
  --secrets \
    "supabase-url=keyvaultref@https://${KEYVAULT_NAME}.vault.azure.net/secrets/SUPABASE-URL/" \
    "supabase-service-role-key=keyvaultref@https://${KEYVAULT_NAME}.vault.azure.net/secrets/SUPABASE-SERVICE-ROLE-KEY/" \
    "database-url=keyvaultref@https://${KEYVAULT_NAME}.vault.azure.net/secrets/DATABASE-URL/" \
    "jwt-secret=keyvaultref@https://${KEYVAULT_NAME}.vault.azure.net/secrets/JWT-SECRET/" \
    "stripe-secret-key=keyvaultref@https://${KEYVAULT_NAME}.vault.azure.net/secrets/STRIPE-SECRET-KEY/" \
    "stripe-webhook-secret=keyvaultref@https://${KEYVAULT_NAME}.vault.azure.net/secrets/STRIPE-WEBHOOK-SECRET/" \
    "openai-api-key=keyvaultref@https://${KEYVAULT_NAME}.vault.azure.net/secrets/OPENAI-API-KEY/" \
    "azure-openai-api-key=keyvaultref@https://${KEYVAULT_NAME}.vault.azure.net/secrets/AZURE-OPENAI-API-KEY/" \
    "azure-openai-endpoint=keyvaultref@https://${KEYVAULT_NAME}.vault.azure.net/secrets/AZURE-OPENAI-ENDPOINT/" \
    "resend-api-key=keyvaultref@https://${KEYVAULT_NAME}.vault.azure.net/secrets/RESEND-API-KEY/" \
    "sentry-dsn=keyvaultref@https://${KEYVAULT_NAME}.vault.azure.net/secrets/SENTRY-DSN/" \
  --registry-server "${ACR_NAME}.azurecr.io" \
  --registry-identity system \
  --health-probe-path /health \
  --health-probe-interval 10 \
  --health-probe-timeout 5 \
  --health-probe-failure-count-threshold 3

echo "✅ Container App created/updated"
echo ""

# Get the FQDN
FQDN=$(az containerapp show \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

echo "🌐 Container App URL: https://$FQDN"
echo ""

# Test health endpoint
echo "🏥 Testing health endpoint..."
sleep 5
curl -s "https://$FQDN/health" | jq . || echo "Health check in progress..."

echo ""
echo "✅ Deployment complete!"
