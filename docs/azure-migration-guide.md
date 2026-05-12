# JobShaman Migrace na Microsoft Azure

**Datum**: 12. května 2026  
**Aktuální stav**: Vercel (frontend) + Northflank (backend) → **Azure**

---

## 1. Přehled Azure Architektury

```
┌─────────────────────────────────────────────────────────┐
│ Azure Architecture                                      │
├─────────────────────────────────────────────────────────┤
│ Frontend                                                │
│ ├─ Azure Static Web Apps (SWA)                          │
│ │  └─ Automatický CI/CD z GitHub                        │
│ │  └─ Globální CDN                                      │
│ │  └─ Serverless (zdarma pro basic)                     │
│ │                                                       │
│ Backend (API)                                           │
│ ├─ Azure Container Apps                                │
│ │  └─ Docker image z Azure Container Registry          │
│ │  └─ Automatické scaling                              │
│ │  └─ Health checks & probes                           │
│ │  └─ Environment variables management                 │
│ │                                                       │
│ Scheduler/Workers                                       │
│ ├─ Azure Container Instances (scraper job)             │
│ │  └─ Time-triggered (Azure Automation)                │
│ ├─ Azure Timer Functions (daily digest, cron jobs)     │
│ │  └─ Serverless, pay-per-execution                    │
│ │                                                       │
│ Databáze                                                │
│ ├─ Azure Database for PostgreSQL (Flexible Server)     │
│ │  └─ Kompatibilní s Supabase migracemi                │
│ │  └─ Built-in backup & replication                    │
│ │  └─ Connection pooling                               │
│ │                                                       │
│ Storage & Services                                      │
│ ├─ Azure Key Vault (secrets management)                │
│ ├─ Azure Monitor & Application Insights (logging)      │
│ ├─ Azure CDN (image caching)                           │
│ └─ Azure Service Bus (message queuing - optional)      │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Krok 1: Příprava Azure Subscription & Infrastruktury

### 2.1 Vytvořit Resource Group
```bash
# CLI command
az group create \
  --name jobshaman-prod \
  --location westeurope
```

### 2.2 Vytvořit Azure Container Registry (ACR)
```bash
az acr create \
  --resource-group jobshaman-prod \
  --name jobshamanacr \
  --sku Basic
```

### 2.3 Vytvořit Azure Database for PostgreSQL - Flexible Server
```bash
az postgres flexible-server create \
  --resource-group jobshaman-prod \
  --name jobshaman-db \
  --admin-user dbadmin \
  --admin-password <STRONG_PASSWORD> \
  --tier Burstable \
  --sku-name Standard_B1ms \
  --storage-size 32 \
  --location westeurope
```

### 2.4 Vytvořit Azure Key Vault (pro secrets)
```bash
az keyvault create \
  --resource-group jobshaman-prod \
  --name jobshaman-vault \
  --location westeurope
```

Uložit všechny environment variables:
```bash
az keyvault secret set \
  --vault-name jobshaman-vault \
  --name SUPABASE-URL \
  --value "<SUPABASE_URL>"

az keyvault secret set \
  --vault-name jobshaman-vault \
  --name SUPABASE-SERVICE-ROLE-KEY \
  --value "<SERVICE_ROLE_KEY>"

# Opakovat pro všechny secrets: STRIPE_*, OPENAI_*, SENTRY_*, JWT_SECRET, atd.
```

---

## 3. Krok 2: Backend Migration

### 3.1 Připravit backend Docker image

**Existující Dockerfile již existuje:** `backend/Dockerfile`  
Proveřit, že je připraven pro production:

```dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app

CMD ["sh", "scripts/start_backend.sh"]
```

**Ověřit `backend/scripts/start_backend.sh`:**
```bash
#!/bin/bash
set -e

# Spustit migrace (pokud není vypnuto)
if [ "${RUN_DB_MIGRATIONS_ON_START}" != "false" ]; then
  python scripts/migrate_v2.py
