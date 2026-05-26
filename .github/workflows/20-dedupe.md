---
name: "RW: Dedupe + Cluster"
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

run-name: "RW: Dedupe + Cluster | issue #${{ inputs.issue_number }} | orch ${{ inputs.orchestration_id || 'n/a' }}"

engine:
  id: copilot
  model: ${{ vars.GH_AW_MODEL_AGENT_COPILOT || 'gpt-5.4-mini' }}
  agent: rw-deduper

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

# Dedupe + Cluster: preserve meaningful geographical variants

## Purpose

This stage determines whether an evidence-ready, normalized problem is:

- an actual duplicate of an existing canonical problem;
- a distinct candidate;
- a meaningful geographical-area variant in the same broad problem cluster; or
- a possible near-duplicate that should remain active with explicit notes.

The pipeline now investigates problems using **geographical areas** as the primary geographic unit. Therefore, two issues that share a similar JTBD are not automatically duplicates if geography materially changes:

- the failure mechanism;
- the buyer or payer;
- the route to initial users;
- existing alternatives;
- language/documentation friction;
- regulation, public-system structure, payment rails, data access or integration constraints;
- or evidenced severity/recurrence.

At the same time, a new issue must not survive merely because the same problem has been renamed for a different area. Regional variation must be material and grounded in the existing normalized/evidence content.

Expected stage transition:

`stage/1-normalized → stage/2-deduped`

Duplicates are archived as:

`status/duplicate + archive/other + stage/9-archived`

This stage uses only repository information already collected. It does not conduct new external evidence research.

---

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Orchestration ID: `${{ inputs.orchestration_id }}`

Before doing anything else:

- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY on issue #${{ inputs.issue_number }} as the issue being classified and written to.
- Search/read other issues only for comparison.
- If the target issue no longer has labels `type/problem` and `stage/1-normalized`, or has label `agentic-workflows`, emit `noop` and stop.

---

## Tooling rules

- Read and search issues using GitHub MCP issue tools only.
- Search both open and closed `type/problem` issues when identifying possible canonical matches.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, local temp-file parsing, reconstructed MCP payloads or workflow-output temp files.
- Do NOT browse the web or independently re-evaluate sources in this stage.
- Treat the `rw:evidence` and `rw:normalized` islands as the working evidence/geography handoff.
- If GitHub issue tools are unavailable, emit `noop` with reason `missing GitHub read tools` and stop.

---

## Mandatory completion rule

A successful run MUST end with at least one safe-output tool call.

Valid endings are:

### Duplicate

- `update_issue` to write the dedupe island;
- `add_comment` identifying the canonical issue and reason;
- `add_labels` for `status/duplicate`, `stage/9-archived`, and `archive/other`;
- `remove_labels` for `stage/1-normalized`;
- `close_issue` with duplicate reason when supported, otherwise archive labels are sufficient.

### Not duplicate / regional variant / possible near-duplicate

- `update_issue` to write the dedupe island;
- `add_labels` for `stage/2-deduped`;
- `remove_labels` for `stage/1-normalized`;
- optionally remove `status/needs-info` only when it is clearly stale and not related to any unresolved evidence or country-validation requirement.

### Missing or conflicting required information

- `add_comment` listing the exact blocker;
- `add_labels` for `status/needs-info`;
- no stage change.

### Ineligible issue

- `noop`.

Do not end with prose-only output.
Do not stop after analysis.

---

## Mandatory write targeting rule

Because this workflow runs via `workflow_dispatch`, there is no implicit triggering issue.

For every write action, explicitly target:

- `repo: ${{ github.repository }}`
- `issue_number: ${{ inputs.issue_number }}` for `update_issue`
- `item_number: ${{ inputs.issue_number }}` for `add_comment`
- `item_number: ${{ inputs.issue_number }}` for `add_labels`
- `item_number: ${{ inputs.issue_number }}` for `remove_labels`
- `item_number: ${{ inputs.issue_number }}` for `close_issue`

Never write to a comparison issue or canonical issue from this workflow.

---

## Required input gate

Before deduplication, the target issue MUST contain a completed normalized island:

`<!-- rw:normalized:start --> ... <!-- rw:normalized:end -->`

The normalized island must provide:

- JTBD;
- context/frequency;
- pain/stakes;
- current workaround;
- trigger/failure moment;
- persona;
- domain;
- theme;
- subtheme;
- archetype;
- evidence status;
- evidence confidence;
- geographic area;
- geographic applicability: `globally-portable|regional|country-dependent`;
- why the area matters;
- likely payer/economic beneficiary;
- next validation-critical unknown.

It must also provide, when applicable:

- `Countries examined`;
- `Country validation before scoring`;
- `Countries requiring validation before scoring`;
- `Pre-scoring geographic gate`.

For `country-dependent` issues with `Country validation before scoring: outstanding`, the required countries/checks must be finite and concrete. Do not preserve placeholders such as `selected country`, `selected municipality`, or `selected first segment / municipality`.

