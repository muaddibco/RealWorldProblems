---
name: "RW: Wedge Filter + Archive"
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

run-name: "RW: Wedge Filter + Archive | issue #${{ inputs.issue_number }} | orch ${{ inputs.orchestration_id || 'n/a' }}"

engine:
  id: copilot
  agent: rw-wedge-filter

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

# Decide whether a validated geographical opportunity has a credible initial wedge

## Purpose

This stage decides whether the currently proposed solution has a believable **narrow market-entry wedge** in the issue's validated geographical scope.

It does not decide whether the underlying pain matters in general; scoring already evaluated problem attractiveness. It decides whether this particular combination of:

- evidenced problem;
- validated geographical scope;
- proposed MVP/solution;
- AI-defensibility position;
- researched competitors and substitutes;
- initial ICP and distribution path;

offers a credible early route to adoption.

The pipeline investigates opportunities using geographical areas and, where necessary, verified country scope. Therefore:

- a wedge must be credible in the validated initial area/country scope;
- a regional distinction may support a wedge only when upstream evidence and competitor research support it;
- a country-dependent solution must not rely on assumptions outside its verified country scope;
- a globally portable opportunity must still name a credible first entry geography and must not treat expansion as already validated.

Expected transition:

```text
stage/6-shortlist
  → RW: Wedge Filter
      ├─ wedge/credible → stage/7-validation + status/shortlisted
      └─ wedge/weak     → stage/9-archived + archive/no-wedge
```

This workflow performs no new market research. It uses upstream islands as its entire decision basis.

---

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Orchestration ID: `${{ inputs.orchestration_id }}`

Before doing anything else:

- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY on issue #${{ inputs.issue_number }}.
- Process only an issue with labels `type/problem` and `stage/6-shortlist`, and without label `agentic-workflows`.
- If these conditions are not met, emit `noop` and stop.
- If the issue has more than one active `stage/*` label, add `status/needs-info`, comment with the conflicting stages and do not make a wedge decision.

---

## Tooling rules

- Read the target issue using GitHub MCP issue tools only.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, local temp-file parsing, reconstructed MCP payloads or workflow-output files.
- Do NOT browse the web in this stage.
- Do NOT add facts not already supported in the upstream islands.
- If GitHub issue-read tools are unavailable, emit `noop` with reason `missing GitHub read tools` and stop.

---

## Mandatory completion rule

A successful run MUST end with at least one safe-output tool call.

Valid endings:

### Credible wedge

- `update_issue` with the complete `rw:wedge` island;
- `add_labels` for `wedge/credible`, `status/shortlisted`, and `stage/7-validation`;
- `remove_labels` for `stage/6-shortlist`, `wedge/weak`, and `archive/no-wedge` if stale;
- optionally remove `status/needs-info` only when no visible blocker remains.

### Weak wedge

- `update_issue` with the complete `rw:wedge` island;
- `add_labels` for `wedge/weak`, `archive/no-wedge`, and `stage/9-archived`;
- `remove_labels` for `stage/6-shortlist`, `wedge/credible`, and `status/shortlisted` if present;
- optionally `close_issue` as not planned when supported.

### Missing, incomplete or inconsistent prerequisites

- `add_comment` specifying exactly what is missing or inconsistent;
- `add_labels` for `status/needs-info`;
- retain `stage/6-shortlist`;
- do not write a wedge verdict.

### Ineligible issue

- `noop`.

Do not end with prose-only output.  
Do not classify a wedge as weak merely because required competitor or geographic input is missing; hold it for information instead.

---

## Mandatory write targeting rule

Because this workflow runs through `workflow_dispatch`, there is no implicit triggering issue.

For every write action, explicitly target:

- `repo: ${{ github.repository }}`
- `issue_number: ${{ inputs.issue_number }}` for `update_issue`
- `item_number: ${{ inputs.issue_number }}` for `add_comment`
- `item_number: ${{ inputs.issue_number }}` for `add_labels`
- `item_number: ${{ inputs.issue_number }}` for `remove_labels`
- `item_number: ${{ inputs.issue_number }}` for `close_issue`

Never write to related, competitor or cluster issues.

---

## Required upstream handoff

The issue MUST contain completed canonical islands:

1. Evidence:
   - `<!-- rw:evidence:start --> ... <!-- rw:evidence:end -->`

