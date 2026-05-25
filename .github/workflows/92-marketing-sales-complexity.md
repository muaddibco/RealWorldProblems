---
name: "RW: Marketing & Sales Complexity"
strict: false
on:
  workflow_dispatch:
    inputs:
      limit:
        description: "How many eligible issues to process in this run (1-25)"
        required: true
        default: "10"
        type: string

concurrency:
  group: rw-marketing-sales-${{ github.repository }}
  cancel-in-progress: false

engine:
  id: copilot
  model: ${{ vars.GH_AW_MODEL_AGENT_COPILOT || 'gpt-5.4' }}
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
    args: ["-y", "tavily-mcp"]
    env:
      TAVILY_API_KEY: "${{ secrets.TAVILY_API_KEY }}"
    allowed: ["tavily_search", "tavily_research", "tavily_extract"]

tools:
  github:
    toolsets: [issues]
    read-only: true
    min-integrity: none
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

# Marketing & Sales Complexity: assess commercial motion in validated geographic scope

## Purpose

This manual batch workflow estimates the difficulty of acquiring, activating and selling to initial customers for a shortlisted opportunity **within its validated initial wedge scope**.

It is an orthogonal commercial assessment. It does not advance pipeline stage, change a wedge decision, select a startup or imply that a planned validation experiment has already produced results.

The workflow must respect the revised geography model:

- `globally-portable` opportunities still require a specific initial commercial scope;
- `regional` opportunities may have area-specific channels, trust, language, payment or buyer constraints;
- `country-dependent` opportunities may be assessed only within verified country scope;
- `regional-variant` opportunities must have a commercially meaningful regional distinction rather than only a different area label.

The completed `rw:marketing-sales` island is a required comparative input for `95-startup-selector.md`.

---

## Tooling and completion rules

- Read/search issues using GitHub MCP issue tools only.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, local temp-file parsing, reconstructed tool payloads or workflow-output files.
- Use Tavily search/news and `web-fetch` only for bounded checks of market-facing commercial facts in the validated scope.
- Prefer official product, association, marketplace, channel, procurement or buyer-facing sources.
- Search relevant local/regional languages when a scoped acquisition or sales path materially depends on them and it is practical.
- Do not infer easy sales, reachable buyers, market whitespace or willingness to pay from thin searches.
- If GitHub reads are unavailable, emit `noop` with reason `missing GitHub read tools`.

A run ends with:

- safe-output island updates plus labels and one report for completed assessments; or
- a report recording blocked/incomplete commercial assessment when such issues were inspected; or
- `noop` when there are no eligible unassessed items.

---

## No-stage-change rule

This workflow may:

- replace only `<!-- rw:marketing-sales:start --> ... <!-- rw:marketing-sales:end -->`;
- add exactly one `marketing-sales/*` label when an assessment is complete;
- create one report issue.

It must NOT:

- add or remove any `stage/*` label;
- alter `status/shortlisted`;
- archive or close a candidate;
- change score, risk, wedge, software-fit, AI-defensibility or country-validation labels;
- rewrite another workflow's island.

---

## Batch limit and deterministic discovery

Process up to `${{ inputs.limit }}` eligible issues.

- If the input is not a positive integer, emit `noop`.
- If it exceeds 25, cap it at 25.

### Broad discovery query

Discover open issues with:

- `type/problem`;
- `status/shortlisted`;
- `stage/7.1-validated`;
- `wedge/credible`;
- no `agentic-workflows`;
- no `status/needs-info`;
- no `stage/9-archived`;
- no existing `marketing-sales/*` label.

Use:

`repo:<OWNER>/<REPO> is:issue is:open label:"type/problem" label:"status/shortlisted" label:"stage/7.1-validated" label:"wedge/credible" -label:"agentic-workflows" -label:"status/needs-info" -label:"stage/9-archived" -label:"marketing-sales/very-easy" -label:"marketing-sales/easy" -label:"marketing-sales/medium" -label:"marketing-sales/hard" -label:"marketing-sales/very-hard"`

### Do not pre-filter away commercial difficulty

Do **not** exclude candidates merely because they carry:

- `risk/high`;
- `ai-defensibility/weak`;
- `ai-risk/high`.

Marketing/sales difficulty is itself a final-comparison input. High risk or weak AI durability should be read and reflected in the assessment, not prevent that assessment from being produced.

### Pagination

Do not assume a first search batch is complete.

Maintain:

- `seen_issue_ids`;
- `eligible_issue_ids`;
- `discovery_complete`.

When paging exists:

1. Read pages deterministically, preferably 50 issues per page.
2. Deduplicate by issue number.
3. Read issue bodies and apply the eligibility gate below.
4. Continue until the processing limit is met or search results are exhausted.

When paging is unavailable:

1. Search deterministic non-overlapping created-date windows.
2. Split windows at truncation risk.
3. Deduplicate across windows.
4. Continue until enough candidates are found, the search space is exhausted or reliable continuation is impossible.

