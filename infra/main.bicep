@description('Name for the Static Web App resource')
param staticWebAppName string

@description('Name for the Storage Account')
param storageAccountName string

@description('Azure region')
param location string = resourceGroup().location

@allowed([
  'Free'
  'Standard'
])
@description('Static Web App SKU')
param sku string = 'Free'

resource staticWebApp 'Microsoft.Web/staticSites@2024-04-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: sku
    tier: sku
  }
  tags: {
    'azd-service-name': 'web'
  }
  properties: {
    buildProperties: {
      appLocation: '/'
      apiLocation: 'api'
      outputLocation: 'dist/portal'
    }
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  tags: {
    'azd-service-name': 'storage'
  }
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
  }
}

resource tableServices 'Microsoft.Storage/storageAccounts/tableServices@2023-01-01' = {
  name: 'default'
  parent: storageAccount
}

resource issuesTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-01-01' = {
  name: 'IssuesCache'
  parent: tableServices
}

output staticWebAppDefaultHostname string = staticWebApp.properties.defaultHostname
output staticWebAppResourceId string = staticWebApp.id
output storageAccountId string = storageAccount.id
output storageAccountName string = storageAccount.name
output storageAccountConnectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${listKeys(storageAccount.id, '2023-01-01').keys[0].value};EndpointSuffix=core.windows.net'
