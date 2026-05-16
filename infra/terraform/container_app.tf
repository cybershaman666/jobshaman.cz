/* Temporary: use Azure Container Instances (azurerm_container_group) as a
   simple, compatible runtime so terraform can provision infrastructure
   without depending on Container Apps provider schema. This can be
   replaced later with azurerm_container_app once you want Container Apps.
*/

resource "azurerm_container_group" "api" {
  name                = "${local.prefix}-api-cg"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  os_type             = "Linux"
  restart_policy      = "OnFailure"

  image_registry_credential {
    server   = azurerm_container_registry.acr.login_server
    username = azurerm_container_registry.acr.admin_username
    password = azurerm_container_registry.acr.admin_password
  }

  container {
    name   = "api"
    image  = "${azurerm_container_registry.acr.login_server}/jobshaman-api:latest"
    ports {
      port     = 8000
      protocol = "TCP"
    }
    cpu    = 0.5
    memory = 1.0
  }

  ip_address_type = "Public"

  tags = {
    environment = "prod"
  }
}
