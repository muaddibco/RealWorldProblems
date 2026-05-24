---
name: "RW: Evidence Enrich"
strict: false
on:
  workflow_dispatch:
    inputs:
      issue_number:
        description: "Target problem issue number"
        required: true
        type: string
      orchestration_id:
        description: "Durable orchestration instance ID for correlation"
        required: false
        type: string
      minimum_sources:
        description: "Minimum independent supporting sources required to advance to normalization"
        required: true
        default: "2"
        type: string
      require_area_signal:
        description: "Require evidence tied to the seeded geographical area when an area is selected"
        required: true
        default: "true"
        type: choice
        options:
          - "true"
          - "false"

concurrency:
  group: rw-issue-${{ github.repository }}-${{ inputs.issue_number }}
  cancel-in-progress: false

run-name: "RW: Evidence Enrich | issue #${{ inputs.issue_number }} | orch ${{ inputs.orchestration_id || 'n/a' }}"

engine:
  id: copilot
  model: ${{ vars.GH_AW_MODEL_AGENT_COPILOT || 'gpt-5.4' }}
  agent: rw-evidence-enricher

permissions:
  contents: read
  issues: read

sandbox:
  agent: awf

network:
  allowed:
    - defaults
    - github
    - "*.tavily.com"

mcp-servers:
  tavily:
    command: npx
    args: ["-y", "tavily-mcp"]
    env:
      TAVILY_API_KEY: "${{ secrets.TAVILY_API_KEY }}"
    allowed: ["tavily_search", "tavily_research", "tavily_extract"]

tools:
  github:
    toolsets: [issues]
    read-only: true
    min-integrity: none
  web-fetch:

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

# Enrich evidence and geographical-area context before normalization

## Purpose

This stage is the formal evidence gate between seeded problem discovery and canonical normalization.

It validates whether a seeded problem candidate is grounded in traceable pain signals and whether its geographical framing is honest and useful for later startup evaluation.

The primary geographic unit is a **geographical investigation area**, not a country.

Examples of areas include:

- North America;
- Latin America;
- Israel;
- Arabic Middle East;
- Arabic North Africa;
- Sub-Saharan Africa;
- Western Europe;
- Eastern Europe;
- Russia and Belarus;
- Central Asia;
- Southern Asia;
- China.

Country-level evidence is required only when the candidate depends materially on national or municipal rules, public services, insurance, payment rails, infrastructure, data access or similar country-specific mechanisms.

This stage:

- researches and verifies problem evidence;
- verifies or corrects geographical-area applicability;
- identifies any country-level validation required before scoring;
- writes only an `rw:evidence` island;
- advances sufficiently evidenced candidates to the existing normalization entry point.

This stage does **not**:

- create new problem issues;
- rewrite user-written seed content;
- design a product solution;
- perform full competitor research;
- score the opportunity.

Expected pipeline position:

`stage/0-evidence → stage/0-intake → stage/1-normalized`

Where:

- `00-seed-problems.md` creates issues at `stage/0-evidence`;
- this workflow advances evidence-ready issues to `stage/0-intake`;
- `10-normalize.md` consumes the evidence-ready handoff.

---

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Orchestration ID: `${{ inputs.orchestration_id }}`
- Minimum independent sources to advance: `${{ inputs.minimum_sources }}`
- Require geographical-area signal: `${{ inputs.require_area_signal }}`

Before doing anything else:

- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY on issue #${{ inputs.issue_number }}.
- If it does not have labels `type/problem` and `stage/0-evidence`, or has label `agentic-workflows`, emit `noop` and stop.

---

## Tooling rules

### Repository reads

- Read the target issue and, when useful, search nearby problem issues using GitHub MCP issue tools only.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, local temp-file parsing, reconstructed MCP payloads or workflow-output files.
- If GitHub issue tools are unavailable, emit `noop` with reason `missing GitHub read tools` and stop.

### External evidence

- Use Tavily search/news and `web-fetch` for evidence verification.
- Search in source languages listed in the seeded issue when useful.
- Prefer area-relevant and local-language sources for `regional` candidates.
- Prefer country-specific official sources for a `country-dependent` mechanism.
- Do not rely only on English-language summaries where local-language or first-party evidence is reasonably discoverable and material to the finding.
- If external evidence tools are unavailable, write a `needs-more-evidence` evidence island, add `status/needs-info`, and do not advance.

### Source hierarchy

Prefer:

1. official regulator, government, municipality, public-service, provider, insurer or institutional sources for actual rules, procedures, deadlines, fees or constraints;
2. reputable research, official surveys, associations and public datasets for frequency, burden or impact;
3. official product or competitor pages for offered alternatives or public price information;
4. reputable regional/local news for documented failures or reported patterns;
5. forums, reviews and complaint discussions only as qualitative signals.

Anecdotal or discussion sources must not be used as proof of area-wide frequency, willingness to pay or market size.

---

## Mandatory completion rule

A run MUST end with at least one safe-output tool call.

Valid endings:

- `update_issue` plus stage transition labels when evidence is ready;
- `update_issue` plus `status/needs-info` and optionally one precise comment when evidence is insufficient;
- `noop` when the issue is not eligible to be processed.

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

Never rely on implicit targeting.

---

## Seeded issue contract

Read the original seeded body outside generated islands.

Expected problem framing fields:

- `**JTBD:**`
- `**Context & frequency:**`
- `**Pain / stakes:**`
- `**Current workaround:**`
- `**Failure moment:**`
- `**Why software may help:**`

Expected evidence/startup fields:

- `**Evidence status:** hypothesis-only|secondary-signalled|primary-validated`
- `**Readiness:** ready-for-evidence-gate|requires-evidence-enrichment`
- evidence-source table, when evidence was collected by seeding;
- unsupported assumptions;
- affected user;
- likely payer/economic beneficiary;
- critical unknown.

Expected geographical fields:

- `**Geographic area:** <area>`
- `**Geographic applicability:** globally-portable|regional|country-dependent`
- `**Areas compared, if any:** <areas or none>`
- `**Countries examined, if any:** <countries or none>`
- `**Countries requiring validation before scoring, if any:** <countries or none>`
- `**Source language(s):** <languages>`
- `**Why this area matters:**`
- `**Area-specific pain signal:**`
- `**Country-level dependency, if any:**`
- `**Transferability beyond this area:**`
- `**Area-specific competitor/substitute note:**`

Expected parseable classification lines:

- `Domain: <domain>`
- `Theme: <theme>`
- `Subtheme: <subtheme>`
- `Catalog status: <catalog|off-catalog>`
- `Persona: <persona>`
- `Archetype: <archetype>`
- `Geographic area: <area>`
- `Geographic applicability: <globally-portable|regional|country-dependent>`

### Missing metadata rule

If the candidate lacks a usable `Geographic area` or `Geographic applicability`, do not advance:

- write an evidence island recording the missing metadata;
- set verdict to `needs-more-evidence`;
- add `status/needs-info`.

Do not infer the active area from a single external source.

---

## Evidence vocabulary

Use exactly one enriched evidence status:

- `hypothesis-only` — the problem remains plausible but lacks sufficient traceable external or primary evidence.
- `secondary-signalled` — the pain or pain mechanism is supported by traceable external sources; direct user validation is not recorded.
- `primary-validated` — visible primary evidence is present in repository content, such as interviews, survey results, pilot results, support-ticket analysis or direct complaint intake.

Rules:

- External research can raise an issue from `hypothesis-only` to `secondary-signalled`, never to `primary-validated`.
- A seeded `primary-validated` claim must be backed by readable primary material in repository content. Otherwise downgrade it and explain why.
- Do not use `observed`, `proven` or `validated` as substitutes for these statuses.

---

## Geographical-area model

## Geographic applicability values

Validate or correct the seed classification to exactly one:

### `globally-portable`

The pain and software-enabled value mechanism plausibly transfer across multiple areas. The seeded area serves as a discovery, validation or entry wedge rather than the principal cause of the pain.

Evidence requirements:

- If the seeded area is a concrete area and `${{ inputs.require_area_signal }}` is `true`, require at least one supporting signal from that area.
- If the seeded area is `global-portable`, an area signal is not required; instead document the evidence basis and, where possible, the first area recommended for subsequent validation.
- Do not claim global prevalence from limited evidence.

### `regional`

The selected geographical area materially affects the pain, workaround, buyer reachability, language/documentation friction, provider structure, alternatives, payment/technology environment or distribution path.

Evidence requirements:

- Require at least one substantive source tied to the selected geographical area regardless of `${{ inputs.require_area_signal }}`.
- When the region groups several countries, do not treat one country's evidence as proof of the entire area's uniformity.
- Either support the regional mechanism through area-level or multi-country evidence, or narrow/correct the claim in the evidence island.

### `country-dependent`

The candidate originates from an area investigation, but its mechanism or feasibility depends materially on country- or municipal-level systems.

Common reasons:

- public administration, documents, permits, tax, benefits or licensing;
- national/municipal healthcare or insurance pathways;
- banking, payments, consumer-credit or financial regulation;
- transit, tolls, parking, vehicle rules or fines;
- school or childcare administration;
- local waste rules;
- privacy/data/compliance rules;
- country/provider data availability or API access.

Evidence requirements:

- Require at least one appropriate country-specific source for any country-specific mechanism being used to support the candidate.
- Preserve the investigation area, but identify which country/countries were actually checked.
- Explicitly list countries still requiring validation before scoring.
- Do not claim the whole area has the country-specific mechanism unless supported by appropriate evidence.

### Country-refinement timing rule

A `country-dependent` candidate may advance to normalization when:

- the problem and an initial relevant country mechanism are sufficiently supported;
- unsupported area-wide generalizations are removed or corrected;
- countries requiring further validation before scoring are explicitly listed.

It must **not** be treated as scoring-ready merely because it is normalization-ready. Downstream scoring must later enforce the listed country-validation requirement.

---

## Research procedure

### 1. Parse the candidate claims

Identify:

- affected user/persona;
- stated likely payer or economic beneficiary;
- failure moment and material consequence;
- proposed geographic area and applicability;
- areas compared and countries examined, if any;
- countries said to require validation before scoring;
- factual assertions requiring verification, including:
  - frequency or recurrence;
  - costs, fees, penalties or losses;
  - official steps, eligibility, deadlines or rules;
  - provider or platform structure;
  - available alternatives;
  - API, data-access or integration assumptions;
  - area-wide or country-specific assertions;
  - payer or willingness-to-pay assertions.

### 2. Validate the pain mechanism

Collect evidence for:

- what event triggers the failure;
- who experiences it;
- how the failure creates meaningful stakes;
- whether current workarounds are visibly inadequate or burdensome.

Do not turn an official process into a claim of frequent user pain unless another source supports that inference.

### 3. Validate the geographical framing

For the seeded area:

- determine whether evidence supports an area-shaped problem, a globally portable pain with an area entry wedge, or a country-dependent candidate;
- correct overbroad claims when only country-level evidence exists;
- examine comparison areas only when the seed issue indicates they were used to select this area or when needed to test a claim.

For a country-dependent candidate:

- verify at least one initial country mechanism where required;
- list remaining country-level checks required before scoring;
- never silently treat those unresolved checks as completed.

### 4. Assess startup relevance without designing a product

Assess whether evidence supports or weakens:

- material stakes;
- recurrence or repeated exposure;
- broken workaround;
- plausible payer/economic beneficiary;
- reachable first segment or channel in the selected area;
- software-enabled first value;
- heroic dependency risk;
- early wedge hypothesis.

These may remain hypotheses if explicitly identified as such. Pain evidence alone does not prove buyer demand.

### 5. Perform a narrow substitute check

Check obvious alternatives just far enough to avoid a clearly false underserved-gap claim.

Record:

- obvious regional or local substitute checked;
- whether it narrows, weakens or leaves open the opportunity hypothesis.

Full competitor research belongs to the later competitor stage.

### 6. Decide readiness

Use the evidence-ready gate below.

---

## Evidence-ready gate

Set `Verdict: ready-for-normalization` only when ALL are true:

1. The candidate identifies a clear affected user, JTBD, current workaround and concrete failure moment.
2. `Geographic area` and `Geographic applicability` are explicit and coherent after evidence review.
3. At least `${{ inputs.minimum_sources }}` independent sources support the candidate's core pain or failure mechanism.
4. Required geographical signal is satisfied:
   - for a concrete seeded area when `${{ inputs.require_area_signal }}` is `true`; or
   - always for `regional` candidates.
5. For a `country-dependent` candidate, at least one relevant country mechanism used to support the problem is sourced, and any further required country checks are explicitly listed as pre-scoring requirements.
6. Evidence supports material pain or a structurally meaningful failure mechanism; it does not merely indicate a possible product feature.
7. An identifiable likely payer or economic beneficiary is recorded, even when payment intent remains a hypothesis.
8. Initial software-enabled value does not rely on an unacknowledged heroic dependency, unavailable data source or unspecified regulatory permission.
9. Unsupported assumptions and the next validation-critical unknown are separated from supported claims.
10. No verified fact makes the core problem narrative materially misleading or invalid.

Set `Verdict: needs-more-evidence` whenever any mandatory condition fails.

A candidate does not need proven willingness to pay or full competitor validation to normalize. Those may remain explicit validation unknowns.

---

## Evidence island output

Write only inside:

`<!-- rw:evidence:start --> ... <!-- rw:evidence:end -->`

Use this structure:

```md
<!-- rw:evidence:start -->
### Evidence enrichment verdict
- Verdict: ready-for-normalization | needs-more-evidence
- Evidence status after enrichment: hypothesis-only | secondary-signalled | primary-validated
- Confidence: low | medium | high
- Geographic area: <area>
- Geographic applicability: globally-portable | regional | country-dependent
- Area-signal requirement: satisfied | not-satisfied | not-required
- Countries examined: <countries or none>
- Country validation before scoring: satisfied | outstanding | not-required
- Countries requiring validation before scoring: <countries or none>

### Claims checked
| Candidate claim | Assessment | Evidence / correction | Geographic relevance |
|---|---|---|---|
| ... | supported / partially-supported / unsupported / contradicted | ... | area / country / portable |

### Sources reviewed
| Source | Source type | Date / recency note | What it supports | Area / country |
|---|---|---|---|---|
| ... | official / research / reputable-report / product-page / qualitative-signal | ... | ... | ... |

### Startup relevance assessment
- Material stakes: strong | plausible | weak — ...
- Recurrence / repeated exposure: strong | plausible | weak — ...
- Broken workaround: strong | plausible | weak — ...
- Likely payer or economic beneficiary: ...
- Reachable initial segment/channel hypothesis in area: ...
- Software-enabled first value: ...
- Heroic dependency risk: low | medium | high — ...
- Early wedge hypothesis: ...

### Geographic assessment
- Why this area matters: ...
- Applicability correction, if any: ...
- Area-specific mechanism or signal: ...
- Country-level dependency, if any: ...
- Transferability beyond this area: ...
- Obvious area/country alternatives or substitutes checked: ...

### Unsupported assumptions / critical unknowns
- ...
- Next validation-critical unknown: ...
- Pre-scoring country-validation requirement: ...

### Recommendation
- Advance to normalization | Hold for additional evidence
- Why: ...
<!-- rw:evidence:end -->
```

Do not overwrite original seeded content or any other workflow island.

---

## If evidence is ready

When `Verdict: ready-for-normalization`:

1. Call `update_issue` on issue #${{ inputs.issue_number }} with:
   - `repo: ${{ github.repository }}`
   - `issue_number: ${{ inputs.issue_number }}`
   - `operation: replace-island`
   - only the complete `rw:evidence` island.
2. Call `add_labels` on issue #${{ inputs.issue_number }} for:
   - `stage/0-intake`
3. Call `remove_labels` on issue #${{ inputs.issue_number }} for:
   - `stage/0-evidence`
   - `status/needs-info` only when its blocking cause is now resolved.

A `country-dependent` candidate may be normalized while still carrying `Country validation before scoring: outstanding`; it must plainly list countries requiring verification before downstream scoring.

Do not add new area/evidence/readiness labels unless AGENTS.md defines them.

---

## If evidence is insufficient

When `Verdict: needs-more-evidence`:

1. Call `update_issue` with the complete `rw:evidence` island.
2. Call `add_labels` for:
   - `status/needs-info`
3. Keep:
   - `stage/0-evidence`
4. Optionally call `add_comment` once, listing only the precise unmet gate conditions, invalid regional claim or contradicted fact.

Do not advance to `stage/0-intake`.
Do not archive at this stage.

---

## Exploratory hypotheses

A candidate seeded with:

- `Evidence status: hypothesis-only`; and
- `Readiness: requires-evidence-enrichment`

may be promoted to `secondary-signalled` if external evidence now satisfies the gate.

If sufficient evidence cannot be found:

- preserve it as a hypothesis;
- document sources searched and what remained unsupported;
- add or retain `status/needs-info`;
- leave it at `stage/0-evidence`.

---

## Integrity and restraint rules

- Never invent or silently strengthen a claim.
- Never claim willingness to pay from pain evidence alone.
- Never claim a regional gap merely because quick searches did not find an alternative.
- Never treat an official rule as proof that many users experience the pain.
- Never treat one country as representative of an entire area without adequate support.
- Never infer MVP feasibility where first value depends on unverified API/data access, government cooperation, regulated permissions or mandatory partnerships.
- Clearly distinguish supported, partially-supported, unsupported and contradicted claims.
- Prefer a conservative hold decision over advancing an attractive but weakly grounded story.
- Preserve the purpose of later stages: normalization, scoring, software fit, competitor depth, wedge decisions and validation planning occur downstream.

Always emit at least one safe-output operation, or `noop`.
