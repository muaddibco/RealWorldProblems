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
- `stage/7-validation`
- `wedge/credible`
- `status/shortlisted`

Rank them by these four startup-selection criteria:
1. **Frequency of use** — how often will users engage (higher is better)
2. **Low market crowding** — competitors are few or clearly differentiated
3. **Implementation simplicity** — MVP achievable in weeks, not months. The easier the development, the higher the score.
4. **Viral promotion potential** — natural sharing loops or referral mechanics

## Output

Create one `[ranking] <YYYY-MM-DD>` report issue containing:
1. A scorecard for **every** matching issue using all four criteria (1–5 each).
2. A final markdown table ordered from highest total score to lowest.
3. The **Top 30** issues from that ranking (or all issues if fewer than 30 match).
4. Issue links, per-criterion scores, total score, and a short rationale per issue explaining why it was given that particular rating.

Do **not** update any problem issue body.
Do **not** add or remove any labels.

If no eligible candidates exist, emit `noop` with a short reason.

Always emit create-issue or noop.