2. Normalized problem:
   - `<!-- rw:normalized:start --> ... <!-- rw:normalized:end -->`

3. Dedupe:
   - `<!-- rw:dedupe:start --> ... <!-- rw:dedupe:end -->`

4. Software fit:
   - `<!-- rw:software-fit:start --> ... <!-- rw:software-fit:end -->`

5. Scorecard:
   - `<!-- rw:scorecard:start --> ... <!-- rw:scorecard:end -->`

6. Solution:
   - `<!-- rw:solution:start --> ... <!-- rw:solution:end -->`

7. AI defensibility:
   - `<!-- rw:ai-defensibility:start --> ... <!-- rw:ai-defensibility:end -->`

8. Competitors:
   - `<!-- rw:competitors:start --> ... <!-- rw:competitors:end -->`

9. Country validation, only when scoring required it:
   - `<!-- rw:country-validation:start --> ... <!-- rw:country-validation:end -->`

Do not accept legacy island-marker alternatives in the geography-aware pipeline. Legacy items missing canonical evidence/geographic handoffs must be returned for enrichment rather than judged on an incomplete record.

---

## Required values before wedge judgment

### Problem and score scope

Require:

- JTBD and documented failure moment;
- affected persona and likely payer/economic beneficiary;
- score bucket and risk label or equivalent scorecard disposition;
- evidence/confidence from the scorecard;
- `Geographic area: <area>`;
- `Geographic applicability: globally-portable|regional|country-dependent`;
- `Scoring geographic scope: <area or verified country/countries>`;
- `Country-validation gate: not-required|satisfied-upstream|satisfied-by-country-validation`;
- scorecard scope/expansion limitations.

### Dedupe/variant handoff

Require an active dedupe outcome:

- `not-duplicate`;
- `regional-variant`; or
- `possible-near-duplicate`.

Rules:

- A `duplicate` must not enter wedge review.
- For `regional-variant`, require a documented geographical distinction that this stage can test against competitor findings.
- For `possible-near-duplicate`, retain the identity uncertainty as a wedge risk.

### Software and solution handoff

Require:

- software-fit decision `yes` or `partial`;
- software dependencies and geographic feasibility constraints;
- a solution hypothesis describing the initial product mode, ICP/wedge, MVP and dependencies;
- AI-defensibility verdict and kill-shot/substitution risk.

### Competitor handoff

Require `rw:competitors` with:

- `Research status: complete-for-wedge-review` or `material-competition-warning`;
- validated market scope researched consistent with score scope;
- relevant direct competitors and substitutes table, even if zero confirmed direct competitors were found;
- geographic competitive assessment;
- gap hypotheses and risks;
- recommendation with `Proceed to wedge review: yes`.

A competitor island with `Research status: needs-verification` is a blocker, not evidence of a weak wedge.

### Country-dependent handoff

For `country-dependent` issues that required country validation:

- require `rw:country-validation` with `Gate status: satisfied`;
- require the wedge scope to stay inside the verified initial scoring/launch scope;
- do not rely on unverified countries or generalize to the entire discovery area.

---

## Blocking conditions

Do not make a wedge decision when:

- any required island is missing or materially incomplete;
- the issue has contradictory active stage labels;
- scoring geographic scope is absent or inconsistent across scorecard and competitors islands;
- competitor research is `needs-verification` or does not cover the scoped opportunity;
- country validation was required but is absent or not satisfied;
- the solution proposes dependencies that upstream records as unverified and essential for first value;
- the issue is a duplicate;
- a regional-variant wedge depends on a geographical distinction not described or not compared in competitors research.

When blocked:

1. Call `add_comment` identifying the precise missing/inconsistent prerequisites.
2. Call `add_labels` for `status/needs-info`.
3. Keep `stage/6-shortlist`.
4. Do not write or replace `rw:wedge`.
5. Do not archive.

---

## Source-of-truth precedence

Use:

1. `rw:country-validation`, when present, for verified country scope and prohibitions on generalization.
2. `rw:scorecard` for the validated scoring scope, evidence/confidence and score limitations.
3. `rw:competitors` for verified competitive/substitute coverage, gap hypotheses and strongest threats.
4. `rw:solution` for the proposed initial product and wedge hypothesis.
5. `rw:ai-defensibility` for AI commoditization and durability risks.
6. `rw:software-fit`, `rw:dedupe`, `rw:normalized` and `rw:evidence` for dependency history, regional-variant context and the evidence-safe problem identity.

