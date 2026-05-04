param(
  [Parameter(Mandatory = $true)]
  [string]$SubscriptionId,

  [Parameter(Mandatory = $false)]
  [string]$EnvironmentName = "dev",

  [Parameter(Mandatory = $false)]
  [string]$Location = "eastus",

  [Parameter(Mandatory = $false)]
  [string]$GitHubOwner = "muaddibco",

  [Parameter(Mandatory = $false)]
  [string]$GitHubRepo = "RealWorldProblems",

  [Parameter(Mandatory = $false)]
  [string]$GitHubWorkflowRef = "main",

  [Parameter(Mandatory = $true)]
  [string]$GitHubToken,

  [Parameter(Mandatory = $true)]
  [string]$GitHubWebhookSecret,

  [Parameter(Mandatory = $false)]
  [string]$ScanBatchSize = "10",

  [Parameter(Mandatory = $false)]
  [string]$ScanStageOrder = "stage/0-intake,stage/1-normalized,stage/2-deduped,stage/3-scored,stage/4-solution,stage/ai-defensibility,stage/5-competitors,stage/6-shortlist,stage/7-validation",

  [Parameter(Mandatory = $false)]
  [switch]$AutoResolveServiceTagConflicts,

  [Parameter(Mandatory = $false)]
  [switch]$ProvisionOnly
)

$ErrorActionPreference = "Stop"

function Assert-CommandExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CommandName
  )

  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Required command '$CommandName' was not found in PATH."
  }
}

Assert-CommandExists -CommandName "az"
Assert-CommandExists -CommandName "azd"

function Get-TaggedOrchestratorHosts {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SubscriptionId,
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroup
  )

  $result = az resource list --subscription $SubscriptionId --resource-group $ResourceGroup --query "[?type=='Microsoft.Web/sites' && tags.'azd-service-name'=='orchestrator'].{name:name,id:id}" -o json
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($result)) {
    return @()
  }

  $parsed = $result | ConvertFrom-Json
  if ($null -eq $parsed) {
    return @()
  }

  if ($parsed -is [System.Array]) {
    return $parsed
  }

  return @($parsed)
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Resolve-Path (Join-Path $scriptDir "..")

Write-Host "Using project directory: $projectDir"
Push-Location $projectDir

try {
  Write-Host "Setting Azure subscription..."
  az account set --subscription $SubscriptionId | Out-Null

  Write-Host "Selecting azd environment '$EnvironmentName' if it exists..."
  azd env select $EnvironmentName 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Environment '$EnvironmentName' not found. Creating it..."
    azd env new $EnvironmentName --no-prompt
  }

  Write-Host "Configuring azd environment values..."
  azd env set AZURE_LOCATION $Location
  azd env set GITHUB_OWNER $GitHubOwner
  azd env set GITHUB_REPO $GitHubRepo
  azd env set GITHUB_WORKFLOW_REF $GitHubWorkflowRef
  azd env set GITHUB_TOKEN $GitHubToken
  azd env set GITHUB_WEBHOOK_SECRET $GitHubWebhookSecret
  azd env set SCAN_BATCH_SIZE $ScanBatchSize
  azd env set SCAN_STAGE_ORDER $ScanStageOrder

  # Guard against azd deploy ambiguity when more than one host is tagged for this service.
  $envResourceGroup = (azd env get-value AZURE_RESOURCE_GROUP 2>$null).Trim('"')
  $envFunctionAppName = (azd env get-value AZURE_FUNCTIONAPP_NAME 2>$null).Trim('"')

  if (-not [string]::IsNullOrWhiteSpace($envResourceGroup)) {
    $taggedHosts = Get-TaggedOrchestratorHosts -SubscriptionId $SubscriptionId -ResourceGroup $envResourceGroup

    if ($taggedHosts.Count -gt 1) {
      if ([string]::IsNullOrWhiteSpace($envFunctionAppName)) {
        $siteNames = ($taggedHosts | ForEach-Object { $_.name }) -join ", "
        throw "Found multiple host resources tagged with azd-service-name=orchestrator in resource group '$envResourceGroup': $siteNames. Run azd provision to refresh environment outputs, then rerun with -AutoResolveServiceTagConflicts, or manually remove the tag from non-target hosts."
      }

      $nonTargetHosts = @($taggedHosts | Where-Object { $_.name -ne $envFunctionAppName })

      if ($nonTargetHosts.Count -gt 0) {
        if ($AutoResolveServiceTagConflicts) {
          Write-Host "Resolving azd-service-name tag conflicts. Keeping '$envFunctionAppName' and removing tag from non-target hosts..."
          foreach ($site in $nonTargetHosts) {
            Write-Host "Removing azd-service-name tag from host '$($site.name)'"
            az tag update --resource-id $site.id --operation delete --tags azd-service-name | Out-Null
            if ($LASTEXITCODE -ne 0) {
              throw "Failed to remove azd-service-name tag from host '$($site.name)'."
            }
          }
        }
        else {
          $siteNames = ($taggedHosts | ForEach-Object { $_.name }) -join ", "
          throw "Detected multiple host resources tagged with azd-service-name=orchestrator in resource group '$envResourceGroup': $siteNames. Expected target host is '$envFunctionAppName'. Rerun with -AutoResolveServiceTagConflicts or remove the tag from non-target hosts manually."
        }
      }
    }
  }

  if ($ProvisionOnly) {
    Write-Host "Running infrastructure provisioning only (azd provision)..."
    azd provision
  }
  else {
    Write-Host "Running full deployment (azd up)..."
    azd up
  }

  if ($LASTEXITCODE -ne 0) {
    throw "Deployment command failed."
  }

  Write-Host "Deployment completed successfully."
}
finally {
  Pop-Location
}
