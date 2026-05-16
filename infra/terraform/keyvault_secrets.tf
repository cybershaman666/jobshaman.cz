resource "azurerm_key_vault_secret" "db_url" {
  name         = "DATABASE-URL"
  # store connection string using the generated admin password and postgres fqdn
  value        = "postgresql://dbadmin:${random_password.db_password.result}@${azurerm_postgresql_flexible_server.postgres.fqdn}:5432/jobshaman?sslmode=require"
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_key_vault_secret" "openai" {
  name         = "OPENAI-API-KEY"
  value        = ""
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_key_vault_secret" "azure_openai_api_key" {
  name         = "AZURE-OPENAI-API-KEY"
  value        = ""
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_key_vault_secret" "azure_openai_endpoint" {
  name         = "AZURE-OPENAI-ENDPOINT"
  value        = ""
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_key_vault_secret" "sentry" {
  name         = "SENTRY-DSN"
  value        = ""
  key_vault_id = azurerm_key_vault.kv.id
}
