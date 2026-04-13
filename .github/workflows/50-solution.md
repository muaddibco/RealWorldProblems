---
name: "RW: Solution Hypothesis"
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
  group: rw-solution-${{ github.repository }}-${{ inputs.issue_number }}
  cancel-in-progress: false

engine:
  id: copilot
  agent: rw-solution-drafter

permissions:
  contents: read
  issues: read

sandbox:
  agent: awf

network: {}

tools:
  github:
    toolsets: [issues, repos]
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

# Solution hypothesis (rw:solution island)

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Trigger label: `${{ inputs.trigger_label }}`

Before doing anything else:
- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY if issue #${{ inputs.issue_number }} has label `type/problem` and `stage/4-solution`, and does NOT have label `agentic-workflows`.
- Otherwise noop.

## Write into solution island

<!-- rw:solution:start -->
### Solution hypothesis (1 paragraph)
...

### Core product mode
- System of execution | workflow hub | decision support | content generation | monitoring/alerts
- Why this mode fits the problem: ...

### Differentiation wedge (why we win)
- ...

### AI role in the product
- AI is used for: ...
- AI is NOT the product by itself because: ...

### Defensibility hooks
- Workflow ownership: ...
- Integration / system access: ...
- Proprietary data / memory: ...
- Habit / switching cost: ...
- Distribution wedge: ...

### MVP scope (3–7 bullets)
- ...

### Not MVP (explicitly out of scope)
- ...
<!-- rw:solution:end -->

## Advance
- Add label: stage/ai-defensibility
- Remove label: stage/4-solution

Always emit safe outputs or noop.