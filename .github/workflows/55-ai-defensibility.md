---
name: "RW: AI Defensibility Gate"
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

run-name: "RW: AI Defensibility Gate | issue #${{ inputs.issue_number }} | orch ${{ inputs.orchestration_id || 'n/a' }}"

engine:
  id: copilot
  agent: rw-ai-defensibility

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
  noop:
---

# AI defensibility evaluation (rw:ai-defensibility island)

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Orchestration ID: `${{ inputs.orchestration_id }}`

Before doing anything else:
- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY if issue #${{ inputs.issue_number }} has label `type/problem` and `stage/ai-defensibility`, and does NOT have label `agentic-workflows`.
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

## Evaluate AI defensibility
Choose exactly one:
- ai-defensibility/strong
- ai-defensibility/medium
- ai-defensibility/weak

Choose exactly one:
- ai-risk/low
- ai-risk/medium
- ai-risk/high

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

## Scoring guidance
Score each dimension from 1 to 5.

### Replaceability
- 1 = trivial prompt or generic chat can replace most of the value
- 3 = needs some workflow/product layer
- 5 = requires system-level execution, trust, or embedded operational context

### Workflow ownership
- 1 = advice/content only
- 3 = supports part of the workflow
- 5 = controls or executes a meaningful workflow step end-to-end

### Data moat
- 1 = no meaningful retained advantage
- 3 = useful structured history
- 5 = strong proprietary memory, usage data, or outcome history

### Integration depth
- 1 = standalone
- 3 = useful but non-essential integrations
- 5 = deeply embedded in important systems/files/APIs

### Switching cost
- 1 = easy to replace tomorrow
- 3 = moderate process/history loss
- 5 = strong habit, operational reliance, or reconfiguration cost

## Label thresholds
- Total 20–25:
  - ai-defensibility/strong
  - ai-risk/low
- Total 14–19:
  - ai-defensibility/medium
  - ai-risk/medium
- Total 5–13:
  - ai-defensibility/weak
  - ai-risk/high

## Heuristics
Usually weak:
- generic AI copilot
- summarization-only
- drafting-only
- Q&A over files
- “better UI on top of an LLM”

Usually stronger:
- owns execution
- embedded in a painful workflow step
- accumulates structured memory/data
- has meaningful integrations
- has a narrow, credible wedge

## Advance
- Add labels:
  - exactly one ai-defensibility/*
  - exactly one ai-risk/*
  - stage/5-competitors
- Remove label:
  - stage/ai-defensibility

Always emit safe outputs or noop.