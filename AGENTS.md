# RealWorldProblems – Agent Operating Manual (AGENTS.md)

This repository is an **agent-driven pipeline** for discovering, evaluating and validating real-world problems and potential software startup opportunities.

Agents operate on GitHub Issues (`type/problem`) and move them through structured stages using labels and structured editable islands inside issue bodies.

The pipeline investigates problems primarily through **geographical areas** rather than countries. Country-level refinement is required only where national or municipal systems materially determine the pain, solution feasibility or opportunity.

---

## 0) Core principles

1. **One problem per issue.**  
   Problem candidates are tracked as `type/problem`.

2. **State machine via labels.**  
   Each active problem issue has exactly **one** `stage/*` label at a time.

3. **Evidence before normalization and scoring.**  
   A seeded candidate must pass evidence enrichment before normalization. A country-dependent candidate must complete any required country-level validation before attractiveness scoring.

4. **Geographical area first; country only when causally necessary.**  
   The primary investigation unit is a geographical area such as `north-america`, `arabic-middle-east` or `western-europe`. Do not fragment discovery into countries unless rules, public services, payments, insurance, data access, infrastructure or local incumbents materially determine the problem.

5. **No unsupported generalization.**  
   Evidence from one country does not establish a conclusion about an entire geographical area unless appropriate multi-country or area-level support exists.

6. **No free-form workflow edits.**  
   Agents must write substantive stage results only inside predefined **islands** using `update-issue` with `operation: replace-island`. Never overwrite user-authored content outside islands.

7. **Safe outputs or noop.**  
   Every workflow run must emit at least one safe-output operation or an explicit `noop`.

8. **Be explicit when archiving.**  
   Any archived issue must have exactly one `archive/*` reason label.

9. **Persona and domain hygiene.**  
   Every normalized-or-later active problem must have:
   - exactly one `persona/*` label, or `status/needs-info` while blocked;
   - 1–3 `domain/*` labels, or `status/needs-info` while blocked.

10. **Progressive filtering toward high-quality opportunities.**  
    Each stage reduces uncertainty, filters weak candidates or sharpens the next decision. Agents must not turn uncertain hypotheses into confident claims merely to move an issue forward.

11. **AI should support durable workflow value.**  
    Solution hypotheses should prefer workflow ownership, execution, integration, data accumulation and credible distribution over thin AI wrappers.

---

## 1) Canonical labels

### Type: exactly one primary type per issue

- `type/problem`
- `type/report`
- `type/experiment`
- `type/cluster` — optional meta issue

### Stage: exactly one per problem issue

- `stage/0-evidence`
- `stage/0-intake`
- `stage/1-normalized`
- `stage/2-deduped`
- `stage/2.5-country-validation`
- `stage/3-scored`
- `stage/4-solution`
- `stage/ai-defensibility`
- `stage/5-competitors`
- `stage/6-shortlist`
- `stage/7-validation`
- `stage/7.1-validated`
- `stage/8-selected`
- `stage/9-archived`

### Stage semantics

| Stage | Meaning |
|---|---|
| `stage/0-evidence` | Seeded problem candidate exists and requires the formal evidence-enrichment gate before normalization. |
| `stage/0-intake` | Evidence enrichment passed; issue is ready to be normalized into the canonical problem structure. |
| `stage/1-normalized` | Problem is expressed in canonical JTBD form with evidence and geographical framing preserved. |
| `stage/2-deduped` | Duplicate check is complete; issue is ready for software-fit evaluation. Meaningful geographical variants may remain separate. |
| `stage/2.5-country-validation` | Software-fit passed, but a `country-dependent` candidate still requires explicit country-level validation before scoring. |
| `stage/3-scored` | Issue is eligible for or has just completed problem-attractiveness scoring under the existing workflow conveyor; no pre-scoring country-validation gate may remain outstanding. |
| `stage/4-solution` | Problem scoring passed sufficiently for a solution hypothesis to be drafted. |
| `stage/ai-defensibility` | Drafted solution is evaluated for durability against AI commoditization. |
| `stage/5-competitors` | Direct competitors, substitutes and market context are researched in the relevant geographical area/country scope. |
| `stage/6-shortlist` | Wedge quality is decided: credible entry wedge vs weak wedge. |
| `stage/7-validation` | Next validation experiment is to be planned for a wedge-credible opportunity. |
| `stage/7.1-validated` | Validation plan has been created and an experiment is defined or ready to run. |
| `stage/8-selected` | Opportunity is chosen for focused execution/incubation. |
| `stage/9-archived` | Opportunity is removed from the active pipeline with exactly one archive reason. |

