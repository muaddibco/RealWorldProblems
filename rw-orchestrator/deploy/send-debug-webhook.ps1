param(
  [string]$WebhookSecret,

  [string]$PayloadPath = (Join-Path $PSScriptRoot "payload.json"),

  [string]$Url = "http://localhost:7071/api/github/webhook",

  [ValidateSet("issues", "workflow_run" )]
  [string]$GitHubEvent = "workflow_run"
)

$ErrorActionPreference = "Stop"

if (-not $WebhookSecret) {
  $WebhookSecret = $env:RWP_WEBHOOK_SECRET
}
if (-not $WebhookSecret) {
  throw "WebhookSecret must be provided via -WebhookSecret or the RWP_WEBHOOK_SECRET environment variable"
}

if (-not (Test-Path -LiteralPath $PayloadPath)) {
  throw "Payload file not found: $PayloadPath"
}

$body = Get-Content -LiteralPath $PayloadPath -Raw
$encoding = [System.Text.Encoding]::UTF8
$hmac = [System.Security.Cryptography.HMACSHA256]::new($encoding.GetBytes($WebhookSecret))

try {
  $hashBytes = $hmac.ComputeHash($encoding.GetBytes($body))
} finally {
  $hmac.Dispose()
}

$signature = "sha256=" + (-join ($hashBytes | ForEach-Object { $_.ToString("x2") }))

$headers = @{
  "Accept" = "*/*"
  "Content-Type" = "application/json"
  "User-Agent" = "GitHub-Hookshot/debug-local"
  "X-GitHub-Delivery" = [guid]::NewGuid().ToString()
  "X-GitHub-Event" = $GitHubEvent
  "X-Hub-Signature-256" = $signature
}

Write-Host "POST $Url"
Write-Host "Event: $GitHubEvent"
Write-Host "Payload: $PayloadPath"

$response = Invoke-WebRequest -Method Post -Uri $Url -Headers $headers -Body $body

Write-Host "Status: $($response.StatusCode) $($response.StatusDescription)"
if ($response.Content) {
  Write-Output $response.Content
}