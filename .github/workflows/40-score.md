---
name: "RW: Score Problems"
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

run-name: "RW: Score Problems | issue #${{ inputs.issue_number }} | orch ${{ inputs.orchestration_id || 'n/a' }}"

engine:
  id: copilot
  model: ${{ vars.GH_AW_MODEL_AGENT_COPILOT || 'gpt-5.4' }}
  agent: rw-scorer

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

# Score problem attractiveness within the validated geographical scope

## Purpose

This stage scores a problem opportunity only after it is:

- evidence-enriched;
- normalized;
- deduplicated or retained as a meaningful regional variant;
- assessed as meaningfully software-solvable; and
- where required, country-validated before scoring.

The score is for **problem attractiveness in the validated geographical scope**, not for:

- the final startup/company outcome;
- the quality of a not-yet-designed product;
- the later market-entry wedge;
- broad expansion potential outside the validated scope.

The pipeline's primary geography is a **geographical area**. A candidate may be:

- `globally-portable`;
- `regional`; or
- `country-dependent`.

A `country-dependent` candidate MUST NOT be scored while its named pre-scoring country-validation gate remains outstanding.

Expected incoming routes:

```text
stage/2-deduped
  → RW: Software Fit
      ├─ software-fit/yes|partial + country gate not-required/satisfied
      │    → stage/3-scored
      └─ software-fit/yes|partial + country gate outstanding
           → stage/2.5-country-validation
           → RW: Country Validation Gate
           → stage/3-scored only if gate satisfied
```

Successful scoring advances:

```text
stage/3-scored → stage/4-solution
```

---

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Orchestration ID: `${{ inputs.orchestration_id }}`

Before doing anything else:

- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY on issue #${{ inputs.issue_number }}.
- If the issue does not have labels `type/problem` and `stage/3-scored`, or has label `agentic-workflows`, emit `noop` and stop.

---

## Tooling rules

- Read the target issue using GitHub MCP issue tools only.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, local temp-file parsing, reconstructed MCP payloads or workflow-output files.
- Do NOT perform web research in this stage.
- Score only from the evidence and decisions already written into upstream islands.
- If GitHub issue-read tools are unavailable, emit `noop` with reason `missing GitHub read tools` and stop.

---

## Mandatory completion rule

A successful run MUST end with at least one safe-output tool call.

Valid endings:

### Successfully scored

- `update_issue` with the complete `rw:scorecard` island;
- `remove_labels` for conflicting prior score/risk labels and `stage/3-scored`;
- `add_labels` for exactly one score bucket, exactly one risk label and `stage/4-solution`;
- optionally remove `status/needs-info` only when no visible blocker remains.

### Blocked from scoring

- `add_comment` identifying the exact missing, inconsistent or unresolved prerequisite;
- `add_labels` for `status/needs-info`;
- retain `stage/3-scored`;
- do not write a scorecard.

### Ineligible issue

- `noop`.

Do not end with prose-only output.
Do not score when a pre-scoring country gate is unresolved.

---

## Mandatory write targeting rule

Because this workflow runs through `workflow_dispatch`, there is no implicit triggering issue.

For every write action, explicitly target:

- `repo: ${{ github.repository }}`
- `issue_number: ${{ inputs.issue_number }}` for `update_issue`
- `item_number: ${{ inputs.issue_number }}` for `add_comment`
- `item_number: ${{ inputs.issue_number }}` for `add_labels`
- `item_number: ${{ inputs.issue_number }}` for `remove_labels`

Never write to related or comparison issues.

---

## Required upstream islands

Before scoring, the issue MUST contain:

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

1. Evidence island:
   - `<!-- rw:evidence:start --> ... <!-- rw:evidence:end -->`
  - or `<!-- gh-aw-island-end:05-evidence-enrich -->`

2. Normalized island:
   - `<!-- rw:normalized:start --> ... <!-- rw:normalized:end -->`
  - or `<!-- gh-aw-island-end:10-normalize -->`

3. Dedupe island:
   - `<!-- rw:dedupe:start --> ... <!-- rw:dedupe:end -->`
  - or `<!-- gh-aw-island-end:20-dedupe -->`

