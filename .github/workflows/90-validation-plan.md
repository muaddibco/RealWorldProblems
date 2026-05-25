---
name: "RW: Validation Plan"
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

run-name: "RW: Validation Plan | issue #${{ inputs.issue_number }} | orch ${{ inputs.orchestration_id || 'n/a' }}"

engine:
  id: copilot
  model: ${{ vars.GH_AW_MODEL_AGENT_COPILOT || 'gpt-5.4' }}
  agent: rw-validation-planner

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
  create-issue:
    title-prefix: "[experiment] "
    labels: [type/experiment]
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

# Create one geographically scoped validation experiment

## Purpose

Turn a shortlisted `wedge/credible` opportunity into one runnable validation experiment for the most decision-critical remaining uncertainty.

The experiment must remain inside the validated initial wedge scope. It must not silently broaden:

- a verified country into the full geographical discovery area;
- a regional opportunity into untested countries or segments;
- a globally-portable hypothesis into proof of global demand.

This stage creates a plan and a child experiment issue; it does not create validation results or upgrade the evidence status to `primary-validated`.

Expected transition:

```text
stage/7-validation → stage/7.1-validated
```

---

## Dispatch context and eligibility

- Target issue: #${{ inputs.issue_number }}
- Orchestration ID: `${{ inputs.orchestration_id }}`

Before doing anything else:

- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY on issue #${{ inputs.issue_number }} for parent writes.
- Proceed only when the issue has `type/problem`, `stage/7-validation`, and `wedge/credible`.
- Do not process when `agentic-workflows` or `stage/9-archived` is present.
- If eligibility fails, emit `noop` and stop.
- If more than one `stage/*` label is active, add `status/needs-info`, comment with the conflicting stages, and stop.

---

## Tooling and completion rules

- Read issues using GitHub MCP issue tools only.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, temp-file parsing, reconstructed tool payloads, or external web research.
- Use only upstream islands and explicit issue content as the source of truth.
- If GitHub issue-read output omits HTML comments, fall back to section-content validation instead of assuming markers are missing.
- If GitHub issue reads are unavailable, emit `noop` with reason `missing GitHub read tools`.

A successful runnable plan MUST include:

1. `create_issue` for one `type/experiment` child issue;
2. `update_issue` for the parent `rw:validation` island;
3. `add_labels` on the parent for `stage/7.1-validated`;
4. `remove_labels` on the parent for `stage/7-validation`.

If blocked:

- call `add_comment` identifying exact prerequisites missing or unsafe;
- call `add_labels` for `status/needs-info`;
- retain `stage/7-validation`;
- create no experiment and write no validation island.

For every parent write, explicitly target:

- `repo: ${{ github.repository }}`
- `issue_number: ${{ inputs.issue_number }}` for `update_issue`
- `item_number: ${{ inputs.issue_number }}` for comments and labels.

The child experiment body must reference parent issue #${{ inputs.issue_number }}. Record the created issue reference in the parent island only when the safe-output tool returns it; never invent an issue number.

---

## Required upstream handoff

Require completed canonical islands:

Each required upstream island may appear either as the full island block or as the matching completion marker `<!-- gh-aw-island-end:<stage-file> -->`, where `<stage-file>` is the upstream workflow filename without `.md`.

1. `<!-- rw:evidence:start --> ... <!-- rw:evidence:end -->`
   - or `<!-- gh-aw-island-end:05-evidence-enrich -->`
2. `<!-- rw:normalized:start --> ... <!-- rw:normalized:end -->`
   - or `<!-- gh-aw-island-end:10-normalize -->`
3. `<!-- rw:dedupe:start --> ... <!-- rw:dedupe:end -->`
   - or `<!-- gh-aw-island-end:20-dedupe -->`
4. `<!-- rw:software-fit:start --> ... <!-- rw:software-fit:end -->`
   - or `<!-- gh-aw-island-end:30-software-fit -->`
5. `<!-- rw:scorecard:start --> ... <!-- rw:scorecard:end -->`
   - or `<!-- gh-aw-island-end:40-score -->`
6. `<!-- rw:solution:start --> ... <!-- rw:solution:end -->`
   - or `<!-- gh-aw-island-end:50-solution -->`
7. `<!-- rw:ai-defensibility:start --> ... <!-- rw:ai-defensibility:end -->`
   - or `<!-- gh-aw-island-end:55-ai-defensibility -->`
8. `<!-- rw:competitors:start --> ... <!-- rw:competitors:end -->`
   - or `<!-- gh-aw-island-end:60-competitors -->`
9. `<!-- rw:wedge:start --> ... <!-- rw:wedge:end -->`
   - or `<!-- gh-aw-island-end:70-wedge-filter -->`
10. `<!-- rw:country-validation:start --> ... <!-- rw:country-validation:end -->` only when a country-dependent issue required the pre-scoring gate.
    - or `<!-- gh-aw-island-end:35-country-validation -->`

If issue-read output does not include HTML comments, treat upstream handoff as present when the matching generated section heading is present with substantive content:

