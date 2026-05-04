---
name: "RW: Wedge Filter + Archive"
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
  group: rw-wedge-filter-${{ github.repository }}-${{ inputs.issue_number }}
  cancel-in-progress: false

run-name: "RW: Wedge Filter + Archive | issue #${{ inputs.issue_number }} | orch ${{ inputs.orchestration_id || 'n/a' }}"

engine:
  id: copilot
  agent: rw-wedge-filter

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

# Wedge decision (wedge/credible vs wedge/weak)

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Trigger label: `${{ inputs.trigger_label }}`
- Orchestration ID: `${{ inputs.orchestration_id }}`

Before doing anything else:
- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY if issue #${{ inputs.issue_number }} has label `type/problem` and `stage/6-shortlist`, and does NOT have label `agentic-workflows`.
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

## Preconditions

This stage decides the **go-to-market wedge**, not the underlying problem attractiveness.

Expected evidence before deciding:
- scorecard island present
- solution island present
- competitors island present

If one of those is clearly missing:
- add one short comment explaining what is missing
- add label: status/needs-info
- stop

## Decide wedge quality
Pick exactly one:
- wedge/credible
- wedge/weak

A **credible wedge** means there is a realistic first entry path into the market, given the issue’s scorecard, proposed solution, and competitor landscape.

A wedge is usually credible only if most of the following are true:
- clear initial ICP / niche / narrow use case
- distinct reason this segment would adopt now
- believable first distribution path or acquisition channel
- advantage that is hard enough to copy quickly (workflow, integration, timing, data, trust, cost structure, compliance positioning, or niche focus)
- MVP can win for that narrow segment without needing a full platform build

A wedge is usually weak if it is mainly:
- better UI / nicer UX only
- cheaper with no durable cost advantage
- broader feature list in a crowded category
- generic AI wrapper with no workflow lock-in
- dependent on unrealistic partnerships, proprietary data, enterprise procurement, or regulatory approvals before first value

## Write into wedge island

<!-- rw:wedge:start -->
- Decision: credible|weak
- Wedge: one sentence describing the initial entry angle
- ICP / niche: ...
- Distribution path: ...
- Why this can win early:
  - ...
  - ...
- Main risks:
  - ...
  - ...
<!-- rw:wedge:end -->

## Label handling
Before applying new labels, remove any existing:
- wedge/credible
- wedge/weak
- archive/no-wedge
- status/shortlisted
- stage/7-validation
- stage/9-archived

Then:

### If wedge is weak
- Add labels: wedge/weak, archive/no-wedge, stage/9-archived
- Remove label: stage/6-shortlist
- Optionally close as not planned

### If wedge is credible
- Add labels: wedge/credible, status/shortlisted, stage/7-validation
- Remove label: stage/6-shortlist
- Optionally remove label: status/needs-info if the issue is now sufficiently complete

## Decision guidance relative to scoring
- A high score does **not** automatically mean the wedge is credible.
- Use the scorecard as context, especially Reachability, Feasibility, Risk, Evidence, and Confidence.
- If the problem scored well but the entry angle is vague or easily copied, choose `wedge/weak`.
- If the problem scored only moderately but the niche, distribution path, and advantage are very clear, `wedge/credible` can still be appropriate.

Always emit safe outputs or noop.