### Status

- `status/needs-info`
- `status/duplicate`
- `status/blocked`
- `status/shortlisted`

### Software fit

- `software-fit/yes`
- `software-fit/partial`
- `software-fit/no`

Interpretation:

- `software-fit/yes` — software can deliver most of the value end-to-end.
- `software-fit/partial` — software can deliver meaningful value, but meaningful non-software elements remain, such as human operations, hardware, field work, constrained data access, partnerships or local integrations.
- `software-fit/no` — software is not a sufficiently strong primary product lever.

Software-fit routing:

- `software-fit/no` → archive with `archive/not-software`.
- `software-fit/yes` or `software-fit/partial` with no outstanding pre-scoring country gate → proceed to scoring entry.
- `software-fit/yes` or `software-fit/partial` with `Country validation before scoring: outstanding` → proceed to `stage/2.5-country-validation`, not scoring.

### Score buckets

- `score/top-10`
- `score/top-50`
- `score/long-tail`

### Wedge quality

- `wedge/credible`
- `wedge/weak`

### Risk

- `risk/high`
- `risk/medium`
- `risk/low`

### AI defensibility labels

- `ai-defensibility/strong`
- `ai-defensibility/medium`
- `ai-defensibility/weak`

### AI risk labels

- `ai-risk/low`
- `ai-risk/medium`
- `ai-risk/high`

### Archive reasons: exactly one when archived

- `archive/not-software`
- `archive/low-pain`
- `archive/unreachable-users`
- `archive/too-regulated`
- `archive/too-dependent-on-partners`
- `archive/no-wedge`
- `archive/other`

Rules:

- Duplicate issues use `status/duplicate` plus `archive/other`; do not create or expect `archive/duplicate`.
- Weak AI defensibility alone is not an archive reason.

### Domain: 1–3 after normalization

- `domain/home`
- `domain/health`
- `domain/finance`
- `domain/work`
- `domain/education`
- `domain/travel`
- `domain/family`
- `domain/food`
- `domain/mobility`
- `domain/shopping`
- `domain/admin-bureaucracy`
- `domain/security-privacy`

### Persona: exactly one after normalization

- `persona/consumer`
- `persona/family-parent`
- `persona/student`
- `persona/employee`
- `persona/freelancer`
- `persona/smb-owner`
- `persona/enterprise`
- `persona/senior`

### Marketing and sales complexity

- `marketing-sales/very-easy`
- `marketing-sales/easy`
- `marketing-sales/medium`
- `marketing-sales/hard`
- `marketing-sales/very-hard`

Optional `cluster/<slug>` labels may be used only when repository owners have pre-created and approved them. Otherwise store cluster membership in the `rw:dedupe` island.

### Geography-label policy

Do **not** introduce `geo/*`, `area/*`, `market/*`, `evidence/*`, `readiness/*` or country-validation labels at this stage. The geography/evidence taxonomy is evolving and must be stored inside issue islands until a future policy explicitly adds canonical labels.

---

## 2) Islands: the only substantive places agents may edit

Agents MUST update only their owned island content using `replace-island` semantics and must not rewrite user-authored content outside islands.

### Evidence enrichment

```md
<!-- rw:evidence:start -->
<!-- rw:evidence:end -->
```

Owner: Evidence enrichment stage.  
Purpose: traceable evidence verdict, geographical applicability, country-refinement requirements, supported/corrected claims and readiness for normalization.

### Normalized problem

```md
<!-- rw:normalized:start -->
<!-- rw:normalized:end -->
```

Owner: Normalization stage.  
Purpose: concise canonical working problem definition preserving evidence and geographical handoff.

### Dedupe / cluster

```md
<!-- rw:dedupe:start -->
<!-- rw:dedupe:end -->
```

Owner: Dedupe stage.  
Purpose: duplicate vs distinct vs meaningful regional-variant disposition and cluster relationship.

### Software fit

```md
<!-- rw:software-fit:start -->
<!-- rw:software-fit:end -->
```

Owner: Software-fit stage.  
Purpose: whether software is the main product lever, including local dependency feasibility where relevant.

### Country validation

```md
<!-- rw:country-validation:start -->
<!-- rw:country-validation:end -->
```

Owner: Conditional country-validation stage.  
Purpose: verify the named country-level mechanisms required before scoring a `country-dependent` candidate.

### Scorecard

```md
<!-- rw:scorecard:start -->
<!-- rw:scorecard:end -->
```

Owner: Scoring stage.  
Purpose: attractiveness score for the problem in its validated geographical scope.

### Solution hypothesis

```md
<!-- rw:solution:start -->
<!-- rw:solution:end -->
```

