---
name: "RW: Normalize"
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

run-name: "RW: Normalize | issue #${{ inputs.issue_number }} | orch ${{ inputs.orchestration_id || 'n/a' }}"

engine:
  id: copilot
  agent: rw-normalizer

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

# Normalize evidence-ready, geographical-area-aware problem issue

## Purpose

This stage converts an **evidence-ready** seeded problem into the canonical normalized structure used by downstream deduplication, software-fit and scoring stages.

The pipeline's geographic discovery unit is a **geographical area**, not a country. A problem can therefore be:

- `globally-portable`;
- `regional`; or
- `country-dependent`.

For `country-dependent` candidates, this workflow may normalize a problem after the evidence stage verifies an initial country-specific mechanism while still identifying additional country validation that must be completed **before scoring**.

This stage:

- consumes the verified `rw:evidence` handoff;
- normalizes the problem without strengthening unsupported claims;
- preserves the geographical-area and pre-scoring country-validation handoff;
- resolves taxonomy and persona/domain labels;
- advances eligible issues from `stage/0-intake` to `stage/1-normalized`.

This stage does **not**:

- perform new external research;
- change evidence conclusions;
- decide software fit;
- score opportunity attractiveness;
- design a solution;
- perform full competitor research.

Expected conveyor-belt position:

`stage/0-evidence → stage/0-intake → stage/1-normalized`

Where:

- `05-evidence-enrich.md` owns the transition from `stage/0-evidence` to `stage/0-intake`;
- this workflow consumes only candidates released by that evidence gate.

---

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Orchestration ID: `${{ inputs.orchestration_id }}`

Before doing anything else:

- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY on issue #${{ inputs.issue_number }}.
- If that issue no longer has labels `type/problem` and `stage/0-intake`, or has label `agentic-workflows`, emit `noop` and stop.

---

## Tooling rules

- Read the target issue using GitHub MCP issue tools only.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, local temp-file parsing, reconstructed MCP payloads or workflow-output temp files.
- Do NOT perform web research in this stage.
- Treat the completed `rw:evidence` island as the verified handoff from `05-evidence-enrich.md`.
- If GitHub issue tools are unavailable, emit `noop` with reason `missing GitHub read tools` and stop.

---

## Mandatory completion rule

A successful run MUST end with at least one safe-output tool call.

Valid endings:

- `update_issue` plus any required `add_labels` / `remove_labels` when normalization succeeds;
- `add_comment` plus `add_labels` when normalization is blocked by missing, invalid or conflicting information;
- `noop` when the issue should not be processed.

Do not end with prose-only output.
Do not stop after analysis.

---

## Mandatory write targeting rule

Because this workflow runs via `workflow_dispatch`, there is no implicit triggering issue.

For every write action, always target:

- `repo: ${{ github.repository }}`
- `issue_number: ${{ inputs.issue_number }}` for `update_issue`
- `item_number: ${{ inputs.issue_number }}` for `add_comment`
- `item_number: ${{ inputs.issue_number }}` for `add_labels`
- `item_number: ${{ inputs.issue_number }}` for `remove_labels`

Never rely on implicit targeting.

---

## Responsibilities of this stage

This stage is responsible for:

1. verifying that the issue passed evidence enrichment;
2. validating the seeded problem structure and its taxonomy/geographical metadata;
3. reconciling the seeded narrative with corrections recorded in `rw:evidence`;
4. producing a concise canonical JTBD/problem definition without restoring unsupported claims;
5. preserving evidence status, confidence, geographical-area framing and country-validation requirements;
6. ensuring the issue has exactly one `persona/*` label and 1–3 valid `domain/*` labels;
7. advancing eligible issues to `stage/1-normalized`.

---

## Evidence-gate requirement (MANDATORY)

Before normalizing, the issue MUST contain a completed evidence island:

`<!-- rw:evidence:start --> ... <!-- rw:evidence:end -->`

The evidence island must explicitly contain all of:

- `Verdict: ready-for-normalization`
- `Evidence status after enrichment: secondary-signalled` OR `Evidence status after enrichment: primary-validated`
- `Confidence: low|medium|high`
- `Geographic area: <area>`
- `Geographic applicability: globally-portable|regional|country-dependent`
- `Area-signal requirement: satisfied|not-required`
- `Countries examined: <countries or none>`
- `Country validation before scoring: satisfied|outstanding|not-required`
- `Countries requiring validation before scoring: <countries or none>`
- at least one populated row under `Claims checked`
- at least one populated row under `Sources reviewed`
- `Next validation-critical unknown:`
- `Recommendation` indicating `Advance to normalization`.