The issue SHOULD also contain its completed evidence island:

`<!-- rw:evidence:start --> ... <!-- rw:evidence:end -->`

If issue-read output does not include HTML comments, treat the evidence handoff as present when the matching generated section heading is present with substantive content. Only use `status/needs-info` when the section content itself is missing or materially incomplete.

The same completion may also be represented by the upstream workflow marker `<!-- gh-aw-island-end:05-evidence-enrich -->`, where the suffix is the upstream workflow filename without `.md`.

or the corresponding completion marker from the prior workflow:

`<!-- gh-aw-island-end:05-evidence-enrich -->`

Use `rw:evidence` to understand corrections, supported geography claims and country-validation requirements. Do not modify it.

### Missing-information handling

If the normalized island is absent or lacks required geographic/evidence fields:

- Call `add_comment` specifying the missing normalized handoff fields.
- Call `add_labels` with `status/needs-info`.
- Do NOT write a dedupe decision.
- Do NOT change stage.

If a `country-dependent` issue says `Country validation before scoring: outstanding` but lacks a specific country/check list or pre-scoring gate:

- handle as missing information;
- do not dedupe/advance until the handoff is explicit.

### Outstanding country validation is not itself a dedupe blocker

When a country-dependent issue clearly lists outstanding country validation:

- proceed with dedupe;
- preserve that handoff in the dedupe island;
- do not infer that it has been satisfied;
- do not archive solely because the pre-scoring validation gate remains open.

---

## Duplicate identity model

Compare issues on two levels:

1. **Core problem identity**
2. **Geographical opportunity identity**

### Core problem identity axes

Assess similarity of:

- JTBD outcome;
- affected persona;
- trigger and failure moment;
- pain/stakes;
- current workaround;
- primary managed/coordinated/verified object;
- recurrence pattern;
- likely payer/economic beneficiary;
- likely software-value mechanism or solution gravity.

### Geographical opportunity identity axes

Assess similarity or material differences in:

- geographic area;
- geographic applicability;
- why geography matters;
- area-specific mechanism or signal;
- countries examined where country-dependent;
- pre-scoring country-validation requirement;
- regulation/public-service/payment/data-access/integration mechanism;
- provider or institution structure;
- language/documentation/identity constraint;
- available substitute pattern;
- initial distribution/reachability path.

---

## Decisions

Use exactly one decision in the `rw:dedupe` island:

- `duplicate`
- `not-duplicate`
- `regional-variant`
- `possible-near-duplicate`

Only `duplicate` is archived.

### Decision: `duplicate`

Classify as `duplicate` only when BOTH are true:

1. The core problem identity is effectively the same as the canonical issue:
   - substantially same JTBD;
   - substantially same failure moment and stakes;
   - substantially same affected-user context and workaround;
   - substantially same likely software-value mechanism.

2. Geography does not create a materially different opportunity:
   - same or overlapping area mechanism; OR
   - the new issue merely renames the same pain for a different area without supported material differences; OR
   - a globally portable canonical issue already covers the same problem and the target adds no substantive regional/country-dependent mechanism.

Do not keep a duplicated candidate merely because the area names differ.

### Decision: `regional-variant`

Classify as `regional-variant` when:

- core JTBD belongs to the same broad cluster as another issue; AND
- the geographical area or country-dependent mechanism materially changes at least one of:
  - trigger/failure mechanism;
  - payer or economic beneficiary;
  - distribution/reachability;
  - substitute/alternative structure;
  - language/documentation/identity constraint;
  - regulatory/public-system/payment/integration dependency;
  - supported stakes or recurrence.

The differing mechanism must already be stated in `rw:normalized` or `rw:evidence`; do not invent it during dedupe.

A `regional-variant` is NOT a duplicate. It advances to `stage/2-deduped`.

### Decision: `not-duplicate`

Use when no sufficiently similar core problem exists, or similarities are too broad to justify a cluster-sibling designation.

It advances to `stage/2-deduped`.

### Decision: `possible-near-duplicate`

Use when:

- substantial overlap exists; but
- the available normalized/evidence content is insufficient to confidently choose `duplicate` or `regional-variant`; or
- two issues may collapse to the same problem later but still contain plausible distinguishing context.

When unsure, do not archive. Advance to `stage/2-deduped` and document exactly what later agent or human review should watch for.

---

## Canonical issue selection for duplicates

When deciding `duplicate`, select a canonical issue carefully.

Prefer, in this order:

1. an issue representing the same core problem and same geographic opportunity mechanism with more complete evidence/normalization;
2. an active non-duplicate issue already farther in the pipeline;
3. an earlier issue with equivalent quality;
4. a closed/archived non-duplicate issue if it is clearly the stable canonical record.

Rules:

- Search both open and closed issues.
- Never choose an issue labelled `status/duplicate` as canonical when its referenced root issue can be found.
- Do not select a generic/global canonical to erase a materially evidenced regional or country-dependent variant.
- Record canonical issue status and reason in the island and duplicate comment.

---

## Search procedure

### 1. Parse target issue

Read from `rw:normalized` and, when present, `rw:evidence`:

- JTBD;
- persona/domain/theme/subtheme/archetype;
- failure moment;
- workaround;
- payer;
- geographic area;
- geographic applicability;
- area mechanism;
- country-dependent requirements;
- likely product/solution gravity.

### 2. Broad searches

Search both open and closed `type/problem` issues using combinations of:

- title terms;
- JTBD verbs and objects;
- persona;
- domain/theme/subtheme;
- failure moment keywords;
- workaround keywords;
- payer keywords where meaningful.

### 3. Geography-aware searches

Search again using:

- geographic area;
- area-specific mechanism;
- country name(s) examined or requiring validation, when applicable;
- regulation/public system/payment/integration terms when country-dependent;
- cross-area versions of the same JTBD to detect false regional duplication.

### 4. Read likely matches

Read enough of the nearest candidate issues to compare:

- normalized problem identity;
- evidence/geographical framing where available;
- stage/status;
- whether a candidate is itself already marked duplicate.

### 5. Decide and write

Do not close/archive based on title similarity alone.  
Use the decision criteria above and document concise reasons.

---

## Legacy and incomplete comparison issues

Comparison issues may predate geographical-area/evidence fields.

Rules:

- A legacy issue can still be a canonical duplicate when core identity is clearly the same and the target adds no materially supported geographical distinction.
- If the target includes a supported regional or country-dependent differentiator that the legacy issue does not address, do not archive the target solely because its broad JTBD matches.
- Record legacy comparison limitations in notes.
- Do not update the comparison issue.

---

## Dedupe island output

For every issue that receives a dedupe decision, write only inside:

`<!-- rw:dedupe:start --> ... <!-- rw:dedupe:end -->`

Use this structure:

```md
<!-- rw:dedupe:start -->
### Dedupe and cluster decision

- **Decision:** duplicate | not-duplicate | regional-variant | possible-near-duplicate
- **Target geographic area:** <area>
- **Target geographic applicability:** globally-portable | regional | country-dependent
- **Country validation before scoring:** satisfied | outstanding | not-required
- **Countries requiring validation before scoring:** <countries or specifically scoped country-level requirement; no placeholders>
- **Pre-scoring geographic gate preserved:** <gate text or none>

### Nearest issues checked
| Issue | Status/stage | Similarity in core problem | Geographic comparison | Result |
|---|---|---|---|---|
| #... | ... | ... | ... | canonical duplicate / regional sibling / near-duplicate / distinct |

### Decision rationale
- **Core problem identity:** ...
- **Geographical opportunity identity:** ...
- **Why duplicate or distinct:** ...

### Canonical / cluster handling
- **Canonical issue:** #<id> | none
- **Canonical issue status:** open | closed | n/a
- **Cluster suggestion:** <short free-text cluster name>
- **Relationship to cluster:** duplicate of canonical | geographic-area variant | near-duplicate to monitor | new cluster candidate

### Notes for downstream stages
- ...
- If country validation is outstanding: `Do not score until listed country-level validation is completed.`
<!-- rw:dedupe:end -->
```

Keep the island concise, factual and grounded in the target and comparison issue content.

---

## If duplicate

When `Decision: duplicate`:

1. Call `update_issue` with `operation: replace-island` for the complete `rw:dedupe` island.
2. Call `add_comment`:
   - `Duplicate of #<canonical-id> (reason: <concise core + geographic identity reason>; canonical status: open|closed).`
3. Call `add_labels` for:
   - `status/duplicate`
   - `stage/9-archived`
   - `archive/other`
4. Call `remove_labels` for:
   - `stage/1-normalized`
5. Call `close_issue` with state reason `duplicate` when supported.

Do not use or request an `archive/duplicate` label.

---

## If not duplicate, regional variant or possible near-duplicate

When decision is `not-duplicate`, `regional-variant` or `possible-near-duplicate`:

1. Call `update_issue` with `operation: replace-island` for the complete `rw:dedupe` island.
2. Call `add_labels` for:
   - `stage/2-deduped`
3. Call `remove_labels` for:
   - `stage/1-normalized`

Do not add a new regional-variant label unless AGENTS.md later defines one.

Do not remove or conceal an outstanding country-validation-before-scoring requirement.

---

## Integrity principles

- Duplicate means the same actionable problem opportunity, not merely the same topic.
- Geography can preserve a distinct candidate only when it changes the opportunity mechanism materially.
- Geography cannot rescue a thin duplicate when only the location name differs.
- Outstanding country validation is a downstream readiness constraint, not by itself evidence of duplication.
- When similarity is real but disposition is uncertain, keep the issue active and document the ambiguity.

Always emit at least one safe-output operation, or `noop`.
