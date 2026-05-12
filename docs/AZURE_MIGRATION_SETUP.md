# Azure Migration Environment Setup

Tento soubor obsahuje konkrétní instrukce a environment variables pro migraci JobShaman na Azure.

## 1. Lokální Příprava

### 1.1 Instalace Azure CLI

```bash
# macOS
brew install azure-cli

# Linux (Ubuntu/Debian)
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Ověřit instalaci
az --version
```

### 1.2 Přihlášení do Azure

```bash
# Interaktivní přihlášení
az login

# Nebo přihlášení s service principal (CI/CD)
az login --service-principal \
  -u <app-id> \
  -p <password> \
  --tenant <tenant-id>

# Nastavit default subscription
az account set --subscription <subscription-id>
```

### 1.3 Konfigurační Proměnné

Vytvořit soubor `./scripts/.env.azure` (NIKDY do gitu!):

```bash
# Azure Configuration
export AZURE_RESOURCE_GROUP="jobshaman-prod"
export AZURE_LOCATION="westeurope"
export AZURE_SUBSCRIPTION_ID="<your-subscription-id>"
export AZURE_TENANT_ID="<your-tenant-id>"

# Services
export AZURE_ACR_NAME="jobshamanacr"
export AZURE_DB_NAME="jobshaman-db"
export AZURE_KEYVAULT_NAME="jobshaman-vault"
export AZURE_CONTAINER_APP_ENV="jobshaman-env"
export AZURE_CONTAINER_APP_NAME="jobshaman-api"
export AZURE_APP_INSIGHTS_NAME="jobshaman-insights"

# CI/CD (GitHub)
export AZURE_CLIENT_ID="<service-principal-app-id>"
export AZURE_TENANT_ID="<service-principal-tenant-id>"
export AZURE_SUBSCRIPTION_ID="<subscription-id>"
```

Načíst před spuštěním skriptů:
```bash
source ./scripts/.env.azure
```

---

## 2. Infrastruktura Setup

### 2.1 Spustit Setup Skript

```bash
chmod +x ./scripts/setup_azure_infrastructure.sh
./scripts/setup_azure_infrastructure.sh
```

Skript vytvoří:
- ✅ Resource Group
- ✅ Azure Container Registry
- ✅ PostgreSQL Database
- ✅ Application Insights
- ✅ Key Vault
- ✅ Container Apps Environment

### 2.2 Ověřit Vytvořené Prostředky

```bash
# Zobrazit všechny resources
az resource list \
  --resource-group jobshaman-prod \
  --output table

# Zkontrolovat Database
az postgres flexible-server show \
  --resource-group jobshaman-prod \
  --name jobshaman-db

# Zkontrolovat ACR
az acr show \
  --resource-group jobshaman-prod \
  --name jobshamanacr
```

---

## 3. Secrets Management

### 3.1 Nastavit Secrets v Key Vault

Nejdřív připravit `.env` soubory (z Northflank nebo lokálního dev prostředí):

```bash
# Zkopírovat existující environment variables
cp .env.production .env
cp backend/.env.example backend/.env

# Vyplnit skutečné hodnoty
nano .env
nano backend/.env
```

Pak spustit:
```bash
chmod +x ./scripts/setup_keyvault_secrets.sh
./scripts/setup_keyvault_secrets.sh
```

### 3.2 Ověřit Secrets

```bash
# Zobrazit všechny secrets
az keyvault secret list \
  --vault-name jobshaman-vault \
  --output table

# Ověřit konkrétní secret
az keyvault secret show \
  --vault-name jobshaman-vault \
  --name SUPABASE-URL
```

---

## 4. Docker Image Build & Push

### 4.1 Lokální Build (pro testing)

```bash
# Build image
docker build -f backend/Dockerfile -t jobshaman-api:local .

# Test image
docker run -it \
  -p 8080:8080 \
  -e SUPABASE_URL="https://..." \
  -e SUPABASE_SERVICE_ROLE_KEY="..." \
  -e JWT_SECRET="..." \
  jobshaman-api:local
```

### 4.2 Push do Azure Container Registry

