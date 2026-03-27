---
name: "RW: AI Defensibility Backfill"

on:
  workflow_dispatch:
    inputs:
      limit:
        description: "How many issues to process in this run (1–25)"
        required: true
        default: "10"

engine:
  id: copilot
  agent: rw-ai-defensibility-backfill

permissions:
  contents: read
  issues: read

sandbox:
  agent: awf

network: {}

tools:
  github:
    toolsets: [issues]
    read-only: true

safe-outputs:
  update-issue:
    body: true
    target: "*"
    max: 25
  add-labels:
    blocked: ["~*", "*[bot]"]
    target: "*"
    max: 25
  remove-labels:
    blocked: ["~*"]
    target: "*"
    max: 25
  create-issue:
    title-prefix: "[ai-backfill] "
    labels: [type/report]
    close-older-issues: false
    max: 1
  noop:
---

# Backfill AI defensibility for already-existing validation-stage problems

Tooling note:
- Read/search issues using GitHub MCP issue tools (issue_read/list_issues/search_issues).
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `noop` with a short reason and stop.

## Goal
Find existing `type/problem` issues that:
- have `stage/7-validation`
- do NOT have label `agentic-workflows`
- do NOT already have any `ai-defensibility/*` label

Then, process up to `${{ inputs.limit }}` issues, but never more than 25 in a single run.

For each selected issue:
1. Read the issue
2. Evaluate AI defensibility using the same rubric as the normal AI-defensibility stage
3. Write/update only the `rw:ai-defensibility` island
4. Add exactly one:
   - `ai-defensibility/strong` OR
   - `ai-defensibility/medium` OR
   - `ai-defensibility/weak`
5. Add exactly one:
   - `ai-risk/low` OR
   - `ai-risk/medium` OR
   - `ai-risk/high`
6. Remove any conflicting existing `ai-defensibility/*` or `ai-risk/*` labels if present
7. DO NOT change the current `stage/*` label

## Input handling
- Treat `${{ inputs.limit }}` as the requested maximum count for this run.
- If the input is missing, invalid, non-numeric, or greater than 25, treat it as 10.
- If the input is less than 1, treat it as 1.

## Selection priority
Skip any issue that does not have a `rw:solution` island with meaningful content.
Do not create AI-defensibility output for issues that lack a drafted solution.

Prioritize issues that:
- are in `stage/7-validation`
- are missing the `rw:ai-defensibility` island
- do not yet have AI labels

If more than `${{ inputs.limit }}` issues qualify, only process the top-priority subset within the limit.

If no matching issues are found, emit `noop`.

## Output format per touched issue
Write into:

<!-- rw:ai-defensibility:start -->
### AI Defensibility Scorecard

| Dimension | 1–5 | Rationale |
|---|---:|---|
| Replaceability | | |
| Workflow ownership | | |
| Data moat | | |
| Integration depth | | |
| Switching cost | | |
| **Total (max 25)** | | |

### Verdict
- Defensibility: strong | medium | weak
- AI risk: low | medium | high

### Why
- ...

### How to improve defensibility
- ...

### Kill shot test
"If a better LLM appears tomorrow, what happens?"
- ...
<!-- rw:ai-defensibility:end -->

## Reporting
If at least one issue is updated, create one report issue:
- title: "[ai-backfill] <YYYY-MM-DD>"
- body should include:
  - issues touched
  - assigned defensibility labels
  - assigned AI risk labels
  - requested limit
  - actual number processed
  - any recurring weaknesses observed

If no issues are updated, emit `noop`.