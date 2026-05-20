# JobShaman Azure deploy cheatsheet

Tyto prikazy nasazuji aktualni lokalni zmeny primo na Azure. Spoustej je z rootu repozitare:

```bash
cd "/home/misha/Projekty (2)/jobshaman-new/jobshaman"
```

## 1. Frontend build

```bash
cd frontend
npm run build
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

## 5. Frontend deploy do Azure Static Web Apps

```bash
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
  --name jobshaman-web \
  --resource-group jobshaman-prod \
  --query properties.apiKey \
  -o tsv)

SWA_CLI_DEPLOYMENT_TOKEN="$DEPLOYMENT_TOKEN" \
  npx -y @azure/static-web-apps-cli deploy ./frontend/dist \
  --env production \
  --app-name jobshaman-web \
  --resource-group jobshaman-prod \
  --subscription-id 11888792-a2ac-495b-b5d4-0210ea95dd52 \
  --no-use-keychain
```

## 6. Kontrola frontend deploye

```bash
curl -I https://delightful-rock-0214a0903.7.azurestaticapps.net
```

Ocekavane minimum: HTTP `200`, aktualni `last-modified` a CSP s backend connect-src na Container App.

## Poznamky

- Lokalni `scripts/deploy_backend_azure_container.sh` pouziva Docker daemon. Pokud Docker nebezi, preferuj `az acr build` postup vyse.
- Backend a frontend je potreba nasadit oba, pokud se meni API payloady i UI.
- Po Container App update sleduj, ze nova revision ma `traffic` 100 a `ready` Running/RunningAtMaxScale.
