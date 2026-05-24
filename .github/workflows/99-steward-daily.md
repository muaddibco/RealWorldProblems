---
name: "RW: Repo Steward (Daily)"
strict: false
on:
  # schedule: daily
  workflow_dispatch:

concurrency:
  group: rw-steward-daily-${{ github.repository }}
  cancel-in-progress: false

engine:
  id: copilot
  model: ${{ vars.GH_AW_MODEL_AGENT_COPILOT || 'gpt-5.4' }}
  agent: rw-repo-steward

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
    max: 10
  add-labels:
    blocked: ["~*", "*[bot]"]
    target: "*"
    max: 20
  remove-labels:
    blocked: ["~*"]
    target: "*"
    max: 20
  create-issue:
    title-prefix: "[steward] "
    labels: [type/report]
    close-older-issues: true
    max: 1
  noop:
---

# Daily repository stewardship for the geography-aware opportunity pipeline

## Purpose

Keep the repository structurally consistent after the introduction of:

- evidence enrichment before normalization;
- geographical-area-first discovery;
- `globally-portable`, `regional`, and `country-dependent` applicability;
- `regional-variant` dedupe handling;
- conditional country validation before scoring;
- geography-aware solution, AI-defensibility, competitor, wedge, shortlist, and validation stages.

This is a **light-touch maintenance** workflow. It repairs only high-confidence structural inconsistencies and reports systemic pipeline bottlenecks. It must not perform substantive analysis that belongs to an owning stage.

The revised problem pipeline is:

```text
stage/0-evidence
  → stage/0-intake
  → stage/1-normalized
  → stage/2-deduped
  → software fit
      ├─ software-fit/no → stage/9-archived
      ├─ software-fit/yes|partial + no country gate → stage/3-scored
      └─ software-fit/yes|partial + outstanding country gate
           → stage/2.5-country-validation
           → stage/3-scored only after satisfaction
  → stage/4-solution
  → stage/ai-defensibility
  → stage/5-competitors
  → stage/6-shortlist
  → stage/7-validation
  → stage/7.1-validated
  → stage/8-selected or stage/9-archived
```

---

## Tooling rules

- Read/search issues using GitHub MCP issue tools only.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, temporary-file parsing, reconstructed MCP payloads or workflow-output artifacts.
- Do NOT browse externally.
- Operate on `type/problem` issues only for issue repairs.
- Skip every issue carrying `agentic-workflows`.
- Limit substantive issue touches to **at most 10 problem issues per run**.
- If GitHub issue tools are unavailable, emit `noop` with reason `missing GitHub read tools` and stop.

---

## Mandatory completion rule

A run MUST finish with one of:

### Repairs or actionable systemic problems found

- one or more safe-output issue repairs, where warranted; and/or
- one daily `[steward] <YYYY-MM-DD>` report issue summarizing repairs and structural bottlenecks.

### No actionable repair or meaningful structural bottleneck found

- `noop` with a concise reason.

### Tool failure

- `noop` with a concise reason.

Do not end with prose-only output.

The workflow may create a steward report without modifying a problem issue when the inspected set reveals a material recurring pipeline inconsistency or geographic-gate bottleneck needing operator attention.

---

## Allowed and prohibited writes

### Allowed repairs on a problem issue

Only when unambiguous:

- add `status/needs-info`;
- remove a clearly conflicting stale stage, score, risk, wedge, AI or archive label;
- add a clearly missing required archive reason as `archive/other`;
- add an empty missing canonical island marker block where a completed earlier-stage output should exist;
- replace or add the `rw:steward` island documenting actual repairs and remaining structural concerns.

### Prohibited repairs

Do NOT:

- populate analytical content in `rw:evidence`, `rw:normalized`, `rw:dedupe`, `rw:software-fit`, `rw:country-validation`, `rw:scorecard`, `rw:solution`, `rw:ai-defensibility`, `rw:competitors`, `rw:wedge`, or `rw:validation`;
- infer or rewrite evidence status, geographic applicability, geographic area, country scope, country-gate outcome, score, AI-defensibility verdict, competitor conclusion, wedge conclusion, or validation plan;
- advance a problem issue to a later stage;
- archive an active candidate based on stewardship judgement;
- silently migrate legacy issues into the new geography-aware model;
- rewrite user-authored content outside generated islands.

An empty island marker is a structural placeholder only. When added for missing analytical content, also add `status/needs-info`; it never means that the owning stage succeeded.

---

## Review scope and prioritization

Review a representative active set of `type/problem` issues, prioritizing:

1. issues with multiple `stage/*` labels;
2. issues in or beyond `stage/0-intake` missing the evidence/geographic handoff;
3. issues at or beyond scoring that may have bypassed country validation;
4. later-stage issues missing required canonical islands;
5. archived issues with inconsistent archive labels;
6. issues with conflicting score/risk/wedge/AI labels;
7. country-dependent or regional-variant items likely to reveal systemic pipeline gaps.

Touch no more than 10 issues.  
The report may mention additional patterns seen during reads without modifying those issues.

---

## Canonical stage order

Use this order only for describing progression and evaluating prerequisites:

1. `stage/0-evidence`
2. `stage/0-intake`
3. `stage/1-normalized`
4. `stage/2-deduped`
5. `stage/2.5-country-validation` — conditional only
6. `stage/3-scored`
7. `stage/4-solution`
8. `stage/ai-defensibility`
9. `stage/5-competitors`
10. `stage/6-shortlist`
11. `stage/7-validation`
12. `stage/7.1-validated`
13. `stage/8-selected`
14. `stage/9-archived`

### Multiple-stage-label rule

Every active `type/problem` issue should carry exactly one `stage/*` label.

When multiple stages exist:

- Remove stale labels only when the correct retained stage is unambiguous from completed canonical islands and owned routing labels.
- Do **not** blindly keep the earliest stage: a previous-stage label may be stale after a successful transition.
- Do **not** blindly keep the latest stage: a later-stage label may have been applied without prerequisites.
- When the correct stage is not unambiguous, add `status/needs-info`, record the conflict in `rw:steward`, and report it; do not choose speculatively.

If no stage exists:

- add `status/needs-info`;
- record the missing-stage concern in `rw:steward`;
- do not invent a stage.

---

## Invariant checks

## 1. Type and stage

For each inspected `type/problem` issue:

- exactly one active `stage/*` label is expected;
- `stage/9-archived` must not coexist with active downstream-routing labels such as `stage/7-validation` or `stage/7.1-validated`;
- `stage/2.5-country-validation` is valid only for a country-dependent candidate routed through software fit with an outstanding pre-scoring gate;
- a candidate in or beyond `stage/3-scored` must not still be blocked by an unresolved country gate.

## 2. Persona and domain

For issues with completed normalization, or any issue at `stage/2-deduped` or later:

- exactly one `persona/*` label is expected;
- 1–3 `domain/*` labels are expected.

If missing:

- add `status/needs-info`;
- record the omission.

If multiple labels conflict:

- repair only when the intended canonical label is explicitly clear in `rw:normalized`;
- otherwise add `status/needs-info` and report ambiguity.

Do not infer persona or domain from narrative text.

## 3. Archive hygiene

For `stage/9-archived`:

- exactly one `archive/*` reason is required;
- if none exists, add `archive/other`;
- if `status/duplicate` exists, the archive reason should be `archive/other`;
- if multiple reasons exist, remove extras only when the intended reason is unmistakable from the prior owning-stage island or labels; otherwise add `status/needs-info`.

An outstanding country-validation gate alone is not an archive reason.

## 4. Score/risk/wedge/AI label sanity

Only correct obvious contradictions:

- At most one `software-fit/*` label.
- At most one `score/*` label.
- At most one `risk/*` label.
- At most one `wedge/*` label.
- At most one `ai-defensibility/*` label.
- At most one `ai-risk/*` label.
- `wedge/weak` must not coexist with `stage/7-validation`, `stage/7.1-validated`, or `status/shortlisted`.
- `wedge/credible` in the revised pipeline should normally accompany `stage/7-validation` or `stage/7.1-validated`, not remain stranded at `stage/6-shortlist`.
- `software-fit/no` should not coexist with active scoring, solution, competitor, wedge, or validation stages.
- `ai-defensibility/strong` pairs with `ai-risk/low`; medium with medium; weak with high, when both are present.

Where the correct label cannot be proven from the relevant island, do not guess; mark and report.

---

## Canonical islands

Use these exact markers:

- `<!-- rw:evidence:start --> ... <!-- rw:evidence:end -->`
- `<!-- rw:normalized:start --> ... <!-- rw:normalized:end -->`
- `<!-- rw:dedupe:start --> ... <!-- rw:dedupe:end -->`
- `<!-- rw:software-fit:start --> ... <!-- rw:software-fit:end -->`
- `<!-- rw:country-validation:start --> ... <!-- rw:country-validation:end -->`
- `<!-- rw:scorecard:start --> ... <!-- rw:scorecard:end -->`
- `<!-- rw:solution:start --> ... <!-- rw:solution:end -->`
- `<!-- rw:ai-defensibility:start --> ... <!-- rw:ai-defensibility:end -->`
- `<!-- rw:competitors:start --> ... <!-- rw:competitors:end -->`
- `<!-- rw:wedge:start --> ... <!-- rw:wedge:end -->`
- `<!-- rw:validation:start --> ... <!-- rw:validation:end -->`
- `<!-- rw:steward:start --> ... <!-- rw:steward:end -->`

