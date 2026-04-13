---
name: "RW: Daily Top-10 Report"
on:
  schedule: daily

concurrency:
  group: rw-copilot-agents-${{ github.repository }}
  cancel-in-progress: false

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

Tooling note:
- Read/search issues using GitHub MCP issue tools (issue_read/list_issues/search_issues).
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `noop` with a short reason and stop.

## Goal
Create one daily report listing the 10 most promising `type/problem` issues that are currently the best candidates for validation work.

This report should align with the updated pipeline logic:
- stage 3 scores **problem attractiveness**
- stage ai-defensibility evaluates **solution durability against AI commoditization**
- stage 6 decides whether the **market-entry wedge** is credible
- this daily report should prioritize issues that are attractive, wedge-credible, and validation-relevant now, while also surfacing confidence, evidence quality, and AI defensibility

## Eligible issues
Consider only issues that:
- have label `type/problem`
- have label `wedge/credible`
- have label `score/top-10` or `score/top-50`
- are in `stage/6-shortlist` or `stage/7-validation`
- do NOT have label `agentic-workflows`
- do NOT have label `stage/9-archived`

If an issue is missing a scorecard island or wedge island, treat it as ineligible for the report.

## Ranking logic
Rank eligible issues using the following order of priority:

1. **Validation readiness**
   - prefer `stage/7-validation` over `stage/6-shortlist`
   - rationale: once a credible wedge exists, the most valuable daily shortlist is what is ready for validation now

2. **Score bucket**
   - `score/top-10` above `score/top-50`

3. **Confidence** from the scorecard island
   - `high` above `medium` above `low`

4. **Evidence** from the scorecard island
   - `strong` above `medium` above `weak`

5. **Risk label**
   - `risk/low` above `risk/medium` above `risk/high`

6. **AI defensibility**
   - `ai-defensibility/strong` above `ai-defensibility/medium` above `ai-defensibility/weak`
   - if the AI defensibility labels or island are missing, treat the issue conservatively and mention the gap in the report
   - AI defensibility is a secondary ranking factor, not a replacement for validation readiness or wedge quality

7. **Tie-break from scorecard and wedge content**
   Prefer issues that show more of the following:
   - higher urgency / failure cost
   - clearer willingness-to-pay or strong payment proxy
   - stronger reachability / believable first-user access
   - stronger feasibility for a narrow MVP
   - a more concrete wedge with a believable initial ICP and distribution path

## Important ranking guidance
- Do **not** re-score the problem from scratch; use the existing scorecard and wedge decision as the source of truth.
- Do **not** promote an issue only because the problem is severe; it should already have a credible wedge.
- If two issues are similar, prefer the one with higher confidence and stronger evidence, not the one with the more ambitious idea.
- If an issue has `wedge/credible` but the wedge rationale is still vague, mention that explicitly in the report and rank it lower.
- If an issue is in `stage/6-shortlist`, it can still appear in the report, but should usually rank below a similarly strong item already in `stage/7-validation`.
- Do **not** let AI defensibility outweigh clear validation readiness, stronger evidence, or a substantially better wedge.
- Use AI defensibility mainly as a display signal and a tie-breaker among otherwise similar candidates.
- If an issue has weak AI defensibility but remains wedge-credible and validation-ready, include it when warranted, but call out that it should be tested against generic AI plus manual workflow.

## Output
Create ONE issue titled `[top10] <YYYY-MM-DD>` containing:

### 1) Header summary
A short summary with:
- how many eligible items were found
- how many were `stage/7-validation`
- how many were `stage/6-shortlist`
- how many eligible items are `ai-defensibility/strong`, `medium`, and `weak` (when available)
- any clear pipeline bottleneck (for example: many scored items but few credible wedges)

### 2) Ranked Top 10
For each item include:
- issue link (`#123`)
- one-line problem summary
- current stage
- score bucket + risk label
- confidence + evidence
- AI defensibility + AI risk
- one sentence on why it made the shortlist
- one sentence with the recommended next validation action

### 3) Near misses
Include up to 5 additional issues that almost made the list, with a short note on what held them back, such as:
- only `score/top-50`
- weaker evidence
- higher risk
- wedge credible but still vague
- not yet at `stage/7-validation`
- weaker AI defensibility
- missing AI defensibility evaluation

### 4) Pipeline note
End with a brief note on what the repo needs most next, such as:
- more validation-ready items
- stronger wedge definition
- better evidence in scorecards
- more competitor workups

## Too few candidates
If there are fewer than 3 eligible items, still create the daily report issue.
Explain:
- how many eligible items exist
- the main reasons the shortlist is thin
- what next workflow stages or labels are most often missing
- the best immediate action to improve tomorrow’s shortlist quality

Always emit create-issue or noop.
