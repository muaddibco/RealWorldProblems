---
name: "RW: Software Fit Gate"
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

run-name: "RW: Software Fit Gate | issue #${{ inputs.issue_number }} | orch ${{ inputs.orchestration_id || 'n/a' }}"

engine:
  id: copilot
  agent: rw-software-fit

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
  close-issue:
    target: "*"
    max: 1
  noop:
---

# Software Fit Gate: route geographical opportunities correctly before scoring

## Purpose

This stage determines whether software is a sufficiently strong primary lever for an evidence-ready, normalized and deduplicated problem opportunity.

It also owns a critical routing decision:

- A software-positive candidate with no outstanding country-validation requirement may proceed to scoring.
- A software-positive `country-dependent` candidate with outstanding country-level checks must go to `stage/2.5-country-validation` before scoring.
- A candidate for which software is not a meaningful primary lever is archived without further country validation.

Expected routing:

```text
stage/2-deduped
  → RW: Software Fit
      ├─ software-fit/no
      │    → stage/9-archived + archive/not-software
      ├─ software-fit/yes|partial
      │    + Country validation before scoring: not-required|satisfied
      │    → stage/3-scored
      └─ software-fit/yes|partial
           + Geographic applicability: country-dependent
           + Country validation before scoring: outstanding
           → stage/2.5-country-validation
```

This workflow reads upstream research but performs no new external research and never resolves the country-validation gate itself.

---

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Orchestration ID: `${{ inputs.orchestration_id }}`

Before doing anything else:

- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY on issue #${{ inputs.issue_number }}.
- If the issue does not have labels `type/problem` and `stage/2-deduped`, or has label `agentic-workflows`, emit `noop` and stop.

---

## Tooling rules

- Read the target issue using GitHub MCP issue tools only.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, temporary-output parsing, reconstructed MCP payloads or local file parsing.
- Do NOT browse the web or add external facts in this workflow.
- Treat upstream islands as the only evidence/geographical handoff.
- If GitHub issue-read tools are unavailable, emit `noop` with reason `missing GitHub read tools` and stop.

---

## Mandatory completion and write-targeting rules

A successful run MUST finish with safe-output tool calls or `noop`.

For every write, explicitly target:

- `repo: ${{ github.repository }}`
- `issue_number: ${{ inputs.issue_number }}` for `update_issue`
- `item_number: ${{ inputs.issue_number }}` for `add_comment`
- `item_number: ${{ inputs.issue_number }}` for `add_labels`
- `item_number: ${{ inputs.issue_number }}` for `remove_labels`
- `item_number: ${{ inputs.issue_number }}` for `close_issue`

Valid endings are:

- Software-fit decision written plus the correct label/stage routing.
- A precise `status/needs-info` hold when required upstream data is missing or contradictory.
- `noop` for an ineligible issue.

Do not end with prose-only output. Never write to comparison issues.

---

## Required upstream handoff

Before deciding software fit, require:

1. `<!-- rw:evidence:start --> ... <!-- rw:evidence:end -->`
2. `<!-- rw:normalized:start --> ... <!-- rw:normalized:end -->`
3. `<!-- rw:dedupe:start --> ... <!-- rw:dedupe:end -->`

### Required problem and geographic values

Read from the evidence and normalized islands:

- evidence status: `secondary-signalled|primary-validated`;
- evidence confidence: `low|medium|high`;
- JTBD, failure moment, current workaround and likely payer/economic beneficiary;
- `Geographic area: <area>`;
- `Geographic applicability: globally-portable|regional|country-dependent`;
- `Why this area matters`;
- `Area-specific mechanism or signal`;
- `Countries examined: <countries or none>`;
- `Country validation before scoring: satisfied|outstanding|not-required`;
- `Countries requiring validation before scoring: <countries/checks or none>`;
- `Pre-scoring geographic gate: <gate or none>`.

### Required dedupe disposition

The dedupe island must retain the issue as active with one of:

- `Decision: not-duplicate`
- `Decision: regional-variant`
- `Decision: possible-near-duplicate`

If it says `Decision: duplicate` while the issue is at this stage, add `status/needs-info`, comment on the routing inconsistency and do not advance.

### Blocking cases

Hold at `stage/2-deduped` with `status/needs-info` when:

- a required island is missing;
- geographical area, applicability or country-validation status is missing;
- `country-dependent` + `outstanding` lacks a named country/check scope or a pre-scoring gate;
- `globally-portable` or `regional` contains an unexplained outstanding country-validation gate;
- the upstream evidence records that the core problem is materially invalid;
- no non-duplicate dedupe decision exists.

When blocked:

1. Call `add_comment` with the exact missing or conflicting input.
2. Call `add_labels` for `status/needs-info`.
3. Do not write the software-fit island.
4. Do not change stage.

---

## Source-of-truth precedence

Use:

1. `rw:evidence` for verified claims, corrections and the original geographical validation.
2. `rw:normalized` for the concise current problem and carried-forward gate.
3. `rw:dedupe` for active/duplicate/variant disposition and preserved geographic gate.
4. This stage only for software-fit assessment and post-fit routing.

Do not rewrite earlier islands.

---

## Software-fit decision

Choose exactly one:

### `software-fit/yes`

