---
name: "RW: Country Validation Gate"
strict: false
on:
  workflow_dispatch:
    inputs:
      issue_number:
        description: "Target country-dependent problem issue number"
        required: true
        type: string
      orchestration_id:
        description: "Durable orchestration instance ID for correlation"
        required: false
        type: string
      minimum_sources_per_country:
        description: "Minimum independent supporting sources per required country/check scope"
        required: true
        default: "1"
        type: string
      verify_obvious_local_alternatives:
        description: "Check obvious country-specific alternatives that could invalidate the opportunity framing"
        required: true
        default: "true"
        type: choice
        options:
          - "true"
          - "false"

concurrency:
  group: rw-issue-${{ github.repository }}-${{ inputs.issue_number }}
  cancel-in-progress: false

run-name: "RW: Country Validation Gate | issue #${{ inputs.issue_number }} | orch ${{ inputs.orchestration_id || 'n/a' }}"

engine:
  id: copilot
  model: ${{ vars.GH_AW_MODEL_AGENT_COPILOT || 'gpt-5.4' }}
  agent: rw-country-validator

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
    max: 1
  add-comment:
    target: "*"
    max: 1
  add-labels:
    blocked: ["~*", "*[bot]"]
    target: "*"
    max: 10
  remove-labels:
    blocked: ["~*"]
    target: "*"
    max: 10
  noop:
---

# Validate country-dependent mechanisms before attractiveness scoring

## Purpose

This is a **conditional pre-scoring gate** for problem candidates whose geographical framing is:

- `Geographic applicability: country-dependent`; and
- `Country validation before scoring: outstanding`.

The pipeline investigates problems primarily by geographical area. Some problems, however, rely on a national or municipal mechanism that must be checked before the issue can be scored honestly, such as:

- public-service procedures, identity documents, benefits, permits, tax or licensing;
- healthcare coverage or insurance pathways;
- payments, banking, consumer credit or financial regulation;
- transport permits, tolls, parking or fines;
- school/childcare administration;
- municipal services or waste rules;
- privacy, data-residency or compliance requirements;
- country/provider-specific APIs, data sources, integrations or available substitutes.

This stage verifies only the **named outstanding country-level requirements** already identified upstream. It does not re-run general problem discovery and does not turn a regional investigation into a country-by-country survey without need.

Expected routing:

```text
stage/2-deduped
  → RW: Software Fit
      ├─ software-fit/no → stage/9-archived
      ├─ software-fit/yes|partial and no outstanding country gate → stage/3-scored
      └─ software-fit/yes|partial and outstanding country gate
            → stage/2.5-country-validation
            → RW: Country Validation Gate
                ├─ gate satisfied → stage/3-scored
                └─ gate outstanding or materially undermined → remain at stage/2.5-country-validation
```

Important: the current `30-software-fit.md` must be updated to perform this routing before this workflow is enabled.

---

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Orchestration ID: `${{ inputs.orchestration_id }}`
- Minimum supporting sources per country/check scope: `${{ inputs.minimum_sources_per_country }}`
- Verify obvious local alternatives: `${{ inputs.verify_obvious_local_alternatives }}`

Before doing anything else:

- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY on issue #${{ inputs.issue_number }}.
- If the issue does not have labels `type/problem` and `stage/2.5-country-validation`, or has label `agentic-workflows`, emit `noop` and stop.

---

## Tooling rules

### Repository reads

- Read the target issue using GitHub MCP issue tools only.
- Read related issues only when needed to understand a retained regional variant or documented canonical cluster.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, local temp-file parsing, reconstructed MCP payloads or workflow-output files.
- If GitHub issue tools are unavailable, emit `noop` with reason `missing GitHub read tools` and stop.

### External verification

