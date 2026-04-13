---
name: "RW: Competitor Scan"
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

Before doing anything else:
- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY if issue #${{ inputs.issue_number }} has label `type/problem` and `stage/5-competitors`, and does NOT have label `agentic-workflows`.
- Otherwise noop.

Use Tavily MCP as the primary web research source (`tavily_search`, optionally `tavily_research`).
Do not use direct `web-fetch` for arbitrary domains in this workflow because firewall allowlists may block it.
If Tavily tools are unavailable at runtime, still produce a best-effort list and clearly mark “Needs verification”.

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