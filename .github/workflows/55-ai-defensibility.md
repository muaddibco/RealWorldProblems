---
name: "RW: AI Defensibility Gate"
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

run-name: "RW: AI Defensibility Gate | issue #${{ inputs.issue_number }} | orch ${{ inputs.orchestration_id || 'n/a' }}"

engine:
  id: copilot
  model: ${{ vars.GH_AW_MODEL_AGENT_COPILOT || 'gpt-5.4' }}
  agent: rw-ai-defensibility

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

# Evaluate AI defensibility in the validated geographical product scope

## Purpose

This stage evaluates whether the proposed solution can remain valuable as general-purpose AI improves, while remaining honest about the product's validated geographic scope.

The pipeline distinguishes:

- `globally-portable` opportunities that still begin in a defined initial product scope;
- `regional` opportunities whose product or entry logic is shaped by an evidenced geographical-area mechanism;
- `country-dependent` opportunities designed only within verified country scope.

Geography can strengthen defensibility only when it results in a real, durable advantage, such as:

- ownership of an area/country-specific workflow step;
- verified integration into an important local system;
- accumulated structured operational data unavailable to a generic model;
- trust, distribution or switching cost grounded in actual product use.

Geography does **not** strengthen defensibility merely because:

- local language support is needed;
- regulation makes implementation difficult;
- integrations may someday be obtained;
- a workflow differs locally but the product still produces generic AI output only.

This stage:

- scores solution durability against AI commoditization;
- preserves validated geographic boundaries and country-gate status;
- identifies geographic advantage versus geographic delivery complexity;
- hands competitor research specific AI and local-substitute risks to investigate.

This stage does **not**:

- conduct new web research;
- re-score problem attractiveness;
- redesign the solution island;
- re-open country validation;
- decide competitor or wedge outcomes;
- archive an opportunity solely for weak AI defensibility.

Expected transition:

```text
stage/ai-defensibility → stage/5-competitors
```

---

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Orchestration ID: `${{ inputs.orchestration_id }}`

Before doing anything else:

- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY on issue #${{ inputs.issue_number }}.
- Process only an issue carrying `type/problem` and `stage/ai-defensibility`, without label `agentic-workflows`.
- If the issue is not eligible, emit `noop` and stop.
- If more than one active `stage/*` label is visible, add `status/needs-info`, comment on the stage conflict and do not evaluate.

---

## Tooling rules

- Read the target issue using GitHub MCP issue tools only.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, temporary-file parsing, reconstructed MCP payloads or workflow-output artifacts.
- Do NOT browse the web or independently verify proposed integrations, distribution or market claims in this stage.
- Treat upstream canonical islands as the source of truth.
- If GitHub issue-read tools are unavailable, emit `noop` with reason `missing GitHub read tools` and stop.

---

## Mandatory completion and targeting rules

Every run MUST finish with safe-output tool calls or `noop`.

For every write action, explicitly target:

- `repo: ${{ github.repository }}`
- `issue_number: ${{ inputs.issue_number }}` for `update_issue`
- `item_number: ${{ inputs.issue_number }}` for `add_comment`
- `item_number: ${{ inputs.issue_number }}` for `add_labels`
- `item_number: ${{ inputs.issue_number }}` for `remove_labels`

Valid endings:

### Defensibility evaluation completed

- `update_issue` with the complete `rw:ai-defensibility` island;
- `add_labels` for exactly one `ai-defensibility/*`, exactly one `ai-risk/*`, and `stage/5-competitors`;
- `remove_labels` for `stage/ai-defensibility` and conflicting AI labels;
- optionally remove `status/needs-info` only if no visible blocker remains.

### Missing or inconsistent prerequisite

- `add_comment` naming the exact blocker;
- `add_labels` for `status/needs-info`;
- retain `stage/ai-defensibility`;
- do not write an AI-defensibility verdict.

### Ineligible issue

- `noop`.

Do not end with prose-only output.  
Do not weaken or strengthen a product's geographical scope to make the defensibility analysis easier.

---

## Required upstream handoff

The issue MUST contain completed canonical islands:

Each required upstream island may appear either as the full island block or as the matching completion marker `<!-- gh-aw-island-end:<stage-file> -->`, where `<stage-file>` is the upstream workflow filename without `.md`.

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

6. Solution:
   - `<!-- rw:solution:start --> ... <!-- rw:solution:end -->`
  - or `<!-- gh-aw-island-end:50-solution -->`

7. Country validation, only when required by a country-dependent route:
   - `<!-- rw:country-validation:start --> ... <!-- rw:country-validation:end -->`
  - or `<!-- gh-aw-island-end:35-country-validation -->`

### Required handoff values

Require:

#### Problem and solution definition

- JTBD and documented failure moment;
- likely payer/economic beneficiary;
- software-fit decision `yes` or `partial`;
- solution core product mode;
- MVP scope;
- AI role;
- defensibility hooks to evaluate;
- dependencies and assumptions;
- items explicitly excluded from MVP.

#### Validated geographical scope

- `Geographic area: <area>`;
- `Geographic applicability: globally-portable|regional|country-dependent`;
- `Scoring geographic scope: <area or verified country/countries>`;
- `Validated initial product scope: <area or verified country/countries>`;
- `Country-validation gate used: not-required|satisfied-upstream|satisfied-by-country-validation`;
- non-generalization or expansion limitations;
- area- or country-specific product requirement, when relevant.

The initial product scope may be narrower than the scoring scope. It must not be broader.

#### Dedupe/variant status

Require an active dedupe status:

- `not-duplicate`;
- `regional-variant`; or
- `possible-near-duplicate`.

For `regional-variant`, require a documented area-specific product/workflow/distribution distinction.  
For `possible-near-duplicate`, carry differentiation ambiguity as a risk to be tested by competition/wedge work.  
If the issue is a duplicate, block and request routing correction.

#### Country-dependent requirement

For a country-dependent issue that used the conditional pre-scoring gate:

- require `rw:country-validation` with `Gate status: satisfied`;
- use only the verified country scope and corrections it identifies;
- do not award defensibility credit for unverified countries or broader-area deployment.

---

## Blocking conditions

Do not write an AI-defensibility verdict when:

- any required upstream island is missing or materially incomplete;
- the issue lacks a validated geographic/scoring/product scope;
- country validation is required but not satisfied;
- solution scope exceeds validated scoring or country scope;
- the solution does not state an AI role or product value beyond AI output;
- essential solution dependencies are contradictory or too unspecified to distinguish real integration from aspiration;
- software fit is `no`;
- the dedupe decision is `duplicate`;
- a retained regional variant lacks an identifiable differentiating mechanism relevant to the solution.

When blocked:

1. Call `add_comment` listing the exact missing/inconsistent prerequisite.
2. Call `add_labels` for `status/needs-info`.
3. Keep `stage/ai-defensibility`.
4. Do not write or replace `rw:ai-defensibility`.

Do not label uncertainty as weak defensibility when the input is too incomplete to evaluate; hold it for missing information.

---

## Source-of-truth precedence

Use:

1. `rw:country-validation`, when present, for verified country scope, local-mechanism corrections and what cannot be generalized.
2. `rw:solution` for the proposed product, MVP, AI role, intended defensibility hooks and geographic fit.
3. `rw:scorecard` for validated scoring scope, problem risk/confidence and solution-drafting constraints.
4. `rw:software-fit` for delivery dependencies and software-leverage limits.
5. `rw:dedupe` for regional-variant/near-duplicate identity.
6. `rw:normalized` and `rw:evidence` for evidence-safe problem context.

Do not modify or contradict upstream islands.

---

## Defensibility decision

Choose exactly one:

- `ai-defensibility/strong`
- `ai-defensibility/medium`
- `ai-defensibility/weak`

Choose exactly one corresponding AI risk label:

- `ai-risk/low`
- `ai-risk/medium`
- `ai-risk/high`

The score is for the **proposed solution within validated initial product scope**, not for a future expanded product or unverified local integration.

---

## Scoring rubric: five dimensions, 1–5 each, maximum 25

### 1. Replaceability by generic AI

Question: If general-purpose AI becomes materially better tomorrow, how much of the product's in-scope value disappears?

