param(
  [Parameter(Mandatory = $true)]
  [string]$SubscriptionId,

  [Parameter(Mandatory = $true)]
  [string]$ResourceGroup,

  [Parameter(Mandatory = $true)]
  [string]$Location,

  [Parameter(Mandatory = $true)]
  [string]$FunctionAppName,

  [Parameter(Mandatory = $true)]
  [string]$StorageAccountName,

  [Parameter(Mandatory = $true)]
  [string]$AppInsightsName,

  [Parameter(Mandatory = $true)]
  [string]$KeyVaultName
)

$ErrorActionPreference = "Stop"

Write-Host "Setting subscription..."
az account set --subscription $SubscriptionId

Write-Host "Creating resource group..."
az group create --name $ResourceGroup --location $Location | Out-Null

Write-Host "Creating storage account..."
az storage account create --name $StorageAccountName --resource-group $ResourceGroup --location $Location --sku Standard_LRS | Out-Null

Write-Host "Creating Application Insights..."
az monitor app-insights component create --app $AppInsightsName --location $Location --resource-group $ResourceGroup --application-type web | Out-Null

Write-Host "Creating Key Vault..."
az keyvault create --name $KeyVaultName --resource-group $ResourceGroup --location $Location | Out-Null

Write-Host "Creating Function App plan (Flex Consumption FC1)..."
az functionapp plan create --resource-group $ResourceGroup --name "$FunctionAppName-plan" --location $Location --sku FC1 --is-linux | Out-Null

Write-Host "Creating Function App..."
az functionapp create --name $FunctionAppName --resource-group $ResourceGroup --plan "$FunctionAppName-plan" --storage-account $StorageAccountName --runtime node --runtime-version 22 --functions-version 4 --os-type Linux | Out-Null

Write-Host "Enabling system-assigned managed identity..."
az functionapp identity assign --name $FunctionAppName --resource-group $ResourceGroup | Out-Null

Write-Host "Deployment baseline complete. Configure app settings and Key Vault references before code deploy."