- Evidence: `### Evidence enrichment verdict`
- Normalized problem: `### Normalized problem`
- Dedupe: `### Dedupe and cluster decision`
- Software fit: `### Software fit decision`
- Scorecard: `### Problem attractiveness scorecard`
- Solution: `### Solution hypothesis`
- AI defensibility: `### AI defensibility scorecard`
- Competitors: `### Competitor research scope`
- Wedge: `### Wedge decision`
- Country validation when required: `### Country validation verdict` or `### Country validation`

When this fallback is used:

- do not block solely for missing comment markers;
- validate required values from the section content itself;
- only apply `status/needs-info` if the section content is actually missing or materially incomplete.

Legacy marker alternatives are not sufficient for the revised geographical-area-aware pipeline.

### Required values

Require:

- Evidence status `secondary-signalled` or `primary-validated`, plus evidence confidence.
- JTBD, affected persona, failure moment, workaround, likely payer/economic beneficiary, and next validation-critical unknown.
- `Geographic area: <area>`.
- `Geographic applicability: globally-portable|regional|country-dependent`.
- `Scoring geographic scope: <area or verified country/countries>`.
- `Validated initial product scope: <area or verified country/countries>`.
- `Validated initial wedge scope: <area or verified country/countries>`.
- `Country-validation gate used: not-required|satisfied-upstream|satisfied-by-country-validation`.
- A statement of what must not be generalized beyond validated scope.
- Dedupe disposition `not-duplicate|regional-variant|possible-near-duplicate`.
- Software-fit decision `yes|partial`.
- Complete scorecard, solution, and AI-defensibility result.
- Competitor status `complete-for-wedge-review|material-competition-warning`.
- Wedge decision `credible`, initial ICP/buyer, distribution path, differentiation hypothesis, fastest falsifiable test, and kill criterion.

The wedge scope may be narrower than scoring scope; it must not be broader.

For a `country-dependent` candidate previously routed through validation:

- require `rw:country-validation` with `Gate status: satisfied`;
- use only its verified country scope in recruitment, local workflow, currency/language, alternatives, and interpretation.

---

## Blocking conditions

Do not plan or create an experiment when:

- a required island/value is missing or contradictory;
- country validation is unresolved;
- scoring, product, and wedge scopes conflict;
- the wedge is weak, archived, or lacks a concrete recruitment path;
- competitor research is `needs-verification`;
- an essential MVP dependency is unverified and is neither avoided nor safely tested;
- no unambiguous pass/fail test can be defined;
- unnecessary sensitive data would be collected;
- an existing linked experiment already tests the same hypothesis without justification for another.

When blocked, add `status/needs-info`, add one precise comment, retain the stage, and do not create/update experiment content.

---

## Source-of-truth precedence

Use:

1. `rw:country-validation`, when present, for verified country scope and non-generalization boundaries.
2. `rw:wedge` for the credible entry path and falsification target.
3. `rw:competitors` for strongest alternatives and differentiation uncertainty.
4. `rw:ai-defensibility` for generic-AI substitution risk.
5. `rw:solution` for MVP and dependency choices.
6. `rw:scorecard` for evidence, confidence, risk, and remaining assumption.
7. Earlier islands for problem identity and historical constraints.

Do not rewrite prior islands.

---

## Choose one primary uncertainty

Select exactly one:

- `willingness-to-pay`
- `reachability/channel`
- `wedge adoption/differentiation`
- `workflow fit/problem truth`
- `MVP feasibility dependency`
- `AI/generic-tool substitution resistance`

A secondary uncertainty is allowed only if the same method tests it without weakening pass/fail clarity.

Choose the uncertainty most likely to reverse the next continue/stop decision and testable inside the validated wedge scope.

Special rules:

- For `regional-variant`, test whether the documented regional difference actually changes adoption, access, or differentiation when this remains uncertain.
- When AI defensibility is weak or AI risk is high, include an AI-substitution benchmark if generic AI plus current tools could invalidate the wedge.

---

## Geographic experiment rules

### `globally-portable`

Recruit and test within the concrete initial area/segment named by the wedge. State what requires retesting before expansion; do not claim cross-area portability from this test.

### `regional`

Recruit in the selected geographical area and test its area-specific mechanism or route. Reflect relevant language, currency, workflow, and alternatives where material. State country/subsegment limits on interpretation.

### `country-dependent`

Recruit only in verified country scope. Use verified local mechanisms and relevant language/currency/alternatives. Do not generalize to other countries or the full discovery area.

### `regional-variant`

Test the distinction that justified keeping the variant separate, not only the broad pain shared by its cluster.

---

## Method guidance

Use one primary method and optionally one tightly coupled secondary method:

- **Interviews** for problem truth, workflow, buyer, urgency, or local distinction.
- **Concierge MVP** for testing workflow adoption before software build.
- **Landing page + waitlist / qualified lead test** for scoped channel or offer resonance.
- **Pricing conversation / paid pilot** only when buyer, feasible first value, and recruitment path are credible.
- **Technical/operational proof or fake-door test** for a critical dependency or behavior.
- **AI substitution benchmark** when the wedge must show value beyond generic AI plus existing tools.

