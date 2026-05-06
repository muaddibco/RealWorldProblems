param(
  [Parameter(Mandatory = $false)]
  [string]$GitHubToken,

  [Parameter(Mandatory = $false)]
  [string]$GitHubOwner = "muaddibco",

  [Parameter(Mandatory = $false)]
  [string]$GitHubRepo = "RealWorldProblems",

  [Parameter(Mandatory = $false)]
  [string]$OldLabel = "stage/7-validation",

  [Parameter(Mandatory = $false)]
  [string]$NewLabel = "stage/7.1-validated",

  [Parameter(Mandatory = $false)]
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not $GitHubToken) {
  $GitHubToken = $env:GITHUB_TOKEN
}
if (-not $GitHubToken) {
  throw "GitHubToken must be provided via -GitHubToken or the GITHUB_TOKEN environment variable"
}

$headers = @{
  "Authorization" = "Bearer $GitHubToken"
  "Accept"        = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

function Invoke-GitHub {
  param([string]$Method = "GET", [string]$Path, [object]$Body)
  $uri = "https://api.github.com$Path"
  $params = @{
    Method  = $Method
    Uri     = $uri
    Headers = $headers
  }
  if ($Body) {
    $params["Body"]        = ($Body | ConvertTo-Json -Compress)
    $params["ContentType"] = "application/json"
  }
  Invoke-RestMethod @params
}

# --- Collect all open issues with the old label ---
$page    = 1
$perPage = 100
$issues  = @()

Write-Host "Searching for open issues with label '$OldLabel' in $GitHubOwner/$GitHubRepo ..."

do {
  $batch = Invoke-GitHub -Path "/repos/$GitHubOwner/$GitHubRepo/issues?state=open&labels=$([Uri]::EscapeDataString($OldLabel))&per_page=$perPage&page=$page"
  $issues += $batch
  $page++
} while ($batch.Count -eq $perPage)

Write-Host "Found $($issues.Count) issue(s)."

if ($issues.Count -eq 0) {
  Write-Host "Nothing to do."
  exit 0
}

# --- Process each issue ---
foreach ($issue in $issues) {
  $number = $issue.number
  $title  = $issue.title
  Write-Host "Issue #$number — $title"

  # Current labels minus the old one, plus the new one
  $currentLabels = $issue.labels | ForEach-Object { $_.name }
  $updatedLabels = @($currentLabels | Where-Object { $_ -ne $OldLabel }) + $NewLabel

  if ($DryRun) {
    Write-Host "  [DRY RUN] Would replace '$OldLabel' → '$NewLabel'"
    Write-Host "  [DRY RUN] New label set: $($updatedLabels -join ', ')"
  } else {
    Invoke-GitHub -Method "PATCH" -Path "/repos/$GitHubOwner/$GitHubRepo/issues/$number" -Body @{ labels = $updatedLabels } | Out-Null
    Write-Host "  Updated: replaced '$OldLabel' with '$NewLabel'"
  }
}

Write-Host ""
if ($DryRun) {
  Write-Host "Dry run complete. $($issues.Count) issue(s) would be updated."
} else {
  Write-Host "Done. $($issues.Count) issue(s) updated."
}
