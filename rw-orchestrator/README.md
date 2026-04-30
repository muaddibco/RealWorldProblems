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

4. Build and run:

```bash
npm run build
npm start
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