fi

# Spustit API s Gunicorn
gunicorn backend.app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8080 \
  --access-logfile - \
  --error-logfile - \
  --log-level info
```

### 3.2 Nastavit Azure Container Apps

```yaml
# azure-container-app.yaml
apiVersion: containerapp.k8s.io/v1beta1
kind: ContainerApp
metadata:
  name: jobshaman-api
  resourceGroup: jobshaman-prod
spec:
  environmentId: /subscriptions/{subscription}/resourceGroups/jobshaman-prod/providers/Microsoft.App/managedEnvironments/jobshaman-env
  template:
    containers:
    - name: api
      image: jobshamanacr.azurecr.io/jobshaman-api:latest
      resources:
        cpu: 0.5
        memory: 1.0Gi
      env:
      - name: SUPABASE_URL
        secretRef: SUPABASE-URL
      - name: SUPABASE_SERVICE_ROLE_KEY
        secretRef: SUPABASE-SERVICE-ROLE-KEY
      - name: DATABASE_URL
        secretRef: DATABASE-URL
      - name: JWT_SECRET
        secretRef: JWT-SECRET
      - name: STRIPE_SECRET_KEY
        secretRef: STRIPE-SECRET-KEY
      - name: OPENAI_API_KEY
        secretRef: OPENAI-API-KEY
      - name: SENTRY_DSN
        secretRef: SENTRY-DSN
      - name: ENABLE_BACKGROUND_SCHEDULER
        value: "true"
      - name: ENABLE_DAILY_DIGESTS
        value: "true"
      - name: API_BASE_URL
        value: "https://api.jobshaman.cz"
      - name: APP_PUBLIC_URL
        value: "https://jobshaman.cz"
      probes:
      - type: Liveness
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 10
        periodSeconds: 10
    scale:
      minReplicas: 2
      maxReplicas: 5
      rules:
      - name: cpu
        custom:
          rule: cpu
          target: "70"
  configuration:
    ingress:
      external: true
      targetPort: 8080
      traffic:
      - latest: 100
    registries:
    - server: jobshamanacr.azurecr.io
      username: <ACR_USERNAME>
      passwordSecretRef: acr-password
```

---

## 4. Krok 3: Frontend Migration (Static Web Apps)

### 4.1 Vytvořit Static Web Apps resource

```bash
az staticwebapp create \
  --resource-group jobshaman-prod \
  --name jobshaman-web \
  --source https://github.com/your-org/jobshaman \
  --branch main \
  --api-location "api" \
  --app-location "frontend" \
  --output-location "dist"
