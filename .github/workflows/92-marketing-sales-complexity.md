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

This workflow is manual-only.

## Operate ONLY on issues that:
- have label `type/problem`
- have label `stage/7-validation`
- have label `wedge/credible`
- have one of: `score/top-10`, `score/top-50`
- have one of: `risk/low`, `risk/medium`
- have one of: `ai-defensibility/medium`, `ai-defensibility/strong`
- have one of: `ai-risk/low`, `ai-risk/medium`
- do NOT have label `agentic-workflows`
- do NOT have any `marketing-sales/*` label

Process up to `${{ inputs.limit }}` eligible issues.

If `${{ inputs.limit }}` is not a valid positive integer, emit noop.
If `${{ inputs.limit }}` is greater than 25, treat it as 25.

Tooling note:
- Read/search issues using GitHub MCP issue tools (`issue_read`, `list_issues`, `search_issues`).
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `missing_tool` once and stop.
- If web-search/web-fetch are missing, do a best-effort assessment and clearly mark unverified assumptions.

## Candidate discovery — MUST be paginated and deterministic

You MUST NOT assume that one search result batch is complete.

You MUST continue discovery until one of these is true:
1. you have collected at least `${{ inputs.limit }}` eligible issues, OR
2. the search space is exhausted, OR
3. you can prove discovery is incomplete because runtime tooling does not support reliable continuation.

Do NOT stop after the first batch merely because the current batch has fewer than `${{ inputs.limit }}` eligible issues.

### Base query
Use this broad base query for discovery:

`repo:<OWNER>/<REPO> is:issue is:open label:"type/problem" label:"stage/7-validation" label:"wedge/credible" -label:"agentic-workflows" -label:"marketing-sales/very-easy" -label:"marketing-sales/easy" -label:"marketing-sales/medium" -label:"marketing-sales/hard" -label:"marketing-sales/very-hard"`

### Exact eligibility filter
A candidate is eligible only if ALL are true:
- `score/top-10` OR `score/top-50`
- `risk/low` OR `risk/medium`
- `ai-defensibility/medium` OR `ai-defensibility/strong`
- `ai-risk/low` OR `ai-risk/medium`

### Deterministic discovery procedure

Maintain these sets / counters:
- `seen_issue_ids`
- `eligible_issue_ids`
- `eligible_issues`
- `discovery_complete = false`

#### Preferred method: explicit page pagination
If the runtime supports paging for search/list operations, use it.

1. Fetch page 1 with `perPage: 50`.
2. Add newly seen issue IDs to `seen_issue_ids`.
3. Filter results locally using the exact eligibility filter.
4. Add newly eligible issues to `eligible_issues`.
5. If eligible count is still below limit, fetch page 2, then page 3, etc.
6. Stop only when:
   - eligible count reaches limit, OR
   - a page returns 0 items, OR
   - a page returns fewer than `perPage` items and therefore the result set is exhausted.

Set `discovery_complete = true` if the result set is exhausted or limit has been reached through a reliable paginated scan.

#### Fallback method: deterministic created-date window discovery
If explicit page pagination is NOT available, use date-window partitioning and DO NOT silently settle for one batch.

1. Start with a broad window covering all plausible issue creation dates.
2. Search the base query plus a `created:` range constraint for that window.
3. If the returned batch is safely below truncation risk, accept the unseen results from that window.
4. If the returned batch may be truncated, split the window into two smaller non-overlapping windows and search both windows, newest first.
5. Continue splitting until:
   - the accepted windows are all below truncation risk, OR
   - enough eligible issues have been collected, OR
   - the window cannot be subdivided further in a reliable way.

You MUST deduplicate by issue number across windows.

Set `discovery_complete = true` only if the full search space has been covered reliably or enough eligible issues were collected through reliable discovery.

#### If reliable continuation is impossible
If the runtime does not support reliable paging or reliable deterministic windowing:
- do NOT silently proceed as if discovery were complete;
- process only if you can clearly mark discovery as incomplete in the report;
- if even that would be misleading, emit noop.

## Ranking and take set

After discovery:
1. Rank all unique eligible issues in this exact order:
   - `score/top-10` before `score/top-50`
   - `risk/low` before `risk/medium`
   - lower issue number first

2. Take the first `${{ inputs.limit }}` eligible issues from that ranked list.

Definitions:
- `candidate issues found` = total number of unique eligible issues discovered before truncating to the limit
- `issues taken for processing` = min(candidate issues found, limit)
- `issues successfully processed` = issues where both the island update and the complexity label were applied successfully

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

## Report issue (MANDATORY if at least 1 issue processed OR discovery was incomplete)

Create exactly one report issue if either:
- at least one issue was successfully processed, OR
- discovery was incomplete and that fact must be reported

Title:
`[marketing-sales] <YYYY-MM-DD>`

Body:

# Marketing & Sales Complexity Report

## Summary
- Discovery complete: yes|no
- Candidate issues found: <number>
- Issues taken for processing: <number>
- Issues successfully processed: <number>

## Processed issues
| Issue | Title | Complexity | Proposed strategy |
|---|---|---|---|
| #123 | Example Title 1 | medium | founder-led sales to niche SMBs via outbound + case-study content |
| #456 | Example Title 2 | easy | self-serve PLG via SEO + templates + referrals |

Rules:
- Include only successfully processed issues in the table
- If some taken issues fail, they must not appear in the table
- If discovery was incomplete, add a short note under Summary explaining why

## Calibration guide

- **very easy**: strong self-serve or viral loop; user can adopt alone; little buyer education; short time-to-value
- **easy**: discoverable and self-serve or light-touch sales; modest onboarding; low procurement friction
- **medium**: some buyer education or niche targeting needed; repeatable but not trivial acquisition
- **hard**: outbound, demos, significant trust-building, integrations, or multi-stakeholder approval usually required
- **very hard**: enterprise or regulated or complex procurement; expensive sales talent likely required; long cycle; heavy onboarding or change management

Always emit safe outputs or noop.