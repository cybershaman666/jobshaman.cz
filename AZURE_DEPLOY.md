# JobShaman Azure Deployment Guide

Kompletní postup nasazení backend a frontend do Azure. Všechny příkazy spouštěj z kořene repozitáře:

```bash
cd "/home/misha/Projekty (2)/jobshaman-new/jobshaman"
```

## Obsah
- [1. Frontend build](#1-frontend-build)
- [2. Backend image build](#2-backend-image-build-v-azure-container-registry)
- [3. Backend deployment](#3-nasazeni-backend-image-do-azure-container-app)
- [4. Frontend deployment](#5-frontend-deploy-do-azure-static-web-apps)
- [Troubleshooting](#troubleshooting)

---

## 1. Frontend Build

### 1.1 TypeScript Kompilace

```bash
cd frontend
npm run build
```

Výstup se přepíše do `frontend/dist/`. Pokud vidíš TypeScript chyby, musíš je opravit. Běžné problémy:
- Chybné import paths (nedostatečná hloubka `../`)
- Chybějící type definitions (přidej `as any` jako workaround)
- Nekompatibilní typy v props (typu `answers: unknown` vs `Record<string, string>`)

Pokud build skončí s chybou, **deploy selhá**. Vrať se do `frontend/` a oprav TypeScript.

```bash
cd ..
```

## 2. Backend image build v Azure Container Registry

Pouziva cloud build v ACR, takze nepotrebuje lokalni Docker daemon.

```bash
az acr build \
  --registry jobshamanacr \
  --image jobshaman-api:latest \
  --file backend/Dockerfile \
  .
```

## 3. Nasazeni backend image do Azure Container App

Aktualizuj timestamp, aby se vytvorila nova revision i pri stejnem `latest` tagu.

```bash
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
az containerapp update \
  --name jobshaman-api \
  --resource-group jobshaman-prod \
  --image jobshamanacr.azurecr.io/jobshaman-api:latest \
  --set-env-vars V2_DEPLOY_TIME="$NOW"
```

## 4. Kontrola backend revision

```bash
az containerapp revision list \
  --name jobshaman-api \
  --resource-group jobshaman-prod \
  --query "[].{name:name,active:properties.active,traffic:properties.trafficWeight,ready:properties.runningState,created:properties.createdTime}" \
  -o table
```

Health check:

```bash
curl -s -o /tmp/jobshaman-api-health.txt -w "%{http_code}\n" \
  https://jobshaman-api.mangorock-7014fb1a.northeurope.azurecontainerapps.io/health
```

## 4.5 Ruční DB migrace/tabulka do Azure PostgreSQL přes psql

Nové SQL migrace tabulek (například pro paměť Shami agenta, historii chatů a další schémata) lze nasadit přes příkaz `psql`. Nejprve si zjistěte správné přihlašovací údaje k produkční Azure databázi (většinou jsou v Azure Portalu nebo v KeyVaultu).

Příklad spuštění migrace (načte a aplikuje SQL skript):

```bash
psql "host=<HOST> port=5432 dbname=<DBNAME> user=<USERNAME> password=<HESLO> sslmode=require" -f database/migrations/20260519_create_shami_agent_memory.sql
```

Nahraďte `<HOST>`, `<DBNAME>`, `<USERNAME>`, `<HESLO>` produkčními Azure údaji.  
Pokud potřebujete nasadit jiný nový SQL skript, změňte pouze parametr za `-f`.

Příklad (nezapomeňte na správné SSL požadavky Azure):

```bash
psql "host=mydb.postgres.database.azure.com port=5432 dbname=jobshaman user=admin@mydb password=superSecret sslmode=require" -f database/migrations/20260519_create_shami_agent_memory.sql
```

Tímto způsobem lze jakoukoli novou či upravenou tabulku doručit bez nutnosti čekat na automatizaci pipeline. Pokud narazíte na error ohledně práv, zkontrolujte role uživatele v Azure Portal.

## 5. Frontend Deploy do Azure Static Web Apps

### 5.1 Automatizovaný Deploy ✅ (FUNGUJÍCÍ)

**Tento příkaz funguje spolehlivě - deploy se VŽDY na síti vidí!**

```bash
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
  --name jobshaman-web \
  --resource-group jobshaman-prod \
  --query properties.apiKey \
  -o tsv) && \
SWA_CLI_DEPLOYMENT_TOKEN="$DEPLOYMENT_TOKEN" \
npx -y @azure/static-web-apps-cli deploy ./frontend/dist \
  --env production \
  --app-name jobshaman-web \
  --resource-group jobshaman-prod \
  --subscription-id 11888792-a2ac-495b-b5d4-0210ea95dd52 \
  --no-use-keychain
```

**Klíčové body:**
- ✅ `--env production` - nasadí do PRODUCTION, ne preview
- ✅ `SWA_CLI_DEPLOYMENT_TOKEN` - správná env variable (ne DEPLOYMENT_TOKEN)
- ✅ `--app-name jobshaman-web` - explicitní app name
- ✅ `--no-use-keychain` - vynechá keychain lookup (zrychluje)

⏱️ **Timing**: Upload trvá 1-3 minuty. Během uploadu vidíš v sysmonitoru network activity!
- Pokud se zdá zaseknutý: BĚŽ NA POZADÍ, počkej 5 minut
- Pokud se trvale zasekne > 10 minut: zabij proces (`pkill -9 -f static-web-apps`) a zkus znova

### 5.2 Verifikace Deploymentu

#### Během Uploadu - Sysmonitor Control

Během `npx deploy` by měl vidět v **sysmonitoru** (Ctrl+Shift+Esc) v záložce **Network**:
- **Upload aktivní** - vidíš chvili, která uploaduje
- Pokud NIČEHO nevidíš po 30s: proces visí bez sítě - zabij a zkus znova

#### Po Deploymentu - HTTP Status

```bash
curl -I https://delightful-rock-0214a0903.7.azurestaticapps.net/
```

Očekávaný výstup:
```
HTTP/2 200 
last-modified: Mon, 26 May 2026 00:09:58 GMT  ← NOVÝ! (měl by být právě nyní)
cache-control: public, must-revalidate, max-age=30
content-type: text/html
etag: "08016108"
```

**Pokud vidíš STAROU `last-modified`** (např. z včera):
1. **CLI deploy selhál** - zkontroluj error zprávy
2. Zkus znova s přesným příkazem z 5.1

**Pokud vidíš NOVOU `last-modified`** - frontend je úspěšně nahrán! ✅

### 5.3 Troubleshooting SWA Deploymentu

| Problém | Příčina | Řešení |
|---------|--------|--------|
| **Sysmonitor: ŽÁDNÝ upload** | CLI visí bez sítě nebo chybná env variable | Zabij: `pkill -9 -f static-web-apps`<br>Zkontroluj: `echo $SWA_CLI_DEPLOYMENT_TOKEN`<br>Zkus znova přesný příkaz z 5.1 |
| **CLI se zdá zaseknutý** | Běží na pozadí, SWA je pomalá | Počkej 5 minut - vidíš network activity?<br>Pokud NE: je zanícený, zabij a zkus znova |
| **last-modified = staré časy** | Deploy se nedokončil | Zabij všechny procesy: `pkill -9 -f static-web-apps`<br>Zkus znova - musíš vidět network activity |
| **ERROR: Project name "undefined"** | Chybí env variable `SWA_CLI_DEPLOYMENT_TOKEN` | Ujisti se že používáš: `SWA_CLI_DEPLOYMENT_TOKEN="$DEPLOYMENT_TOKEN"` |
| **Timeout po 600s** | Timeout script zabil proces dříve než skončil | Používej `--no-use-keychain` flag (zrychluje)<br>Nepoužívej `timeout 600` - SWA potřebuje 5+ minut |
| **"No api location specified"** | Nevadí - API je v Backend Container App | Deploy pokračuje - jen ignoruj varování |
| **HTTP 404 po deploymentu** | Soubory se nahrály ale CDN chybí | Počkej 2-3 minuty, pak `curl -I` znova<br>Zkus `Ctrl+Shift+R` v prohlížeči |

**Postup debugging:**
1. `curl -I https://delightful-rock-0214a0903.7.azurestaticapps.net/` - jaká je `last-modified`?
2. Porovnej s `date` - pokud je starší: deploy selhál
3. Zkontroluj cli výstup: měl by skončit s ✔ Project deployed
4. Pokud máš v sysmonitoru ŽÁDNÝ upload: env variable není nastavená

### 5.4 Manuální Smazání Starého Deploymentu (pokud se vzal blok)

Pokud se CLI zákeydí a nic nefunguje:

```bash
# Zjisti aktuální builds
az staticwebapp environment list \
  --name jobshaman-web \
  --resource-group jobshaman-prod

# Smaž starý build (pokud existuje)
az staticwebapp environment delete \
  --name jobshaman-web \
  --resource-group jobshaman-prod \
  --environment-name "build-123"  # Nahraď ID staršího buildu

# Zkus deploy znova
npx -y @azure/static-web-apps-cli deploy ./dist
```

---

## Complete Deploy Checklist

Když chceš nasadit **obojí** (backend + frontend):

```bash
# 1. FRONTEND - Build
cd frontend && npm run build && cd ..

# 2. BACKEND - Build a deploy
az acr build --registry jobshamanacr --image jobshaman-api:latest --file backend/Dockerfile .
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
az containerapp update --name jobshaman-api --resource-group jobshaman-prod \
  --image jobshamanacr.azurecr.io/jobshaman-api:latest \
  --set-env-vars V2_DEPLOY_TIME="$NOW"

# 3. FRONTEND - Deploy
cd frontend
npx -y @azure/static-web-apps-cli deploy ./dist
cd ..

# 4. VERIFIKACE
echo "Backend health:" && curl -s https://jobshaman-api.mangorock-7014fb1a.northeurope.azurecontainerapps.io/health | head -5
echo "Frontend (Azure default):" && curl -I https://delightful-rock-0214a0903.7.azurestaticapps.net/ | head -3
```

---

## Troubleshooting

### Frontend vidíš stará verze
1. **Počkej 2-3 minuty** na CDN propagaci
2. **Hard refresh**: `Ctrl+Shift+R`
3. **Private mode**: Zkus private/incognito okno
4. **Ověř deployment**: `curl -I https://delightful-rock-0214a0903.7.azurestaticapps.net/`
   - Pokud je `last-modified` starší než tvůj deployment → SWA neuploadla nové soubory
   - Řešení: Zkus deploy znova

### SWA CLI se zasekne během uploadu
- Normální ✓ - SWA CLI je pomalá, vydrž 10+ minut
- Zkontroluj: `ps aux | grep "static-web-apps-cli"`
- Pokud je vidět proces → ještě běží, počkej
- Pokud nic → upload skončil (podívej se na poslední řádky v terminálu)

### TypeScript chyby při `npm run build`
- Chybné import paths: Zkontroluj hloubku `../../../`
- Missing types: Přidej `as any` workaround
- Type incompatibility: Vem si `Record<string, any>` místo přesnějších typů
- **Bez TypeScript opravy se frontend nelze nasadit** - build musí skončit bez chyb

### Backend API vrací 405 METHOD NOT ALLOWED
Normální ✓ - GET na `/health` není podporován, jen POST. Zkus:
```bash
curl -X POST https://jobshaman-api.mangorock-7014fb1a.northeurope.azurecontainerapps.io/health
```

### PostgreSQL migrace selže
```bash
# Zkontroluj connection string (Azure Portal → PostgreSQL → Connection strings)
psql "host=<YOUR-HOST> port=5432 dbname=jobshaman user=<USER> password=<PASS> sslmode=require" \
  -f database/migrations/20260525_your_script.sql
```

Běžné chyby:
- `role does not exist` - Uživatel nemá práva (kontaktuj DB admin)
- `connection refused` - Host/port je špatně
- `SSL error` - Zjisti SSL certifikáty Azure Portal

### Scraper se nemůže připojit k Postgres - `connection timeout expired`

**Root cause**: psycopg pool import error - `module 'psycopg' has no attribute 'pool'`

**Řešení pro LOKÁLNÍ scraper** (spouštíš přes `scraper.sh`):
1. Přidej do `.env.local` (create if not exists) Azure Postgres connection string:
```bash
# Získej z Azure Portal → PostgreSQL → Connection strings
# nebo z Azure Container App env variables
JOBS_POSTGRES_URL=postgresql://dbadmin:<PASSWORD>@jobshaman-db-np.postgres.database.azure.com:5432/jobshaman?sslmode=require
JOBS_POSTGRES_ENABLED=true
JOBS_POSTGRES_WRITE_MAIN=true
```

2. Zkontroluj že `.env.local` je v `.gitignore` (hesla se nesmí commitovat):
```bash
echo ".env.local" >> .gitignore
```

3. Spusť scraper - aplikace načte `.env` a `.env.local`:
```bash
./scraper.sh
```

4. Debugging: Pokud stále vidíš "connection timeout":
```bash
# Zkontroluj connectivity na DB
psql -h jobshaman-db-np.postgres.database.azure.com -U dbadmin -d jobshaman -c "SELECT 1"
# Zkontroluj env proměnné
python3 -c "from app.services.jobs_postgres_store import jobs_postgres_enabled; print(f'Postgres enabled: {jobs_postgres_enabled()}')"
```

---

**Řešení pro AZURE CONTAINER APP** (backend revision):
1. Import pool modulu je teď v místě kde se používá (ne v _load_psycopg):
```python
from psycopg import pool
_pool = pool.ThreadedConnectionPool(...)
```
2. Zkontroluj Azure Container App env variables:
```bash
az containerapp show --resource-group jobshaman-prod --name jobshaman-api \
  --query "properties.template.containers[0].env" | grep -i postgres
```
- `JOBS_POSTGRES_URL` - musí být `postgresql://...@jobshaman-db-np.postgres.database.azure.com:5432/jobshaman?sslmode=require`
- `JOBS_POSTGRES_ENABLED` - musí být `"true"`
- `JOBS_POSTGRES_WRITE_MAIN` - musí být `"true"`

3. Pokud chybí nebo jsou špatné → zavolej:
```bash
az containerapp update \
  --resource-group jobshaman-prod \
  --name jobshaman-api \
  --set-env-vars JOBS_POSTGRES_ENABLED="true" JOBS_POSTGRES_WRITE_MAIN="true"
```

4. Redeploy backend image (viz krok 2-3 výše)

