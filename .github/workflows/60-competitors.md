---
name: "RW: Competitor Scan"
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
      maximum_direct_competitors:
        description: "Maximum confirmed direct competitors to record"
        required: true
        default: "10"
        type: string
      maximum_adjacent_alternatives:
        description: "Maximum adjacent products/substitutes to record"
        required: true
        default: "8"
        type: string

concurrency:
  group: rw-issue-${{ github.repository }}-${{ inputs.issue_number }}
  cancel-in-progress: false

run-name: "RW: Competitor Scan | issue #${{ inputs.issue_number }} | orch ${{ inputs.orchestration_id || 'n/a' }}"

engine:
  id: copilot
  model: ${{ vars.GH_AW_MODEL_AGENT_COPILOT || 'gpt-5.5' }}
  agent: rw-competitor-scout

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

# Competitor and substitute scan within the validated geographical scope

## Purpose

This stage researches the competitive and substitute landscape for a solution hypothesis **within the validated geographic scope** of the problem opportunity.

The pipeline discovers opportunities using geographical areas. A competitor scan is therefore incomplete unless it distinguishes:

- global products that are actually available or relevant in the selected area/country scope;
- regional or local direct competitors;
- country-specific alternatives where the opportunity is `country-dependent`;
- manual, institutional and non-software substitutes;
- whether the previously documented geographical distinction still creates a plausible opportunity.

This stage does **not**:

- re-score the problem;
- re-open evidence enrichment;
- redesign the solution;
- decide final wedge credibility;
- claim an underserved market from absence of search results.

Expected transition:

```text
stage/5-competitors → stage/6-shortlist
```

A complete, geographically scoped competitor scan enables the wedge stage to decide whether a credible market-entry wedge exists.

---

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Orchestration ID: `${{ inputs.orchestration_id }}`
- Maximum confirmed direct competitors to record: `${{ inputs.maximum_direct_competitors }}`
- Maximum adjacent alternatives/substitutes to record: `${{ inputs.maximum_adjacent_alternatives }}`

Before doing anything else:

- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY on issue #${{ inputs.issue_number }}.
- If the issue does not have labels `type/problem` and `stage/5-competitors`, or has label `agentic-workflows`, emit `noop` and stop.

---

## Tooling rules

### Repository reads

- Read the target issue using GitHub MCP issue tools only.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, local temp-file parsing, reconstructed MCP payloads or workflow-output files.
- Search/read other repository issues only when needed to understand a documented cluster or `regional-variant` relationship.
- If GitHub issue tools are unavailable, emit `noop` with reason `missing GitHub read tools` and stop.

### External competitor research

- Use Tavily MCP as the research source:
  - `tavily_search` for discovery and scoped queries;
  - `tavily_extract` for extracting useful source details where available;
  - `tavily_research` for a bounded synthesis only when needed.
- Search in relevant regional/local languages recorded in the issue where practical and material.
- Prefer first-party/official product pages for what a product offers, regions served, languages, integrations and public pricing.
- Use credible directories, app stores or comparison sites as discovery/support sources, but do not treat their listing alone as proof of actual market availability or feature coverage.
- Use reviews, forums or complaints only as qualitative signals about workflow gaps; never as proof of broad prevalence or demand.
- Do not use direct arbitrary-domain `web-fetch` in this workflow because the workflow is configured around Tavily MCP and firewall behavior may make arbitrary fetches unreliable.

### Research-unavailable fallback

If Tavily tools are unavailable at runtime:

- do not invent a competitor landscape;
- write a `rw:competitors` island with `Research status: needs-verification`, listing any upstream-stated alternatives only as unverified context;
- add `status/needs-info`;
- retain `stage/5-competitors`;
- do NOT advance to `stage/6-shortlist`.

A wedge decision must not be made from an unverified competitor scan.

---

## Mandatory completion and write-targeting rules

A successful run MUST end with safe-output operations or `noop`.

For every write action, explicitly target:

- `repo: ${{ github.repository }}`
- `issue_number: ${{ inputs.issue_number }}` for `update_issue`
- `item_number: ${{ inputs.issue_number }}` for `add_comment`
- `item_number: ${{ inputs.issue_number }}` for `add_labels`
- `item_number: ${{ inputs.issue_number }}` for `remove_labels`

