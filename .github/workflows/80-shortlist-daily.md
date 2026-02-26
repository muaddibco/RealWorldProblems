---
name: "RW: Daily Top-10 Report"
on:
  schedule: daily

engine:
  id: copilot
  agent: rw-shortlist-curator

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
  create-issue:
    title-prefix: "[top10] "
    labels: [type/report]
    close-older-issues: true
    max: 1
  noop:
---

# Create a daily Top-10 report issue

## Scope
Generate a ranked list of the 10 most promising `type/problem` issues, prioritizing:
- wedge/credible
- score/top-10 then score/top-50
- risk/low then risk/medium
- and stages 6–7 (shortlist/validation)
- excluding issues labeled `agentic-workflows`

## Output
Create ONE issue titled "[top10] <YYYY-MM-DD>" containing:
- The top 10 list with links
- One-line rationale per item
- Recommended next action (usually validation experiment)

If there are fewer than 3 eligible items, create a report explaining why and what to do next.

Always emit create-issue or noop.