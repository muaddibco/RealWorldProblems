param(
  [Parameter(Mandatory = $true)]
  [string]$InstanceId,

  [string]$Reason = "manual-terminate",

  [string]$FunctionAppName,

  [string]$ResourceGroup,

  [string]$AzdEnvironment,

  [string]$TaskHub = "RealWorldProblemsHub",

  [string]$Connection = "Storage",

  [string]$Code
)

$ErrorActionPreference = "Stop"

function Get-AzdEnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Key,
    [string]$Environment
  )

  $projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
  Push-Location $projectRoot
  try {
    $cmd = "azd env get-values"
    if ($Environment) {
      $cmd += " --environment $Environment"
    }

    $lines = Invoke-Expression $cmd
    $pattern = '^' + [regex]::Escape($Key) + '="(.*)"$'
    $match = $lines | Where-Object { $_ -match $pattern } | Select-Object -First 1
    if (-not $match) {
      return $null
    }

    return $match -replace ('^' + [regex]::Escape($Key) + '="'), '' -replace '"$', ''
  } catch {
    return $null
  } finally {
    Pop-Location
  }
}

if (-not $FunctionAppName) {
  $FunctionAppName = $env:AZURE_FUNCTIONAPP_NAME
}
if (-not $ResourceGroup) {
  $ResourceGroup = $env:AZURE_RESOURCE_GROUP
}

if (-not $FunctionAppName) {
  $FunctionAppName = Get-AzdEnvValue -Key "AZURE_FUNCTIONAPP_NAME" -Environment $AzdEnvironment
}
if (-not $ResourceGroup) {
  $ResourceGroup = Get-AzdEnvValue -Key "AZURE_RESOURCE_GROUP" -Environment $AzdEnvironment
}

if (-not $FunctionAppName) {
  throw "FunctionAppName is required. Provide -FunctionAppName or set AZURE_FUNCTIONAPP_NAME."
}
if (-not $ResourceGroup) {
  throw "ResourceGroup is required. Provide -ResourceGroup or set AZURE_RESOURCE_GROUP."
}

if (-not $Code) {
  $Code = az functionapp keys list --resource-group $ResourceGroup --name $FunctionAppName --query masterKey -o tsv
}
if (-not $Code) {
  throw "Could not resolve function key."
}

$encodedInstanceId = [uri]::EscapeDataString($InstanceId)
$encodedReason = [uri]::EscapeDataString($Reason)
$baseUrl = "https://{0}.azurewebsites.net/runtime/webhooks/durabletask/instances/{1}?taskHub={2}&connection={3}&code={4}" -f $FunctionAppName, $encodedInstanceId, $TaskHub, $Connection, $Code
$terminateUrl = "https://{0}.azurewebsites.net/runtime/webhooks/durabletask/instances/{1}/terminate?reason={2}&taskHub={3}&connection={4}&code={5}" -f $FunctionAppName, $encodedInstanceId, $encodedReason, $TaskHub, $Connection, $Code

Write-Host "POST $terminateUrl"
Invoke-RestMethod -Method Post -Uri $terminateUrl | Out-Null

Write-Host "Termination requested for instance '$InstanceId'."
Write-Host "Current status:"
Invoke-RestMethod -Method Get -Uri $baseUrl | ConvertTo-Json -Depth 10
