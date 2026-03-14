---
name: "RW: Startup Selector"
on:
  schedule: weekly
  workflow_dispatch:

engine:
  id: copilot
  agent: rw-startup-selector

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
  create-issue:
    title-prefix: "[ranking] "
    labels: [type/report]
    max: 1
  noop:
---

# Rank startup candidates from validated problems

Tooling note:
- Read/search issues using GitHub MCP issue tools (issue_read/list_issues/search_issues).
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `missing_tool` once and stop.

## Scope

Find `type/problem` issues that are:
- `wedge/credible`
- `status/shortlisted`
- (`stage/6-shortlist` OR `stage/7-validation`)
- NOT `status/needs-info`
- NOT `stage/9-archived`

Use existing evidence from:
- `rw:scorecard`
- `rw:solution`
- `rw:competitors`
- `rw:wedge`
- `rw:validation`
- labels: `software-fit/*`, `risk/*`, `score/*`

## Ranking model

Score each candidate on a 1–5 scale using:
1. Recurring usage potential
2. Monetization signal
3. Distribution advantage
4. Implementation simplicity
5. Competitive whitespace
6. Validation readiness

Rules:
- Use existing issue evidence first; do not invent missing evidence.
- If evidence is missing, assign conservative scores and mark confidence as low.
- Penalize `software-fit/partial` by -1 total.
- Penalize `risk/high` by -2 total.
- Break ties by:
  1) stage/7-validation over stage/6-shortlist
  2) higher monetization signal
  3) lower risk

## Output

Create one `[ranking] <YYYY-MM-DD>` report issue containing:
1. Summary counts:
   - total eligible
   - high-confidence candidates
   - excluded for missing evidence
2. A scorecard for every eligible issue
3. A final Top 30 table ordered by total score
4. A short “Near misses” section
5. For each top item:
   - issue link
   - per-criterion scores
   - total
   - confidence: high|medium|low
   - short rationale
   - recommended next action

If fewer than 5 eligible items exist, still create the report and explain what pipeline stages or labels are missing.