# RW Orchestrator

Azure Durable Functions service that orchestrates the RealWorldProblems issue pipeline while keeping GitHub workflows as stage executors.

## What this service does

- Starts one orchestration per issue (`rw:{owner}:{repo}:issue:{issueNumber}`)
- Claims issues with `rw/processing` and stage-scoped lock labels
- Dispatches stage workflows by `workflow_dispatch`
- Waits for completion callback (`workflow_run.completed`) or timeout
- Verifies stage transition labels and validation island completion
- Releases lock labels and marks failures with `status/orchestration-failed`
- Reconciles missed events with a timer scanner every 10 minutes

## Project layout

- `src/functions/githubWebhook.ts` - webhook-driven orchestration starter and external-event raiser
- `src/functions/scanBacklog.ts` - timer-based backlog scanner
- `src/functions/issuePipelineOrchestrator.ts` - durable orchestrator loop
- `src/functions/activities.ts` - GitHub I/O activities
- `src/domain/stages.ts` - data-driven stage/workflow mapping
- `src/github/githubClient.ts` - Octokit wrapper

## Local setup

1. Copy `local.settings.json.template` to `local.settings.json`.
2. Fill required settings:
   - `GITHUB_TOKEN`
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_WEBHOOK_SECRET`
3. Install dependencies:

```bash
npm install
```

4. In one terminal start Azurite:

```bash
npx azurite --silent --location .azurite --debug .azurite/debug.log
```

5. In another terminal, start functions:

```bash
npm --prefix rw-orchestrator start
```

## GitHub webhook setup

Set repository webhook URL to:

`https://<function-app-host>/api/github/webhook?code=<function-key>`

Subscribe to events:
- Issues
- Workflow runs

Use `GITHUB_WEBHOOK_SECRET` for HMAC signature validation.

## Required workflow updates

Stage workflow source files should include optional `orchestration_id` input and preserve existing `issue_number` + `trigger_label` inputs.

Files:
- `.github/workflows/10-normalize.md`
- `.github/workflows/20-dedupe.md`
- `.github/workflows/30-software-fit.md`
- `.github/workflows/40-score.md`
- `.github/workflows/50-solution.md`
- `.github/workflows/55-ai-defensibility.md`
- `.github/workflows/60-competitors.md`
- `.github/workflows/70-wedge-filter.md`
- `.github/workflows/90-validation-plan.md`

After updates, run `gh aw compile` from repo root.

## Azure deployment (PowerShell)

Use `deploy/deploy.ps1` as a baseline deployment script.

For end-to-end deployment with `azd` (recommended for this repo), use `deploy/azd-up.ps1`.

From the `rw-orchestrator` folder:

```powershell
.\deploy\azd-up.ps1 `
   -SubscriptionId "<subscription-id>" `
   -GitHubToken "<github-token>" `
   -GitHubWebhookSecret "<webhook-secret>" `
   -AutoResolveServiceTagConflicts
```

Notes:
- `GitHubOwner` defaults to `muaddibco`.
- `GitHubRepo` defaults to `RealWorldProblems`.
- `EnvironmentName` defaults to `dev`.
- `Location` defaults to `eastus`.

To provision infrastructure only (without full app deployment), add `-ProvisionOnly`:

```powershell
.\deploy\azd-up.ps1 `
   -SubscriptionId "<subscription-id>" `
   -GitHubToken "<github-token>" `
   -GitHubWebhookSecret "<webhook-secret>" `
   -AutoResolveServiceTagConflicts `
   -ProvisionOnly
```

## Local webhook debugging

Use `deploy/send-debug-webhook.ps1` to send a signed GitHub-style webhook payload to a local or remote endpoint.

Example:

```powershell
.\deploy\send-debug-webhook.ps1 `
   -WebhookSecret "your-secret" `
   -PayloadPath ".\payload.json" `
   -GitHubEvent workflow_run
```

## Verifying deployed version

Use `deploy/get-version.ps1` to confirm which version of the orchestrator is currently running in Azure.

```powershell
.\deploy\get-version.ps1 -AzdEnvironment dev
```

Optional parameters:
- `-FunctionAppName`
- `-ResourceGroup`
- `-Code` (function key; if omitted, script resolves `masterKey`)

The script calls `GET /api/github/webhook?mode=version` and prints a JSON response such as:

```json
{
  "version": "0.1.0",
  "mode": "version",
  "function": "githubWebhook"
}
```

The `version` field reflects the `version` field in `package.json` at the time the package was built and deployed. You can also hit the endpoint directly from a browser or `curl` using the same URL.

## Durable instance management scripts

Use these scripts to inspect and control a specific Durable Functions orchestration instance by `instanceId`.

Scripts:
- `deploy/get-instance-status.ps1` - gets instance status JSON
- `deploy/terminate-instance.ps1` - terminates an instance and prints current status

Both scripts support:
- Explicit arguments for app and resource selection
- Environment variable fallbacks: `AZURE_FUNCTIONAPP_NAME`, `AZURE_RESOURCE_GROUP`
- `azd` environment fallback via `azd env get-values` (optional `-AzdEnvironment`)

### Get instance status

```powershell
.\deploy\get-instance-status.ps1 `
   -InstanceId "rw:muaddibco:RealWorldProblems:issue:86" `
   -AzdEnvironment dev
```

Optional parameters:
- `-FunctionAppName`
- `-ResourceGroup`
- `-TaskHub` (default: `RealWorldProblemsHub`)
- `-Connection` (default: `Storage`)
- `-Code` (function key; if omitted, script resolves `masterKey`)

### Terminate instance

```powershell
.\deploy\terminate-instance.ps1 `
   -InstanceId "rw:muaddibco:RealWorldProblems:issue:86" `
   -Reason "manual-reset" `
   -AzdEnvironment dev
```

Optional parameters:
- `-Reason` (default: `manual-terminate`)
- `-FunctionAppName`
- `-ResourceGroup`
- `-TaskHub` (default: `RealWorldProblemsHub`)
- `-Connection` (default: `Storage`)
- `-Code` (function key; if omitted, script resolves `masterKey`)