```bash
# Přihlásit se k ACR
az acr login --name jobshamanacr

# Build a push v jednom kroku
az acr build \
  --registry jobshamanacr \
  --image jobshaman-api:latest \
  --image jobshaman-api:$(date +%s) \
  --file backend/Dockerfile \
  .

# Ověřit image
az acr repository show \
  --name jobshamanacr \
  --repository jobshaman-api
```

---

## 5. Backend Deployment

### 5.1 Deployovat do Container Apps

```bash
chmod +x ./scripts/deploy_azure_container_app.sh
./scripts/deploy_azure_container_app.sh
```

### 5.2 Monitoring Deployment

```bash
# Zobrazit Container App status
az containerapp show \
  --name jobshaman-api \
  --resource-group jobshaman-prod \
  --output json | jq '.properties.provisioningState'

# Streamovat logs v reálném čase
az containerapp logs show \
  --name jobshaman-api \
  --resource-group jobshaman-prod \
  --container-name api \
  --follow

# Zobrazit poslední 50 řádků logů
az containerapp logs show \
  --name jobshaman-api \
  --resource-group jobshaman-prod \
  --container-name api \
  --tail 50
```

### 5.3 Test Backend

```bash
# Získat FQDN
CONTAINER_APP_FQDN=$(az containerapp show \
  --name jobshaman-api \
  --resource-group jobshaman-prod \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

# Test health endpoint
curl https://$CONTAINER_APP_FQDN/healthz

# Test s data
curl -s https://$CONTAINER_APP_FQDN/api/v2/tests/jcfpm/diagnostics \
  -H "Authorization: Bearer <JWT_TOKEN>" | jq .

# Test database connection
curl -s https://$CONTAINER_APP_FQDN/api/v2/health/db | jq .
```

---

## 6. Frontend Deployment (Static Web Apps)

### 6.1 Vytvořit Static Web App

```bash
az staticwebapp create \
  --resource-group jobshaman-prod \
  --name jobshaman-web \
  --source https://github.com/<org>/jobshaman-new \
  --branch main \
  --app-location "frontend" \
  --output-location "dist" \
  --app-build-command "npm run build"
```

### 6.2 Nakonfigurovat Environment Variables

```bash
# V Azure Portal nebo CLI:
az staticwebapp appsettings set \
  --name jobshaman-web \
  --resource-group jobshaman-prod \
  --setting-names \
    VITE_BACKEND_URL="https://api.jobshaman.cz" \
    VITE_SUPABASE_URL="https://..." \
    VITE_SUPABASE_ANON_KEY="..." \
    VITE_ENVIRONMENT="production"
```

### 6.3 Ověřit Build & Deployment

```bash
# Zobrazit build history
az staticwebapp builds list \
  --name jobshaman-web \
  --resource-group jobshaman-prod

# Zobrazit deployment detail
az staticwebapp show \
  --name jobshaman-web \
  --resource-group jobshaman-prod
```

---

## 7. Database Migration

### 7.1 Export z Supabase

```bash
# Exportovat SQL dump z Supabase
pg_dump \
  -h db.*.supabase.co \
  -U postgres \
  -d postgres \
  --no-password \
  > supabase_dump.sql

# Nebo s PGPASSWORD
PGPASSWORD="<password>" pg_dump \
  -h db.*.supabase.co \
  -U postgres \
  > supabase_dump.sql
```

### 7.2 Import do Azure PostgreSQL

```bash
# Získat PostgreSQL credentials z Azure
DB_HOST="jobshaman-db.postgres.database.azure.com"
DB_USER="dbadmin@jobshaman-db"
DB_PASSWORD=$(cat ~/.jobshaman-db-password)

# Import SQL dump
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d jobshaman \
  -f supabase_dump.sql

# Ověřit import
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d jobshaman \
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
```

### 7.3 Nastavit Connection String

```bash
DATABASE_URL="postgresql://appuser:password@jobshaman-db.postgres.database.azure.com:5432/jobshaman?sslmode=require"

# Uložit do Key Vault
az keyvault secret set \
  --vault-name jobshaman-vault \
  --name DATABASE-URL \
  --value "$DATABASE_URL"
```

---

## 8. Runtime Services

### 8.1 Scraper Job (Azure Container Instances + Automation)

