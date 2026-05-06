---
name: "RW: Startup Selector"
strict: false
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

# Rank validation-ready startup candidates

Tooling note:
- Read/search issues using GitHub MCP issue tools (issue_read/list_issues/search_issues).
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `noop` exactly once with reason `missing GitHub read tools` and stop.

## Goal

Create one ranking report of the most promising **validation-ready startup candidates** from the current problem pipeline.

This report should align with the updated pipeline logic:
- stage 3 scores **problem attractiveness**
- stage `ai-defensibility` evaluates **solution durability against AI commoditization**
- stage 6 decides whether the **market-entry wedge** is credible
- stage 7 defines the **next decision-critical validation experiment**

This selector is not choosing the "biggest sounding idea."
It is ranking the best **startup opportunities to focus on next**, using the evidence already present in the repo.

## Scope

Find `type/problem` issues that are:
- `wedge/credible`
- `status/shortlisted`
- `stage/7.1-validated`
- NOT `status/needs-info`
- NOT `stage/9-archived`
- NOT `agentic-workflows`

Use existing evidence from:
- `rw:scorecard`
- `rw:solution`
- `rw:ai-defensibility` (if present)
- `rw:competitors`
- `rw:wedge`
- `rw:validation`
- labels:
  - `software-fit/*`
  - `risk/*`
  - `score/*`
  - `ai-defensibility/*`
  - `ai-risk/*`

## Eligibility rules

An issue is eligible only if it has, at minimum:
- a scorecard island
- a solution island
- a wedge island
- a validation island

If `rw:ai-defensibility` or AI labels are missing:
- the issue may still be included
- but rank it conservatively
- and explicitly mention the missing AI-defensibility evaluation in the report

## Ranking model

Score each eligible candidate on a 1–5 scale using these criteria:

1. **Monetization signal**
   - Is there believable willingness-to-pay, budget ownership, or a strong payment proxy?
   - Use the scorecard and validation plan first.

2. **Distribution advantage**
   - Is there a believable first-user acquisition path or narrow ICP/channel advantage?
   - Use the wedge and validation islands first.

3. **Implementation simplicity**
   - Can a useful MVP be built quickly with acceptable operational complexity?
   - Use Feasibility, software-fit, dependency constraints, and risk.

4. **Competitive whitespace**
   - Is there meaningful room to win in a narrow segment?
   - Use competitors, wedge, and positioning gaps.

5. **Validation readiness**
   - Is the issue genuinely ready for the next focused experiment now?
   - Prefer concrete validation plans, specific ICPs, and actionable recruiting paths.

6. **AI defensibility**
   - Is the proposed solution durable against generic AI substitution?
   - Use `rw:ai-defensibility` and `ai-defensibility/*` / `ai-risk/*` when present.
   - If missing, score conservatively and mention the gap.

### Scoring rules
- Use existing issue evidence first; do not invent missing evidence.
- If evidence is missing, assign conservative scores and mark confidence as low.
- `software-fit/partial` should usually reduce **Implementation simplicity** unless the non-software portion is minor.
- Penalize `risk/high` by -2 total.
- Penalize `software-fit/partial` by -1 total.
- Missing AI-defensibility evaluation does not make an issue ineligible, but should usually lower AI defensibility and overall confidence.

## Tie-breakers

If totals are tied, break ties in this order:
1. higher **Validation readiness**
2. higher **Monetization signal**
3. stronger **AI defensibility**
4. lower **Risk**
5. stronger **Evidence / Confidence**

## Output

Create one `[ranking] <YYYY-MM-DD>` report issue containing:

### 1) Summary
- total eligible candidates
- how many are high-confidence vs medium/low-confidence
- how many are missing AI-defensibility evaluation
- the clearest pipeline bottleneck

### 2) Ranked table
Include up to the Top 30 candidates, ordered by final score.

For each item include:
- issue link
- one-line problem summary
- stage
- score bucket + risk label
- confidence + evidence
- AI defensibility + AI risk (or `missing`)
- per-criterion scores:
  - Monetization
  - Distribution
  - Simplicity
  - Whitespace
  - Validation readiness
  - AI defensibility
- total
- short rationale
- recommended next action

### 3) Near misses
Include a short section for candidates that almost made the top group, with a brief reason such as:
- weaker monetization signal
- weaker distribution path
- higher implementation complexity
- crowded space
- weaker AI defensibility
- missing AI-defensibility evaluation
- lower confidence

### 4) Portfolio note
End with a short operational note on what the repo most needs next to improve the quality of startup candidates, for example:
- stronger validation plans
- better wedge specificity
- better AI-defensibility coverage
- sharper monetization evidence
- cleaner competitor analysis

## Too few candidates

If fewer than 5 eligible items exist, still create the report.
Explain:
- how many eligible items exist
- what is most commonly missing
- what the most useful next workflow or evidence improvement would be

Always emit create-issue or noop.