### Evidence gate failure

If the evidence island is missing, malformed, says `needs-more-evidence`, has `Evidence status after enrichment: hypothesis-only`, or indicates a required area signal is not satisfied:

1. Call `add_comment` listing the evidence-gate deficiency precisely.
2. Call `add_labels` with `status/needs-info`.
3. Do NOT create or update the normalized island.
4. Do NOT change stage.

### Country-dependent normalization rule

A `country-dependent` candidate is allowed to normalize when the evidence island says:

- `Verdict: ready-for-normalization`; and
- `Country validation before scoring: outstanding`.

This is **not** a blocker for normalization.

However:

- the normalized island MUST state that country validation remains outstanding before scoring;
- the list under `Countries requiring validation before scoring` MUST be preserved;
- no normalized wording may generalize a checked country's mechanism across the entire geographical area;
- downstream workflows responsible for scoring readiness must later block scoring until the outstanding country checks are satisfied.

If `Country validation before scoring: outstanding` but no countries or specific requirement are listed, block normalization with `status/needs-info`.

---

## Authoritative handoff and source-of-truth precedence

The original seeded issue may retain historical fields such as:

- `Evidence status: hypothesis-only`;
- `Readiness: requires-evidence-enrichment`; or
- `Readiness: ready-for-evidence-gate`.

These are historical intake metadata and need not be rewritten.

Use this precedence order:

### 1. Evidence island — authoritative for evidence and geographical corrections

Use `rw:evidence` as the source of truth for:

- evidence verdict;
- evidence status after enrichment;
- confidence;
- supported, partially-supported, unsupported or contradicted claims;
- geographic area when enrichment corrected or confirmed it;
- geographic applicability;
- area-signal status;
- countries examined;
- country-validation-before-scoring status;
- countries requiring validation before scoring;
- payer/economic-beneficiary framing recorded by enrichment;
- dependency cautions;
- next validation-critical unknown.

### 2. Original seeded content — authoritative for taxonomy when coherent

Use explicit seeded metadata outside generated islands as the preferred source for:

- `Domain`;
- `Theme`;
- `Subtheme`;
- `Catalog status`;
- `Persona`;
- `Archetype`.

Use it only when it fits the problem narrative and does not conflict with evidence corrections.

### 3. Existing valid labels — confirmation/backfill only

Use existing canonical `persona/*` and `domain/*` labels to confirm or backfill labels.  
They must not override explicit coherent seed metadata or evidence corrections.

### 4. Conservative taxonomy inference — last resort

Infer missing non-critical taxonomy fields only when the intended value is unambiguous.

Never silently infer or repair:

- geographic area;
- geographic applicability;
- evidence status;
- evidence confidence;
- area-signal satisfaction;
- payer/economic beneficiary;
- country validation before scoring;
- countries requiring validation before scoring;
- next validation-critical unknown.

Missing critical fields block normalization.

---

## Original seeded problem metadata gate (MANDATORY)

Inspect the original seeded content outside workflow islands.

### Required problem-structure fields

The issue must contain, or clearly support without introducing new facts:

- `**JTBD:**`
- `**Context & frequency:**`
- `**Pain / stakes:**`
- `**Current workaround:**`
- `**Failure moment:**`
- `**Why software may help:**`

### Seeded taxonomy fields

Inspect for:

- `Domain: <domain>`
- `Theme: <theme>`
- `Subtheme: <subtheme>`
- `Catalog status: <catalog|off-catalog>`
- `Persona: <persona>`
- `Archetype: <archetype>`

### Seeded geographical fields

Inspect for:

- `Geographic area: <area>` or `**Geographic area:** <area>`
- `Geographic applicability: <globally-portable|regional|country-dependent>` or its bold equivalent.

The evidence island may supply or correct geographical values.  
The normalizer must use the evidence-island values when the seed and evidence differ.

---

## Taxonomy inference rules

When a taxonomy field is missing or malformed, infer conservatively from the seeded narrative.

### Domain

- Resolve 1–3 canonical domains from AGENTS.md.
- Use one primary domain in the normalized classification.
- Add extra domain labels only when the problem materially spans them.

