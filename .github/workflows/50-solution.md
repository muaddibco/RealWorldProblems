---
name: "RW: Solution Hypothesis"
strict: false
on:
  workflow_dispatch:
    inputs:
      issue_number:
        description: "Target issue number"
        required: true
        type: string
      orchestration_id:
        description: "Durable orchestration instance ID for correlation"
        required: false
        type: string

concurrency:
  group: rw-issue-${{ github.repository }}-${{ inputs.issue_number }}
  cancel-in-progress: false

run-name: "RW: Solution Hypothesis | issue #${{ inputs.issue_number }} | orch ${{ inputs.orchestration_id || 'n/a' }}"

engine:
  id: copilot
  model: ${{ vars.GH_AW_MODEL_AGENT_COPILOT || 'gpt-5.4' }}
  agent: rw-solution-drafter

permissions:
  contents: read
  issues: read

sandbox:
  agent: awf

network: {}

tools:
  github:
    toolsets: [issues, repos]
    read-only: true
    min-integrity: none

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

# Draft a geographically scoped, AI-defensible solution hypothesis

## Purpose

This stage drafts a focused software product hypothesis for a problem that has already passed:

- evidence enrichment;
- normalization;
- deduplication or meaningful regional-variant retention;
- software-fit review;
- any required country-validation gate; and
- problem-attractiveness scoring.

The solution must fit the **validated geographic scope**. It must not silently expand a country-supported opportunity to an entire geographical area or turn a portability hypothesis into a launch fact.

This stage should produce:

- a narrow product hypothesis;
- a realistic initial product mode;
- a credible but still testable differentiation wedge;
- a specific AI role embedded within workflow value;
- defensibility hooks to be assessed next;
- a fast MVP scope;
- explicit geographic and dependency boundaries.

Expected transition:

```text
stage/4-solution → stage/ai-defensibility
```

This stage does not:

- perform new market or competitor research;
- change score conclusions;
- resolve evidence or country-validation gaps;
- prove a wedge;
- claim defensibility has been established.

---

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Orchestration ID: `${{ inputs.orchestration_id }}`

Before doing anything else:

- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY on issue #${{ inputs.issue_number }}.
- Process only an issue with labels `type/problem` and `stage/4-solution`, and without label `agentic-workflows`.
- If those conditions are not met, emit `noop` and stop.

---

## Tooling rules

- Read the target issue using GitHub MCP issue tools only.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, local temp-file parsing, reconstructed MCP payloads or workflow-output files.
- Do NOT browse the web in this stage.
- Use only upstream island content and existing issue metadata.
- If GitHub issue-read tools are unavailable, emit `noop` with reason `missing GitHub read tools` and stop.

---

## Mandatory completion rule

A successful run MUST end with at least one safe-output tool call.

Valid endings:

### Solution hypothesis complete

- `update_issue` with the complete `rw:solution` island;
- `add_labels` for `stage/ai-defensibility`;
- `remove_labels` for `stage/4-solution`;
- optionally remove `status/needs-info` only when no visible blocker remains.

### Missing or inconsistent prerequisites

- `add_comment` identifying the exact missing, inconsistent or unfulfilled prerequisite;
- `add_labels` for `status/needs-info`;
- retain `stage/4-solution`;
- do not write a solution hypothesis.

### Ineligible issue

- `noop`.

Do not end with prose-only output.  
Do not draft a product on top of an unresolved scoring-scope or country-validation contradiction.

---

## Mandatory write targeting rule

Because this workflow runs through `workflow_dispatch`, there is no implicit triggering issue.

For every write action, explicitly target:

- `repo: ${{ github.repository }}`
- `issue_number: ${{ inputs.issue_number }}` for `update_issue`
- `item_number: ${{ inputs.issue_number }}` for `add_comment`
- `item_number: ${{ inputs.issue_number }}` for `add_labels`
- `item_number: ${{ inputs.issue_number }}` for `remove_labels`

Never write to related, canonical, cluster or competitor issues.

---

## Required upstream handoff

The issue MUST contain completed canonical islands:

Each required upstream island may appear either as the full island block or as the matching completion marker `<!-- gh-aw-island-end:<stage-file> -->`, where `<stage-file>` is the upstream workflow filename without `.md`.

If issue-read output does not include HTML comments, treat upstream handoff as present when the matching generated section heading is present with substantive content:

- Evidence: `### Evidence enrichment verdict`
- Normalized problem: `### Normalized problem`
- Dedupe: `### Dedupe and cluster decision`
- Software fit: `### Software fit decision`
- Scorecard: `### Problem attractiveness scorecard`

When this fallback is used:

- do not block solely for missing comment markers;
- validate required values from the section content itself;
- only apply `status/needs-info` if the section content is actually missing or materially incomplete.

1. Evidence:
   - `<!-- rw:evidence:start --> ... <!-- rw:evidence:end -->`
   - or `<!-- gh-aw-island-end:05-evidence-enrich -->`

2. Normalized problem:
   - `<!-- rw:normalized:start --> ... <!-- rw:normalized:end -->`
   - or `<!-- gh-aw-island-end:10-normalize -->`

3. Dedupe:
   - `<!-- rw:dedupe:start --> ... <!-- rw:dedupe:end -->`
   - or `<!-- gh-aw-island-end:20-dedupe -->`

4. Software fit:
   - `<!-- rw:software-fit:start --> ... <!-- rw:software-fit:end -->`
   - or `<!-- gh-aw-island-end:30-software-fit -->`

5. Scorecard:
   - `<!-- rw:scorecard:start --> ... <!-- rw:scorecard:end -->`
   - or `<!-- gh-aw-island-end:40-score -->`

6. Country validation, only when a country-dependent issue required the conditional gate:
   - `<!-- rw:country-validation:start --> ... <!-- rw:country-validation:end -->`
   - or `<!-- gh-aw-island-end:35-country-validation -->`

### Required values

Require:

#### Problem definition

- JTBD;
- affected user/persona;
- documented failure moment;
- current workaround;
- pain/stakes;
- likely payer/economic beneficiary.

#### Evidence and geographic definition

- evidence status and confidence;
- corrected claims and unresolved assumptions relevant to solution scope;
- `Geographic area: <area>`;
- `Geographic applicability: globally-portable|regional|country-dependent`;
- `Scoring geographic scope: <area or verified country/countries>`;
- `Country-validation gate: not-required|satisfied-upstream|satisfied-by-country-validation`;
- scope and expansion limitation.

#### Dedupe identity

Require an active dedupe disposition:

- `not-duplicate`;
- `regional-variant`; or
- `possible-near-duplicate`.

If `regional-variant`, require the recorded regional differentiator.  
If `possible-near-duplicate`, carry identity/differentiation uncertainty into solution risks.  
If `duplicate`, block and request stage correction.

#### Software fit

Require:

- decision `yes` or `partial`;
- software-controlled value;
- non-software components;
- local/API/data/regulatory/human/partner dependency constraints;
- routing consistent with the scoring path.

If software-fit is `no`, block and request stage correction.

#### Scorecard

Require:

- validated scoring scope;
- scoring total/bucket or complete dimension table;
- evidence, confidence and risk;
- highest-scoring validated strength;
- most decision-critical unresolved assumption;
- solution drafting constraint.

### Country-dependent requirement

For `country-dependent` issues previously routed through the gate:

- require `rw:country-validation` with `Gate status: satisfied`;
- require verified initial scoring/launch scope;
- treat its corrections and non-generalization boundaries as authoritative;
- design only within that verified country scope.

Do not produce a solution that depends on unvalidated countries or broad area assumptions.

---

## Blocking conditions

Do not write a solution hypothesis when:

- a required upstream island is missing or materially incomplete;
- the issue has an unresolved country-validation gate;
- geographical area, applicability or validated scoring scope is missing;
- the scorecard identifies a core contradiction or absence of scoring eligibility;
- the solution would necessarily rely on an essential integration/data/approval/partner dependency that upstream marks unverified or unavailable, unless the solution explicitly avoids that dependency for first value;
- the dedupe decision is duplicate;
- software-fit is no;
- a regional-variant has no recorded regional differentiator to ground product scope.