Valid endings:

### Complete competitor scan

- `update_issue` with the complete `rw:competitors` island;
- `add_labels` for `stage/6-shortlist`;
- `remove_labels` for `stage/5-competitors`;
- optionally remove `status/needs-info` only when no other visible blocker remains.

### Research unavailable or upstream handoff blocked

- `update_issue` with a `needs-verification` island when research was attempted but unavailable; or
- `add_comment` when the necessary upstream handoff is missing;
- `add_labels` for `status/needs-info`;
- retain `stage/5-competitors`.

### Ineligible issue

- `noop`.

Do not end with prose-only output.

---

## Required upstream handoff

This stage occurs after scoring, solution drafting and AI-defensibility review. Before competitor research, the target issue MUST contain:

Each required upstream island may appear either as the full island block or as the matching completion marker `<!-- gh-aw-island-end:<stage-file> -->`, where `<stage-file>` is the upstream workflow filename without `.md`.

If issue-read output does not include HTML comments, treat upstream handoff as present when the matching generated section heading is present with substantive content:

- Evidence: `### Evidence enrichment verdict`
- Normalized problem: `### Normalized problem`
- Dedupe: `### Dedupe and cluster decision`
- Software fit: `### Software fit decision`
- Scorecard: `### Problem attractiveness scorecard`
- Solution: `### Solution hypothesis`
- AI defensibility: `### AI defensibility scorecard`

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

5. Scorecard island:
   - `<!-- rw:scorecard:start --> ... <!-- rw:scorecard:end -->`
  - or `<!-- gh-aw-island-end:40-score -->`

6. Solution island:
   - `<!-- rw:solution:start --> ... <!-- rw:solution:end -->`
  - or `<!-- gh-aw-island-end:50-solution -->`

7. AI-defensibility island:
   - `<!-- rw:ai-defensibility:start --> ... <!-- rw:ai-defensibility:end -->`
  - or `<!-- gh-aw-island-end:55-ai-defensibility -->`

8. Country-validation island when the scored opportunity is country-dependent and earlier required a pre-scoring gate:
   - `<!-- rw:country-validation:start --> ... <!-- rw:country-validation:end -->`
  - or `<!-- gh-aw-island-end:35-country-validation -->`

### Required geographic and opportunity values

The upstream content must identify:

- JTBD and documented failure moment;
- solution/MVP shape and intended wedge hypothesis;
- evidence confidence and corrected claims;
- `Geographic area: <area>`;
- `Geographic applicability: globally-portable|regional|country-dependent`;
- `Scoring geographic scope: <area or verified country/countries>`;
- `Country-validation gate: not-required|satisfied-upstream|satisfied-by-country-validation`;
- dedupe disposition: `not-duplicate|regional-variant|possible-near-duplicate`;
- likely payer/economic beneficiary or intended ICP;
- relevant dependency limitations and AI-defensibility concerns.

### Country-gate integrity check

For a `country-dependent` scored issue:

- require an honest verified scoring scope;
- if prior routing required country validation, require `rw:country-validation` with `Gate status: satisfied`;
- do not research competitors for unvalidated countries as though they are part of the launch/scoring scope.

### Blocked handoff

If required islands or geographic/scoring-scope values are missing, contradictory or imply unresolved country validation:

1. Call `add_comment` listing exact missing/inconsistent handoff information.
2. Call `add_labels` for `status/needs-info`.
3. Do not write a substantive competitor decision.
4. Do not change stage.

---

## Source-of-truth precedence

Use:

1. `rw:country-validation`, when present, for resolved country scope and what must not be generalized.
2. `rw:scorecard` for validated scoring scope and the attractiveness constraints carried forward.
3. `rw:solution` for the product hypothesis being compared.
4. `rw:ai-defensibility` for AI-substitute and commoditization concerns.
5. `rw:normalized`, `rw:evidence`, `rw:dedupe` and `rw:software-fit` for problem identity, corrections, regional-variant context and dependency history.

Do not rewrite prior islands.

---

## Competitor identity model

Classify findings into these categories:

### 1. Direct competitor

A product or service addressing substantially the same primary JTBD/failure moment for the same or closely overlapping buyer/user in the validated geographic scope.

A product can be direct only when:

