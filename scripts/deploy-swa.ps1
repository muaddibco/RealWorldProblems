param(
  [string]$EnvironmentName = "dev",
  [string]$Location = "eastus2",
  [string]$SubscriptionId,
  [string]$ResourceGroup,
  [string]$StaticWebAppName,
  [string]$SwaEnvironment = "default",
  [string]$ApiLocation = "./api",
  [string]$ApiLanguage,
  [string]$ApiVersion,
  [ValidateSet("Free", "Standard")]
  [string]$Sku = "Free",
  [switch]$SkipBuild,
  [switch]$ProvisionOnly,
  [switch]$DeployOnly
)

$ErrorActionPreference = "Stop"

if ($ProvisionOnly -and $DeployOnly) {
  throw "Use only one of -ProvisionOnly or -DeployOnly."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Assert-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' is not installed or not on PATH."
  }
}

Assert-Command -Name "az"
Assert-Command -Name "azd"
Assert-Command -Name "yarn"
Assert-Command -Name "npx"

if ($SubscriptionId) {
  Write-Host "Setting Azure subscription to $SubscriptionId..."
  az account set --subscription $SubscriptionId | Out-Null
}

$existingEnvsRaw = azd env list --output json
$existingEnvs = @()
if ($existingEnvsRaw) {
  $existingEnvs = ($existingEnvsRaw | ConvertFrom-Json).Name
}

if ($existingEnvs -notcontains $EnvironmentName) {
  Write-Host "Creating azd environment '$EnvironmentName'..."
  azd env new $EnvironmentName --no-prompt
}

Write-Host "Selecting azd environment '$EnvironmentName'..."
azd env select $EnvironmentName

if (-not $StaticWebAppName) {
  $safeEnv = $EnvironmentName.ToLowerInvariant()
  $StaticWebAppName = "rwp-portal-$safeEnv"
}

if (-not $ResourceGroup) {
  $safeEnv = $EnvironmentName.ToLowerInvariant()
  $ResourceGroup = "rg-rwp-portal-$safeEnv"
}

Write-Host "Configuring azd environment variables..."
azd env set AZURE_LOCATION $Location
azd env set STATIC_WEB_APP_NAME $StaticWebAppName
azd env set SWA_SKU $Sku
azd env set AZURE_RESOURCE_GROUP $ResourceGroup

if (-not $SkipBuild -and -not $ProvisionOnly) {
  Write-Host "Building portal and API..."
  yarn swa:build
}

if (-not $DeployOnly) {
  Write-Host "Provisioning Azure infrastructure..."
  azd provision
}

if (-not $ProvisionOnly) {
  Write-Host "Deploying portal + API via GitHub Actions workflow..."

  # The SWA CLI local deploy binary (StaticSitesClient.exe) has a known Windows issue
  # where it crashes with exit code 1 whenever an API payload is included.
  # The reliable solution is to trigger the GitHub Actions deploy workflow,
  # which uses the official azure/static-web-apps-deploy action on Linux.

  Assert-Command -Name "gh"

  $branch = git rev-parse --abbrev-ref HEAD 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to determine current git branch. Ensure you are inside the git repository."
  }

  Write-Host "Triggering deploy-portal workflow on branch '$branch'..."
  gh workflow run deploy-portal.yml --ref $branch
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to trigger GitHub Actions workflow. Ensure 'gh' is authenticated and the workflow file is committed."
  }

  Write-Host ""
  Write-Host "Workflow triggered. Monitor progress at:"
  Write-Host "  https://github.com/muaddibco/RealWorldProblems/actions/workflows/deploy-portal.yml"
  Write-Host ""
  Write-Host "Note: The workflow requires AZURE_STATIC_WEB_APPS_API_TOKEN to be set as a GitHub secret."
  Write-Host "If this is the first run, add it at:"
  Write-Host "  https://github.com/muaddibco/RealWorldProblems/settings/secrets/actions"
}

Write-Host "Done."
Write-Host "Environment: $EnvironmentName"
Write-Host "Resource Group: $ResourceGroup"
Write-Host "Static Web App: $StaticWebAppName"