### Persona

- Resolve exactly one canonical persona from AGENTS.md.
- The affected user is the persona; do not replace them with a payer unless they are the same party.
- If persona is ambiguous, do not infer; block normalization.

### Theme and subtheme

- Prefer explicit seed values when they naturally reflect the pain mechanism.
- If missing and a catalog fit is clear, infer the closest catalog term.
- If no catalog term fits naturally, use a short off-catalog value.
- Mark inferred values as `(inferred)` in the normalized island; mark inferred off-catalog values as `(inferred; off-catalog)`.

Natural-fit test:

`This is a <theme> / <subtheme> problem because <specific failure mechanism>.`

If this sounds forced or generic, block rather than backfitting taxonomy.

### Catalog status

- Preserve `catalog` only when theme/subtheme are genuine catalog fits.
- Preserve `off-catalog` when explicit and coherent.
- Mark inferred catalog status as `(inferred)`.

### Archetype

Resolve one canonical problem-shape archetype used by seeding:

- `deadline-window-lapse`
- `status-opacity`
- `evidence-proof-trail`
- `coordination-handoff`
- `verification-mismatch`
- `scheduling-booking`
- `comparison-selection`
- `exception-recovery`
- `ongoing-upkeep-drift`
- `fragmented-records`

Use the explicit coherent seed archetype where present.  
If inferred, append `(inferred)`.  
If no archetype clearly fits, block normalization.

---

## Evidence-safe normalization rules

Normalization clarifies and compresses; it must not strengthen the opportunity story.

### Allowed transformations

You may:

- rewrite the JTBD into clear canonical form while preserving meaning;
- condense context, stakes, workaround and failure moment;
- incorporate evidence-stage corrections;
- replace an unsupported or overbroad regional claim with cautious wording;
- preserve explicit pre-scoring country validation requirements;
- summarize evidence basis while leaving detailed sources in `rw:evidence`.

### Prohibited transformations

You must not:

- repeat a seeded statistic, fee, deadline, regulation, market-size, regional-prevalence or API claim marked unsupported or contradicted;
- change `secondary-signalled` into validated/observed wording;
- state that a geographical area uniformly shares a country-specific mechanism unless evidence supports it;
- treat `Country validation before scoring: outstanding` as if it were satisfied;
- claim willingness to pay is established unless primary evidence explicitly supports it;
- claim a competitive gap is proven;
- turn a likely payer hypothesis into a confirmed buyer;
- introduce solution features or a business strategy.

### Correction rule

If the evidence island corrects or narrows a non-central claim:

- normalize using the corrected/cautious statement;
- list the correction under `Evidence cautions / corrected claims`;
- proceed if all gates pass.

If evidence contradicts the core problem mechanism:

- add `status/needs-info`;
- add a precise comment;
- do not normalize or advance.

---

## Label inference and hygiene rules

Before advancing:

- ensure exactly one valid `persona/*` label;
- ensure 1–3 valid `domain/*` labels;
- use resolved taxonomy as the basis for these labels;
- remove conflicting persona/domain labels only when correction is unambiguous;
- do not add geographic area, geographic applicability, evidence, country-validation or readiness labels unless AGENTS.md explicitly defines them;
- remove `status/needs-info` only when all known blockers are resolved.

If persona or domain remains ambiguous:

- add `status/needs-info`;
- do not advance.

Use only canonical labels defined by AGENTS.md.

---

## Blocking conditions

After evidence and taxonomy checks, do not normalize if any of these is unresolved:

### Evidence/geography blockers

- missing or non-passing `rw:evidence` island;
- missing geographic area;
- missing or invalid geographic applicability;
- evidence status remains `hypothesis-only`;
- required area signal not satisfied;
- missing evidence confidence;
- missing next validation-critical unknown;
- `Country validation before scoring: outstanding` without a listed country/specific check;
- sourced contradiction that undermines the core problem.

### Problem-structure blockers

- JTBD absent and not safely derivable;
- context absent or incoherent;
- pain/stakes absent;
- current workaround absent;
- failure moment absent;
- no software-help rationale.

### Taxonomy/label blockers

- persona cannot be determined confidently;
- domain cannot be determined confidently;
- theme/subtheme cannot be resolved;
- archetype cannot be resolved;
- explicit seeded taxonomy materially conflicts with the problem narrative.

