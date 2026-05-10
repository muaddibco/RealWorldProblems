---
name: "RW: Solution Hypothesis"
strict: false
on:
  workflow_dispatch:
    inputs:
      issue_number:
        description: "Target issue number"
        required: true
        type: string
      orchestration_id:
        description: "Durable orchestration instance ID for correlation"
        required: false
        type: string

concurrency:
  group: rw-issue-${{ github.repository }}-${{ inputs.issue_number }}
  cancel-in-progress: false

run-name: "RW: Solution Hypothesis | issue #${{ inputs.issue_number }} | orch ${{ inputs.orchestration_id || 'n/a' }}"

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
- Orchestration ID: `${{ inputs.orchestration_id }}`

Before doing anything else:
- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY if issue #${{ inputs.issue_number }} has label `type/problem` and `stage/4-solution`, and does NOT have label `agentic-workflows`.
- Otherwise `noop`.

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