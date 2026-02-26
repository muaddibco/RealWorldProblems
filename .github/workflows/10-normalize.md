---
name: "RW: Normalize"
on:
  workflow_dispatch:
  issues:
    types: [opened, edited, labeled]
    lock-for-agent: true

engine:
  id: copilot
  agent: rw-normalizer

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
  noop:
---

# Normalize Problem Issue

Operate ONLY if the issue has labels:
- type/problem
- stage/0-intake
- and does NOT have label agentic-workflows

Otherwise emit noop.

## If missing required info
- Add a short comment listing exactly what’s missing.
- Add label: status/needs-info
- Do NOT change stage.

## If complete
1) Update the normalized island only:
   <!-- rw:normalized:start --> ... <!-- rw:normalized:end -->
2) Add label: stage/1-normalized
3) Remove label: stage/0-intake

Always emit at least one safe output operation, or noop.