- Use Tavily search/news and `web-fetch` for country-level verification.
- Prefer official national/local institutions, regulators, public providers, insurers, payment providers, transport/public-service operators and authoritative documentation for the mechanism being checked.
- Use source languages recorded upstream and the relevant country language(s) where useful and practical.
- Use reputable reports, research or public datasets for burden/frequency/economic-impact claims.
- Use official product/provider pages for local availability, integration or public pricing claims.
- Use news, reviews or complaints only as qualitative supporting signals, not as proof of broad prevalence or willingness to pay.
- If external verification tools are unavailable, write a country-validation island with `Gate status: outstanding`, add `status/needs-info`, retain stage and stop.

---

## Mandatory completion rule

A run MUST end with at least one safe-output tool call.

Valid endings:

### Gate satisfied

- `update_issue` with the complete `rw:country-validation` island;
- `add_labels` for `stage/3-scored`;
- `remove_labels` for `stage/2.5-country-validation`;
- optionally `remove_labels` for `status/needs-info` only when the country gate was its sole remaining blocker.

### Gate remains outstanding or problem is materially undermined

- `update_issue` with the complete `rw:country-validation` island;
- `add_labels` for `status/needs-info`;
- optionally one `add_comment` stating the precise unmet/contradicted requirement;
- retain `stage/2.5-country-validation`.

### Ineligible issue

- `noop`.

Do not finish with prose-only output.
Do not silently advance an incompletely verified country-dependent candidate.

---

## Mandatory write targeting rule

Because this workflow runs via `workflow_dispatch`, there is no implicit triggering issue.

For every write action, explicitly target:

- `repo: ${{ github.repository }}`
- `issue_number: ${{ inputs.issue_number }}` for `update_issue`
- `item_number: ${{ inputs.issue_number }}` for `add_comment`
- `item_number: ${{ inputs.issue_number }}` for `add_labels`
- `item_number: ${{ inputs.issue_number }}` for `remove_labels`

Never write to any comparison or related issue.

---

## Required upstream handoff

Before country validation, the issue MUST contain:

Each required upstream island may appear either as the full island block or as the matching completion marker `<!-- gh-aw-island-end:<stage-file> -->`, where `<stage-file>` is the upstream workflow filename without `.md`.

If issue-read output does not include HTML comments, treat upstream handoff as present when the matching generated section heading is present with substantive content:

- Evidence: `### Evidence enrichment verdict`
- Normalized problem: `### Normalized problem`
- Dedupe: `### Dedupe and cluster decision`
- Software fit: `### Software fit decision`

When this fallback is used:

- do not block solely for missing comment markers;
- validate required values from the section content itself;
- only apply `status/needs-info` if the section content is actually missing or materially incomplete.

1. A completed evidence island:
  - `<!-- rw:evidence:start --> ... <!-- rw:evidence:end -->`
  - or `<!-- gh-aw-island-end:05-evidence-enrich -->`

2. A completed normalized island:
   - `<!-- rw:normalized:start --> ... <!-- rw:normalized:end -->`
  - or `<!-- gh-aw-island-end:10-normalize -->`

3. A completed dedupe island:
   - `<!-- rw:dedupe:start --> ... <!-- rw:dedupe:end -->`
  - or `<!-- gh-aw-island-end:20-dedupe -->`

4. A completed software-fit island:
   - `<!-- rw:software-fit:start --> ... <!-- rw:software-fit:end -->`
  - or `<!-- gh-aw-island-end:30-software-fit -->`

### Mandatory upstream values

The normalized/evidence/dedupe handoff must state:

- `Geographic area: <area>`
- `Geographic applicability: country-dependent`
- `Country validation before scoring: outstanding`
- `Countries requiring validation before scoring: <one or more countries or a specifically scoped country-level requirement>`
- `Pre-scoring geographic gate: <specific gate>`
- `Next validation-critical unknown: ...`

The software-fit handoff must state:

- `Decision: yes` or `Decision: partial`;
- any relevant local API/data/integration/regulatory dependency risk.

### Upstream handoff blocker

If any required island or required country-validation instruction is missing, malformed or contradictory:

1. Do not attempt to infer the required countries/checks.
2. Call `add_comment` listing precisely what upstream handoff is missing or inconsistent.
3. Call `add_labels` for `status/needs-info`.
4. Keep `stage/2.5-country-validation`.
5. Do not write a substantive country-validation conclusion unless you can accurately record that the handoff itself is incomplete.