- 1 = generic prompting/chat/content output replaces most value.
- 3 = AI output matters, but product also contributes meaningful workflow context or structured state.
- 5 = value depends primarily on execution, trusted operational context, verified workflow position or other assets not replaceable by better text/model output.

Geographic rule:

- Local language or local prompting alone does not raise this score materially.
- A verified local workflow execution position or local trust/distribution asset may raise it.

### 2. Workflow ownership

Question: Does the product control or execute a meaningful in-scope workflow step at the documented failure moment?

- 1 = advice, search or content only.
- 3 = supports a workflow step but leaves execution primarily outside the product.
- 5 = executes, verifies, monitors or closes an important workflow step inside the validated scope.

Geographic rule:

- Give credit only for the workflow the product actually proposes in its validated scope, not a future area-wide workflow.

### 3. Data moat potential

Question: Does normal product use create durable, useful proprietary state or outcome history?

- 1 = no meaningful retained advantage beyond prompts/documents users already hold.
- 3 = useful structured history or workflow state could accumulate through use.
- 5 = strong unique longitudinal state, outcome data, audit trail or network/process data is inherent to the in-scope product.

Geographic rule:

- A local dataset is not a moat merely because it is local.
- Give credit only when the solution captures or derives reusable value through actual operation and is legally/practically supportable in the scope.

### 4. Integration depth

Question: Is the product embedded in meaningful systems, records, APIs or operational channels that increase defensibility?

- 1 = standalone; or essential integrations are unverified/aspirational.
- 3 = verified useful integrations or workflow connections, but not deeply embedded.
- 5 = verified, difficult-to-replace integration into important operating systems/processes in the in-scope market.

Geographic rule:

- Country-specific government/provider/payment/API integration earns no credit unless validated upstream or explicitly already available.
- Regulation or difficulty obtaining access is risk, not integration depth.

### 5. Switching cost / habit

Question: Would a successful user/buyer lose meaningful value by switching away?

- 1 = tool can be replaced with little process or history loss.
- 3 = moderate habit, configuration, workflow-state or history loss.
- 5 = strong operational reliance, historical continuity, trusted workflow position or reconfiguration/migration cost inherent to use.

Geographic rule:

- Dependence caused only by local inconvenience or compliance burden is not a desirable switching cost unless the product actually provides durable in-scope value.

---

## Thresholds and labels

Calculate total score out of 25.

- Total 20–25:
  - `ai-defensibility/strong`
  - `ai-risk/low`
- Total 14–19:
  - `ai-defensibility/medium`
  - `ai-risk/medium`
- Total 5–13:
  - `ai-defensibility/weak`
  - `ai-risk/high`

Do not adjust thresholds for geography.  
Instead, make geographic advantages, limitations and delivery risks explicit in the island.

---

## Geography-aware assessment rules

### `globally-portable`

Assess only the validated initial product scope.  
Record whether the defensibility hook plausibly transfers, but treat expansion as unverified.

Watch for:

- a “portable” idea that is actually generic AI output;
- initial area distribution or workflow advantages that may not transfer elsewhere;
- product state/data that could form a durable asset independent of area.

### `regional`

Assess whether the area's mechanism yields real defensibility through workflow, distribution, data or verified integration.

Do not treat as defensible:

- translation/local language alone;
- generic cultural tailoring;
- regional complexity without an owned workflow or durable asset.

Record whether any claimed geographic advantage is:

- a durable advantage;
- an implementation requirement;
- an unresolved hypothesis;
- or a delivery risk.

### `country-dependent`

Assess only verified initial country scope.

Do not award credit for:

- future countries;
- unverified public/institutional access;
- unverified country APIs/payment/provider integrations;
- compliance burden itself.

Do record:

- verified local system/workflow ownership as a potential advantage;
- country-specific expansion costs and transfer limits;
- any continuing delivery risk despite a satisfied pre-scoring truth gate.

### `regional-variant`

Assess whether the product derives a defensibility hook from the regional difference that justified separate treatment.  
If the variant's product advantage is otherwise identical to a broader/shared candidate, treat that as a risk for competitor and wedge stages, not as defensibility.

