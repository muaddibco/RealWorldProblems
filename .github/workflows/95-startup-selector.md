---
name: "RW: Startup Selector"
on:
  schedule: weekly

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
  update-issue:
    body: true
    target: "*"
    max: 1
  add-labels:
    blocked: ["~*", "*[bot]"]
    target: "*"
    max: 5
  remove-labels:
    blocked: ["~*"]
    target: "*"
    max: 5
  create-issue:
    title-prefix: "[selected] "
    labels: [type/report]
    max: 1
  noop:
---

# Select the most promising startup from validated problems

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
3. **Implementation simplicity** — MVP achievable in weeks, not months
4. **Viral promotion potential** — natural sharing loops or referral mechanics

## Output

1. Update the winning issue body (steward island) with the selection rationale and scorecard.
2. Add label `stage/8-selected`, remove `stage/7-validation` from the winning issue.
3. Create one `[selected]` report issue summarising the decision.

If an issue already carries `stage/8-selected`, emit `noop` — selection is final.

Always emit safe outputs or noop.
