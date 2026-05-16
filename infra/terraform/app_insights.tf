resource "azurerm_application_insights" "ai" {
  name                = "${local.prefix}-insights"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  application_type    = "web"

  lifecycle {
    ignore_changes = ["workspace_id"]
  }
}

output "app_insights_instrumentation_key" {
  value     = azurerm_application_insights.ai.instrumentation_key
  sensitive = true
}

/* lifecycle ignore applied on azurerm_application_insights.ai above */