- its relevance to the JTBD is supported; and
- its availability or practical applicability in the scoring scope is `confirmed` or clearly described as `unclear`.

### 2. Adjacent competitor

A product addressing part of the workflow, an adjacent step or a different user segment/payer, but potentially reducing need for the proposed product.

### 3. Substitute / workaround

A non-direct solution users may choose instead, including:

- spreadsheets, messaging, email or manual coordination;
- employer/provider/municipality portals;
- hiring a professional or managed service;
- generic AI plus existing tools;
- local community/institutional support;
- bundled feature in an incumbent product.

### 4. AI substitute

A generic or vertical AI product that might perform the proposed value sufficiently well, particularly where upstream AI-defensibility is medium/weak.

---

## Geographic research requirements

## For `globally-portable`

Research:

- direct/global products relevant to the evidenced initial scoring scope;
- whether those products are actually available/relevant in the first area;
- local substitutes in the initial area;
- whether the supposed portable value is already commoditized.

Do not perform exhaustive global research or conclude global market gaps.

## For `regional`

Research:

- global products available or usable in the area;
- area-specific/local competitors in relevant languages;
- local substitutes/workarounds;
- whether the area-specific mechanism survives comparison with available offerings;
- whether the differentiated area opportunity is supported, narrowed or weakened by competition.

Do not conclude no regional competitor exists merely because English queries were thin.

## For `country-dependent`

Research only within the verified scoring/launch scope:

- country-specific direct products and institutional alternatives;
- global products actually usable in the verified country scope;
- official or bundled service substitutes;
- local-language alternatives where material;
- local data/API/provider constraints only insofar as they alter the comparison.

Do not generalize the competitor landscape from the verified country to the broader investigation area.

## For `regional-variant`

The scan must state whether competition:

- supports the variant as meaningfully distinct;
- narrows the distinction;
- weakens the claimed difference;
- leaves it unresolved.

Do not reclassify dedupe status here; hand the evidence to wedge evaluation.

---

## Search procedure

### 1. Parse the comparison scope

From upstream islands, extract:

- problem JTBD/failure moment;
- target user and payer/ICP;
- solution/MVP shape and wedge hypothesis;
- geographical area and applicability;
- validated scoring/launch scope;
- source language(s), if preserved in the issue body;
- regional-variant or near-duplicate context;
- AI-defensibility risks;
- key dependencies and scope limitations.

### 2. Form search query families

Run focused queries covering, as appropriate:

- JTBD/problem terms + product/software/service + area/country;
- solution category terms + area/country;
- local-language equivalents of the pain and product type;
- buyer/industry terms + workflow/problem + area/country;
- institutional/manual substitute terms;
- generic AI or vertical AI substitute terms where the solution could be AI-replaceable;
- named upstream competitor/substitute references for verification.

Avoid relying on one query or one language.

### 3. Verify direct competitors

For plausible direct competitors:

- find official or credible supporting pages;
- verify what the offering does;
- identify target user/buyer where possible;
- find pricing signal only when publicly visible;
- assess availability/relevance in validated scope:
  - `confirmed`;
  - `likely`;
  - `unclear`;
  - `not-available/not-relevant`.
- record source and confidence.

Do not force the table to reach three entries. Zero confirmed direct competitors is allowed when search coverage is documented, but it does not prove a gap.

### 4. Verify adjacent alternatives and substitutes

Research relevant:

- adjacent software;
- manual workarounds;
- institutional/provider portals or bundled features;
- local service providers;
- generic AI plus existing tools;
- country/area-specific substitutes.

Describe how each addresses or fails to address the exact failure moment.

### 5. Form gap hypotheses conservatively

A gap statement must be written as:

- `supported observation` only when explicit evidence shows the limitation; or
- `gap hypothesis` when inferred from product scope/search findings; or
- `unknown requiring validation` when evidence is insufficient.

Never use “no competitor,” “underserved,” “white space,” “unserved,” or “observed gap” without adequate supporting evidence and scope qualification.

### 6. Determine research completeness

Use exactly one:

- `complete-for-wedge-review` — sufficient scoped research exists for the next wedge stage to assess a narrow entry path.
- `needs-verification` — research tools are unavailable, scope cannot be checked, or critical availability/comparison evidence is missing.
- `material-competition-warning` — scoped research is complete enough to proceed, but a strong competitor/substitute materially challenges the solution/wedge hypothesis.

