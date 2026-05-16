# Cutover Runbook — Dump/Restore migration (Northflank → Azure)

Tento runbook popisuje krok-za-krokem postup pro plánovaný cutover s krátkým oknem downtime (strategii A: dump/restore).

Předpoklady
- Terraform resources vytvořeny a Azure infra je připravená (infra/terraform)
- Key Vault existuje a máte právo zapisovat secrets
- Máte přístup k produkční PostgreSQL (Northflank) pro export
- Máte přístup k Azure PostgreSQL pro import
- Skripty v repo: backend/scripts/migrate_db_export.sh, backend/scripts/migrate_db_import.sh, backend/scripts/migrate_storage_rclone.sh

Pre-cutover (dny předem)
1) Otestujte Terraform v stagingu: terraform init && terraform apply
2) Vytvořte a ověřte Key Vault tajemství (alespoň placeholdery). Poznamenejte si názvy: KEYVAULT_NAME, RESOURCE_GROUP
3) Připravte storage pro přenos dumpu (dočasný Azure Blob container nebo bezpečný server)
4) Ověřte, že importovací skript funguje na testovací dump: proveďte test importu do testovací DB
5) Naplánujte maintenance okno (doporučeno nízký traffic)

Cutover (okno downtime)
1) Oznamte uživatelům maintenance a zastavte write access (režim maintenance) — konkrétně:
   - Zapněte maintenance flag v aplikaci nebo krátce zastavte backend (scale to 0 / stop službu)

2) Export produkční DB z Northflank (na serveru s přístupem k NF DB):
   export DUMP_FILE=jobshaman.dump
   export NF_HOST=<northflank_host>
   export NF_PORT=5432
   export NF_USER=<nf_user>
   export NF_DB=<nf_db>
   export PGPASSWORD=<nf_password>
   ./backend/scripts/migrate_db_export.sh

3) Přeneste dump do bezpečného umístění s přístupem k Azure (scp nebo az storage blob upload):
   az storage blob upload --account-name <storage_account> --container-name <container> --name ${DUMP_FILE} --file ${DUMP_FILE}

4) Připravit cílovou Azure DB: vytvořit DB a uživatele (pokud ještě neexistují). Na Azure:
   psql "host=<AZ_HOST> user=postgres password=<ADMIN_PWD> dbname=postgres" -c "CREATE DATABASE jobshaman;"
   psql -h <AZ_HOST> -U postgres -c "CREATE USER appuser WITH ENCRYPTED PASSWORD '<app_pwd>';"
   psql -h <AZ_HOST> -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE jobshaman TO appuser;"

5) Import dump do Azure:
   Přeneste dump na stroj s psql/pg_restore a spustťe:
   export AZ_HOST=<azure_db_host>
   export AZ_USER=appuser
   export AZ_DB=jobshaman
   export DUMP_FILE=jobshaman.dump
   export PGPASSWORD=<appuser_pwd>
   ./backend/scripts/migrate_db_import.sh

6) Nastavte DATABASE_URL v Key Vault (viz infra/scripts/set_keyvault_secret_db.sh):
   ./infra/scripts/set_keyvault_secret_db.sh \ 
     --vault-name <KEYVAULT_NAME> \ 
     --secret-name DATABASE-URL \ 
     --db-user appuser \ 
     --db-pass <appuser_pwd> \ 
     --db-host <azure_db_host> \ 
     --db-port 5432 \ 
     --db-name jobshaman

7) Restart container app (nebo aplikace) aby načetla nové tajemství:
   az containerapp update --name jobshaman-api --resource-group <RG> --image <ACR>.azurecr.io/jobshaman-api:latest
   # případně scale down/up nebo restart prostřednictvím Azure Portal

8) Ověření:
   - GET https://api.jobshaman.cz/healthz → 200
   - Spustit interní smoke tests (backend/app/routers/tests.py endpoints)
   - Ověřit uživatelské případy: přihlášení, zobrazení jobů, vytvoření inzerátu (pokud relevantní)

9) Po 12–24 hodinách monitoringu a ověření ukončete Northflank služby (deprovision) podle plánu

Rollback (pokud se něco pokazí během ověření)
1) Neprovádějte deprovision Northflank. Mějte je v warm state.
2) Aktualizujte Key Vault DATABASE-URL zpět na původní Northflank connection string:
   ./infra/scripts/set_keyvault_secret_db.sh --vault-name <KEYVAULT_NAME> --secret-name DATABASE-URL --db-user <nf_user> --db-pass <nf_pwd> --db-host <nf_host> --db-port 5432 --db-name <nf_db>
3) Restart aplikace v Azure nebo přepněte DNS zpět (pokud DNS měněno)

Poznámky a bezpečnostní doporučení
- V dumpu jsou citlivá data; použijte šifrovaný přenos a bezpečné úložiště
- Ověřte, zda máte dostatečná práva pro az keyvault secret set
- Zvažte snapshot/backups před importem
