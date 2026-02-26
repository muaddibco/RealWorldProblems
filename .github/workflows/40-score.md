---
name: "RW: Score Problems"
on:
  issues:
    types: [labeled]
    names: [stage/3-scored]   # scoring begins once stage/3-scored is applied
    lock-for-agent: true

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
  update-issue:
    body: true
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

Operate ONLY if:
- type/problem
- stage/3-scored
- and software-fit is yes or partial (software-fit/yes or software-fit/partial)
- and does NOT have label agentic-workflows

If software-fit is missing, add comment requesting it (or noop if not allowed) and stop.

## Fill scorecard island
Write into:

<!-- rw:scorecard:start -->
| Dimension | 1–5 | Rationale |
|---|---:|---|
| Severity | | |
| Frequency | | |
| Willingness-to-pay | | |
| Reachability | | |
| Feasibility | | |
| Wedge plausibility | | |
| **Total (max 30)** | | |

- Risk: low|medium|high (+ why)
<!-- rw:scorecard:end -->

## Apply bucket labels
Use AGENTS.md thresholds:
- score/top-10 (≥24)
- score/top-50 (20–23)
- score/long-tail (≤19)

Also apply one risk label: risk/low|risk/medium|risk/high.

## Advance
After scoring, add label stage/4-solution and remove label stage/3-scored.

Always emit safe outputs or noop.