When blocked:

1. Call `add_comment` stating the precise missing/inconsistent/essential dependency issue.
2. Call `add_labels` for `status/needs-info`.
3. Retain `stage/4-solution`.
4. Do not write or replace `rw:solution`.

---

## Source-of-truth precedence

Use:

1. `rw:country-validation`, when present, for verified country scope, country-specific corrections and restrictions on expansion/generalization.
2. `rw:scorecard` for validated scoring scope, evidence/confidence/risk, highest validated strength and solution constraints.
3. `rw:software-fit` for what software can deliver and material dependencies.
4. `rw:dedupe` for regional-variant or near-duplicate relationship.
5. `rw:normalized` and `rw:evidence` for the evidence-safe problem definition and corrected claims.

Do not rewrite prior islands.  
Do not make a product concept sound more geographically validated than the scorecard permits.

---

## Solution principles

A strong solution is AI-enabled where helpful but remains valuable if general-purpose models improve.

### Prefer products that own one or more of

1. **Execution**
   - The product performs, controls or reliably closes a meaningful workflow step.

2. **Workflow position**
   - It sits at the documented failure moment rather than offering generic advice around it.

3. **Verified or avoidable integration**
   - It uses integrations/data access already verified, or deliberately creates first value without requiring them.

4. **Structured memory/data accumulation**
   - It builds a useful history, audit trail, case structure, state model or outcomes dataset through actual usage.

5. **Distribution wedge**
   - It reaches a narrowly defined initial user/buyer through a plausible path in the validated geography.

### Avoid by default

- `ChatGPT for X`;
- summarization-only or drafting-only utilities;
- a generic AI assistant with no executed workflow;
- a product whose moat is only local-language prompting;
- an area-wide product justified by evidence from one verified country;
- a first MVP requiring unverified government/provider/payment integrations;
- a broad platform without a narrow first measurable value event.

### Mandatory self-check

Before finalizing, answer internally:

> If a much better general-purpose LLM appears tomorrow, why does this product still matter?

If the answer is mostly “better responses,” rewrite the hypothesis around workflow ownership, state, verified integration, trust, distribution or executable outcomes.

---

## Geographic solution design rules

### For `globally-portable`

The solution must:

- name the initial entry geography or scoped launch environment from the scorecard;
- describe first value in that scope;
- keep expansion to other areas as a hypothesis, with revalidation needs;
- avoid assuming workflows, data sources or distribution channels transfer unchanged.

### For `regional`

The solution must:

- identify the documented area-specific product requirement or adoption advantage;
- state whether it affects language, workflow, trust, distribution, payments, documentation, alternatives or another supported factor;
- avoid turning cultural/regional narrative into a feature without upstream evidence;
- describe expansion assumptions beyond the region cautiously.

### For `country-dependent`

The solution must:

- stay within the verified initial country scope;
- use only country mechanisms/dependencies validated upstream, or avoid them in MVP;
- state which country-specific requirements shape product behavior;
- avoid describing a multi-country/area product as ready before further validation.

### For `regional-variant`

The solution must use the documented regional distinction as a meaningful product, buyer, distribution or workflow difference.  
If the product would be effectively identical to the shared/canonical cluster, state that as a risk for later wedge review rather than fabricating differentiation.

---

## Core product mode

Choose exactly one dominant mode:

- `system of execution`
- `workflow hub`
- `monitoring/alerts`
- `decision support`
- `content generation`

Prefer:

- `system of execution`;
- `workflow hub`;
- `monitoring/alerts`.

Use `decision support` or `content generation` only when they are legitimately the first useful product and are paired with a defensible workflow or distribution rationale. Do not present generic content generation as durable differentiation.

---

## AI role rules

State:

- what AI specifically does;
- what product value exists beyond model output;
- what AI dependence may become commoditized;
- what the next AI-defensibility stage must challenge.

AI may help with:

- document extraction;
- classification;
- triage;
- anomaly detection;
- reconciliation;
- structured drafting within a controlled workflow;
- summarization inside a stateful execution process.