---

## Weakness and risk heuristics

Usually weak or high-risk:

- generic AI copilot;
- Q&A over files;
- translation/local-language wrapper only;
- summarization-only or drafting-only value;
- content generation with no workflow state;
- unverified integration presented as a moat;
- local compliance complexity presented as differentiation;
- geographic expansion required before first value.

Potentially stronger only when supported by the solution/upstream handoff:

- execution of a costly failure-point workflow;
- monitoring/verification with structured state;
- verified local-system integration required for outcomes;
- accumulating outcomes/audit history;
- narrow in-scope distribution/trust advantage that can be tested and retained;
- switching cost arising from useful workflow adoption, not artificial lock-in.

---

## AI-defensibility island output

Write only inside:

`<!-- rw:ai-defensibility:start --> ... <!-- rw:ai-defensibility:end -->`

Use this exact structure:

```md
<!-- rw:ai-defensibility:start -->
### AI defensibility scorecard

### Validated product scope assessed
- **Geographic area:** <area>
- **Geographic applicability:** globally-portable | regional | country-dependent
- **Validated initial product scope:** <area or verified country/countries>
- **Country-validation gate used:** not-required | satisfied-upstream | satisfied-by-country-validation
- **Dedupe/variant status:** not-duplicate | regional-variant | possible-near-duplicate
- **Scope / expansion limitation:** ...

| Dimension | 1–5 | Rationale within validated product scope |
|---|---:|---|
| Replaceability by generic AI | n | ... |
| Workflow ownership | n | ... |
| Data moat potential | n | ... |
| Integration depth | n | ... |
| Switching cost / habit | n | ... |
| **Total (max 25)** | **nn** | ... |

### Verdict
- **Defensibility:** strong | medium | weak
- **AI risk:** low | medium | high
- **Why:** ...

### Geographic advantage versus complexity
| Claimed area/country factor | Durable advantage, implementation requirement, unresolved hypothesis, or delivery risk | Rationale / downstream test needed |
|---|---|---|
| ... | ... | ... |

- **Verified geographic defensibility hook, if any:** ...
- **Geographic complexity that must not be mistaken for a moat:** ...
- **What cannot be generalized beyond validated scope:** ...

### How to improve defensibility
- ...
- ...
- ...

### Kill-shot test for competitor and wedge stages
- **Question:** If a materially better general-purpose AI appears tomorrow, what in-scope value remains?
- **Current answer:** ...
- **Generic-AI or local-substitute threat to investigate next:** ...
- **Evidence that would invalidate the defensibility hypothesis:** ...
<!-- rw:ai-defensibility:end -->
```

Do not duplicate full upstream source tables or revise the solution hypothesis itself.

---

## Label handling and advance

Before adding a new result, remove any conflicting labels:

- `ai-defensibility/strong`
- `ai-defensibility/medium`
- `ai-defensibility/weak`
- `ai-risk/low`
- `ai-risk/medium`
- `ai-risk/high`

When evaluation is complete:

1. Call `update_issue` on issue #${{ inputs.issue_number }} with:
   - `repo: ${{ github.repository }}`
   - `issue_number: ${{ inputs.issue_number }}`
   - `operation: replace-island`
   - only the complete `rw:ai-defensibility` island.
2. Call `add_labels` for:
   - exactly one `ai-defensibility/*`;
   - exactly one corresponding `ai-risk/*`;
   - `stage/5-competitors`.
3. Call `remove_labels` for:
   - `stage/ai-defensibility`;
   - conflicting AI defensibility/risk labels;
   - `status/needs-info` only when no visible blocker remains.

Weak AI defensibility is not an automatic archive reason. It should be surfaced for competitor and wedge evaluation.

Do not add geographic, integration, moat or market labels.

---

## Integrity principles

- Assess the product actually proposed in the validated scope, not the best future version imaginable.
- Geographic complexity is usually a risk unless the product converts it into verified workflow ownership, durable data, integration or distribution advantage.
- Better AI is the adversary; useful execution and durable product position are the defense.
- Carry weakness forward honestly rather than hiding it or archiving prematurely.

Always emit at least one safe-output operation, or `noop`.