```

### 4.2 Nakonfigurovat build settings

**Vytvořit:** `staticwebapp.config.json`
```json
{
  "routes": [
    {
      "route": "/api/v2/*",
      "rewrite": "/api/v2"
    },
    {
      "route": "/seo/*",
      "rewrite": "/seo"
    },
    {
      "route": "/sitemap*",
      "rewrite": "/sitemap"
    },
    {
      "route": "/health",
      "rewrite": "/health"
    },
    {
      "route": "/*",
      "serve": "/index.html",
      "statusCode": 200
    }
  ],
  "globalHeaders": [
    {
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; script-src 'self' https://esm.sh; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: https://*.unsplash.com https://images.unsplash.com; connect-src 'self' https://*.supabase.co https://nominatim.openstreetmap.org https://ipapi.co; worker-src 'self' blob:; manifest-src 'self';"
        }
      ]
    }
  ],
  "auth": {
    "identityProviders": {}
  },
  "responseOverrides": {
    "404": "/404.html"
  }
}
```

### 4.3 Aktualizovat build script

**V `frontend/package.json`:**
```json
{
  "scripts": {
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### 4.4 Nastavit environment variables pro build

V Azure Static Web Apps portal:
- `VITE_BACKEND_URL` = `https://api.jobshaman.cz`
- `VITE_SUPABASE_URL` = `https://...supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `<anon_key>`

---

## 5. Krok 4: Runtime Services Migration

### 5.1 Scraper Job (Azure Container Instances + Timer)

**Vytvořit nový script:** `backend/scripts/start_azure_scraper.sh`
```bash
#!/bin/bash
set -e

# Spustit scraper job
python -m backend.scripts.run_northflank_scraper_job

# Exitovat úspěšně (Container Instance se pak zastaví)
exit 0
```

**Vytvořit Azure Automation runbook:**
```bash
az automation runbook create \
  --resource-group jobshaman-prod \
  --name StartScraperJob \
  --type PowerShell \
  --automation-account-name jobshaman-automation

# Kód runbooku:
$containerGroup = @{
  ResourceGroupName = "jobshaman-prod"
  Name = "scraper-job-$(Get-Date -Format 'yyyyMMddHHmmss')"
  Image = "jobshamanacr.azurecr.io/jobshaman-scraper:latest"
  OsType = "Linux"
  Cpu = 2
  MemoryInGb = 4
  EnvironmentVariable = @{
    "JOBS_POSTGRES_URL" = $Env:DATABASE_URL
    "JWT_SECRET" = $Env:JWT_SECRET
    # ... další env vars
  }
}

New-AzContainerGroup @containerGroup
```

**Naplánovat běh (cron schedule):**
```bash
# Každý den v 2:00 UTC
$schedule = New-AzAutomationSchedule `
  -AutomationAccountName jobshaman-automation `
  -Name "DailyScraperJob" `
  -StartTime (Get-Date).AddDays(1) `
  -DayInterval 1 `
  -ResourceGroupName jobshaman-prod

Register-AzAutomationScheduledRunbook `
  -AutomationAccountName jobshaman-automation `
  -Name StartScraperJob `
  -ScheduleName "DailyScraperJob" `
  -ResourceGroupName jobshaman-prod
```

### 5.2 Daily Digest (Azure Timer Functions)

**Vytvořit:** `azure-functions/TimerDigest/function_app.py`
```python
import azure.functions as func
import asyncio
import os
from backend.domains.notification.service import NotificationDomainService

app = func.FunctionApp()

@app.schedule_trigger(arg_name="myTimer", schedule="0 */6 * * *")  # Every 6 hours
async def timer_daily_digest(myTimer: func.TimerRequest) -> None:
    """Send daily digest emails every 6 hours."""
    try:
        # Trigger digest job
        service = NotificationDomainService()
        await service.send_scheduled_digests()
        
    except Exception as e:
        print(f"Error in daily digest: {e}")
        raise
```

### 5.3 Search API (Azure Container Apps nebo Functions)

Pokud je to lightweight API:
```bash
# Vytvořit Container App pro search-api
az containerapp create \
  --name jobshaman-search-api \
  --resource-group jobshaman-prod \
  --image jobshamanacr.azurecr.io/jobshaman-search-api:latest \
  --environment jobshaman-env
```

---

## 6. Krok 5: Databáze Migration

### 6.1 Exportovat Supabase → PostgreSQL

```bash
# Z Supabase:
pg_dump -h db.*.supabase.co -U postgres dbname > supabase_dump.sql

# Importovat do Azure:
psql -h jobshaman-db.postgres.database.azure.com \
  -U dbadmin@jobshaman-db \
  -d jobshaman \
  -f supabase_dump.sql
```

### 6.2 Nastavit Azure PostgreSQL

```sql
-- Připojit se k Azure Database for PostgreSQL

-- 1. Vytvořit databázi
CREATE DATABASE jobshaman;

-- 2. Vytvořit user pro aplikaci
CREATE USER appuser WITH ENCRYPTED PASSWORD 'strong_password';

-- 3. Udělat oprávnění
GRANT ALL PRIVILEGES ON DATABASE jobshaman TO appuser;
ALTER DATABASE jobshaman OWNER TO appuser;

-- 4. Nastavit connection pooling
-- (Azure Database má built-in - port 5432)

-- 5. Povolit extensions (pokud je potřeba)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS uuid-ossp;
```

### 6.3 Konfigurovat Connection String

```
DATABASE_URL=postgresql://appuser:password@jobshaman-db.postgres.database.azure.com:5432/jobshaman?sslmode=require
```

---

## 7. Krok 6: CI/CD Pipeline (GitHub Actions)

### 7.1 Vytvořit workflow pro backend

**Vytvořit:** `.github/workflows/deploy-backend-azure.yml`
```yaml
name: Deploy Backend to Azure

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - '.github/workflows/deploy-backend-azure.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write

    steps:
    - uses: actions/checkout@v4

    - name: Login to Azure
      uses: azure/login@v1
      with:
        client-id: ${{ secrets.AZURE_CLIENT_ID }}
        tenant-id: ${{ secrets.AZURE_TENANT_ID }}
        subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

    - name: Build and push image to ACR
      run: |
        az acr build \
          --registry jobshamanacr \
          --image jobshaman-api:latest \
          --file backend/Dockerfile .

    - name: Deploy to Container Apps
      run: |
        az containerapp update \
          --name jobshaman-api \
          --resource-group jobshaman-prod \
          --image jobshamanacr.azurecr.io/jobshaman-api:latest
```

### 7.2 Vytvořit workflow pro frontend

**Vytvořit:** `.github/workflows/deploy-frontend-azure.yml`
```yaml
name: Deploy Frontend to Azure Static Web Apps

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'
      - '.github/workflows/deploy-frontend-azure.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write

    steps:
    - uses: actions/checkout@v4

    - name: Deploy to Static Web Apps
      uses: Azure/static-web-apps-deploy@v1
      with:
        azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
        repo_token: ${{ secrets.GITHUB_TOKEN }}
        action: "upload"
        app_location: "frontend"
        api_location: ""
        output_location: "dist"
```

---

## 8. Krok 7: Monitoring & Logging

### 8.1 Nastavit Application Insights

```bash
az monitor app-insights component create \
  --app jobshaman-insights \
  --resource-group jobshaman-prod \
  --location westeurope \
  --application-type web
```

### 8.2 Propojit s Container Apps

```bash
az containerapp update \
  --name jobshaman-api \
  --resource-group jobshaman-prod \
  --enable-dapr false \
  --application-insights-key $(az monitor app-insights component show --app jobshaman-insights --resource-group jobshaman-prod --query instrumentationKey -o tsv)
```

### 8.3 Nastavit alerty

```bash
az monitor metrics alert create \
  --name api-high-cpu \
  --resource-group jobshaman-prod \
  --scopes /subscriptions/{sub}/resourceGroups/jobshaman-prod/providers/Microsoft.App/containerApps/jobshaman-api \
  --condition "avg Cpu > 80" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action create-action-group \
  --severity 3
```

---

## 9. Krok 8: DNS & SSL

### 9.1 Nastavit custom domain

```bash
# Pro Static Web Apps
az staticwebapp custom-domain set \
  --name jobshaman-web \
  --resource-group jobshaman-prod \
  --domain-name jobshaman.cz

# Pro Container Apps
az containerapp ingress update \
  --name jobshaman-api \
  --resource-group jobshaman-prod \
  --dns api.jobshaman.cz
```

### 9.2 SSL Certificate (Azure managed)

Azure automaticky vydá a obnovuje SSL certifikáty přes Let's Encrypt.

---

## 10. Cutover Checklist

- [ ] **Subnet příprava**
  - [ ] Azure Resource Group vytvořen
  - [ ] ACR vytvořen a ověřen
  - [ ] PostgreSQL Database vytvořen a migrován
  - [ ] Key Vault s secrets nakonfigurován

- [ ] **Backend**
  - [ ] Docker image zbuildován a pushnutý do ACR
  - [ ] Container Apps deployment ✓
  - [ ] Environment variables nastaveny ✓
  - [ ] Health check `/healthz` vrací 200
  - [ ] DB migrace proběhly bez chyb

- [ ] **Frontend**
  - [ ] Static Web Apps deployment ✓
  - [ ] Build variables nastaveny (`VITE_BACKEND_URL` → `https://api.jobshaman.cz`)
  - [ ] Build proběhl bez chyb
  - [ ] SWA je dostupné na custom domain

- [ ] **Runtime Services**
  - [ ] Scraper job nakonfigurován & ověřen
  - [ ] Daily digest Timer Function nasazena
  - [ ] Pierwszy scraper run ✓

- [ ] **Monitoring**
  - [ ] Application Insights propojeny
  - [ ] Sentry DSN ✓
  - [ ] Alerty nakonfigurované

- [ ] **DNS & SSL**
  - [ ] DNS záznamy aktualizovány (CNAME pro SWA, api.jobshaman.cz)
  - [ ] SSL certifikáty ověřeny
  - [ ] Testovní requesty přes HTTPS ✓

- [ ] **Data Verification**
  - [ ] `GET /healthz` → 200
  - [ ] `GET /api/v2/tests/jcfpm/diagnostics` (s tokenem) → supabase_key_set=true
  - [ ] Frontend načítá backend data ✓
  - [ ] Autentifikace funguje
  - [ ] Stripe integration funguje
  - [ ] Email (Resend) funguje

- [ ] **Finální kroky**
  - [ ] DNS migration (jobshaman.cz → Azure Static Web Apps)
  - [ ] DNS migration (api.jobshaman.cz → Azure Container Apps)
  - [ ] Northflank services v standby režimu (12-24h rollback okno)
  - [ ] Monitoring v Azure 24-48h
  - [ ] Northflank deprovisioning (pokud je vše stabilní)

---

## 11. Rollback Plan

Pokud se něco pokazí během migrace:

1. **DNS rollback** (1-5 minut)
   ```bash
   # Vrátit na Northflank
   az network dns record-set a update \
     --resource-group dns-group \
     --zone-name jobshaman.cz \
     --name @ \
     --target-resource $(az containerapp show --name jobshaman-api-northflank --query id)
   ```

2. **Zachovat Northflank services v warm state** (12-24 hodin)
   - Udržovat repliky = 1
   - Monitoring aktivní
   - Logs zachované

3. **Data recovery** (pokud je potřeba)
   - Azure Database backups (automatické denní)
   - Supabase backups (v případě potřeby vrátit)

---

## 12. Odhad Nákladů

| Service | Tier | Cost/měsíc |
|---------|------|-----------|
| Static Web Apps | Standard | ~$10 |
| Container Apps | 2 replicas, 0.5 CPU | ~$30 |
| PostgreSQL | Flexible Server (B1ms) | ~$20 |
| Application Insights | Standard | ~$2 |
| Container Registry | Basic | ~$5 |
| **Celkem** | | **~$70/měsíc** |

*Poznámka: Supabase zůstane jako fallback/cache (volitelně), ostatní služby fungují independent.*

---

## 13. Kontaktní Body

- **Azure Support**: premium support pro kritické issues
- **GitHub Actions**: CI/CD monitoring
- **Application Insights**: Real-time monitoring dashboard
- **Azure Alerts**: Email notifikace

---

## Další Kroky

1. ✅ Vytvořit Azure subscription & resource group
2. ✅ Vytvořit ACR, Database, Key Vault
3. ✅ Buildnout a pushovat Docker images
4. ✅ Nasadit backend na Container Apps
5. ✅ Nasadit frontend na Static Web Apps
6. ✅ Nakonfigurovat runtime services
7. ✅ Migrovat databázi
8. ✅ Nastavit CI/CD pipelines
9. ✅ Testovací run (smoke tests)
10. ✅ DNS cutover & production migration