AI must not be treated as proof of:

- differentiation;
- local regulatory compliance;
- trust;
- unavailable integrations;
- proprietary data;
- buyer demand.

---

## MVP rules

The MVP must:

- deliver one measurable improvement at the documented failure moment;
- be scoped to the validated initial geography and ICP;
- contain 3–7 must-have capabilities;
- explicitly avoid features or dependencies not required for the first test;
- distinguish verified dependencies from assumptions;
- avoid a platform build before proving first value.

If `software-fit/partial`, the MVP section must state the minimal non-software component and how it affects testing.

If an essential dependency remains uncertain but can be avoided in the first value path, state that exclusion explicitly in `Not MVP` and `Dependencies and assumptions`.

---

## Solution island output

Write only inside:

`<!-- rw:solution:start --> ... <!-- rw:solution:end -->`

Use this exact structure:

```md
<!-- rw:solution:start -->
### Solution hypothesis

<One paragraph: intended user/buyer, scoped product, workflow position, failure moment addressed, and validated geography.>

### Validated geographic fit
- **Geographic area:** <area>
- **Geographic applicability:** globally-portable | regional | country-dependent
- **Validated initial product scope:** <area or verified country/countries>
- **Country-validation gate used:** not-required | satisfied-upstream | satisfied-by-country-validation
- **Dedupe/variant status:** not-duplicate | regional-variant | possible-near-duplicate
- **Area- or country-specific product requirement:** ...
- **What must not be generalized beyond validated scope:** ...
- **Expansion hypothesis requiring later validation:** ...

### Initial ICP and adoption moment
- **Initial user / buyer:** ...
- **Failure moment addressed first:** ...
- **Why this segment may adopt now:** ...
- **Payer/economic-beneficiary assumption:** ...

### Core product mode
- **Mode:** system of execution | workflow hub | monitoring/alerts | decision support | content generation
- **Why this mode fits the evidenced problem:** ...

### Differentiation wedge hypothesis
- ...
- ...
- **What is supported vs still hypothetical:** ...

### AI role in the product
- **AI is used for:** ...
- **AI is NOT the product by itself because:** ...
- **AI commoditization risk to test next:** ...

### Defensibility hooks to evaluate
- **Workflow ownership:** ...
- **Integration / system access:** verified | avoidable-in-MVP | unverified/not-relied-on — ...
- **Proprietary data / memory:** ...
- **Habit / switching cost:** ...
- **Distribution wedge:** ...
- **Geographic advantage vs geographic complexity:** ...

### MVP scope (3–7 bullets)
- ...
- ...
- ...

### Dependencies and assumptions
| Dependency / assumption | Status | Why it matters | MVP treatment |
|---|---|---|---|
| ... | verified / plausible / unverified / excluded-from-MVP | ... | ... |

### Not MVP (explicitly out of scope)
- ...
- ...
<!-- rw:solution:end -->
```

Keep the solution concise enough for AI-defensibility and competitor stages to test it, while making boundaries explicit.

---

## Advance

When the solution hypothesis is complete:

1. Call `update_issue` on issue #${{ inputs.issue_number }} with:
   - `repo: ${{ github.repository }}`
   - `issue_number: ${{ inputs.issue_number }}`
   - `operation: replace-island`
   - only the complete `rw:solution` island.
2. Call `add_labels` for:
   - `stage/ai-defensibility`
3. Call `remove_labels` for:
   - `stage/4-solution`
   - `status/needs-info` only if no visible blocker remains.

Do not add geographic, product-mode, dependency or defensibility labels here.

---

## Integrity principles

- Design for the validated opportunity, not an imagined larger market.
- Use geography to constrain product truth, not to decorate positioning.
- Never base first-value delivery on an unresolved essential local dependency.
- Keep differentiation as a hypothesis to be tested downstream.
- Prefer a narrow executable MVP over a broad AI product concept.
- Preserve constraints so AI-defensibility, competitor and wedge stages can challenge the solution honestly.

Always emit at least one safe-output operation, or `noop`.
