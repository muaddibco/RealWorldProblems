---
name: "RW: Daily Top-10 Report"
strict: false
on:
  schedule: daily

concurrency:
  group: rw-shortlist-daily-${{ github.repository }}
  cancel-in-progress: false

engine:
  id: copilot
  model: ${{ vars.GH_AW_MODEL_AGENT_COPILOT || 'gpt-5.4' }}
  agent: rw-shortlist-curator

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
  create-issue:
    title-prefix: "[top10] "
    labels: [type/report]
    close-older-issues: true
    max: 1
  noop:
---

# Create a daily geography-aware Top-10 validation report

## Purpose

Create one daily report showing the strongest `type/problem` opportunities for validation work now.

This workflow is a reporting stage only. It does not modify problem issues, re-score candidates, re-decide wedge credibility, perform market research or repair missing pipeline data.

The report must reflect the revised pipeline:

```text
stage/0-evidence → stage/0-intake → stage/1-normalized → stage/2-deduped
  → software fit → optional stage/2.5-country-validation → stage/3-scored
  → stage/4-solution → stage/ai-defensibility → stage/5-competitors
  → stage/6-shortlist → stage/7-validation → stage/7.1-validated
```

It should make clear:

- which opportunities are actionable for validation now;
- the geographical area and exact validated wedge scope of each candidate;
- whether country-dependent items passed their pre-scoring validation gate;
- whether retained `regional-variant` candidates have a genuine area-specific reason to exist;
- what geographic/evidence bottlenecks limit the portfolio.

---

## Tooling and completion rules

- Read/search issues using GitHub MCP issue tools only.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, local temp-file parsing, reconstructed MCP payloads or external web research.
- Use existing canonical islands and labels as the source of truth.
- Create exactly one `type/report` issue each successful run, even when no candidates qualify.
- Emit `noop` only if GitHub issue-read tools are unavailable or report creation is not technically possible.
- Do NOT update, label or close any `type/problem` issue from this workflow.
- Do not end with prose-only output.

---

## Candidate discovery scope

Inspect active problem issues that could be ready for validation, especially those carrying:

- `wedge/credible`;
- `score/top-10` or `score/top-50`;
- `stage/7-validation` or `stage/7.1-validated`.

You may inspect issues at `stage/6-shortlist` with `wedge/credible` as transitional/legacy near-candidates or routing inconsistencies. Under the revised pipeline, a successful wedge decision normally moves directly to `stage/7-validation`.

Never rank issues carrying:

- `agentic-workflows`;
- `stage/9-archived`;
- `status/duplicate`;
- `wedge/weak`.

---

## Ranked eligibility gate

An issue is eligible for the ranked Top 10 only when all conditions are satisfied.

### Required labels/stage

- `type/problem`;
- `wedge/credible`;
- `score/top-10` or `score/top-50`;
- `stage/7-validation` or `stage/7.1-validated`.

### Required canonical islands

Each required upstream island may appear either as the full island block or as the matching completion marker `<!-- gh-aw-island-end:<stage-file> -->`, where `<stage-file>` is the upstream workflow filename without `.md`.

- `<!-- rw:scorecard:start --> ... <!-- rw:scorecard:end -->`
- `<!-- rw:solution:start --> ... <!-- rw:solution:end -->`
- `<!-- rw:ai-defensibility:start --> ... <!-- rw:ai-defensibility:end -->`
- `<!-- rw:competitors:start --> ... <!-- rw:competitors:end -->`
- `<!-- rw:wedge:start --> ... <!-- rw:wedge:end -->`

Each of the above may also be represented by its matching `gh-aw-island-end` marker, such as `<!-- gh-aw-island-end:40-score -->`, `<!-- gh-aw-island-end:50-solution -->`, `<!-- gh-aw-island-end:55-ai-defensibility -->`, `<!-- gh-aw-island-end:60-competitors -->`, and `<!-- gh-aw-island-end:70-wedge-filter -->`.