A runnable plan must specify participant scope, recruitment route, method target volume, pass/fail threshold, privacy safeguards, and scope limitations.

---

## Parent validation island output

Write only inside:

`<!-- rw:validation:start --> ... <!-- rw:validation:end -->`

Use this exact structure:

```md
<!-- rw:validation:start -->
### Validation goal
- **Primary uncertainty:** willingness-to-pay | reachability/channel | wedge adoption/differentiation | workflow fit/problem truth | MVP feasibility dependency | AI/generic-tool substitution resistance
- **Secondary uncertainty, if tightly coupled:** <uncertainty or none>
- **Why this is the next decision-critical test:** ...

### Validated geographic experiment scope
- **Geographic area:** <area>
- **Geographic applicability:** globally-portable | regional | country-dependent
- **Validated initial wedge scope for this test:** <area or verified country/countries>
- **Country-validation gate used:** not-required | satisfied-upstream | satisfied-by-country-validation
- **Participant/customer location requirement:** ...
- **Language / currency / local workflow considerations:** ...
- **Local competitors/substitutes to include in test framing:** ...
- **What must not be generalized beyond this scope:** ...

### Hypothesis
- **We believe:** ...
- **Because upstream evidence suggests:** ...
- **This would be falsified if:** ...

### Experiment design
- **Primary method:** interviews | concierge MVP | landing page + waitlist | pricing conversation | paid pilot | technical/operational proof | fake-door test | AI substitution benchmark
- **Optional coupled method:** <method or none>
- **Offer or workflow being tested:** ...
- **MVP / artifact needed:** ...
- **Essential dependency treatment:** verified | deliberately avoided | directly tested — ...

### Target participant / customer
- **ICP / buyer:** ...
- **Eligibility criteria:** ...
- **Exclusion criteria / sensitive-data limits:** ...
- **Target sample or outreach volume:** ...

### Recruiting path
- **Channel in validated scope:** ...
- **Recruitment message/value proposition:** ...
- **Why this route is feasible here:** ...

### Success criteria (pass/fail)
| Metric / observation | Pass threshold | Fail / kill threshold | Why it changes the decision |
|---|---|---|---|
| ... | ... | ... | ... |

### Evidence to collect
- ...
- **Privacy / sensitivity safeguards:** ...

### Test script or execution steps
1. ...
2. ...
3. ...

### Next action if PASS / if FAIL
- **PASS:** ...
- **FAIL:** ...
- **INCONCLUSIVE:** ...

### Planning traceability
- **Scorecard signals used:** evidence=..., confidence=..., risk=...
- **Wedge assumption being tested:** ...
- **Strongest competitor/substitute considered:** ...
- **AI-defensibility risk addressed:** ...
- **Experiment issue:** #<created issue number if returned by tool; never invent>
<!-- rw:validation:end -->
```

---

## Child experiment issue

For a successful plan create exactly one `type/experiment` issue.

Title remainder after `[experiment]`:

`<short opportunity name> - <primary uncertainty> - <scoped geography>`

Body:

```md
## Parent problem
- Parent issue: #${{ inputs.issue_number }}
- Parent stage at creation: stage/7-validation
- Geographic area: <area>
- Geographic applicability: globally-portable | regional | country-dependent
- Validated experiment scope: <area or verified country/countries>

## Decision to resolve
- Primary uncertainty: ...
- Hypothesis: ...
- Kill criterion: ...

## Method and execution
- Method: ...
- Offer/workflow tested: ...
- Participant/customer criteria: ...
- Recruiting path: ...
- Target sample/outreach volume: ...
- Language/currency/local workflow considerations: ...
- Sensitive-data safeguards: ...

## Success criteria
| Metric / observation | Pass threshold | Fail threshold |
|---|---|---|
| ... | ... | ... |

## Results capture
- Status: not-started
- Findings: pending
- Decision: pending

## Next action
- If pass: ...
- If fail: ...
- If inconclusive: ...
```

The child issue is an execution plan, not evidence that the hypothesis is true.

---

## Advance after success

When a runnable plan and experiment issue are created:

1. Call `create_issue` for the child.
2. Call `update_issue` on the parent with `operation: replace-island` and only the complete `rw:validation` island.
3. Call `add_labels` on the parent for `stage/7.1-validated`.
4. Call `remove_labels` on the parent for `stage/7-validation` and for `status/needs-info` only if no visible blocker remains.

Do not remove `wedge/credible` or `status/shortlisted`. Do not add undeclared geography or evidence-result labels.

---

## Integrity principles

- Plan one experiment that can change a decision.
- Stay inside validated geographic scope.
- A validation plan is not validation evidence until executed.
- Test against meaningful alternatives and AI substitution risk where material.
- Prefer a sharp, inexpensive falsification test over a broad research programme.

Always emit at least one safe-output operation, or `noop`.
