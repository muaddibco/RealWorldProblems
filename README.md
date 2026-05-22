# RealWorldProblems Portal

Internal control plane for `muaddibco/RealWorldProblems` issue orchestration. The portal shows GitHub issue lifecycle state, Durable Functions orchestration state, stuck/actionable status, and safe reinvoke controls without exposing GitHub or Durable keys to the browser.

## What it is

- Angular frontend served as a Static Web Apps-compatible SPA.
- Azure Functions backend under `api/` for GitHub and Durable status access.
- Mock mode for the UI so the portal can be explored without live credentials.
- Mock Durable provider for local development and tests.

## Run locally

Install dependencies from the repository root:

```bash
yarn install
```

Start the Angular app:

```bash
yarn start
```

The frontend runs on `http://localhost:4200` and proxies `/api/*` requests to the local Functions host at `http://127.0.0.1:7071`.

Run the Functions backend locally:

```bash
yarn api:start
```

The frontend defaults to mock data mode. Use the mode toggle in the header to switch to live API mode once the backend is running.

## Required environment variables

### GitHub

```text
GITHUB_OWNER=muaddibco
GITHUB_REPO=RealWorldProblems

# Local/dev GitHub auth
GITHUB_TOKEN=

# Production GitHub App auth
GITHUB_APP_ID=
GITHUB_PRIVATE_KEY=
GITHUB_INSTALLATION_ID=
```

### Durable orchestration lookup

```text
ORCHESTRATOR_STATUS_PROVIDER=mock|durable-http
ORCHESTRATOR_FUNCTION_APP_NAME=
ORCHESTRATOR_FUNCTION_KEY=
ORCHESTRATOR_TASK_HUB=RealWorldProblemsHub
ORCHESTRATOR_CONNECTION=Storage
```

### Portal behavior

```text
PORTAL_ALLOW_MOCK_USER=true
PORTAL_RETRY_COOLDOWN_SECONDS=120
PORTAL_BATCH_RETRY_MAX=25
PORTAL_USE_MOCK_GITHUB=true
```

`PORTAL_USE_MOCK_GITHUB=true` is useful for local UI development. If GitHub credentials are present, the API can use live data instead.

## API endpoints

- `GET /api/health`
- `GET /api/me`
- `GET /api/issues`
- `GET /api/issues/{number}`
- `POST /api/issues/{number}/retry`
- `POST /api/issues/retry-batch`

## Retry behavior

The portal never directly dispatches a workflow. Retry is server-side only:

1. Re-read the issue from GitHub.
2. Fetch Durable status for the issue instance ID `rw:{owner}:{repo}:issue:{issueNumber}`.
3. Enforce safety rules.
4. Remove all `rw/*` labels.
5. If the issue has `status/orchestration-failed`, remove that label.
6. Otherwise remove and re-add the current `stage/*` label.
7. Add an audit comment starting with `[portal] Manual retry requested`.

The backend refuses retry when the issue is terminal, blocked, invalid, too recently retried, or has an active Durable orchestration while `rw/processing` is present.

## GitHub App permissions

Minimum recommended permissions for the GitHub App:

- Issues: read/write
- Metadata: read
- Actions: read, optional for future workflow-run display

## Durable provider behavior

The durable HTTP provider uses the same instance endpoint shape as the orchestrator scripts:

```text
https://{functionAppName}.azurewebsites.net/runtime/webhooks/durabletask/instances/{encodedInstanceId}?taskHub={taskHub}&connection={connection}&code={functionKey}
```

If the endpoint returns 404, the portal treats the issue as `not_started`.
If the provider is unavailable or misconfigured, issue listing still works with `orchestrationStatus: "unknown"`.

## Deploy to Azure Static Web Apps

The repo includes `azure.yaml`, `staticwebapp.config.json`, and `infra/main.bicep` so it can be deployed with `azd` with the Angular portal and the `api/` Azure Functions backend in the same Static Web App.

Typical flow:

```bash
azd up
```

If you use an existing Static Web App resource, point the deployment at the root project and keep the `api/` folder as the Functions backend.

### Deployment scripts

From the repo root:

```bash
yarn swa:build
yarn swa:provision
yarn swa:deploy
```

One-command flow:

```bash
yarn swa:up
```

PowerShell wrapper (supports non-interactive env setup):

```bash
pwsh -File ./scripts/deploy-swa.ps1 -EnvironmentName dev -Location eastus
```

## Notes

- The default dashboard view shows non-terminal issues only.
- `stage/ai-defensibility` is treated as a normal processing stage.
- `stage/7.1-validated`, `stage/8-selected`, and `stage/9-archived` are terminal.
- The portal supports mock data mode so the UI can be viewed without live GitHub credentials.