Do not rewrite prior islands.  
Do not replace a source-backed constraint with a more attractive assumption.

---

## What a wedge decision means

Choose exactly one:

- `wedge/credible`
- `wedge/weak`

### `wedge/credible`

Use only when the proposed solution has a realistic, narrow first entry path in the validated geographic scope.

A credible wedge normally requires ALL of:

1. **Specific initial ICP / niche**
   - Defined within the validated geographic scope.
   - Narrower than everyone experiencing the broad pain.
   - Names the user/buyer workflow or segment.

2. **Area- or country-relevant adoption trigger**
   - A concrete supported reason to act now, tied to the failure moment, local workflow or verified scope.

3. **Believable first distribution path**
   - A specific channel or access path that is credible in the area/country scope.
   - Not a vague claim such as “ads,” “partnerships” or “SEO” without an accessible route.

4. **Defensible initial differentiation**
   - Addresses a documented competitor/substitute weakness or a well-qualified gap hypothesis.
   - Does not rely merely on better UI, more generic AI, or unsupported absence of competitors.
   - Is consistent with AI-defensibility findings.

5. **MVP feasibility inside the wedge**
   - Software can create the claimed initial value without unresolved essential data/API/regulatory/partner dependency.
   - Consistent with `software-fit/yes|partial` and scorecard feasibility/risk.

6. **Honest geographic boundary**
   - The wedge is limited to the validated scope.
   - Geographic expansion is explicitly an assumption to be tested later, not a basis for present credibility.

7. **Testable next validation step**
   - There is a concrete validation experiment capable of disproving the wedge.

A credible wedge may coexist with material risk, but its first testable route must be concrete and honest.

### `wedge/weak`

Use when all prerequisites are present and one or more fundamental wedge weaknesses are established, including:

- the ICP remains broad or generic;
- adoption trigger is not distinct from existing alternatives;
- distribution path is implausible or inaccessible in the validated scope;
- competition materially covers the proposed first value and no defensible differentiation remains;
- differentiation relies only on better UI, cheaper pricing without structural advantage, generic AI or unsupported gap claims;
- first value requires essential unverified partnerships, APIs, approvals, data or country expansion;
- a regional/country-dependent distinction is weakened by competitor evidence;
- AI-defensibility is weak and the wedge does not survive generic AI plus existing workflows;
- a credible MVP entry path cannot be described without moving beyond validated geographic scope.

Do not use `wedge/weak` merely because evidence is missing; missing prerequisites are a `status/needs-info` hold.

---

## Geographic wedge standards

### For `globally-portable`

A credible wedge must still state:

- the initial entry geographic scope;
- why that area/segment is accessible now;
- what must be revalidated before expansion.

A general claim that the pain exists everywhere is not a distribution strategy.

### For `regional`

A credible wedge must state:

- the geographical-area-specific adoption trigger or distribution advantage;
- how local/regional competitor research supports or at least leaves open that differentiation;
- what local-language, workflow, payments, trust or service-structure condition matters.

If competitors research weakens the regional distinction and no alternate narrow wedge remains, choose `wedge/weak`.

### For `country-dependent`

A credible wedge must:

- stay within verified country scope;
- use only satisfied country mechanisms/dependencies;
- state which country-specific channel/workflow creates initial access;
- avoid area-wide or cross-country claims.

If the candidate needs unvalidated country expansion to support its wedge, choose `wedge/weak` or hold for missing information when the claimed prerequisite was never verified.

### For `regional-variant`

A credible wedge must depend materially on the recorded regional difference.  
If the proposed route would be identical to the canonical/shared cluster opportunity, the variant's distinct wedge is weak or unresolved.

---

## How to use upstream judgments

### Use the scorecard

- A high score does not create a wedge.
- Low reachability or feasibility requires especially strong, concrete wedge evidence.
- High risk requires a narrower and more verifiable entry path.
- Low confidence makes a `credible` decision harder unless the initial validation step is exceptionally concrete and inexpensive.

### Use software fit

- For `software-fit/partial`, confirm the non-software element does not prevent early adoption.
- A wedge relying on unresolved essential dependencies is weak or blocked.
- Do not make new feasibility assumptions.

### Use AI defensibility

