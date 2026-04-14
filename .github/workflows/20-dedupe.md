---
name: "RW: Dedupe + Cluster"
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
  group: rw-dedupe-${{ github.repository }}-${{ inputs.issue_number }}
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

# Dedupe + Cluster (stage/1-normalized → stage/2-deduped or archived)

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Trigger label: `${{ inputs.trigger_label }}`

Before doing anything else:
- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY on issue #${{ inputs.issue_number }} as the primary target.
- If that issue no longer has labels `type/problem` and `stage/1-normalized`, or has label `agentic-workflows`, emit `noop` and stop.

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