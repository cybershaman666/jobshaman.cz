locals {
  location = "westeurope"
  prefix   = "jobshaman"
}

resource "azurerm_resource_group" "rg" {
  name     = "${local.prefix}-prod"
  location = local.location
}

resource "azurerm_container_registry" "acr" {
  name                = "${local.prefix}acr"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Basic"
  admin_enabled       = true
}

resource "azurerm_postgresql_flexible_server" "postgres" {
  # Use distinct name for new server to avoid conflict with any existing resource in other region
  name                = "${local.prefix}-db-np"
  resource_group_name = azurerm_resource_group.rg.name
  # Use northeurope to avoid location restrictions on the subscription
  location            = "northeurope"

  administrator_login          = "dbadmin"
  administrator_password      = random_password.db_password.result

  # Use a valid sku_name for Flexible Server. GP_Standard_D2ds_v4 provides reasonable performance.
  sku_name   = "GP_Standard_D2ds_v4"
  storage_mb = 32768

  version = "15"

  delegated_subnet_id = null
}

resource "random_password" "db_password" {
  length  = 16
  special = true
}

resource "azurerm_key_vault" "kv" {
  name                        = "${local.prefix}-vault"
  location                    = azurerm_resource_group.rg.location
  resource_group_name         = azurerm_resource_group.rg.name
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  sku_name                    = "standard"
  purge_protection_enabled    = false
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get",
      "List",
      "Set",
      "Delete",
    ]
  }
}

output "acr_login_server" {
  value = azurerm_container_registry.acr.login_server
}

output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.postgres.fqdn
}

output "postgres_admin_password" {
  value     = random_password.db_password.result
  sensitive = true
}