4. Software-fit island:
   - `<!-- rw:software-fit:start --> ... <!-- rw:software-fit:end -->`
  - or `<!-- gh-aw-island-end:30-software-fit -->`

5. Country-validation island, only when required:
   - `<!-- rw:country-validation:start --> ... <!-- rw:country-validation:end -->`

---

## Required handoff values

### Evidence and normalized handoff

Require:

- evidence status: `secondary-signalled` or `primary-validated`;
- evidence confidence: `low|medium|high`;
- JTBD;
- context/frequency;
- pain/stakes;
- workaround;
- trigger/failure moment;
- likely payer/economic beneficiary;
- next validation-critical unknown;
- `Geographic area: <area>`;
- `Geographic applicability: globally-portable|regional|country-dependent`;
- why the area matters;
- area-specific mechanism or signal;
- countries examined where relevant;
- `Country validation before scoring: satisfied|outstanding|not-required`;
- countries/checks requiring validation where relevant;
- pre-scoring geographic gate.

### Dedupe handoff

Require one active disposition:

- `Decision: not-duplicate`;
- `Decision: regional-variant`; or
- `Decision: possible-near-duplicate`.

If the dedupe island says `Decision: duplicate`, do not score. Add `status/needs-info` and comment that archived duplicate routing is inconsistent with scoring entry.

For `Decision: regional-variant`, score only the documented differentiating geographical opportunity. Do not score the generic shared cluster as though it were unique to this issue.

For `Decision: possible-near-duplicate`, score conservatively and carry the dedupe uncertainty into constraints/confidence.

### Software-fit handoff

Require:

- exactly one of `software-fit/yes` or `software-fit/partial`;
- corresponding island decision `yes` or `partial`;
- geographic applicability and country-validation routing consistent with the normalized/dedupe handoff.

Do not score:

- `software-fit/no`;
- missing software-fit decision;
- contradictory software-fit label and island decision.

---

## Mandatory country-gate enforcement

### `globally-portable` and `regional` candidates

These may be scored only when:

- `Country validation before scoring: not-required`; or
- an upstream correction explicitly and coherently establishes that no country gate applies.

If they carry an unexplained outstanding country gate, block scoring and request upstream correction.

### `country-dependent` candidates with gate already satisfied upstream

A `country-dependent` candidate may be scored without a `rw:country-validation` island only when the evidence/normalized/software-fit handoff coherently states:

- `Country validation before scoring: satisfied`; and
- no historical or preserved outstanding pre-scoring gate remains in downstream handoff.

Use the evidenced country scope recorded upstream as the scoring scope.

### `country-dependent` candidates previously routed through country validation

If any upstream island preserves:

- `Country validation before scoring: outstanding`; or
- `Routing after software fit: country-validation-required`; or
- a pre-scoring geographic gate requiring checks,

then the issue MUST contain a completed `rw:country-validation` island with:

- `Gate status: satisfied`;
- `Scoring eligibility after this pass: eligible`;
- countries verified in this pass;
- countries/checks still outstanding: `none`;
- a verified initial scoring/launch scope;
- confidence and source-backed check disposition.

If any such requirement is absent, if gate status remains `outstanding`, or if it is `materially-undermined`:

- add `status/needs-info`;
- comment with the exact country-gate reason;
- do not score or advance.

### Country-gate authority rule

When a country-validation island exists, it is authoritative for resolution of the pre-scoring country gate. Earlier islands may correctly retain historical `outstanding` language. Do not require those historical islands to be rewritten.

---

## Blocking conditions

Do not score when any of the following applies:

### Evidence/definition blockers

- required upstream island is absent or malformed;
- evidence status remains `hypothesis-only`;
- evidence/normalized content says the problem is not ready for normalization or is materially contradicted;
- JTBD, persona, failure moment, stakes, workaround, geographic area or applicability is missing;
- likely payer/economic beneficiary or next validation-critical unknown is missing.

### Dedupe/software blockers

- dedupe decision is missing, duplicate or inconsistent;
- software-fit is absent or `no`;
- software-fit label and island conflict.

### Geographic blockers

- geographic applicability is missing or invalid;
- required area signal is unsatisfied;
- a country-dependent issue has an unresolved pre-scoring gate;
- a country-validation island indicates `outstanding` or `materially-undermined`;
- an issue claims a regional/area-wide opportunity while the handoff only supports a narrower country scope and does not clearly constrain the score.