Owner: Solution stage.  
Purpose: a focused product hypothesis and MVP scope appropriate to the geographical opportunity.

### AI defensibility scorecard

```md
<!-- rw:ai-defensibility:start -->
<!-- rw:ai-defensibility:end -->
```

Owner: AI defensibility stage.  
Purpose: durability against AI commoditization.

### Competitors and substitutes

```md
<!-- rw:competitors:start -->
<!-- rw:competitors:end -->
```

Owner: Competitor stage.  
Purpose: area/country-relevant direct competitors, alternatives, substitutes and gap hypotheses.

### Wedge decision

```md
<!-- rw:wedge:start -->
<!-- rw:wedge:end -->
```

Owner: Wedge stage.  
Purpose: credibility of a narrow initial market-entry wedge in the chosen geographical scope.

### Validation plan

```md
<!-- rw:validation:start -->
<!-- rw:validation:end -->
```

Owner: Validation stage.  
Purpose: focused experiment addressing the most decision-critical remaining uncertainty.

### Steward notes

```md
<!-- rw:steward:start -->
<!-- rw:steward:end -->
```

Owner: Stewardship only.  
Purpose: automation/hygiene fixes and unresolved structural concerns.

### Marketing and sales complexity

```md
<!-- rw:marketing-sales:start -->
<!-- rw:marketing-sales:end -->
```

Owner: any approved marketing/sales assessment workflow.  
Purpose: orthogonal acquisition/sales complexity assessment; does not advance pipeline stage by itself.

### Optional manual expansion analysis

```md
<!-- rw:expansion:start -->
<!-- rw:expansion:end -->
```

Purpose: manual assessment of credible expansion to broader actors, workflows or adjacent cases.

Rules:

- Optional/manual only; not a pipeline stage.
- Does not advance or archive issues.
- Does not add or remove labels.
- Must be conservative when broader scope would constitute a different product or geographical market.

---

## 3) Seeded problem candidate contract

New seeded issues are created at `stage/0-evidence`.

Every seed candidate should include a clear problem framing:

- `**JTBD:** When ..., I want ..., so I can ...`
- `**Context & frequency:**`
- `**Pain / stakes:**`
- `**Current workaround:**`
- `**Failure moment:**`
- `**Why software may help:**`

### Required seed evidence and startup framing

Each seeded issue should include:

- `**Evidence status:** hypothesis-only | secondary-signalled | primary-validated`
- `**Readiness:** ready-for-evidence-gate | requires-evidence-enrichment`
- evidence source table when any external/primary evidence is claimed;
- unsupported assumptions requiring validation;
- affected user;
- likely payer/economic beneficiary;
- material consequence;
- recurrence signal;
- reachable first segment/channel;
- MVP-without-heroic-dependencies assessment;
- critical unknown to validate next.

Evidence status meaning:

- `hypothesis-only` — plausible framing without sufficient traceable evidence.
- `secondary-signalled` — supported by traceable external sources but not direct project primary validation.
- `primary-validated` — explicit primary material exists in repository content: interviews, surveys, pilot outcomes, support-ticket analysis or direct complaint intake.

Public web sources remain secondary evidence.

### Required seed geographic framing

Every seeded issue should include:

- `**Geographic area:** <area>`
- `**Geographic applicability:** globally-portable | regional | country-dependent`
- `**Areas compared, if any:** <areas or none>`
- `**Countries examined, if any:** <countries or none>`
- `**Countries requiring validation before scoring, if any:** <countries or none>`
- `**Source language(s):** <languages>`
- `**Why this area matters:**`
- `**Area-specific pain signal:**`
- `**Country-level dependency, if any:**`
- `**Transferability beyond this area:**`
- `**Area-specific competitor/substitute note:**`

### Required seed classification lines

Each seeded issue should contain explicit parseable lines:

- `Domain: <domain>`
- `Theme: <theme>`
- `Subtheme: <subtheme>`
- `Catalog status: <catalog|off-catalog>`
- `Persona: <persona>`
- `Archetype: <archetype>`
- `Geographic area: <area>`
- `Geographic applicability: <globally-portable|regional|country-dependent>`

---

## 4) Geographic-area model

### Primary investigation concept

The primary geography for problem discovery is a **geographical area**. Supported initial investigation areas include:

- `global-portable`
- `north-america` — USA and Canada
- `latin-america`
- `israel`
- `arabic-middle-east`
- `arabic-north-africa`
- `sub-saharan-africa`
- `western-europe`
- `eastern-europe`
- `russia-belarus`
- `caucasus`
- `central-asia`
- `turkey`
- `iran`
- `southern-asia`
- `southeast-asia`
- `china`
- `japan`
- `south-korea`
- `australia-new-zealand`
- an explicitly named custom area

