---
name: "RW: Software Fit Gate"
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
  group: rw-software-fit-${{ github.repository }}-${{ inputs.issue_number }}
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
  close-issue:
    target: "*"
    max: 1
  noop:
---

# Software Fit (stage/2-deduped → software-fit/*)

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Trigger label: `${{ inputs.trigger_label }}`

Before doing anything else:
- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY if issue #${{ inputs.issue_number }} has labels `type/problem` and `stage/2-deduped`, and does NOT have label `agentic-workflows`.
- Otherwise noop.

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