Software can deliver most first measurable value in the evidenced geographic scope without material dependence on human operations, physical execution, inaccessible data, unverified institutional cooperation or mandatory local integrations.

A pending country check may still require routing to country validation when it affects pre-scoring truth rather than whether software is inherently the lever.

### `software-fit/partial`

Software can deliver meaningful value, but material non-software or local-system components remain, such as:

- human operations;
- field/physical activity or hardware;
- partner cooperation;
- country-specific integrations or constrained data;
- regulated approval or compliance work;
- significant trust/implementation burden.

`software-fit/partial` remains active; it is not automatic archive.

### `software-fit/no`

Software is not a sufficiently strong main lever because the candidate is mostly policy/physical/human execution, or because a required dependency makes practical software-first value unrealistic.

Do not use `no` merely because attractiveness, willingness to pay or wedge quality remains uncertain.

---

## Geographic feasibility assessment

Assess software fit within the documented geographical scope.

### For `globally-portable`

Record:

- whether first value avoids local-system dependencies;
- whether the proposed first area introduces localization/integration needs;
- what would need revalidation before geographic expansion.

### For `regional`

Record:

- whether language, document structure, payments, provider structure, local workflow or area distribution materially shapes MVP delivery;
- whether that requirement is feasible and supported upstream.

### For `country-dependent`

Record:

- whether software is a meaningful primary lever assuming the listed local mechanism is verified;
- the exact local API/data/regulatory/provider/payment dependencies;
- whether those dependencies are verified or must be resolved by `35-country-validation.md`.

Rules:

- An outstanding country-validation gate does not automatically force `partial` or `no`.
- Undisclosed heroic dependencies are not acceptable.
- Never route a software-positive, country-gated issue directly to scoring.

---

## Dependencies to document

Where applicable, record:

- data inputs needed for first value;
- API/system integrations and whether verified or unverified upstream;
- payment, identity, public-service, provider or insurer dependency;
- regulatory, privacy, trust or compliance dependency;
- human operations, hardware or partner dependency;
- local substitute that could reduce software value;
- portability limits beyond the initial geographical scope.

Do not invent verification that is absent from earlier islands.

---

## Routing after decision

### If `software-fit/no`

- Write `rw:software-fit`.
- Add: `software-fit/no`, `stage/9-archived`, `archive/not-software`.
- Remove: `stage/2-deduped`, `software-fit/yes`, `software-fit/partial` if present.
- Optionally close as not planned when supported.

### If `software-fit/yes|partial` and country validation is not required or satisfied

- Write `rw:software-fit`.
- Add exactly one of: `software-fit/yes`, `software-fit/partial`.
- Add: `stage/3-scored`.
- Remove: `stage/2-deduped` and conflicting software-fit labels.

Valid combinations:

- `globally-portable|regional` with `Country validation before scoring: not-required`;
- `country-dependent` with `Country validation before scoring: satisfied`.

### If `software-fit/yes|partial` and country validation is outstanding

Require:

- `Geographic applicability: country-dependent`;
- `Country validation before scoring: outstanding`;
- explicit countries/checks and pre-scoring geographic gate.

Then:

- Write `rw:software-fit`.
- Add exactly one of: `software-fit/yes`, `software-fit/partial`.
- Add: `stage/2.5-country-validation`.
- Remove: `stage/2-deduped` and conflicting software-fit labels.
- Do NOT add `stage/3-scored`.

---

## Software-fit island output

Write only inside:

`<!-- rw:software-fit:start --> ... <!-- rw:software-fit:end -->`

Use this exact structure:

```md
<!-- rw:software-fit:start -->
### Software fit decision

- **Decision:** yes | partial | no
- **Geographic area:** <area>
- **Geographic applicability:** globally-portable | regional | country-dependent
- **Country validation before scoring inherited:** satisfied | outstanding | not-required
- **Countries requiring validation before scoring:** <countries/checks or none>
- **Pre-scoring geographic gate preserved:** <gate text or none>
- **Routing after software fit:** ready-for-scoring | country-validation-required | archive-not-software

### Primary software value
- What software can materially improve: ...
- Why this addresses the documented failure moment: ...

### Assessment
- Software-controlled value: ...
- Non-software components required: ...
- Data / API / integration dependencies: ...
- Regulatory / trust / privacy dependencies: ...
- Human-operations / hardware / partnership dependencies: ...

### Geographic feasibility
- Area- or country-specific requirement: ...
- What is verified upstream: ...
- What remains unverified or requires country validation: ...
- What must not be assumed for expansion beyond verified scope: ...

### Decision rationale
- ...
- ...

### Notes for downstream stages
- ...
- If routing to country validation: `Do not score until the listed country-level validation is completed.`
<!-- rw:software-fit:end -->
```

Do not modify upstream islands.

---

## Integrity principles

- Assess software leverage within the evidence-supported geographical scope.
- Do not confuse an unresolved country check with evidence that software is impossible.
- Do not let a country-dependent candidate reach scoring until the named gate is satisfied.
- Do not turn unverified integrations into MVP assumptions.
- Archive only when software is not a meaningful main lever; leave low pain, commercial weakness and wedge failure to their owning stages.

Always emit at least one safe-output operation, or `noop`.