`material-competition-warning` still proceeds to wedge review; wedge stage owns disposition.

---

## Competitor island output

Write only inside:

`<!-- rw:competitors:start --> ... <!-- rw:competitors:end -->`

Use this exact structure:

```md
<!-- rw:competitors:start -->
### Competitor research scope
- **Research status:** complete-for-wedge-review | needs-verification | material-competition-warning
- **Geographic area:** <area>
- **Geographic applicability:** globally-portable | regional | country-dependent
- **Validated market scope researched:** <area or verified country/countries>
- **Countries researched, if applicable:** <countries or none>
- **Source languages used:** <languages>
- **Dedupe/variant status inherited:** not-duplicate | regional-variant | possible-near-duplicate
- **AI-defensibility context:** strong | medium | weak — <relevant implication>

### Search coverage
| Query theme / source language | Scope searched | Purpose | Result summary |
|---|---|---|---|
| ... | ... | direct / local / substitute / AI substitute / verification | ... |

### Direct competitors in validated scope
| Competitor | What it does / same JTBD link | Target user or buyer | Availability in scoped market | Pricing signal | Evidence source | Confidence |
|---|---|---|---|---|---|---|
| ... | ... | ... | confirmed / likely / unclear / not-relevant | ... | ... | high / medium / low |

### Adjacent competitors and substitutes
| Alternative | Type | How it addresses the failure moment | Relevance in scoped market | Evidence source | Implication |
|---|---|---|---|---|---|
| ... | adjacent software / institutional / manual / service / AI substitute | ... | ... | ... | ... |

### Geographic competitive assessment
- **Global products available/relevant in scope:** ...
- **Regional/local competitors found:** ...
- **Country-specific alternatives found, if applicable:** ...
- **Does competition support the regional/country-dependent distinction?:** supports | narrows | weakens | unresolved — ...
- **What must not be generalized beyond researched scope:** ...

### Gap hypotheses and risks
| Finding | Type | Evidence basis | Confidence | Implication for wedge review |
|---|---|---|---|---|
| ... | supported observation / gap hypothesis / unknown / material competitive risk | ... | low / medium / high | ... |

### Recommendation for wedge stage
- **Proceed to wedge review:** yes | no-needs-verification
- **Most credible remaining differentiation hypothesis:** ...
- **Strongest competitive threat or substitute:** ...
- **Critical competitor question still unresolved:** ...
<!-- rw:competitors:end -->
```

### No-result rule

When no confirmed direct competitor is found:

- include the search coverage performed;
- state `No confirmed direct competitor identified in this scoped search; this is not proof that none exists.`;
- set any gap inference to `gap hypothesis` or `unknown`, never a proven observation.

---

## If research is complete enough for wedge review

When `Research status` is `complete-for-wedge-review` or `material-competition-warning` and `Proceed to wedge review: yes`:

1. Call `update_issue` on issue #${{ inputs.issue_number }} with:
   - `repo: ${{ github.repository }}`
   - `issue_number: ${{ inputs.issue_number }}`
   - `operation: replace-island`
   - only the complete `rw:competitors` island.
2. Call `add_labels` for:
   - `stage/6-shortlist`
3. Call `remove_labels` for:
   - `stage/5-competitors`
   - `status/needs-info` only if no other visible blocker remains.

Do not add new competition, geography or market-gap labels.

---

## If research is not sufficient

When `Research status` is `needs-verification`:

1. Call `update_issue` with the complete `rw:competitors` island when research status and missing verification can be accurately described.
2. Call `add_labels` for:
   - `status/needs-info`
3. Keep:
   - `stage/5-competitors`
4. Optionally call `add_comment` once identifying the precise missing research capability or critical availability verification.

Do not advance to wedge review.

---

## Integrity principles

- Research competitors in the validated geographic scope, not in an imagined broad market.
- Global products are competitors only when relevant or plausibly available to the scoped users.
- Local-language discovery matters when the opportunity depends on an area/country-specific workflow.
- Absence of results is not evidence of a market gap.
- A strong incumbent is a useful finding, not a reason to soften evidence.
- Preserve geographical and AI-defensibility constraints so the wedge stage can make an honest decision.

Always emit at least one safe-output operation, or `noop`.
