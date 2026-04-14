---
name: "RW: Score Problems"
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

concurrency:
  group: rw-score-${{ github.repository }}-${{ inputs.issue_number }}
  cancel-in-progress: false

engine:
  id: copilot
  agent: rw-scorer

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

# Scorecard (fills rw:scorecard island + score buckets)

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Trigger label: `${{ inputs.trigger_label }}`

Before doing anything else:
- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY if issue #${{ inputs.issue_number }} has label `type/problem` and `stage/3-scored`, and does NOT have label `agentic-workflows`.
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

If software-fit is missing:
- Add one short comment requesting a software-fit decision first
- Add label: status/needs-info
- Stop

If software-fit is `software-fit/no`:
- Noop and stop

If normalized problem details are too incomplete to score reliably, add a short note in the scorecard island, add `status/needs-info`, and stop.

Minimum expected inputs before scoring:
- clear problem statement / JTBD
- who experiences it
- context or trigger moment
- pain / consequence / stakes
- current workaround or status quo

## Fill scorecard island
Write into:

<!-- rw:scorecard:start -->
| Dimension | 1–5 | Rationale |
|---|---:|---|
| Severity | | |
| Frequency | | |
| Urgency / failure cost | | |
| Willingness-to-pay | | |
| Reachability | | |
| Feasibility | | |
| **Total (max 30)** | | |

- Evidence: weak|medium|strong
- Confidence: low|medium|high
- Risk: low|medium|high (+ why)
- Main constraints:
  - ...
<!-- rw:scorecard:end -->

## Scoring rules
Score the **problem attractiveness**, not the final company outcome.

Use conservative scoring when evidence is weak.

Interpret dimensions as:
- **Severity**: how painful or costly the problem is when it happens
- **Frequency**: how often the target user experiences it
- **Urgency / failure cost**: whether the user must act now, and what happens if they do nothing
- **Willingness-to-pay**: direct payment likelihood or strong proxy (time saved, revenue protected, penalties avoided)
- **Reachability**: how realistically the first users can be found and reached
- **Feasibility**: how quickly an MVP can create real value with software

Important:
- Do **not** score wedge here; wedge is evaluated later in the dedicated wedge stage.
- If software-fit is `partial`, Feasibility should rarely exceed 3 unless the non-software portion is minor.
- If the problem clearly depends on hard-to-get APIs, partnerships, compliance approvals, hardware rollout, or difficult data access, lower Reachability and/or Feasibility and raise Risk.
- If the evidence is mostly inferred and not explicit in the issue body, lower Confidence and score conservatively.

## Apply bucket labels
Before applying new labels, remove any existing:
- score/top-10
- score/top-50
- score/long-tail
- risk/low
- risk/medium
- risk/high

Then apply exactly one score bucket using AGENTS.md thresholds:
- `score/top-10` for total >= 24 **and** confidence is not low
- `score/top-50` for total 20–23, or total >= 24 with confidence low
- `score/long-tail` for total <= 19, or total 20–23 with confidence low

Also apply exactly one risk label:
- risk/low
- risk/medium
- risk/high

## Advance
If scored successfully:
- Add label: stage/4-solution
- Remove label: stage/3-scored
- Optionally remove label: status/needs-info if it is present and the issue is now sufficiently complete

Always emit safe outputs or noop.