This catalog is an investigation scaffold, not an assertion of homogeneity within an area.

### Geographic applicability

Each problem must eventually use exactly one applicability value:

#### `globally-portable`

The pain and software-value mechanism plausibly transfer across multiple areas. The selected area is mainly an initial discovery, validation or distribution wedge.

Rules:

- Do not state global prevalence as established without evidence.
- Later validation should still identify the first area/segment where initial testing occurs.

#### `regional`

The geographical area materially shapes the pain or startup opportunity through factors such as:

- language or documentation;
- business/service-provider structure;
- cultural or workflow pattern;
- payments or technology usage;
- substitute availability;
- acquisition/distribution channels;
- supported severity or recurrence.

Rules:

- Require area-tied or appropriate multi-country evidence.
- Do not generalize a single country's mechanism to the entire area.

#### `country-dependent`

The candidate originated from geographical-area exploration, but its pain mechanism or product feasibility depends materially on national or municipal conditions.

Typical country-dependent causes:

- government forms, permits, identity documents, tax, benefits or business licensing;
- healthcare coverage/reimbursement or insurance pathways;
- banking, credit or payment regulation;
- transport fines, tolls, parking, licensing or public mobility policy;
- school or childcare administration controlled locally/nationally;
- waste disposal and municipal collection rules;
- privacy, data residency or compliance requirements;
- country/provider-specific APIs, data sources or integration permissions.

Rules:

- Preserve the geographic area as discovery context.
- Identify checked countries.
- Explicitly list further countries or country-level mechanisms requiring validation before scoring.
- Country-dependent problems may normalize and dedupe before all named country validation is complete, but they must not be scored while the pre-scoring gate is outstanding.

### Geographic variant rule

A similar problem in a different area is not automatically a new opportunity. Keep a distinct regional/country-dependent variant only when evidence indicates a material difference in:

- workflow/failure mechanism;
- payer/buyer;
- distribution route;
- substitutes;
- language/documentation/identity constraint;
- regulation, public-system, payment, data-access or integration context;
- severity or recurrence.

Otherwise treat it as a duplicate or near-duplicate of the same actionable opportunity.

---

## 5) Evidence enrichment and country-validation gates

### Evidence enrichment gate

Before normalization, the `rw:evidence` island must record:

- verdict: `ready-for-normalization` or `needs-more-evidence`;
- evidence status after enrichment;
- confidence;
- geographic area;
- geographic applicability;
- area-signal status;
- countries examined;
- country-validation-before-scoring status;
- countries requiring validation before scoring;
- claims checked;
- sources reviewed;
- startup relevance assessment;
- unsupported assumptions;
- next validation-critical unknown;
- recommendation.

An issue may move from `stage/0-evidence` to `stage/0-intake` only when:

- verdict is `ready-for-normalization`;
- status is `secondary-signalled` or `primary-validated`;
- required area evidence is satisfied;
- the core problem mechanism is supported;
- a likely payer/economic beneficiary is identified without overclaiming;
- software-first value has no undisclosed heroic dependency.

### Country-validation-before-scoring gate

A `country-dependent` candidate may have:

- `Country validation before scoring: outstanding`

Such a candidate may:

- advance to normalization;
- advance through dedupe;
- undergo software-fit assessment.

It must not:

- receive problem-attractiveness scoring;
- advance to solution drafting;
until the named country-level checks are completed.

If software-fit is `yes` or `partial` and country validation remains outstanding:

- route to `stage/2.5-country-validation`.

The `rw:country-validation` island must record:

- relevant geographical area;
- countries/checks required by earlier islands;
- country-level claims checked;
- sources reviewed;
- corrections;
- whether the pre-scoring gate is `satisfied` or remains `outstanding`;
- recommendation: advance to scoring or hold.

Only a satisfied country-validation gate permits routing to `stage/3-scored`.

---

## 6) Required normalized problem structure

After normalization, a problem must have a `rw:normalized` island containing:

### Normalized problem

- JTBD one-liner: `When __, I want __, so I can __.`
- Context and frequency.
- Pain and stakes.
- Current workaround.
- Trigger/failure moment.
- Why software may help.

### Evidence and geographical framing

