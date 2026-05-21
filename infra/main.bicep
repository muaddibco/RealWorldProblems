@description('Name for the Static Web App resource')
param staticWebAppName string

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

output staticWebAppDefaultHostname string = staticWebApp.properties.defaultHostname
output staticWebAppResourceId string = staticWebApp.id
