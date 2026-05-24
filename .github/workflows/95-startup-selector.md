---
name: "RW: Startup Selector"
strict: false
on:
  schedule: weekly
  workflow_dispatch:

concurrency:
  group: rw-startup-selector-${{ github.repository }}
  cancel-in-progress: false

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
    min-integrity: none

safe-outputs:
  staged: false
  github-token: ${{ secrets.SAFEOUTPUTS_GITHUB_TOKEN }}
  create-issue:
    title-prefix: "[ranking] "
    labels: [type/report]
    max: 1
  noop:
---

# Rank validation-ready startup candidates with geographic and GTM integrity

## Purpose

Create one ranking report for the most promising **validation-ready startup candidates** currently in the pipeline.

This workflow is not a final investment decision. Under the revised pipeline, `stage/7.1-validated` means that a geographically scoped validation plan and child experiment should exist; it does not mean demand, payment or product-market fit has been proven.

The selector compares candidates using:

- evidence-backed problem attractiveness;
- validated geographic and country scope;
- scoped product/MVP feasibility;
- AI defensibility;
- scoped competitors and substitutes;
- credible wedge quality;
- runnable validation planning;
- completed marketing and sales complexity assessment.

A candidate without a completed, scope-consistent `rw:marketing-sales` assessment is not comparable enough for final ranking.

---

## Tooling and output rules

- Read/search issues using GitHub MCP issue tools only.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, local temp-file parsing, reconstructed tool payloads or external web research.
- Do NOT modify a `type/problem` issue or its labels.
- Create exactly one `[ranking] <YYYY-MM-DD>` `type/report` issue on every successful run, even when no candidate qualifies.
- Emit `noop` only when GitHub reads or report creation are technically unavailable.
- Do not end with prose-only output.

---

## Candidate pool

Find active issues with:

- `type/problem`;
- `status/shortlisted`;
- `stage/7.1-validated`;
- `wedge/credible`;
- no `status/needs-info`;
- no `stage/9-archived`;
- no `status/duplicate`;
- no `agentic-workflows`.

Read candidate bodies and apply the exact eligibility gate below.

---

## Exact eligibility gate

Rank a candidate only when it contains completed canonical islands:

- `<!-- rw:scorecard:start --> ... <!-- rw:scorecard:end -->`
- `<!-- rw:solution:start --> ... <!-- rw:solution:end -->`
- `<!-- rw:ai-defensibility:start --> ... <!-- rw:ai-defensibility:end -->`
- `<!-- rw:competitors:start --> ... <!-- rw:competitors:end -->`
- `<!-- rw:wedge:start --> ... <!-- rw:wedge:end -->`
- `<!-- rw:validation:start --> ... <!-- rw:validation:end -->`
- `<!-- rw:marketing-sales:start --> ... <!-- rw:marketing-sales:end -->`

For a country-dependent candidate routed through conditional validation, also require:

- `<!-- rw:country-validation:start --> ... <!-- rw:country-validation:end -->`;
- `Gate status: satisfied`.

### Required labels

Require:

- one of `score/top-10`, `score/top-50`;
- one of `risk/low`, `risk/medium`, `risk/high`;
- one of `ai-defensibility/strong`, `ai-defensibility/medium`, `ai-defensibility/weak`;
- one of `ai-risk/low`, `ai-risk/medium`, `ai-risk/high`;
- exactly one of:
  - `marketing-sales/very-easy`;
  - `marketing-sales/easy`;
  - `marketing-sales/medium`;
  - `marketing-sales/hard`;
  - `marketing-sales/very-hard`.

Do not exclude candidates only for high risk, weak AI defensibility or hard selling; those must affect ranking and recommendation.

### Required scope integrity

Require consistency across islands for:

- `Geographic area`;
- `Geographic applicability: globally-portable|regional|country-dependent`;
- `Scoring geographic scope`;
- `Validated initial product scope`;
- `Validated initial wedge scope`;
- `Validated initial wedge scope for this test`;
- `Validated commercial assessment scope`;
- `Country-validation gate: not-required|satisfied-upstream|satisfied-by-country-validation`;
- `Country-validation gate used`;
- `Dedupe/variant status: not-duplicate|regional-variant|possible-near-duplicate`.

Rank only when:

- product, wedge, validation and commercial scopes are equal to or narrower than scored/verified scope;
- no country-validation gate remains outstanding;
- country-dependent candidates stay within verified country scope;
- regional candidates preserve their supported area-specific opportunity and commercial factor;
- globally-portable candidates name a concrete initial test/commercial scope;
- regional-variant candidates retain their differentiating mechanism in wedge and commercial assessment;
- competitor research status is `complete-for-wedge-review` or `material-competition-warning`;
- marketing-sales assessment status is `complete`;
- validation plan is runnable.

Do not rank candidates with missing or inconsistent inputs. Show them under **Pending prerequisites / excluded candidates**.

---

## Source-of-truth precedence

Use:

1. `rw:validation` for readiness to execute the next test.
2. `rw:marketing-sales` for commercial route and acquisition/sales friction.
3. `rw:wedge` for the entry hypothesis and kill criterion.
4. `rw:competitors` for scoped alternatives and differentiation risk.
5. `rw:ai-defensibility` for durability against generic AI/local substitution.
6. `rw:solution` for product scope, MVP and dependencies.
7. `rw:scorecard` for attractiveness, evidence, confidence, risk and validated scoring scope.
8. `rw:country-validation`, where required, for verified country boundaries.

Do not invent evidence or override scope limitations.

---

## Ranking model: seven criteria, 1–5 each

Score each eligible candidate on seven criteria, maximum base total **35**.

### 1. Monetization signal

Use scorecard, validation and marketing-sales:

- Is there credible payer/budget ownership or an economic-value proxy?
- Does the planned test address commitment where it remains unverified?

### 2. Distribution advantage

Use wedge and validation:

- Is there a believable route to first users/buyers in the validated scope?
- Is the channel concrete and testable?

### 3. Commercial motion practicality

Use `rw:marketing-sales`:

- How manageable are onboarding, trust, procurement, local language/channel, compliance and sales-cycle requirements?
- Treat `very easy` as favourable and `very hard` as unfavourable, tempered by the assessment confidence.

### 4. Implementation simplicity

Use software fit, solution, scorecard and risk:

- Can a useful MVP be delivered quickly inside the validated scope?
- Are material dependencies verified, avoidable or burdensome?

### 5. Competitive differentiation

Use competitor and wedge islands:

- Is there a plausible, evidence-safe narrow reason to win?
- Do not reward asserted “whitespace” based only on absent search results.

### 6. Validation execution readiness

Use validation:

- Is there a runnable, scoped experiment with a feasible recruiting route and decisive pass/fail threshold?

### 7. AI defensibility

Use the AI scorecard and labels:

- Does the scoped product keep value if generic AI improves?
- Is geographic advantage real, rather than implementation complexity?

---

## Adjustments

After calculating the 35-point base total:

- subtract 1 for `software-fit/partial`;
- subtract 2 for `risk/high`;
- subtract 1 for `possible-near-duplicate` unless the validation plan directly tests the distinguishing opportunity claim.

Do not add another penalty for marketing-sales complexity: it is already represented in **Commercial motion practicality**.

Record:

- base total;
- adjustments;
- final total.

---

## Selector confidence

Assign `high|medium|low`.

Use `high` only when:

- all scope/gate/island handoffs are coherent;
- country resolution is valid where needed;
- evidence is strong enough for the ranking claim;
- no pivotal ranking basis is principally speculative.

Use `medium` when the candidate is coherent and test-ready but key demand, commercial or differentiation hypotheses remain.  
Use `low` for especially assumption-sensitive but still comparable candidates.

