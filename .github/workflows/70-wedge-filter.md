---
name: "RW: Wedge Filter + Archive"
on:
  issues:
    types: [labeled]
    names: [stage/6-shortlist]
    lock-for-agent: true

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

# Wedge decision (wedge/credible vs wedge/weak)

Operate ONLY if:
- type/problem
- stage/6-shortlist
- and does NOT have label agentic-workflows

## Decide wedge quality
Pick exactly one:
- wedge/credible
- wedge/weak

Write into:

<!-- rw:wedge:start -->
- Decision: credible|weak
- Why: ...
- If credible: the “wedge” in one sentence
- Main risks: ...
<!-- rw:wedge:end -->

## If wedge/weak
- Add labels: wedge/weak, stage/9-archived, archive/no-wedge
- Remove label: stage/6-shortlist
- Optionally close as not planned

## If wedge/credible
- Add labels: wedge/credible, status/shortlisted
- Keep stage/6-shortlist (do not advance here) OR advance to stage/7-validation if ready.
  - Preferred: advance to stage/7-validation if validation plan is missing.

Always emit safe outputs or noop.