### Already satisfied / wrong routing

If upstream content already states `Country validation before scoring: satisfied` or `not-required`, this issue should not be at this stage:

- emit `noop` with reason `country-validation gate already satisfied or not required; stage routing needs correction`;
- do not rewrite prior islands.

---

## Source-of-truth rule

Earlier islands remain historical handoffs and may still state that country validation is outstanding.

This workflow resolves that gate in:

`<!-- rw:country-validation:start --> ... <!-- rw:country-validation:end -->`

For downstream stages:

- `rw:country-validation` is authoritative for whether the pre-scoring country gate is now `satisfied`, `outstanding` or `materially-undermined`;
- upstream `rw:evidence`, `rw:normalized` and `rw:dedupe` remain authoritative for original evidence, normalized problem and dedupe context;
- do not rewrite earlier islands solely to replace their historical `outstanding` status.

---

## Validation scope rule

Validate only the country-level mechanisms required for scoring the current problem opportunity.

Do not:

- research every country in the geographical area;
- prove an area-wide market claim when the candidate is explicitly country-dependent;
- expand into full competitor research;
- redesign the solution;
- score the issue.

Do:

- verify each named country/check required upstream;
- assess whether the underlying pain remains valid in the scoped country context;
- assess whether the first software-value assumption is invalidated by country constraints;
- check obvious local alternatives only when required to avoid an evidently false opportunity framing.

---

## Research procedure

### 1. Parse outstanding country checks

From the evidence, normalized and dedupe islands, extract:

- geographical area;
- candidate's country-dependent mechanism;
- countries examined previously;
- countries still requiring validation;
- the exact pre-scoring geographic gate;
- core JTBD and failure moment;
- supported stakes and cautions;
- likely payer/economic beneficiary;
- software-fit result and dependency risks;
- regional-variant relationship, if any.

Translate the outstanding gate into a checklist such as:

- verify government process/deadline in country X;
- verify whether the required integration/data access exists in country Y;
- verify whether payment/workflow rule creates the claimed pain in country Z;
- verify whether an obvious local incumbent substantially solves the exact workflow.

Do not invent a new country validation scope.

### 2. Validate each required mechanism

For each required country/check:

- search for authoritative sources;
- record what claim is supported, partly supported, unsupported or contradicted;
- record source type, date/recency note and country;
- distinguish a process fact from evidence of user pain or repeated burden.

Source minimum:

- obtain at least `${{ inputs.minimum_sources_per_country }}` independent supporting source(s) for each country/check scope used to satisfy the gate;
- where a regulatory, public-service, payment or formal process claim is central, at least one supporting source should be official or otherwise authoritative for that mechanism whenever available.

### 3. Validate implications for startup attractiveness

Without scoring, determine whether country verification:

- preserves the same core problem;
- narrows the valid country launch scope;
- weakens a severity, recurrence, reachability or feasibility assumption;
- exposes a new dependency or compliance risk;
- identifies an obvious local substitute that materially weakens the opportunity framing.

Keep willingness-to-pay and full competition conclusions as hypotheses unless directly evidenced.

### 4. Reconcile with geographic scope

Determine:

- which countries are now adequately verified for the claimed mechanism;
- which countries, if any, remain outstanding;
- whether the issue should be understood as a candidate for one verified country inside a broader discovery area rather than for the area as a whole;
- what must not be generalized beyond verified scope.

Do not change the upstream `Geographic applicability: country-dependent`.

### 5. Decide gate status

Use exactly one:

- `satisfied`
- `outstanding`
- `materially-undermined`

#### `satisfied`

Use only when:

- every named pre-scoring country check required for the intended initial scoring scope has adequate evidence;
- the problem remains coherent and materially relevant within that verified scope;
- country-specific dependencies needed to judge software feasibility are verified sufficiently or accurately constrained;
- no unresolved country requirement remains necessary before scoring.

#### `outstanding`

Use when:

- any required country/check lacks sufficient evidence;
- required country-level alternatives or integration facts remain unverified;
- the initial scoring scope still cannot be defined honestly.