### Output-island timing principle

A stage label usually means the preceding stage completed and the issue is waiting for the named next workflow. Therefore:

- At `stage/0-evidence`, `rw:evidence` may legitimately be absent before evidence enrichment runs.
- At `stage/0-intake`, `rw:evidence` should already exist and show a ready-for-normalization handoff.
- At `stage/1-normalized`, `rw:normalized` should already exist.
- At `stage/2-deduped`, `rw:dedupe` should already exist; `rw:software-fit` may not yet exist.
- At `stage/2.5-country-validation`, `rw:software-fit` should exist; `rw:country-validation` may not yet exist before that gate runs.
- At `stage/3-scored`, software-fit and any required satisfied country-gate handoff should exist; `rw:scorecard` may not yet exist before scoring runs.
- At `stage/4-solution`, `rw:scorecard` should exist; `rw:solution` may not yet exist before solution drafting runs.
- At `stage/ai-defensibility`, `rw:solution` should exist; `rw:ai-defensibility` may not yet exist before that gate runs.
- At `stage/5-competitors`, `rw:ai-defensibility` should exist; `rw:competitors` may not yet exist before competitor research runs.
- At `stage/6-shortlist`, `rw:competitors` should exist; `rw:wedge` may not yet exist before wedge filtering runs.
- At `stage/7-validation`, `rw:wedge` should exist with a credible decision; `rw:validation` may not yet exist before planning runs.
- At `stage/7.1-validated` or `stage/8-selected`, `rw:validation` should exist.

Do not mark a currently pending stage as broken merely because its own workflow output island has not yet been written.

---

## Minimum expected handoffs by current stage

| Current stage/status | Earlier-stage islands/conditions that should exist |
|---|---|
| `stage/0-evidence` | Seed content; no completed island required yet. |
| `stage/0-intake` | `rw:evidence` with evidence-ready and geographic handoff. |
| `stage/1-normalized` | `rw:evidence`, `rw:normalized`; persona/domain hygiene. |
| `stage/2-deduped` | `rw:evidence`, `rw:normalized`, `rw:dedupe`; active non-duplicate disposition. |
| `stage/2.5-country-validation` | Prior islands plus `rw:software-fit`; applicability `country-dependent`; outstanding country gate and named checks. |
| `stage/3-scored` | Prior islands plus `rw:software-fit`; if country gate was required, satisfied `rw:country-validation`; no unresolved pre-scoring gate. |
| `stage/4-solution` | Stage-3 prerequisites plus `rw:scorecard`; country gate resolved. |
| `stage/ai-defensibility` | Prior islands plus `rw:solution`; validated initial product scope. |
| `stage/5-competitors` | Prior islands plus `rw:ai-defensibility`; geographic product scope available. |
| `stage/6-shortlist` | Prior islands plus `rw:competitors`; research scope compatible with score/product scope. |
| `stage/7-validation` | Prior islands plus `rw:wedge` with credible scoped wedge. |
| `stage/7.1-validated` | Prior islands plus `rw:validation`; experiment plan scoped to validated wedge. |
| `stage/8-selected` | All applicable canonical islands complete; no unresolved country gate or blocking status. |
| `stage/9-archived` | Exactly one archive reason; missing analytical islands are lower priority than archive consistency. |

When a required earlier-stage island is missing:

- add empty markers only if appropriate for structural visibility;
- add `status/needs-info`;
- record that the owning upstream workflow must be re-run or migrated;
- do not invent its content.

---

## Evidence and geographical-integrity checks

For every issue at `stage/0-intake` or later, verify structural presence of:

- `rw:evidence`;
- `Geographic area`;
- `Geographic applicability: globally-portable|regional|country-dependent`.

For every issue at `stage/1-normalized` or later, where `rw:normalized` is expected to exist, verify structural presence of:

- geographic area and applicability;
- evidence status/confidence;
- countries examined where applicable;
- `Country validation before scoring`;
- countries requiring validation/check scope where applicable;
- non-generalization or expansion limitation where applicable.

For `regional` issues:

- report as inconsistent if later islands omit an area-specific mechanism or scope limitation required by the current stage.

For `globally-portable` issues:

- report as inconsistent if later score, solution, wedge, or validation content treats portability as proof of worldwide validation rather than identifying an initial scope.

For `regional-variant` dedupe decisions:

- report as inconsistent if later solution, wedge, or validation content does not preserve the differentiating geographical mechanism.