Since `stage/7.1-validated` records an experiment plan rather than completed results, do not treat stage alone as high-confidence validation.

---

## Tie-breakers

When final totals tie, apply:

1. higher Validation execution readiness;
2. higher Monetization signal;
3. higher Commercial motion practicality;
4. stronger AI defensibility;
5. lower Risk;
6. stronger scorecard evidence/confidence;
7. geographically diverse or genuinely distinct validated scope only when otherwise comparable.

Do not use portfolio diversity to displace materially stronger candidates.

---

## Geographic and commercial portfolio analysis

Report:

- eligible candidates by geographic area and verified country scope;
- distribution by applicability type;
- count of ranked `regional-variant` candidates;
- count of ranked country-dependent candidates with satisfied gates;
- count excluded because `rw:marketing-sales` is missing/incomplete;
- count excluded because geographic/country integrity is inconsistent.

Highlight:

- concentration in one geography or cluster;
- whether regional variants have meaningfully distinct commercial routes;
- whether final ranking is bottlenecked by commercial assessment or country-gate/scoping repair;
- what cannot be inferred beyond evaluated scopes.

---

## Output report

Create one issue titled:

`[ranking] <YYYY-MM-DD>`

Use:

```md
# Startup candidate ranking — <YYYY-MM-DD>

## Summary
- **Eligible ranked candidates:** <number>
- **High / medium / low selector confidence:** <n> / <n> / <n>
- **Country-dependent candidates with satisfied gate:** <number>
- **Regional variants ranked:** <number>
- **Candidates excluded for missing marketing-sales assessment:** <number>
- **Candidates excluded for geographic/country integrity:** <number>
- **Main selection bottleneck:** ...

## Geographic and commercial portfolio snapshot
| Validated scope | Applicability | Ranked count | Typical marketing-sales complexity | Highest-ranked issue(s) | Main scope limitation |
|---|---|---:|---|---|---|
| ... | globally-portable / regional / country-dependent | ... | ... | #... | ... |

- **Concentration observation:** ...
- **Regional-variant observation:** ...
- **Country-validation / GTM observation:** ...

## Ranked Top 30

| Rank | Issue | Validated wedge/commercial scope | Applicability | Score / risk | Marketing-sales complexity | AI defensibility / risk | Monetization | Distribution | Commercial practicality | Simplicity | Differentiation | Validation readiness | AI durability | Base / adjustments / final | Selector confidence |
|---:|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| 1 | #... | ... | ... | ... | ... | ... | n | n | n | n | n | n | n | 00 / -0 / 00 | ... |

### Ranked candidate notes

#### #<issue> — <one-line opportunity>
- **Why it ranks here:** ...
- **Validated scope limitation:** ...
- **Commercial motion:** ...
- **Most decision-critical next action:** ...
- **What would invalidate selection interest:** ...

## Pending prerequisites / excluded candidates
| Issue | Apparent promise | Exclusion reason | Required next workflow or repair |
|---|---|---|---|
| #... | ... | missing marketing-sales / country-gate mismatch / geographic scope drift / incomplete competitor scan / missing island | ... |

## Portfolio recommendation
- **Most promising candidate(s) to test next:** ...
- **Required evidence before any product selection claim:** ...
- **Workflow action most likely to improve next ranking:** ...
```

### Zero or few eligible items

Even when zero or fewer than five candidates qualify, create the report:

- state the actual eligible count;
- list visible pending prerequisites;
- identify whether marketing-sales assessment, country validation, scope repair, competitor completion or experiment planning is the primary next action.

Do not rank incomplete candidates.

---

## Integrity principles

- Final ranking is credible only when commercial comparisons and geographic scopes align.
- A planned experiment is readiness, not proof of demand.
- Marketing/sales complexity must affect ranking once selection begins.
- Country-supported scope must not be displayed as regional readiness.
- Competitive differentiation must be evidence-safe.
- Report what to test next; do not prematurely declare a startup winner.

Always emit `create_issue` or `noop`.
