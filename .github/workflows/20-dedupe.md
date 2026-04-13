---
name: "RW: Dedupe + Cluster"
on:
  issues:
    types: [labeled]
    names: [stage/1-normalized]
    lock-for-agent: true

concurrency:
  group: rw-copilot-agents-${{ github.repository }}
  cancel-in-progress: false

engine:
  id: copilot
  agent: rw-deduper

permissions:
  contents: read
  issues: read

sandbox:
  agent: awf

network: {}   # no outbound network for this step (strict mode requires explicit config) :contentReference[oaicite:8]{index=8}

tools:
  github:
    toolsets: [issues]
    read-only: true

safe-outputs:
  staged: false
  github-token: ${{ secrets.SAFEOUTPUTS_GITHUB_TOKEN }}
  update-issue:
    body: true
    max: 1
  add-comment:
    max: 1
  add-labels:
    blocked: ["~*", "*[bot]"]
    max: 10
  remove-labels:
    blocked: ["~*"]
    max: 10
  close-issue:
    max: 1
  noop:
---

# Dedupe + Cluster (stage/1-normalized → stage/2-deduped or archived)

Operate ONLY if the issue has labels:
- type/problem
- stage/1-normalized
- and does NOT have label agentic-workflows

Otherwise: emit noop.

Tooling note:
- Read/search issues using GitHub MCP issue tools (issue_read/list_issues/search_issues).
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `noop` with a short reason and stop.

## Hard rules

- When the workflow classifies an issue as a duplicate, the intended label semantics are:
  - `status/duplicate`
  - `stage/9-archived`
  - `archive/other`
- Do not assume or request any `archive/duplicate` label.

## Tasks

1) Search for likely duplicates among both open and closed issues:
   - similar titles ("Problem: ...")
   - similar JTBD lines
   - prefer the best canonical match even if it is already closed (include status in notes)

2) If this issue is a duplicate:
   - Add comment: "Duplicate of #<id> (reason: ..., target status: open|closed)"
   - Add labels: status/duplicate, stage/9-archived, archive/other
   - Remove label: stage/1-normalized
   - Close issue with state-reason "duplicate" if supported; otherwise just label archived.
   - Do not skip dedupe classification just because the canonical issue is closed.

3) If NOT a duplicate:
   - Write a short summary into the Dedupe island using update-issue + replace-island semantics:
     <!-- rw:dedupe:start -->
     - Checked duplicates: #... (if any)
     - Cluster suggestion (free text): "<cluster name>"
     - Notes: ...
     <!-- rw:dedupe:end -->
   - Add label: stage/2-deduped
   - Remove label: stage/1-normalized

## Output requirements

- Use update-issue with operation: replace-island for the dedupe island.
- Always emit at least one safe output action, or noop.