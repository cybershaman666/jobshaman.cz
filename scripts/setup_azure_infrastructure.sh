#!/bin/bash
# Azure Infrastructure Setup Script for JobShaman
# This script creates all necessary Azure resources for production deployment

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-jobshaman-prod}"
LOCATION="${AZURE_LOCATION:-westeurope}"
ACR_NAME="${AZURE_ACR_NAME:-jobshamanacr}"
DB_NAME="${AZURE_DB_NAME:-jobshaman-db}"
APP_INSIGHTS_NAME="${AZURE_APP_INSIGHTS_NAME:-jobshaman-insights}"
KEYVAULT_NAME="${AZURE_KEYVAULT_NAME:-jobshaman-vault}"
CONTAINER_APP_ENV="${AZURE_CONTAINER_APP_ENV:-jobshaman-env}"
CONTAINER_APP_NAME="${AZURE_CONTAINER_APP_NAME:-jobshaman-api}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   JobShaman - Azure Infrastructure Setup                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Create Resource Group
echo -e "${YELLOW}📁 Step 1: Creating Resource Group...${NC}"
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --tags project=jobshaman environment=production
echo -e "${GREEN}✅ Resource Group created: $RESOURCE_GROUP${NC}\n"

# Step 2: Create Azure Container Registry
echo -e "${YELLOW}🐳 Step 2: Creating Azure Container Registry...${NC}"
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true
echo -e "${GREEN}✅ ACR created: $ACR_NAME${NC}\n"

# Step 3: Create PostgreSQL Database
echo -e "${YELLOW}🗄️  Step 3: Creating Azure Database for PostgreSQL...${NC}"

# Generate secure password
DB_ADMIN_PASSWORD=$(openssl rand -base64 32)

az postgres flexible-server create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$DB_NAME" \
  --location "$LOCATION" \
  --admin-user dbadmin \
  --admin-password "$DB_ADMIN_PASSWORD" \
  --tier Burstable \
  --sku-name Standard_B1ms \
  --storage-size 32 \
  --backup-retention 7 \
  --geo-redundant-backup Enabled \
  --high-availability Disabled \
  --version 15

echo -e "${GREEN}✅ PostgreSQL Database created: $DB_NAME${NC}"
echo -e "${YELLOW}   Admin password saved to: $HOME/.jobshaman-db-password${NC}"
echo "$DB_ADMIN_PASSWORD" > "$HOME/.jobshaman-db-password"
chmod 600 "$HOME/.jobshaman-db-password"

# Allow Azure services to access database
echo -e "${YELLOW}   Configuring firewall...${NC}"
az postgres flexible-server firewall-rule create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$DB_NAME" \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

echo -e "${GREEN}✅ Firewall configured${NC}\n"

# Step 4: Create Application Insights
echo -e "${YELLOW}📊 Step 4: Creating Application Insights...${NC}"
az monitor app-insights component create \
  --app "$APP_INSIGHTS_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --application-type web
echo -e "${GREEN}✅ Application Insights created${NC}\n"

# Step 5: Create Key Vault
echo -e "${YELLOW}🔐 Step 5: Creating Azure Key Vault...${NC}"
az keyvault create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$KEYVAULT_NAME" \
  --location "$LOCATION" \
  --enable-rbac-authorization true
echo -e "${GREEN}✅ Key Vault created: $KEYVAULT_NAME${NC}\n"

# Step 6: Create Container Apps Environment
echo -e "${YELLOW}🚀 Step 6: Creating Container Apps Environment...${NC}"
az containerapp env create \
  --name "$CONTAINER_APP_ENV" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION"
echo -e "${GREEN}✅ Container Apps Environment created${NC}\n"

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ✅ Infrastructure Setup Complete                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Created Resources:${NC}"
echo "  📁 Resource Group: $RESOURCE_GROUP"
echo "  🐳 Container Registry: $ACR_NAME"
echo "  🗄️  PostgreSQL Database: $DB_NAME"
echo "  📊 Application Insights: $APP_INSIGHTS_NAME"
echo "  🔐 Key Vault: $KEYVAULT_NAME"
echo "  🚀 Container Apps Environment: $CONTAINER_APP_ENV"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Store secrets in Key Vault:"
echo "     ./scripts/setup_keyvault_secrets.sh"
echo ""
echo "  2. Build and push Docker images:"
echo "     az acr build --registry $ACR_NAME --image jobshaman-api:latest --file backend/Dockerfile ."
echo ""
echo "  3. Deploy backend Container App:"
echo "     ./scripts/deploy_container_app.sh"
echo ""
