param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CompileArgs
)

$ErrorActionPreference = 'Stop'

# Compile workflows first. Any args passed to this script are forwarded to gh aw compile.
if ($CompileArgs -and $CompileArgs.Count -gt 0) {
    gh aw compile @CompileArgs
} else {
    gh aw compile
}

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$workflowsDir = Join-Path $PSScriptRoot '.github/workflows'
$lockFiles = Get-ChildItem -Path $workflowsDir -Filter '*.lock.yml' -File

$targetGroupLine = '      group: "gh-aw-conclusion-${{ inputs.issue_number }}"'

$updated = 0

foreach ($file in $lockFiles) {
    $lines = Get-Content -Path $file.FullName
    $raw = ($lines -join "`n")

    $hasWorkflowDispatch = $false
    $hasInputs = $false
    $hasIssueNumberInput = $false

    # Detect: on.workflow_dispatch.inputs.issue_number in the lock file header.
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -eq '  workflow_dispatch:') {
            $hasWorkflowDispatch = $true

            for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                if ($lines[$j] -match '^  \S') {
                    break
                }

                if ($lines[$j] -eq '    inputs:') {
                    $hasInputs = $true

                    for ($k = $j + 1; $k -lt $lines.Count; $k++) {
                        if ($lines[$k] -match '^    \S') {
                            break
                        }

                        if ($lines[$k] -eq '      issue_number:') {
                            $hasIssueNumberInput = $true
                            break
                        }
                    }
                    break
                }
            }
            break
        }
    }

    # Only rewrite workflows where issue_number is explicitly declared as a workflow_dispatch input.
    if (-not ($hasWorkflowDispatch -and $hasInputs -and $hasIssueNumberInput)) {
        continue
    }

    $conclusionIndex = -1
    $concurrencyIndex = -1
    $groupIndex = -1

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -eq '  conclusion:') {
            $conclusionIndex = $i
            break
        }
    }

    if ($conclusionIndex -ge 0) {
        for ($i = $conclusionIndex + 1; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match '^  \S') {
                break
            }

            if ($lines[$i] -eq '    concurrency:') {
                $concurrencyIndex = $i
                break
            }
        }
    }

    if ($concurrencyIndex -ge 0) {
        for ($i = $concurrencyIndex + 1; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match '^    \S') {
                break
            }

            if ($lines[$i] -match '^\s{6}group:\s*".*"\s*$') {
                $groupIndex = $i
                break
            }
        }
    }

    if ($groupIndex -ge 0 -and $lines[$groupIndex] -ne $targetGroupLine) {
        $lines[$groupIndex] = $targetGroupLine
        $patched = ($lines -join "`n")
    } else {
        $patched = $raw
    }

    if ($patched -ne $raw) {
        Set-Content -Path $file.FullName -Value $patched -NoNewline
        $updated++
    }
}

Write-Host "Updated conclusion concurrency in $updated lock file(s)."