When blocked:

1. Call `add_comment` with a concise list of exact blockers.
2. Call `add_labels` for `status/needs-info`.
3. Keep `stage/3-scored`.
4. Do NOT write or replace `rw:scorecard`.

---

## Scoring scope

Before assigning scores, state the precise scope:

- **Geographic area:** inherited area-level discovery context.
- **Geographic applicability:** `globally-portable|regional|country-dependent`.
- **Scoring geographic scope:** the actual area or verified initial country scope supported by evidence.
- **Country-validation gate:** `not-required|satisfied-upstream|satisfied-by-country-validation`.
- **Cluster/variant status:** from the dedupe island.
- **Expansion limitations:** what must not be generalized beyond current scope.

Rules:

- A geographic area is not automatically a validated market.
- A `regional` score must use evidence related to that area, not generic global assumptions.
- A `country-dependent` score is only for verified country scope unless stronger evidence exists.
- A `globally-portable` score evaluates the evidenced initial area/context, while portability remains an expansion hypothesis.

---

## Scoring rubric: problem attractiveness only

Score six dimensions, each 1–5, maximum 30.

### 1. Severity

How painful or costly is the problem when it occurs in the validated geographic scope?

- 1 = minor annoyance.
- 3 = meaningful time, cost, stress, service disruption or operational burden.
- 5 = severe consequence, repeated business loss, significant penalty, critical access failure or serious risk supported by evidence.

Do not assign 5 based on hypothetical worst cases not grounded in the upstream handoff.

### 2. Frequency

How often does the evidenced user/segment face this problem or repeated exposure in the validated scope?

- 1 = rare or highly uncertain.
- 3 = occasional, periodic or recurring exposure plausibly supported.
- 5 = frequent/ongoing workflow-level pain supported by credible evidence.

A mandatory process does not by itself prove frequent failure.

### 3. Urgency / failure cost

How time-sensitive is the problem and what happens if no action is taken?

- 1 = easily deferred with low consequence.
- 3 = moderate deadline, delay, inconvenience or avoidable cost.
- 5 = immediate action needed or clear supported penalty, lost revenue, denied access or serious consequence.

### 4. Willingness-to-pay / strong proxy

What evidence suggests a payer would fund a solution, or that a strong economic proxy exists?

- 1 = weak or unsubstantiated value signal.
- 3 = plausible budget owner or meaningful ROI proxy, explicitly still a hypothesis where not directly validated.
- 5 = direct payment evidence, credible budget owner commitment, or very strong supported economic value.

Pain alone is not proof of willingness to pay.  
An identified payer hypothesis without commitment should rarely score 5.

### 5. Reachability

How realistically can first users or buyers be reached in the validated initial scope?

- 1 = diffuse or hard-to-access users/channels.
- 3 = plausible communities, roles, organisations or channels but not yet tested.
- 5 = concentrated and credible path to initial users/buyers with strong support.

For regional or country-dependent candidates, reachability must reflect actual area/country access, language/channel constraints and buyer structure.

### 6. Feasibility

How quickly can a software MVP create real value in the validated scope?

- 1 = major dependencies or limited software lever.
- 3 = feasible with meaningful constraints, dependencies or `software-fit/partial`.
- 5 = fast practical software MVP with clear value and minimal unresolved dependency.

Rules:

- If `software-fit/partial`, Feasibility should rarely exceed 3 unless non-software elements are plainly minor.
- If validated scope requires difficult integration, partner cooperation, compliance approval, hardware or data access, reduce Feasibility and/or increase Risk.
- Country validation resolving the truth of a mechanism does not automatically eliminate implementation risk.

---

## Evidence, confidence and risk rules

### Scorecard evidence quality

Record `Evidence: weak|medium|strong` for the scoring case.

Use:

- `strong` only when the most important severity/frequency/failure and geographic-scope claims are well-supported, with payer/reachability/feasibility support adequate for a stable score;
- `medium` when problem evidence is solid but important commercial or delivery assumptions remain;
- `weak` when important scoring rationales still rest mainly on hypotheses or thin evidence.

