---
name: "RW: Marketing & Sales Complexity"
on:
  workflow_dispatch:
    inputs:
      limit:
        description: "How many eligible issues to process in this run (1-25)"
        required: true
        default: "10"

engine:
  id: copilot
  agent: rw-marketing-sales-complexity

permissions:
  contents: read
  issues: read

sandbox:
  agent: awf

network:
  allowed:
    - defaults
    - github
    - "*.tavily.com"

mcp-servers:
  tavily:
    command: npx
    args: ["-y", "@tavily/mcp-server"]
    env:
      TAVILY_API_KEY: "${{ secrets.TAVILY_API_KEY }}"
    allowed: ["search", "search_news"]

tools:
  github:
    toolsets: [issues]
    read-only: true
  web-fetch:

safe-outputs:
  staged: false
  github-token: ${{ secrets.SAFEOUTPUTS_GITHUB_TOKEN }}
  update-issue:
    body: true
    target: "*"
    max: 25
  add-labels:
    blocked: ["~*", "*[bot]"]
    target: "*"
    max: 25
  create-issue:
    title-prefix: "[marketing-sales] "
    labels: [type/report]
    max: 1
  noop:
---

# Marketing & Sales Complexity (manual batch assessment)

Operate ONLY on issues that:
- have label `type/problem`
- have label `stage/7-validation`
- have label `wedge/credible`
- have one of: `score/top-10`, `score/top-50`
- have one of: `risk/low`, `risk/medium`
- have one of: `ai-defensibility/medium`, `ai-defensibility/strong`
- have one of: `ai-risk/low`, `ai-risk/medium`
- do NOT have label `agentic-workflows`
- do NOT have any `marketing-sales/*` label

This workflow is manual-only.
Process up to `${{ inputs.limit }}` eligible issues.
If `${{ inputs.limit }}` is not a valid positive integer, emit noop.
If `${{ inputs.limit }}` is greater than 25, treat it as 25.

Tooling note:
- Read/search issues using GitHub MCP issue tools (`issue_read`, `list_issues`, `search_issues`).
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `missing_tool` once and stop.
- If web-search/web-fetch are missing, do a best-effort assessment and clearly mark unverified assumptions.

## Candidate discovery

1) Search open issues broadly using a stable base query such as:

`repo:<OWNER>/<REPO> is:issue is:open label:"type/problem" label:"stage/7-validation" label:"wedge/credible" -label:"agentic-workflows" -label:"marketing-sales/very-easy" -label:"marketing-sales/easy" -label:"marketing-sales/medium" -label:"marketing-sales/hard" -label:"marketing-sales/very-hard"`

2) From the search results, keep ONLY issues that also satisfy:
- `score/top-10` OR `score/top-50`
- `risk/low` OR `risk/medium`
- `ai-defensibility/medium` OR `ai-defensibility/strong`
- `ai-risk/low` OR `ai-risk/medium`

3) Sort eligible issues in this order:
- `score/top-10` before `score/top-50`
- `risk/low` before `risk/medium`
- lower issue number first

4) Take only the first `${{ inputs.limit }}` eligible issues.

If there are no eligible issues, emit noop.

## Per-issue task

Estimate how difficult it will be to market and sell the likely product implied by the problem and the current issue context.

Use available issue content, especially:
- normalized problem
- scorecard
- solution hypothesis
- competitor scan
- wedge decision
- validation plan
- AI defensibility / AI risk labels already present

When helpful, use Tavily/web search to sanity-check:
- likely acquisition channels
- buyer type
- sales motion
- category crowding
- whether similar products are typically self-serve, PLG, sales-assisted, or enterprise-led

## Write into marketing-sales island

For each processed issue, update only:

<!-- rw:marketing-sales:start -->
### Likely acquisition channels
- ...

### Likely sales motion
- Motion: Self-serve | PLG | founder-led sales | SMB outbound | enterprise sales | channel/partner-led
- Primary buyer: ...
- Main adoption trigger: ...

### Key blockers / friction
- ...

### Proposed strategy
- ...

### Complexity
- very easy|easy|medium|hard|very hard

### Why
- 3–6 bullets covering buyer reachability, sales cycle length, need for demos/onboarding, procurement/compliance, virality/referrals, and content/SEO/paid viability
<!-- rw:marketing-sales:end -->

## Apply exactly one label per processed issue

Pick exactly one:
- marketing-sales/very-easy
- marketing-sales/easy
- marketing-sales/medium
- marketing-sales/hard
- marketing-sales/very-hard

Do NOT touch issues that already have any `marketing-sales/*` label.

## Report issue (MANDATORY if at least 1 issue processed)

After processing the batch, create exactly one report issue with title:

`[marketing-sales] <YYYY-MM-DD>`

The report body must include:

# Marketing & Sales Complexity Report

## Summary
- Candidate issues found: <number>
- Issues taken for processing: <number>
- Issues successfully processed: <number>

## Processed issues
| Issue | Title | Complexity | Proposed strategy |
|---|---|---|---|
| #123 | Example Title 1 | medium | founder-led sales to niche SMBs via outbound + case-study content |
| #456 | Example Title 2 | easy | self-serve PLG via SEO + templates + referrals |

Rules:
- "Candidate issues found" = number of eligible issues after exact filtering and before truncating to the limit
- "Issues taken for processing" = min(candidate issues found, limit)
- "Issues successfully processed" = number of issues for which both island update and label application were completed
- Include only successfully processed issues in the table
- If some taken issues fail, they should not appear in the table

## Calibration guide

- **very easy**: strong self-serve or viral loop; user can adopt alone; little buyer education; short time-to-value
- **easy**: discoverable and self-serve or light-touch sales; modest onboarding; low procurement friction
- **medium**: some buyer education or niche targeting needed; repeatable but not trivial acquisition
- **hard**: outbound, demos, significant trust-building, integrations, or multi-stakeholder approval usually required
- **very hard**: enterprise or regulated or complex procurement; expensive sales talent likely required; long cycle; heavy onboarding or change management

Always emit safe outputs or noop.