If discovery cannot be reliably completed:

- state `Discovery complete: no` in the report;
- process only fully verified eligible items where not misleading.

---

## Exact eligibility gate

Before commercial assessment, require these completed canonical islands:

Each required upstream island may appear either as the full island block or as the matching completion marker `<!-- gh-aw-island-end:<stage-file> -->`, where `<stage-file>` is the upstream workflow filename without `.md`.

- `<!-- rw:scorecard:start --> ... <!-- rw:scorecard:end -->`
- `<!-- rw:solution:start --> ... <!-- rw:solution:end -->`
- `<!-- rw:ai-defensibility:start --> ... <!-- rw:ai-defensibility:end -->`
- `<!-- rw:competitors:start --> ... <!-- rw:competitors:end -->`
- `<!-- rw:wedge:start --> ... <!-- rw:wedge:end -->`
- `<!-- rw:validation:start --> ... <!-- rw:validation:end -->`

Each of the above may also be represented by its matching `gh-aw-island-end` marker, such as `<!-- gh-aw-island-end:40-score -->`, `<!-- gh-aw-island-end:50-solution -->`, `<!-- gh-aw-island-end:55-ai-defensibility -->`, `<!-- gh-aw-island-end:60-competitors -->`, `<!-- gh-aw-island-end:70-wedge-filter -->`, and `<!-- gh-aw-island-end:90-validation-plan -->`.

For a country-dependent route resolved through the conditional gate, also require:

- `<!-- rw:country-validation:start --> ... <!-- rw:country-validation:end -->`;
  - or `<!-- gh-aw-island-end:35-country-validation -->`;
- `Gate status: satisfied`.

Require consistent fields:

From `rw:scorecard`:

- `Geographic area`;
- `Geographic applicability: globally-portable|regional|country-dependent`;
- `Scoring geographic scope`;
- `Country-validation gate: not-required|satisfied-upstream|satisfied-by-country-validation`;
- `Dedupe/variant status: not-duplicate|regional-variant|possible-near-duplicate`;
- evidence, confidence and risk.

From `rw:solution`:

- `Validated initial product scope`;
- initial user/buyer and payer/economic-beneficiary assumption;
- dependencies and assumptions.

From `rw:competitors`:

- `Research status: complete-for-wedge-review|material-competition-warning`;
- scoped competitor/substitute information;
- strongest remaining threat.

From `rw:wedge`:

- `Decision: credible`;
- `Validated initial wedge scope`;
- initial ICP/buyer and first distribution path;
- scope limitation.

From `rw:validation`:

- validated geographic experiment scope;
- participant/customer location;
- recruiting path and pass/fail criteria.

Assess only when:

- validated wedge/commercial scope is equal to or narrower than the scored/product/country-verified scope;
- no country-validation gate remains outstanding;
- a country-dependent item stays within verified country scope;
- a regional item retains its area-specific adoption or distribution factor;
- a globally-portable item has a defined initial commercial scope;
- a regional-variant item states the commercial distinction being assessed.

When these requirements fail:

- do not add a marketing-sales complexity label;
- optionally write `Assessment status: needs-verification`;
- report the blocked assessment.

---

## Source-of-truth precedence

Use:

1. `rw:validation` for planned participant/customer scope and recruiting path.
2. `rw:wedge` for the validated entry route and adoption factor.
3. `rw:competitors` for alternatives and competitive acquisition friction.
4. `rw:solution` for product, buyer, onboarding and dependencies.
5. `rw:ai-defensibility` for generic-AI/local-substitute selling risk.
6. `rw:scorecard` for scope, payer framing, evidence/confidence and risk.
7. `rw:country-validation`, when required, for verified country boundaries.

External research may sanity-check commercial motion only; it must not rewrite upstream scope.

---

## Geographic research scope

### `globally-portable`

Assess the declared initial geography/segment only. Record what commercial assumptions require re-checking before expansion.

### `regional`

Assess the supported area-specific commercial factor, such as language, payments, trust, local channels, provider structure or substitutes. Do not convert single-country evidence into area-wide commercial ease.

### `country-dependent`

Assess only the verified country scope. Do not use unchecked geographic expansion to improve the complexity verdict.

### `regional-variant`

Assess whether the geographic distinction creates a different reachable buyer/channel, trust position or sales friction compared with the shared cluster.

---

## Complexity classification

Assign exactly one label only for a complete assessment:

- `marketing-sales/very-easy`
- `marketing-sales/easy`
- `marketing-sales/medium`
- `marketing-sales/hard`
- `marketing-sales/very-hard`

Calibration:

- **very easy:** supported self-serve/referral path, individual adoption, minimal trust/procurement/onboarding friction.
- **easy:** mostly self-serve or light-touch founder support with a credible low-friction channel.
- **medium:** targeted acquisition and education/trust work required, but plausible for a small team.
- **hard:** sales assistance, demos/onboarding, integration, compliance, institutional trust or multi-stakeholder approval is material.
- **very hard:** long/expensive institutional, public-sector or enterprise motion; mandatory partners/procurement or specialist sales dominates.

