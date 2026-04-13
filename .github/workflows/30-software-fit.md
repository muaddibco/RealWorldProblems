---
name: "RW: Software Fit Gate"
on:
  issues:
    types: [labeled]
    names: [stage/2-deduped]
    lock-for-agent: true

concurrency:
  group: rw-copilot-agents-${{ github.repository }}
  cancel-in-progress: false

engine:
  id: copilot
  agent: rw-software-fit

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
  close-issue:
    max: 1
  noop:
---

# Software Fit (stage/2-deduped → software-fit/*)

Operate ONLY if:
- type/problem
- stage/2-deduped
- and does NOT have label agentic-workflows

Otherwise noop.

Tooling note:
- Read/search issues using GitHub MCP issue tools (issue_read/list_issues/search_issues).
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `noop` with a short reason and stop.

## Decide software fit
Choose exactly one label:
- software-fit/yes
- software-fit/partial
- software-fit/no

Write decision into:
<!-- rw:software-fit:start -->
- Decision: yes|partial|no
- Why: ...
- Non-software components required (if any): ...
<!-- rw:software-fit:end -->

## If software-fit/no
- Add labels: software-fit/no, stage/9-archived, archive/not-software
- Remove label: stage/2-deduped
- Optionally close as not planned (if supported)

## If software-fit/partial
- Add labels: software-fit/partial, stage/3-scored
- Remove label: stage/2-deduped

## If software-fit/yes
- Add labels: software-fit/yes, stage/3-scored
- Remove label: stage/2-deduped

Always emit safe outputs or noop.