- Evidence status: `secondary-signalled` or `primary-validated`.
- Evidence confidence: `low|medium|high`.
- Brief evidence basis; detailed evidence remains in `rw:evidence`.
- Geographic area.
- Geographic applicability.
- Why the area matters.
- Area-specific mechanism or signal.
- Countries examined.
- Country-validation-before-scoring status.
- Countries requiring validation before scoring.
- Pre-scoring geographic gate.
- Likely payer/economic beneficiary, labelled as a hypothesis unless primary-supported.
- Next validation-critical unknown.
- Evidence cautions/corrected claims.

### Classification

- Persona.
- Domain.
- Theme.
- Subtheme.
- Catalog status.
- Archetype.
- Geographic area.
- Geographic applicability.

Normalization stage responsibilities:

- ensure exactly one `persona/*` label;
- ensure 1–3 `domain/*` labels;
- preserve evidence/geographical conclusions from `rw:evidence`;
- never restore seeded claims that evidence marked unsupported or contradicted;
- never treat an outstanding country-validation gate as satisfied.

If mandatory normalized data cannot be resolved confidently, add `status/needs-info` and do not advance.

---

## 7) Dedupe and regional-variant policy

The dedupe stage compares:

1. **Core problem identity**
   - JTBD;
   - affected persona;
   - failure moment;
   - stakes;
   - workaround;
   - managed/verified/coordinated object;
   - payer/economic beneficiary;
   - likely software-value mechanism.

2. **Geographical opportunity identity**
   - geographic area and applicability;
   - area-specific mechanism;
   - countries examined/required;
   - regulation/public systems/payments/data/integration dependencies;
   - provider/institution structure;
   - language/documentation constraints;
   - substitutes;
   - distribution route.

Valid dedupe decisions:

- `duplicate`
- `not-duplicate`
- `regional-variant`
- `possible-near-duplicate`

Rules:

- Only `duplicate` is archived.
- A geographical-area name change alone does not justify retaining an issue.
- A supported regional/country-dependent mechanism may justify a separate `regional-variant`.
- A clearly listed outstanding country-validation gate is not a dedupe blocker; it must be preserved in the dedupe island.
- When uncertain whether geographic distinction is material, prefer `possible-near-duplicate` over premature archive.

---

## 8) Software-fit gate

The software-fit stage determines whether software is a sufficiently strong main lever for the evidence-supported problem in its geographical scope.

It must consider:

- whether first value can be delivered without unavailable APIs, official integrations, data permissions or mandatory partnerships;
- whether a regional/country-dependent constraint makes delivery partial or impractical;
- whether local data, language or process differences change product feasibility.

Output must state:

- `Decision: yes|partial|no`;
- why;
- non-software components;
- key dependency risks;
- geographic implications for feasibility;
- country-validation-before-scoring status preserved from upstream.

Routing:

- `software-fit/no` → archive with `archive/not-software`.
- `software-fit/yes|partial` and no outstanding country gate → proceed to `stage/3-scored`.
- `software-fit/yes|partial` and outstanding country gate → proceed to `stage/2.5-country-validation`.

---

## 9) Scoring rubric: problem attractiveness in validated geographical scope

Score only when:

- software fit is `yes` or `partial`;
- `rw:evidence`, `rw:normalized`, `rw:dedupe` and `rw:software-fit` are sufficiently complete;
- for `country-dependent` candidates, country validation before scoring is `satisfied` and `rw:country-validation` is complete.

Agents fill a scorecard for **problem attractiveness** in the evidenced geographical scope: six dimensions, each 1–5, maximum 30.

1. **Severity**
   - How painful or costly the problem is when it happens in the investigated area/country scope.

2. **Frequency**
   - How often the evidenced target user experiences the pain or how repeatedly exposed the segment is.

3. **Urgency / failure cost**
   - Whether action is time-sensitive and what happens if the user does nothing.

4. **Willingness to pay / strong proxy**
   - Direct payment evidence or a strong proxy such as protected revenue, avoided penalties, meaningful labour savings or risk reduction.
   - Pain alone is not proof of willingness to pay.

5. **Reachability**
   - How realistically first users/buyers can be reached in the selected geographical area and initial segment.

6. **Feasibility**
   - How quickly an MVP can create real software value in the validated geographic context.

Interpretation:

- 1 = very weak.
- 3 = medium or uncertain.
- 5 = strong evidence or clear case.

Important rules:

- Score the **problem attractiveness**, not the final company outcome.
- Do not score wedge credibility here; wedge is evaluated later.
- Score in the specified geographic area/country scope, not generically.
- Do not score a country-dependent issue while its country-validation-before-scoring gate is outstanding.
- Use conservative scoring when evidence is weak or geographic transferability is uncertain.
- If software fit is `partial`, feasibility should rarely exceed 3 unless non-software dependencies are minor.
- If delivery depends on difficult data access, integrations, partnerships, approvals, hardware or local compliance, reduce reachability and/or feasibility and increase risk.
- A `regional-variant` must be scored on the distinct regional opportunity documented upstream, not on generic market assumptions.