For `stage/7.1-validated`, also require:

- `<!-- rw:validation:start --> ... <!-- rw:validation:end -->`
  - or `<!-- gh-aw-island-end:90-validation-plan -->`

For a country-dependent item resolved through the conditional gate, also require:

- `<!-- rw:country-validation:start --> ... <!-- rw:country-validation:end -->`
  - or `<!-- gh-aw-island-end:35-country-validation -->`
- `Gate status: satisfied`.

Do not accept legacy non-canonical marker formats for the ranked list.

### Required geographic integrity

Read from `rw:scorecard`:

- `Geographic area`;
- `Geographic applicability: globally-portable | regional | country-dependent`;
- `Scoring geographic scope`;
- `Country-validation gate: not-required | satisfied-upstream | satisfied-by-country-validation`;
- `Dedupe/variant status: not-duplicate | regional-variant | possible-near-duplicate`;
- score, evidence, confidence, risk and scope limitations.

Read from `rw:wedge`:

- `Decision: credible`;
- `Validated initial wedge scope`;
- `Country-validation gate used`;
- `Competitor research status considered: complete-for-wedge-review | material-competition-warning`;
- initial ICP/buyer;
- distribution path;
- falsifiable test and kill criterion;
- non-generalization limitation.

Rank only when:

- wedge scope matches or is narrower than scored scope;
- no country-validation requirement remains outstanding;
- country-dependent items remain within verified country scope;
- regional items state an area-specific entry factor;
- globally-portable items state an initial test/entry scope;
- regional variants state what area-specific distinction the wedge will test.

An otherwise promising issue failing any rule belongs in **Promising but excluded / blocked**, not the ranked list.

---

## Source-of-truth precedence

Use:

1. `rw:validation`, when present, for a runnable experiment and immediate action.
2. `rw:wedge` for entry wedge, scope, test and kill criterion.
3. `rw:competitors` for scoped competition and substitute findings.
4. `rw:ai-defensibility` for durability and generic-AI risk.
5. `rw:solution` for product scope and dependencies.
6. `rw:scorecard` for problem attractiveness, geographic scope, evidence, confidence and risk.
7. `rw:country-validation`, when required, for the authoritative country-gate resolution and verified country boundary.

Never replace these conclusions with new inference.

---

## Ranking logic

Rank eligible candidates in this priority order:

1. **Validation execution readiness**
   - Prefer `stage/7.1-validated` with a concrete plan/experiment reference over `stage/7-validation`.

2. **Score bucket**
   - `score/top-10` above `score/top-50`.

3. **Evidence and confidence**
   - Prefer higher confidence and stronger evidence.

4. **Geographically executable wedge**
   - Prefer narrow validated scope, concrete ICP, credible in-scope distribution, explicit geographic boundary and a fast falsifiable test.

5. **Competitive posture**
   - Prefer a credible differentiation supported by a `complete-for-wedge-review` competitor scan.
   - An item with `material-competition-warning` remains eligible, but rank it lower than a comparable candidate unless its wedge specifically addresses the threat.

6. **Risk**
   - Prefer lower risk, except where a higher-risk item has a clearly superior test that directly resolves the risk.

7. **AI defensibility**
   - Use as a secondary ranking factor and display field.
   - For weak defensibility/high AI risk, recommend validation against generic AI plus current workflow.

8. **Portfolio geography tie-breaker only**
   - When items are otherwise comparable, prefer a well-supported opportunity in an underrepresented validated area or a genuinely distinct regional variant.
   - Do not replace quality/readiness with diversity.

Do not reward theoretical regional size, broad portability or ambitious expansion unless the current in-scope validation opportunity is strong.

---

## Geographic portfolio analysis

Summarize the inspected eligible/near-eligible set by:

- geographical area;
- geographic applicability;
- verified country scope for country-dependent items;
- count of eligible `regional-variant` items;
- count of country-dependent eligible items with satisfied gates;
- promising candidates excluded because of scope/country-gate/competitor integrity problems.

