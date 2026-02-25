---
name: "RW: Repo Steward (Daily)"
on:
  schedule: daily

engine:
  id: copilot
  agent: rw-repo-steward

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
  update-issue:
    body: true
    target: "*"
    max: 10
  add-labels:
    blocked: ["~*", "*[bot]"]
    target: "*"
    max: 20
  remove-labels:
    blocked: ["~*"]
    target: "*"
    max: 20
  create-issue:
    title-prefix: "[steward] "
    labels: [type/report]
    close-older-issues: true
    max: 1
  noop:
---

# Daily repo stewardship

## Goal
Keep the repo clean and the pipeline consistent.

## What to check/fix
For up to 10 issues per run (to limit churn):
1) For `type/problem` issues:
   - Ensure exactly ONE `stage/*` label. If multiple, keep the earliest stage and remove the rest.
   - Ensure exactly ONE `persona/*`. If missing, add `status/needs-info`.
   - If `stage/9-archived`, ensure exactly one `archive/*` reason label exists; if missing add `archive/other`.
2) Ensure “islands” exist for the current stage:
   - If missing, insert empty island markers (do not overwrite user content).
3) Write a brief steward note into:
   <!-- rw:steward:start --> ... <!-- rw:steward:end -->
   Include what was fixed and why.

## Report
Create a single daily report issue "[steward] <YYYY-MM-DD>" summarizing:
- Issues touched
- Types of fixes applied
- Any systemic problems (missing labels, template drift)

If no changes are needed, emit noop (and do not create report).