Scorecard must include:

- Geographic area.
- Geographic applicability.
- Country-validation gate: `satisfied|not-required`.
- Geographic score limitations or expansion assumptions.
- Evidence and confidence.
- Risk and constraints.

Buckets:

- `score/top-10`: total ≥ 24 and confidence is not low.
- `score/top-50`: total 20–23, or total ≥ 24 with confidence low.
- `score/long-tail`: total ≤ 19, or total 20–23 with confidence low.

Risk label:

- `risk/high`: regulated, partnership-dependent, difficult data access, hardware-heavy, country-validation uncertainty, or heavy operational complexity.
- Otherwise apply `risk/medium` or `risk/low` conservatively.

---

## 10) Solution drafting rule

Solution agents must default toward **AI-defensible products** grounded in the validated geographical opportunity.

### Prefer

- workflow ownership;
- systems of execution;
- monitoring/alerts where failure is time-sensitive;
- integrations only when access is verified or explicitly treated as an assumption;
- structured memory/data accumulation;
- narrow initial geographical-area and segment wedges;
- product requirements tied to documented language, workflow or local-system constraints.

### Avoid by default

- “ChatGPT for X”;
- summarization-only;
- drafting-only;
- generic copilots;
- “better UI on LLM”;
- assuming an area-wide product based on a single country mechanism;
- designing around unverified public-system or payment integrations.

### Required geographic fit

A solution hypothesis should state:

- geographical area;
- geographic applicability;
- area-specific product requirement, when any;
- country-dependent constraints already validated, where applicable;
- expansion assumptions beyond the initial area.

### Mandatory self-check

> If a much better LLM appears tomorrow, why does this product still matter?

If weak, redesign.

---

## 11) AI defensibility rubric and stage

Agents fill an AI defensibility scorecard: five dimensions, each 1–5, maximum 25.

1. **Replaceability**
   - Could a better generic AI or simple prompt replace most value?

2. **Workflow ownership**
   - Does the product execute or control a real workflow step rather than merely advise?

3. **Data moat**
   - Does it accumulate proprietary structure, memory or outcome history?

4. **Integration depth**
   - Is it embedded in meaningful systems, files, APIs or operational tools?

5. **Switching cost**
   - Would replacement cause meaningful process loss, history loss or retraining friction?

Interpretation:

- 1 = very weak.
- 3 = medium or uncertain.
- 5 = strong evidence or clear.

Thresholds:

- `ai-defensibility/strong`: total 20–25.
- `ai-defensibility/medium`: total 14–19.
- `ai-defensibility/weak`: total 5–13.

AI risk:

- `ai-risk/low` for strong.
- `ai-risk/medium` for medium.
- `ai-risk/high` for weak.

Geographic interpretation rules:

- Local language support alone is not necessarily a moat.
- Verified local workflow ownership, difficult-to-replicate integration, trust position or distribution may contribute to defensibility.
- Local complexity without an advantage is a delivery risk, not defensibility.
- Never award integration-depth or switching-cost credit for assumed/unverified country-specific access.

AI defensibility may be backfilled onto issues in later stages without changing their current `stage/*` label.

---

## 12) Competitor research standards

Competitor research must be relevant to the candidate's validated geographical framing.

When web research is enabled, record:

- geographical area researched;
- countries researched where `country-dependent` or otherwise material;
- source languages used;
- global competitors available in the area;
- regional/local competitors;
- country-specific alternatives where applicable;
- substitutes and current workarounds;
- pricing signals supported by sources;
- area-specific gap hypothesis and its confidence.

Rules:

- Research direct competitors and substitutes/workarounds.
- Record what each does, target user, pricing signal and source.
- Search local/regional languages where necessary to avoid false gap conclusions.
- Do not claim an area has no solution because English-language search was thin.
- Do not describe a gap as observed/proven merely from not finding competitors.
- If web tools are unavailable, mark findings clearly as `Needs verification`.

---

## 13) Wedge decision standards

The wedge stage decides whether there is a believable narrow entry path into the selected geographical market scope.

A credible wedge normally requires:

- clear initial ICP/niche;
- area-specific or clearly portable adoption trigger;
- believable distribution path in the initial area;
- a defensible reason to adopt now;
- an MVP that can win in the narrow segment without unverified dependencies;
- competitors/substitutes sufficiently researched for the relevant geographic scope.

Wedge output should state:

- geographic area of initial wedge;
- geographic applicability;
- area-specific adoption trigger;
- area-specific distribution path;
- expansion hypothesis beyond the initial area;
- remaining geographic risks.

Rules:

- A high problem score does not automatically imply a credible wedge.
- A wedge dependent on unvalidated country assumptions is not credible.
- For globally portable opportunities, clearly distinguish initial entry area from later expansion.
- Weak wedge plus weak AI defensibility is a strong archive signal.

---

## 14) Validation planning standards

The validation stage tests the most decision-critical remaining uncertainty.

Plans must be scoped to the opportunity's geography:

- For `regional` candidates, recruit from and test the specified geographical area and its distinctive mechanism.
- For `globally-portable` candidates, validate the proposed first-entry area and identify what requires retesting elsewhere.
- For `country-dependent` candidates, validate in the verified country scope; do not treat results as area-wide without additional support.

Validation plans should state:

- geographic area;
- geographic applicability;
- countries included where relevant;
- source-language, currency, workflow or local-substitute considerations;
- what must not be generalized beyond the experiment scope.

If AI defensibility is not strong:

- test against generic AI plus the existing manual/tool workflow.

---

## 15) Stage transitions: the conveyor belt

Agents move issues forward by:

- writing results in the correct owned island;
- adding the next stage label;
- removing the current stage label;
- preserving unresolved gates and corrections for downstream stages.

### Standard happy path without country-validation gate

```text
stage/0-evidence
  → stage/0-intake
  → stage/1-normalized
  → stage/2-deduped
  → stage/3-scored
  → stage/4-solution
  → stage/ai-defensibility
  → stage/5-competitors
  → stage/6-shortlist
  → stage/7-validation
  → stage/7.1-validated
  → stage/8-selected
```

### Conditional path for country-dependent candidates

```text
stage/0-evidence
  → stage/0-intake
  → stage/1-normalized
  → stage/2-deduped
  → stage/2.5-country-validation
  → stage/3-scored
  → stage/4-solution
  → stage/ai-defensibility
  → stage/5-competitors
  → stage/6-shortlist
  → stage/7-validation
  → stage/7.1-validated
  → stage/8-selected
```

The conditional branch occurs after software-fit has established that further geographic validation is worthwhile and before scoring.

### Decision ownership by stage

| Stage / workflow responsibility | Decision owned |
|---|---|
| Seed | Generate traceable hypotheses/candidates within geographic-area framing. |
| Evidence enrichment | Decide whether the problem has sufficient evidence to normalize; verify geographic applicability and record country checks required before scoring. |
| Normalize | Produce canonical problem definition without overstating evidence. |
| Dedupe | Decide duplicate vs distinct vs regional variant. |
| Software fit | Decide whether software is a strong enough lever and route country-gated issues accordingly. |
| Country validation | Resolve required country-level mechanisms before scoring. |
| Score | Evaluate problem attractiveness in validated geographic scope. |
| Solution | Draft product/MVP hypothesis. |
| AI defensibility | Assess solution durability vs AI commoditization. |
| Competitors | Research area/country-relevant competitors and substitutes. |
| Wedge | Decide whether a credible market-entry wedge exists. |
| Validation | Define next decision-critical experiment. |
| Steward | Repair clear structural inconsistencies only. |

---

## 16) Archive rules

Archive when:

- duplicate → add `status/duplicate`, `stage/9-archived` and `archive/other`;
- not meaningfully software-solvable → `archive/not-software`;
- low-pain outcome established by approved workflow → `archive/low-pain`;
- unreachable users established by approved workflow → `archive/unreachable-users`;
- too regulated → `archive/too-regulated`;
- too dependent on partners → `archive/too-dependent-on-partners`;
- weak wedge → `archive/no-wedge`;
- another explicit reason → `archive/other`.

Important:

- Duplicates do not use a dedicated `archive/duplicate`.
- `ai-defensibility/weak` is not automatic archive; prefer solution redesign or allow wedge analysis to resolve viability.
- An outstanding country-validation gate is not an archive reason by itself. It is a blocking research requirement before scoring.

---

## 17) Downstream interpretation rules

### Score stage

- Evaluates problem attractiveness within validated geographical scope.
- Does not decide market wedge.
- Does not decide final company quality.
- Cannot score while pre-scoring country validation is outstanding.

### Solution stage

- Produces a narrow product hypothesis consistent with area/country constraints.
- Must not rely on unverified local integrations or generalize beyond validated scope.

### AI defensibility stage

- Evaluates durability against improved generic AI.
- Treats local complexity as defensibility only when it creates a real, verified advantage.