Identify:

- top-list concentration in one area;
- several variants of one broad problem cluster;
- areas producing candidates but few validation-ready items;
- country-validation or geographic-scope bottlenecks.

State clearly that these observations are based on the inspected active candidate set, not the whole market.

---

## Supporting sections

### Near misses

Include up to 5 valid, scoped candidates that nearly ranked or ranked below the Top 10 because of:

- lower score bucket;
- weaker evidence/confidence;
- higher risk;
- material competition warning;
- weaker AI defensibility;
- still awaiting validation-plan creation.

### Promising but excluded / blocked

Include up to 5 issues excluded from ranking because of:

- missing canonical island;
- unresolved/missing country-validation handoff;
- scoring/wedge geographic-scope mismatch;
- competitor research marked `needs-verification`;
- unsupported regional-variant distinction;
- routing inconsistency such as `wedge/credible` still at `stage/6-shortlist`.

Do not modify these issues; report the required repair/workflow action.

---

## Report issue output

Create ONE issue titled:

`[top10] <YYYY-MM-DD>`

Use this format:

```md
# Daily validation shortlist — <YYYY-MM-DD>

## Header summary
- **Eligible ranked candidates found:** <number>
- **Listed in Top 10:** <number>
- **Validation-plan ready (`stage/7.1-validated`):** <number>
- **Awaiting validation plan (`stage/7-validation`):** <number>
- **Excluded/blocked promising candidates inspected:** <number>
- **AI defensibility among eligible:** strong=<n>, medium=<n>, weak=<n>, missing=<n>
- **Country-dependent eligible items with satisfied gate:** <number>
- **Regional variants among eligible:** <number>
- **Main pipeline bottleneck:** ...

## Geographic portfolio snapshot
| Geographic area / verified scope | Applicability | Eligible count | Highest-ranked issue(s) | Scope/readiness note |
|---|---|---:|---|---|
| ... | globally-portable / regional / country-dependent | ... | #... | ... |

- **Concentration note:** ...
- **Country-validation bottleneck note:** ...
- **Regional-variant / cluster note:** ...

## Ranked Top 10

### 1. #<issue> — <one-line problem summary>
- **Validated wedge scope:** <area or verified country/countries> (`<applicability>`)
- **Stage / next executable status:** ...
- **Score / risk:** `score/...`, `risk/...`
- **Evidence / confidence:** ...
- **AI defensibility / AI risk:** ...
- **Dedupe/variant status:** ...
- **Competition note:** ...
- **Why it ranks here now:** ...
- **Recommended next validation action:** ...
- **Scope limitation:** ...

<repeat up to 10>

## Near misses
| Issue | Validated scope | Why it nearly qualified or ranked lower | Next improvement |
|---|---|---|---|
| #... | ... | ... | ... |

## Promising but excluded / blocked
| Issue | Apparent potential | Ranking blocker | Required pipeline fix |
|---|---|---|---|
| #... | ... | ... | ... |

## Pipeline note
- **What the repository most needs next:** ...
- **Geographic coverage or validation concern:** ...
- **Most useful workflow action before tomorrow's report:** ...
```

### Too few candidates

If fewer than 3 eligible issues exist, still create the report. Explain:

- exact eligible count;
- visible exclusions and their most common reason;
- relevant country-validation/geographic-scope bottleneck;
- which workflow action would most improve tomorrow's report.

Do not fill a thin list with ineligible candidates.

---

## Integrity principles

- Rank validation-ready opportunities, not speculative market reach.
- Display validated scope so a country-supported issue is not confused with an area-wide opportunity.
- Do not hide competition warnings, AI risk or variant fragility.
- Do not interpret missing research as whitespace.
- Use portfolio geography for transparency and tie-breaking, not as a quality substitute.

Always emit `create_issue` or `noop`.