This is scoring-case evidence quality, not a replacement for `Evidence status after enrichment`.

### Confidence

Record `Confidence: low|medium|high`.

- `high` requires coherent upstream islands, credible scope-specific evidence and no major unresolved fact that would materially change the score.
- `medium` is appropriate where pain is supported but payer, reachability, transferability, alternatives or feasibility are still assumptions.
- `low` is required where score hinges on weak evidence, near-duplicate ambiguity or major untested assumptions.

### Risk

Record `Risk: low|medium|high`, and apply exactly one corresponding label.

Use `risk/high` when one or more are material:

- regulated or trust-heavy domain;
- significant country/local compliance or institutional dependency;
- strong partnership dependency;
- difficult data access or integration dependency;
- meaningful operational, legal or hardware complexity;
- unclear feasibility after a `software-fit/partial` decision.

Use `risk/medium` for meaningful but manageable constraints.  
Use `risk/low` only when MVP delivery and early user access are relatively straightforward within the validated geographic scope.

---

## Scorecard island output

Write only inside:

`<!-- rw:scorecard:start --> ... <!-- rw:scorecard:end -->`

Use this exact structure:

```md
<!-- rw:scorecard:start -->
### Problem attractiveness scorecard

### Validated scoring scope
- **Geographic area:** <area>
- **Geographic applicability:** globally-portable | regional | country-dependent
- **Scoring geographic scope:** <area or verified country/countries>
- **Country-validation gate:** not-required | satisfied-upstream | satisfied-by-country-validation
- **Dedupe/variant status:** not-duplicate | regional-variant | possible-near-duplicate
- **Scope and expansion limitation:** ...

| Dimension | 1–5 | Rationale within validated scope |
|---|---:|---|
| Severity | n | ... |
| Frequency | n | ... |
| Urgency / failure cost | n | ... |
| Willingness-to-pay / strong proxy | n | ... |
| Reachability | n | ... |
| Feasibility | n | ... |
| **Total (max 30)** | **nn** | ... |

### Evidence and risk
- **Evidence:** weak | medium | strong
- **Confidence:** low | medium | high
- **Risk:** low | medium | high — ...
- **Geographic score limitations:** ...
- **Main constraints:**
  - ...
  - ...

### Downstream handoff
- **Highest-scoring validated strength:** ...
- **Most decision-critical unresolved assumption:** ...
- **Solution drafting must respect:** ...
<!-- rw:scorecard:end -->
```

Do not duplicate full evidence tables. Downstream agents should read the prior islands when source detail is needed.

---

## Bucket labels

Before applying a new score decision, remove any existing:

- `score/top-10`
- `score/top-50`
- `score/long-tail`
- `risk/low`
- `risk/medium`
- `risk/high`

Then apply exactly one score bucket using the thresholds in `AGENTS.md`:

- `score/top-10` for total ≥ 24 and confidence is not low.
- `score/top-50` for total 20–23, or total ≥ 24 with confidence low.
- `score/long-tail` for total ≤ 19, or total 20–23 with confidence low.

Also apply exactly one:

- `risk/low`;
- `risk/medium`; or
- `risk/high`.

Do not create geographic or country-validation labels.

---

## Advance after successful scoring

When scoring succeeds:

1. Call `update_issue` on issue #${{ inputs.issue_number }} with:
   - `repo: ${{ github.repository }}`
   - `issue_number: ${{ inputs.issue_number }}`
   - `operation: replace-island`
   - only the complete `rw:scorecard` island.
2. Remove conflicting existing score/risk labels.
3. Call `add_labels` for:
   - exactly one score bucket;
   - exactly one risk label;
   - `stage/4-solution`.
4. Call `remove_labels` for:
   - `stage/3-scored`;
   - `status/needs-info` only if no visible blocking concern remains.

Do not modify earlier islands.

---

## Integrity principles

- Score supported problems in honest geographic scope.
- Do not use attractive regional storytelling as evidence.
- Do not use one verified country to inflate an entire area score.
- Do not score while country validation is outstanding.
- Do not decide wedge quality here.
- Prefer a conservative score with explicit uncertainty over an inflated score that later stages cannot trust.

Always emit at least one safe-output operation, or `noop`.