#### `materially-undermined`

Use when verified country-level facts contradict or materially weaken the candidate's core pain, assumed availability of first value or intended launch scope.

A materially undermined issue does not advance. It should be held for re-framing or later archival decision by an appropriate workflow/human review.

---

## Country-validation island output

Write only inside:

`<!-- rw:country-validation:start --> ... <!-- rw:country-validation:end -->`

Use this exact structure:

```md
<!-- rw:country-validation:start -->
### Country validation verdict
- Gate status: satisfied | outstanding | materially-undermined
- Geographic area inherited from upstream: <area>
- Geographic applicability: country-dependent
- Countries required before scoring: <countries/check scope>
- Countries verified in this pass: <countries or none>
- Countries/checks still outstanding: <countries/checks or none>
- Scoring eligibility after this pass: eligible | not-eligible
- Confidence: low | medium | high

### Required checks disposition
| Country / scope | Required mechanism or claim | Assessment | Evidence / correction | Effect on scoring scope |
|---|---|---|---|---|
| ... | ... | supported / partially-supported / unsupported / contradicted | ... | ... |

### Sources reviewed
| Country / scope | Source | Source type | Date / recency note | What it supports |
|---|---|---|---|---|
| ... | ... | official / regulator / research / provider-page / product-page / reputable-report / qualitative-signal | ... | ... |

### Local mechanism and opportunity impact
- Verified country-specific pain mechanism: ...
- Verified initial scoring/launch scope: ...
- Effect on material stakes or recurrence assumptions: ...
- Effect on payer/reachability assumptions: ...
- Effect on software-fit/dependency risks: ...
- Obvious local alternatives checked: ...
- What must not be generalized beyond verified scope: ...

### Remaining assumptions / corrections
- ...
- Corrections required in later stages: ...

### Recommendation
- Advance to scoring | Hold for additional country evidence | Hold for re-framing because country validation materially undermines the candidate
- Why: ...
<!-- rw:country-validation:end -->
```

Do not modify earlier islands. Later scoring must read this island as the authoritative resolution of the country gate.

---

## If gate is satisfied

When `Gate status: satisfied` and `Scoring eligibility after this pass: eligible`:

1. Call `update_issue` on issue #${{ inputs.issue_number }} with:
   - `repo: ${{ github.repository }}`
   - `issue_number: ${{ inputs.issue_number }}`
   - `operation: replace-island`
   - only the complete `rw:country-validation` island.
2. Call `add_labels` for:
   - `stage/3-scored`
3. Call `remove_labels` for:
   - `stage/2.5-country-validation`
   - `status/needs-info` only if no other visible blocking concern remains.

Do not add country, area, evidence or readiness labels unless AGENTS.md later explicitly defines them.

---

## If gate remains outstanding

When `Gate status: outstanding`:

1. Call `update_issue` with the complete `rw:country-validation` island.
2. Call `add_labels` for:
   - `status/needs-info`
3. Keep:
   - `stage/2.5-country-validation`
4. Optionally call `add_comment` once, stating the remaining exact country/check requirements.

Do not advance to scoring.

---

## If country validation materially undermines the candidate

When `Gate status: materially-undermined`:

1. Call `update_issue` with the complete `rw:country-validation` island.
2. Call `add_labels` for:
   - `status/needs-info`
3. Keep:
   - `stage/2.5-country-validation`
4. Call `add_comment` once, explaining which verified country facts undermine the current candidate and that re-framing or archival review is required.

Do not score, archive or redesign the issue in this stage.

---

## Integrity rules

- Verify only what is needed to unlock or block scoring.
- Do not confuse a confirmed local procedure with confirmed user demand.
- Do not use one verified country to claim an entire geographical area.
- Do not treat absence of a quick competitor finding as a verified gap.
- Do not claim an integration exists unless supported by suitable evidence.
- Do not score or draft solutions in this stage.
- Prefer retaining the gate over advancing on incomplete country facts.

Always emit at least one safe-output operation, or `noop`.