When blocked:

1. Call `add_comment` on issue #${{ inputs.issue_number }} listing exactly what is missing, invalid, conflicting or contradicted.
2. Call `add_labels` with `status/needs-info`.
3. Do NOT change stage.
4. Do NOT create or update the normalized island.

---

## Normalized output requirements

When all gates pass, write only inside:

`<!-- rw:normalized:start --> ... <!-- rw:normalized:end -->`

Use this structure:

```md
<!-- rw:normalized:start -->
### Normalized problem

**JTBD:** When ..., I want ..., so I can ...

**Context & frequency:**  
...

**Pain / stakes:**  
...

**Current workaround:**  
...

**Trigger / failure moment:**  
...

**Why software may help:**  
...

### Evidence and geographical framing

- **Evidence status:** secondary-signalled | primary-validated
- **Evidence confidence:** low | medium | high
- **Evidence basis:** <brief description; detailed reviewed sources remain in rw:evidence>
- **Geographic area:** <area>
- **Geographic applicability:** globally-portable | regional | country-dependent
- **Why this area matters:** <concise evidence-safe explanation>
- **Area-specific mechanism or signal:** <concise explanation>
- **Countries examined:** <countries or none>
- **Country validation before scoring:** satisfied | outstanding | not-required
- **Countries requiring validation before scoring:** <countries or none>
- **Pre-scoring geographic gate:** <`None` or `Do not score until listed country-level validation is completed.`>
- **Likely payer / economic beneficiary:** <mark as hypothesis unless primary-supported>
- **Next validation-critical unknown:** ...

**Evidence cautions / corrected claims:**
- <relevant correction, limitation or `None recorded by evidence enrichment.`>

### Classification

- **Persona:** <persona>
- **Domain:** <domain>
- **Theme:** <theme>
- **Subtheme:** <subtheme>
- **Catalog status:** catalog | off-catalog
- **Archetype:** <archetype>
- **Geographic area:** <area>
- **Geographic applicability:** globally-portable | regional | country-dependent
<!-- rw:normalized:end -->
```

### Downstream handoff rule

The normalized island is a concise working definition. The `rw:evidence` island remains the detailed evidence source.

For a `country-dependent` candidate with outstanding country checks:

- preserve `Country validation before scoring: outstanding`;
- preserve the specific countries/checks still required;
- state the pre-scoring gate explicitly;
- allow the issue to proceed through normalization, while later scoring-related workflows must enforce the gate.

---

## If complete

When all evidence, metadata and label checks pass:

1. Call `update_issue` on issue #${{ inputs.issue_number }} with:
   - `repo: ${{ github.repository }}`
   - `issue_number: ${{ inputs.issue_number }}`
   - `operation: replace-island`
   - only the complete `rw:normalized` island.
2. Call `add_labels` on issue #${{ inputs.issue_number }} for:
   - `stage/1-normalized`
   - exactly one resolved `persona/*`
   - 1–3 resolved `domain/*` labels.
3. Call `remove_labels` on issue #${{ inputs.issue_number }} for:
   - `stage/0-intake`
   - clearly conflicting `persona/*` labels;
   - clearly conflicting `domain/*` labels;
   - `status/needs-info` only when all blocking issues are resolved.

Do not change the `rw:evidence` island.
Do not add score, risk, wedge, marketing/sales, geographic-area, evidence-status or country-validation labels unless AGENTS.md later explicitly defines them.

---

## Legacy issue handling

Existing `stage/0-intake` issues created before evidence enrichment was introduced may not contain an `rw:evidence` island.

Do not silently normalize those issues under this evidence-aware pipeline.

For a legacy issue without a completed evidence island:

- add `status/needs-info`;
- add a comment:
  `Evidence enrichment is required before normalization under the current pipeline. Run RW: Evidence Enrich after placing the issue in stage/0-evidence.`;
- do not change stage automatically, because stage repair/migration belongs to orchestration or stewardship.

---

## Integrity principles

- Normalize what evidence supports; do not beautify assumptions into facts.
- Geographical areas are discovery frames, not grounds for unsupported regional generalization.
- Country-dependent issues can be normalization-ready while still requiring explicit country checks before scoring.
- Preserve uncertainty so later agents can make better decisions.
- When in doubt, hold rather than advance.

Always emit at least one safe-output operation, or `noop`.
