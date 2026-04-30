---
name: "RW: Competitor Scan"
strict: false
on:
  workflow_dispatch:
    inputs:
      issue_number:
        description: "Target issue number"
        required: true
        type: string
      trigger_label:
        description: "Stage label that triggered this run"
        required: true
        type: string
      orchestration_id:
        description: "Durable orchestration instance ID for correlation"
        required: false
        type: string

concurrency:
  group: rw-competitors-${{ github.repository }}-${{ inputs.issue_number }}
  cancel-in-progress: false

engine:
  id: copilot
  agent: rw-competitor-scout

permissions:
  contents: read
  issues: read

sandbox:
  agent: awf

network:
  allowed:
    - defaults
    - github
    - "*.tavily.com"

mcp-servers:
  tavily:
    command: npx
    args: ["-y", "tavily-mcp"]
    env:
      TAVILY_API_KEY: "${{ secrets.TAVILY_API_KEY }}"
    allowed: ["tavily_search", "tavily_research", "tavily_extract"]

tools:
  github:
    toolsets: [issues]
    read-only: true

safe-outputs:
  staged: false
  github-token: ${{ secrets.SAFEOUTPUTS_GITHUB_TOKEN }}
  update-issue:
    body: true
    target: "*"
    max: 1
  add-comment:
    target: "*"
    max: 1
  add-labels:
    blocked: ["~*", "*[bot]"]
    max: 10
  remove-labels:
    blocked: ["~*"]
    max: 10
  noop:
---

# Competitor scan (rw:competitors island)

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Trigger label: `${{ inputs.trigger_label }}`
- Orchestration ID: `${{ inputs.orchestration_id }}`

Before doing anything else:
- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY if issue #${{ inputs.issue_number }} has label `type/problem` and `stage/5-competitors`, and does NOT have label `agentic-workflows`.
- Otherwise `noop`.

Use Tavily MCP as the primary web research source (`tavily_search`, optionally `tavily_research`).
Do not use direct `web-fetch` for arbitrary domains in this workflow because firewall allowlists may block it.
If Tavily tools are unavailable at runtime, still produce a best-effort list and clearly mark “Needs verification”.

## Mandatory completion rule

A successful run MUST end with at least one safe-output tool call.

Valid endings are only:
- `update_issue` plus any needed `add_labels` / `remove_labels`
- `add_comment` plus `add_labels` when info is missing
- `noop` when the issue should not be processed

Do not end with prose-only output.
Do not stop after analysis.
A run with no safe-output tool call is invalid.

## Mandatory write targeting rule

Because this workflow runs via `workflow_dispatch`, there is no implicit triggering issue.

For every write action, always target:
- `repo: ${{ github.repository }}`
- `issue_number: ${{ inputs.issue_number }}` for `update_issue`
- `item_number: ${{ inputs.issue_number }}` for `add_comment`
- `item_number: ${{ inputs.issue_number }}` for `add_labels`
- `item_number: ${{ inputs.issue_number }}` for `remove_labels`

Never rely on implicit targeting.

## Write into competitors island

<!-- rw:competitors:start -->
### Direct competitors (3–10)
- Name — what they do — target user — pricing signal — source/link
- ...

### Substitutes / current workarounds
- ...

### Observed gaps / opportunities
- ...
<!-- rw:competitors:end -->

## Advance
- Add label: stage/6-shortlist
- Remove label: stage/5-competitors

Always emit safe outputs or noop.