# Rychlý setup pro nasazení na Azure (Terraform + GitHub Actions)

1. Vytvoř si Service Principal a nastav ho v GitHub Secrets:

```bash
az ad sp create-for-rbac --name jobshaman-github-deployer --role Contributor --scopes /subscriptions/<SUBSCRIPTION_ID>
```

Ulož do GitHub secrets:
- AZURE_CLIENT_ID
- AZURE_CLIENT_SECRET
- AZURE_TENANT_ID
- AZURE_SUBSCRIPTION_ID
- AZURE_RESOURCE_GROUP (např. jobshaman-prod)
- ACR_NAME (např. jobshamanacr)
- AZURE_STATIC_WEB_APPS_API_TOKEN

2. Inicializace Terraformu a deploy:

```
cd infra/terraform
terraform init
terraform apply
```

3. Po aplikaci Terraformu doplň v Key Vault tajemství (nebo pomocí terraform azurerm_key_vault_secret):
- DATABASE-URL
- OPENAI-API-KEY
- SENTRY-DSN
- STRIPE-SECRET-KEY
- SUPABASE-URL, SUPABASE-SERVICE-ROLE-KEY, SUPABASE-ANON-KEY

4. Aktivuj GitHub Actions workflows - push na main nasadí backend a frontend.

5. Migrace databáze: export z Supabase a import do Azure PostgreSQL (viz docs/azure-migration-guide.md sekce 6).