```bash
# Vytvořit Automation Account
az automation account create \
  --name jobshaman-automation \
  --resource-group jobshaman-prod \
  --location westeurope

# Crear Container Instance image
az acr build \
  --registry jobshamanacr \
  --image jobshaman-scraper:latest \
  --file backend/Dockerfile \
  .

# Spustit Container Instance (jednorázově pro test)
az container create \
  --resource-group jobshaman-prod \
  --name scraper-test-run \
  --image jobshamanacr.azurecr.io/jobshaman-scraper:latest \
  --registry-login-server jobshamanacr.azurecr.io \
  --registry-username <acr-username> \
  --registry-password <acr-password> \
  --cpu 2 \
  --memory 4 \
  --environment-variables \
    JOBS_POSTGRES_ENABLED=true \
    JOBS_POSTGRES_WRITE_MAIN=true \
    SCRAPER_JOB_COUNTRIES="CZ,AT,DE,SK,PL" \
  --command-line "/bin/bash -c 'python scripts/start_azure_scraper.py'"
```

### 8.2 Daily Digest (Azure Timer Functions)

```bash
# Vytvořit Function App
az functionapp create \
  --resource-group jobshaman-prod \
  --consumption-plan-location westeurope \
  --name jobshaman-functions \
  --storage-account jobshamanst \
  --runtime python \
  --runtime-version 3.11 \
  --functions-version 4

# Deploy Timer Trigger Function
# (soubory v azure-functions/TimerDigest/)
func azure functionapp publish jobshaman-functions
```

---

## 9. DNS Setup

### 9.1 Static Web Apps Custom Domain

```bash
# Přidat custom domain
az staticwebapp custom-domain set \
  --name jobshaman-web \
  --resource-group jobshaman-prod \
  --domain-name jobshaman.cz

# Získat TXT record pro ověření
az staticwebapp custom-domain show \
  --name jobshaman-web \
  --resource-group jobshaman-prod \
  --domain-name jobshaman.cz
```

### 9.2 Container Apps Custom Domain

```bash
# Přidat custom domain k Container App ingress
az containerapp ingress update \
  --name jobshaman-api \
  --resource-group jobshaman-prod \
  --host-name api.jobshaman.cz
```

### 9.3 DNS Records (v registraru/DNS provideru)

```bash
# Static Web Apps (z Azure portal - kopírovat CNAME)
CNAME jobshaman.cz -> <azure-generated-domain>

# Container Apps (z Azure portal)
CNAME api.jobshaman.cz -> <container-app-fqdn>

# Ověřit DNS propagaci
nslookup jobshaman.cz
nslookup api.jobshaman.cz
```

---

## 10. Monitoring & Alerts

### 10.1 Application Insights

```bash
# Propojit Container App s Application Insights
az containerapp update \
  --name jobshaman-api \
  --resource-group jobshaman-prod \
  --application-insights-key $(az monitor app-insights component show \
    --app jobshaman-insights \
    --resource-group jobshaman-prod \
    --query instrumentationKey \
    --output tsv)
```

### 10.2 Nastavit Alerty

```bash
# Alert na vysoké CPU
az monitor metrics alert create \
  --name api-high-cpu \
  --resource-group jobshaman-prod \
  --scopes $(az containerapp show \
    --name jobshaman-api \
    --resource-group jobshaman-prod \
    --query id \
    --output tsv) \
  --condition "avg Percentage CPU > 80" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --severity 2

# Alert na chyby v Application Insights
az monitor log-analytics query create \
  --workspace-name jobshaman-insights \
  --query 'customEvents | where name == "Exception" | count by tostring(customDimensions.errorCode)'
```

---

## 11. Cutover Checklist

Kopírovat a vyplnit:

```
INFRASTRUCTURE SETUP
✅ [ ] Resource Group vytvořen
✅ [ ] ACR vytvořen
✅ [ ] PostgreSQL Database vytvořen
✅ [ ] Application Insights vytvořen
✅ [ ] Key Vault vytvořen
✅ [ ] Secrets nakonfigurované

BACKEND
✅ [ ] Docker image buildován
✅ [ ] Image pushnutý do ACR
✅ [ ] Container App deployován
✅ [ ] Health endpoint vrací 200
✅ [ ] Environment variables nastaveny
✅ [ ] Database migrace OK
✅ [ ] Logs v Application Insights

FRONTEND
✅ [ ] Static Web App vytvořena
✅ [ ] Build skončil úspěšně
✅ [ ] Environment variables nastaveny
✅ [ ] SPA routing funguje
✅ [ ] HTTPS/SSL certificate OK

RUNTIME SERVICES
✅ [ ] Scraper job test OK
✅ [ ] Daily digest Timer Function OK
✅ [ ] Search API Container App OK

DNS
✅ [ ] Custom domain CNAME přidáno
✅ [ ] DNS propagace ověřena
✅ [ ] API domain funguje
✅ [ ] Frontend domain funguje

FINAL TESTS
✅ [ ] Backend /healthz vrací 200
✅ [ ] Frontend se načítá
✅ [ ] API komunikace funguje
✅ [ ] Autentifikace OK
✅ [ ] Databáze dotazy OK
✅ [ ] Stripe webhook OK
✅ [ ] Email (Resend) OK

CLEANUP
✅ [ ] Northflank v standby režimu
✅ [ ] Monitoring Azure 24h
✅ [ ] Logs archivovány
✅ [ ] Northflank deprovisioning (pokud OK)
```

---

## 12. Troubleshooting

### Container App se nepouští

```bash
# Zkontrolovat logs
az containerapp logs show \
  --name jobshaman-api \
  --resource-group jobshaman-prod \
  --container-name api \
  --follow

# Zkontrolovat environment variables
az containerapp show \
  --name jobshaman-api \
  --resource-group jobshaman-prod \
  --query properties.template.containers[0].env

# Zkontrolovat health probes
az containerapp show \
  --name jobshaman-api \
  --resource-group jobshaman-prod \
  --query properties.template.containers[0].probes
```

### Database connection error

```bash
# Ověřit PostgreSQL firewall
az postgres flexible-server firewall-rule list \
  --resource-group jobshaman-prod \
  --name jobshaman-db

# Zkontrolovat CONNECTION STRING
echo $DATABASE_URL

# Test připojení
psql $DATABASE_URL -c "SELECT 1;"
```

### Secrets nejsou dostupné

```bash
# Ověřit identity/RBAC
az keyvault role assignment list \
  --vault-name jobshaman-vault \
  --scope /subscriptions/<sub>/resourceGroups/jobshaman-prod

# Ověřit secret reference v Container App
az containerapp show \
  --name jobshaman-api \
  --resource-group jobshaman-prod \
  --query properties.configuration.secrets
```

---

## 13. CLI Quick Reference

```bash
# Monitoring
az containerapp logs show --name jobshaman-api --resource-group jobshaman-prod --follow
az monitor app-insights metrics show --app jobshaman-insights --resource-group jobshaman-prod --metric requests/count

# Scaling
az containerapp update --name jobshaman-api --resource-group jobshaman-prod --min-replicas 3 --max-replicas 10

# Updates
az containerapp update --name jobshaman-api --resource-group jobshaman-prod --image jobshamanacr.azurecr.io/jobshaman-api:v2.0

# Secrets
az keyvault secret show --vault-name jobshaman-vault --name JWT-SECRET
az keyvault secret set --vault-name jobshaman-vault --name NEW-SECRET --value "value"

# Database
psql postgresql://user@host:5432/db

# Cleanup (⚠️ DESTRUCTIVE)
az resource delete --resource-group jobshaman-prod --name jobshaman-api
az group delete --name jobshaman-prod --yes --no-wait
```

---

## 14. Support & Resources

- **Azure CLI Reference**: https://learn.microsoft.com/cli/azure/
- **Container Apps Docs**: https://learn.microsoft.com/azure/container-apps/
- **PostgreSQL Flexible Server**: https://learn.microsoft.com/azure/postgresql/flexible-server/
- **Static Web Apps**: https://learn.microsoft.com/azure/static-web-apps/
- **Application Insights**: https://learn.microsoft.com/azure/azure-monitor/app/app-insights-overview
- **GitHub Actions**: https://github.com/Azure/actions