- If `ai-defensibility/weak` or `ai-risk/high`, a credible wedge must include a non-generic, workflow-embedded reason to win and must explicitly test against generic AI plus existing tools.
- Strong AI defensibility is helpful, but does not replace geographic distribution or competitive evidence.

### Use competitor research

- `material-competition-warning` is not automatic rejection, but demands a clear narrow route around the threat.
- A stated gap hypothesis is not a proved gap.
- Zero confirmed direct competitors is not proof of white space.
- Competitor findings that weaken a regional distinction must be addressed, not ignored.

---

## Wedge island output

Write only inside:

`<!-- rw:wedge:start --> ... <!-- rw:wedge:end -->`

Use this exact structure:

```md
<!-- rw:wedge:start -->
### Wedge decision

- **Decision:** credible | weak
- **Geographic area:** <area>
- **Geographic applicability:** globally-portable | regional | country-dependent
- **Validated initial wedge scope:** <area or verified country/countries>
- **Dedupe/variant status:** not-duplicate | regional-variant | possible-near-duplicate
- **Country-validation gate used:** not-required | satisfied-upstream | satisfied-by-country-validation
- **Competitor research status considered:** complete-for-wedge-review | material-competition-warning
- **AI-defensibility context considered:** strong | medium | weak

### Proposed entry wedge
- **Wedge:** <one sentence describing the narrow initial entry angle>
- **Initial ICP / buyer:** ...
- **Painful trigger / reason to adopt now:** ...
- **Area- or country-specific adoption factor:** ...
- **First distribution path in validated scope:** ...
- **MVP value inside the wedge:** ...

### Why this can win early — or why it cannot
- ...
- ...
- ...

### Competitive and substitute test
- **Strongest direct competitor or substitute:** ...
- **Differentiation basis:** supported observation | gap hypothesis | insufficient differentiation — ...
- **Effect of regional/country-specific competition:** supports | narrows | weakens | unresolved — ...

### Feasibility and durability constraints
- **Essential dependency status:** verified/acceptable | material but manageable | blocks credible entry — ...
- **AI/generic-tool substitution risk:** ...
- **What must not be generalized beyond validated scope:** ...
- **Expansion hypothesis beyond initial scope:** ...

### Validation handoff
- **Most decision-critical wedge hypothesis:** ...
- **Fastest falsifiable test in the scoped market:** ...
- **Kill criterion:** ...
- **Main risks:**
  - ...
  - ...
<!-- rw:wedge:end -->
```

If the decision is `weak`, still provide the narrowest plausible rejected wedge and the factual reasons it fails. This helps later analysis without keeping the issue active.

---

## Label handling

Before applying a new wedge outcome, remove any conflicting existing wedge outcome label:

- `wedge/credible`
- `wedge/weak`

Also remove stale routing labels only as needed to implement the selected outcome.

### If wedge is credible

1. Call `update_issue` with `operation: replace-island` for the complete `rw:wedge` island.
2. Call `add_labels` for:
   - `wedge/credible`
   - `status/shortlisted`
   - `stage/7-validation`
3. Call `remove_labels` for:
   - `stage/6-shortlist`
   - `wedge/weak`
   - `archive/no-wedge` if stale
   - `status/needs-info` only if no blocker remains.

### If wedge is weak

1. Call `update_issue` with `operation: replace-island` for the complete `rw:wedge` island.
2. Call `add_labels` for:
   - `wedge/weak`
   - `archive/no-wedge`
   - `stage/9-archived`
3. Call `remove_labels` for:
   - `stage/6-shortlist`
   - `wedge/credible`
   - `status/shortlisted` if present.
4. Optionally call `close_issue` as not planned when supported.

Do not add geographic, competition-warning, AI-risk or country-validation labels beyond labels already defined by AGENTS.md and owned by their stages.

---

## Integrity principles

- Judge a first market-entry wedge, not the abstract attractiveness of a problem.
- Treat the validated geographical scope as a hard boundary for current conclusions.
- A geographical distinction matters only when it creates a real adoption, distribution, workflow or competitive difference.
- Never call absence of found competitors a defensible gap.
- Never approve a wedge that requires unresolved local facts or essential dependencies.
- Prefer a clear weak verdict over a vague credible one.
- Prefer a needs-info hold over a weak verdict when prerequisites are incomplete.

Always emit at least one safe-output operation, or `noop`.