When uncertain between adjacent levels, choose the harder level unless a supported low-friction path exists.

---

## Marketing-sales island

Write only:

```md
<!-- rw:marketing-sales:start -->
### Marketing and sales assessment scope
- **Assessment status:** complete | needs-verification
- **Geographic area:** <area>
- **Geographic applicability:** globally-portable | regional | country-dependent
- **Validated commercial assessment scope:** <validated wedge area or verified country/countries>
- **Country-validation gate used:** not-required | satisfied-upstream | satisfied-by-country-validation
- **Dedupe/variant status:** not-duplicate | regional-variant | possible-near-duplicate
- **Source languages / local market checks used:** ...
- **What must not be generalized beyond this scope:** ...

### Buyer and commercial trigger
- **Initial user / ICP:** ...
- **Primary buyer / budget owner:** ...
- **Economic beneficiary / payment proxy:** ...
- **Main adoption trigger:** ...
- **Commercial assumption still unvalidated:** ...

### Likely acquisition channels
| Channel | Why it fits the scoped ICP | Geographic/local constraint | Evidence or basis | Confidence |
|---|---|---|---|---|
| ... | ... | ... | upstream / external verification / hypothesis | low / medium / high |

### Likely sales motion
- **Motion:** self-serve | PLG | founder-led sales | SMB outbound | enterprise sales | channel/partner-led | public/institutional procurement
- **Time-to-value / onboarding expectation:** ...
- **Trust, compliance, procurement, integration or payment friction:** ...
- **Local-language / local-channel requirement:** ...

### Competitive and AI commercial friction
- **Strongest competitor/substitute affecting acquisition:** ...
- **Generic-AI substitution effect on selling:** ...
- **Regional/country-specific advantage or friction:** ...

### Proposed go-to-market strategy
- ...
- ...
- **Expansion assumption requiring later validation:** ...

### Complexity decision
- **Complexity:** very easy | easy | medium | hard | very hard | not-assigned
- **Complexity label:** marketing-sales/very-easy | marketing-sales/easy | marketing-sales/medium | marketing-sales/hard | marketing-sales/very-hard | none
- **Why:**
  - ...
  - ...
  - ...

### Startup-selector handoff
- **Commercial-strength signal:** strong | moderate | weak | not-assessed
- **Biggest customer-acquisition or sales risk:** ...
- **Validation evidence that would materially improve confidence:** ...
<!-- rw:marketing-sales:end -->
```

If `Assessment status: needs-verification`, use `Complexity: not-assigned`, add no complexity label and include the item in the blocked section of the report.

---

## Safe-output behavior

### Complete assessment

For each completed item:

1. `update_issue` with `operation: replace-island` for only `rw:marketing-sales`.
2. `add_labels` for exactly one `marketing-sales/*` label.
3. No other label or stage changes.

### Needs verification

Where accurate and useful:

1. `update_issue` with the needs-verification island.
2. Do not add a marketing-sales label.
3. Include it in the report.

---

## Report

Create one issue titled:

`[marketing-sales] <YYYY-MM-DD>`

when at least one assessment is completed, discovery is incomplete, or otherwise promising candidates are blocked by commercial/geographic prerequisites.

Use:

```md
# Marketing & Sales Complexity Report — <YYYY-MM-DD>

## Summary
- **Discovery complete:** yes | no
- **Candidate issues found before limit:** <number>
- **Issues taken for processing:** <number>
- **Issues successfully assessed and labelled:** <number>
- **Issues blocked / left unlabelled:** <number>
- **Geographic scopes assessed:** <areas/countries>
- **Main commercial bottleneck:** ...

## Completed assessments
| Issue | Validated commercial scope | Applicability | Complexity | Likely motion | Proposed strategy | Selector relevance |
|---|---|---|---|---|---|---|
| #... | ... | ... | ... | ... | ... | ... |

## Blocked or needs-verification assessments
| Issue | Potential scope | Blocker | Required fix or verification |
|---|---|---|---|
| #... | ... | ... | ... |

## Geographic commercial observations
- **Area/country concentration in assessed set:** ...
- **Country-dependent sales constraints observed:** ...
- **Regional-variant commercial differentiation observed:** ...
- **What cannot be inferred beyond assessed scopes:** ...

## Discovery / process note
- ...
```

---

## Integrity principles

- Measure commercialization difficulty inside the validated wedge scope, not an imagined expansion market.
- A planned experiment is not proof of sales ease or payment.
- Do not filter out risky candidates before measuring GTM complexity.
- Do not assign easy acquisition from optimistic channel speculation.
- Produce a comparable, scope-honest handoff for Startup Selector.

Always emit safe outputs or `noop`.