### Competitor stage

- Researches direct alternatives and substitutes in relevant geographical scope.
- Must identify whether global products are actually available/relevant in the area and search regional/local-language alternatives when needed.

### Wedge stage

- Decides if a believable narrow entry path exists in the initial area.
- Must not rely on unresolved country-level assumptions.

### Validation stage

- Tests the most decision-critical remaining uncertainty within the correct geographic scope.
- Must explicitly state what findings should not yet be generalized.

---

## 18) Steward rules

For up to 10 issues per run, stewardship should enforce structural consistency without re-analysis.

### Basic invariants

- Ensure exactly one `stage/*` label.
- Ensure one persona after normalization; if absent/ambiguous add `status/needs-info`.
- Ensure an archive reason exists if archived.
- Ensure stage-relevant islands exist.
- Ensure issues past evidence enrichment retain geographic/evidence handoff fields.
- Ensure issues do not progress to scoring with an outstanding country-validation gate.

### Expected islands by stage

| Stage/status | Required island(s) |
|---|---|
| `stage/0-evidence` | Seed content; `rw:evidence` may be absent before processing and should exist after an evidence attempt. |
| `stage/0-intake` or later | `rw:evidence` |
| `stage/1-normalized` or later | `rw:evidence`, `rw:normalized` |
| `stage/2-deduped` or later | `rw:evidence`, `rw:normalized`, `rw:dedupe` |
| Software-fit label exists or after software-fit routing | `rw:software-fit` |
| `stage/2.5-country-validation` or later when country gate was required | `rw:country-validation` after country-validation processing |
| `stage/3-scored` or later | `rw:scorecard` and no outstanding pre-scoring country gate |
| `stage/4-solution` or later | `rw:solution` |
| `stage/ai-defensibility` or later | `rw:ai-defensibility` |
| `stage/5-competitors` or later | `rw:competitors` |
| `stage/6-shortlist` or later | `rw:wedge` |
| `stage/7-validation` or later | `rw:validation` after planning attempt |

### AI-specific checks

- Ensure at most one `ai-defensibility/*`.
- Ensure at most one `ai-risk/*`.
- Ensure `rw:ai-defensibility` exists for issues in or past the AI-defensibility stage.

### Geographic/evidence checks

Flag with `status/needs-info` where clearly applicable:

- `stage/0-intake` or later but no `rw:evidence`;
- `stage/1-normalized` or later but no geographic area/applicability in normalized content;
- `stage/3-scored` or later while `Country validation before scoring: outstanding`;
- regional/country-dependent items missing explicit geographical mechanism/gate information in required upstream islands.

Stewardship may insert empty missing island markers only where that is appropriate for structural repair. It must not populate substantive evidence, country validation, scores or strategy.

---

## 19) Daily shortlist/report interpretation

Daily reports should display:

- geographical area;
- geographic applicability;
- evidence/confidence;
- country-validation status when applicable;
- score/wedge/AI-defensibility/risk status.

Rules:

- Do not present a candidate with an outstanding pre-scoring country gate as fully evaluated.
- Surface over-concentration in a single geographical area or repeated variants of one cluster.
- Prefer higher evidence quality and comparable geographic readiness over more ambitious narratives.

---

## 20) No-op policy

If a workflow trigger condition does not match, the issue is at the wrong stage, or there is nothing valid to change:

- emit `noop` with a short reason, such as `Not a type/problem issue` or `Issue not at expected stage`.

If a required workflow tool is unavailable:

- emit `noop` with a short reason describing the missing requirement, unless that workflow explicitly defines an evidence-hold fallback.
- Example: `missing GitHub read tools`.

If an optional tool is unavailable but the workflow defines a fallback:

- follow the fallback instead of nooping.

---

## 21) Philosophy

This repository does not optimize for:

- ideas that merely sound compelling;
- broad markets without validated pain;
- country or region labels that substitute for research;
- AI features without a durable product position.

It optimizes for:

- problems that materially matter;
- evidence that is honest about scope and confidence;
- geographical opportunity definitions that are neither overgeneralized nor needlessly fragmented;
- solutions that can be tested quickly;
- products that may survive AI commoditization;
- validation experiments that reduce the next most important uncertainty.

---

## 22) Marketing and sales rules

- At most one `marketing-sales/*` label may exist on a problem issue.
- Marketing/sales assessment is orthogonal metadata and does not advance stage by itself.
- Where geography materially affects acquisition or sales motion, the assessment must identify the relevant geographical area or country scope.

---

# Final rule

**Use evidence to define the problem, geography to define the honest market scope, and AI inside a durable product — not as the product itself.**