Do not create or revise geography fields yourself.

---

## Country-validation-before-scoring invariant

This is a critical invariant.

A `country-dependent` issue may be in:

- `stage/2-deduped`; or
- `stage/2.5-country-validation`;

while `Country validation before scoring: outstanding`.

It must not proceed to `stage/3-scored` or any later active stage unless either:

1. upstream handoffs coherently state the gate was already `satisfied`; or
2. a completed `rw:country-validation` island states:
   - `Gate status: satisfied`;
   - `Scoring eligibility after this pass: eligible`;
   - no country/check remains outstanding.

Important:

- Earlier islands may legitimately preserve historical `outstanding` language after `rw:country-validation` satisfies the gate.
- Treat `rw:country-validation` as authoritative for later resolution when present.
- If an issue in or beyond `stage/3-scored` lacks required gate resolution:
  - add `status/needs-info`;
  - record a critical progression violation in `rw:steward`;
  - include it prominently in the daily report;
  - do not invent or backfill country-validation results;
  - do not downgrade or reroute the issue unless a purely mechanical stale-label correction is proven.

---

## Later-stage scope consistency checks

Where relevant islands exist, flag mismatches such as:

- `rw:scorecard` scoring a broader geographic scope than `rw:country-validation` verifies;
- `rw:solution` proposing a product scope broader than the validated scoring scope;
- `rw:ai-defensibility` awarding local-integration defensibility without a verified local-integration basis;
- `rw:competitors` using only generic/global coverage for a regional or country-dependent scoped item;
- `rw:wedge` defining a wedge broader than the scoring or verified country scope;
- `rw:validation` recruiting or testing outside the validated wedge scope.

Stewardship does not correct analytical content. It records the inconsistency, adds `status/needs-info` when material, and reports the pattern.

---

## Steward island format

When an issue is touched, add or replace only:

```md
<!-- rw:steward:start -->
### Steward check
- **Checked on:** <YYYY-MM-DD>
- **Structural fixes applied:**
  - ...
- **Integrity concerns recorded:**
  - ...
- **Required owning-stage action:** <workflow/stage to rerun or `none`>
- **Geographic/country-gate concern:** <concern or `none`>
<!-- rw:steward:end -->
```

Rules:

- Keep it compact.
- Record only repairs actually made and observable structural concerns.
- Do not summarize or reassess the problem.
- Do not state that a gate is satisfied unless the authoritative island already says so.

---

## Daily steward report

When repairs or material systemic concerns are identified, create one issue titled:

`[steward] <YYYY-MM-DD>`

Use:

```md
# Daily repository stewardship — <YYYY-MM-DD>

## Header summary
- **Problem issues reviewed:** <number>
- **Issues touched:** <number>
- **Issues flagged but not repaired:** <number>
- **Overall pipeline health:** healthy | bottlenecked | inconsistent
- **Most urgent integrity risk:** ...

## Stage snapshot of inspected issues
| Stage | Count inspected | Structural concern observed |
|---|---:|---|
| stage/... | ... | ... |

## Repairs applied
| Issue | Repair type | Exact repair | Remaining concern |
|---|---|---|---|
| #... | labels / empty-island-marker / archive reason / steward note | ... | ... |

## Geographic and country-gate integrity
- **Issues missing evidence/geographic handoff after intake:** <number>
- **Country-dependent issues waiting at `stage/2.5-country-validation`:** <number>
- **Issues found at scoring-or-later without satisfied country gate:** <number>
- **Regional-variant items with downstream scope/differentiation drift:** <number>
- **Portable/regional items with scope inconsistency:** <number>
- **Observation:** ...

## Other consistency findings
- **Stage-label conflicts:** <number>
- **Persona/domain hygiene issues:** <number>
- **Archive-reason issues:** <number>
- **Score/risk/wedge/AI label contradictions:** <number>
- **Missing canonical islands:** <number>

## Bottlenecks and systemic risks
- ...
- ...
- ...

## Recommended next actions
1. ...
2. ...
3. ...
```

### Report/noop rule

- If repairs were made, create the report.
- If no repair was made but a recurring or critical integrity problem is observed, create the report.
- If neither exists, emit `noop` and do not create an empty report.

---

## Integrity principles

- Steward structure; do not redo analysis.
- Fix only what is mechanically and confidently correct.
- Do not advance issues or create analytical conclusions.
- Do not treat missing evidence as evidence.
- Do not treat a geographical-area name as a validated market.
- Treat unresolved country validation before scoring as a critical progression guardrail.
- Surface recurring workflow defects instead of hiding them through ad hoc edits.

Always emit safe outputs or `noop`.
