---
name: "RW: Seed Problems"
strict: false
on:
  workflow_dispatch:
    inputs:
      count:
        description: "Maximum problems to create in this run (recommended 5–10 for evidence-backed seeding)"
        required: true
        default: "6"
      seed_strategy:
        description: "Discovery strategy: evidence-backed by default; hypotheses are explicitly marked as unvalidated"
        required: true
        default: "signal_first"
        type: choice
        options:
          - signal_first
          - buyer_first
          - exploratory_hypothesis
      mode:
        description: "Coverage mode"
        required: true
        default: "balanced"
        type: choice
        options:
          - balanced
          - domain_focus
          - persona_focus
      focus_domain:
        description: "If mode=domain_focus, use e.g. finance | health | work | admin-bureaucracy"
        required: false
        default: ""
      focus_persona:
        description: "If mode=persona_focus, use e.g. consumer | employee | family-parent | student | smb-owner"
        required: false
        default: ""
      include_regulated:
        description: "Allow regulated-ish problem discovery (health/finance/kids); never provide advice"
        required: true
        default: "false"
        type: choice
        options:
          - "false"
          - "true"
      geography_mode:
        description: "How geographical areas shape discovery"
        required: true
        default: "area_focus"
        type: choice
        options:
          - global_portable
          - area_focus
          - compare_areas
      geographic_area:
        description: "Primary geographical area to investigate"
        required: true
        default: "israel"
        type: choice
        options:
          - global-portable
          - north-america
          - latin-america
          - israel
          - arabic-middle-east
          - arabic-north-africa
          - sub-saharan-africa
          - western-europe
          - eastern-europe
          - russia-belarus
          - caucasus
          - central-asia
          - turkey
          - iran
          - southern-asia
          - southeast-asia
          - china
          - japan
          - south-korea
          - australia-new-zealand
          - custom-area
      custom_geographic_area:
        description: "Custom area name when geographic_area=custom-area"
        required: false
        default: ""
      comparison_areas:
        description: "If geography_mode=compare_areas, comma-separated geographical areas"
        required: false
        default: ""
      focus_countries:
        description: "Optional comma-separated countries to inspect only when area-level pain depends on national/local rules or infrastructure"
        required: false
        default: ""
      source_languages:
        description: "Languages for area-specific evidence discovery, comma-separated, e.g. ar,en | he,en | es,pt,en"
        required: true
        default: "he,en"
      require_area_signal:
        description: "Require at least one source demonstrating the pain in the selected geographical area"
        required: true
        default: "true"
        type: choice
        options:
          - "true"
          - "false"
      minimum_sources:
        description: "Minimum independent evidence sources for signal_first/buyer_first (recommended 2)"
        required: true
        default: "2"
      novelty_mode:
        description: "How aggressively to avoid nearby problem shapes"
        required: true
        default: "balanced"
        type: choice
        options:
          - conservative
          - balanced
          - exploratory
      avoid_recent_days:
        description: "Avoid clusters that appeared in the last N days"
        required: true
        default: "45"
      recent_scan_limit:
        description: "Approximate number of recent visible problem issues to scan before seeding"
        required: true
        default: "60"
      max_per_archetype:
        description: "Soft cap per archetype in this run"
        required: true
        default: "2"
      max_oversized_attempts:
        description: "Oversized GitHub read/search attempts before recent-run avoidance fallback"
        required: true
        default: "3"

engine:
  id: copilot
  agent: rw-problem-seeder

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
  create-issue:
    labels: [type/problem, stage/0-evidence]
    max: 25
  noop:
---

# Seed problems — evidence-aware, geographical-area-focused startup opportunity intake

## Mission

Create **up to** `${{ inputs.count }}` high-quality `type/problem` issues suitable for investigating startup opportunities.

This workflow must optimize for:

1. real and specific pain;
2. traceable evidence and honest confidence;
3. a plausible payer or economic beneficiary;
4. a reachable initial segment in the selected geographical area;
5. software-enabled first value without heroic dependencies;
6. novelty relative to the existing repository; and
7. regional differences that materially change the problem or market-entry opportunity.

The primary geographic unit in this workflow is a **geographical investigation area**, not a country.

Countries are used only as a refinement layer when national or municipal regulation, public services, payment rails, insurance, language, infrastructure, or incumbent services materially determine the pain.

Do **not** optimize for raw issue count, polished storytelling, taxonomy coverage alone, or speculative regional stereotypes.
Creating fewer well-supported issues is preferred to creating a full batch of weak candidates.

All newly created problems enter `stage/0-evidence`. The dedicated `05-evidence-enrich.md` stage determines whether an issue can move onward to `stage/0-intake` for normalization.

---

## Tooling and evidence discipline

### Repository reads

- Search/read existing issues using GitHub MCP issue tools only.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, temporary tool-output files, or reconstructed coverage maps to inspect issue data.
- Use MCP results directly from `list_issues`, `search_issues`, and `issue_read`.
- If GitHub read tools are unavailable, CALL `noop` exactly once with reason `missing GitHub read tools` and stop.

### External evidence discovery

- For `seed_strategy=signal_first` and `seed_strategy=buyer_first`, use Tavily/web-fetch to collect evidence before creating an issue.
- Search in `${{ inputs.source_languages }}` where useful; for an area with multiple relevant languages, do not rely only on English-language material when local-language signals are reasonably available.
- Prefer sources with traceable provenance:
  - official public-service/provider/regulator pages for workflow rules, fees, deadlines or process constraints;
  - reputable reports, associations, public datasets or research for quantified frequency/stakes;
  - official competitor/product pages for offered alternatives and public pricing signals;
  - reputable local or regional news for documented failures;
  - reviews, forums or complaint threads only as qualitative pain signals.
- Do not invent statistics, fees, legal rules, API availability, competitor gaps, user frequency, area-wide commonality or market size.
- If a fact cannot be verified, record it as an assumption requiring validation, not as evidence.
- If evidence tools are unavailable in `signal_first` or `buyer_first`, CALL `noop` exactly once with reason `missing evidence research tools for evidence-backed seeding` and stop.

### Evidence vocabulary — mandatory

Never use `observed`, `proven`, `validated`, or equivalent wording merely because a problem sounds plausible.

Use exactly one `Evidence status` value:

- `hypothesis-only` — agent-generated problem framing without sufficient external or primary evidence;
- `secondary-signalled` — supported by traceable external sources, but not by direct user validation in this repo;
- `primary-validated` — backed by explicit primary evidence already supplied in repository content, such as interviews, surveys, pilot results, support tickets or direct complaint intake.

A public web source is **secondary** evidence even when it strongly supports the problem.

---

## Strategy behavior

### `signal_first` — default

Begin from traceable pain signals in the selected geographical area, then formulate a problem issue.

Create an issue only if:

- `Evidence status` is `secondary-signalled` or `primary-validated`;
- there are at least `${{ inputs.minimum_sources }}` independent supporting evidence sources;
- at least one source signals the pain in the selected `${{ inputs.geographic_area }}` or resolved custom area when `require_area_signal=true`;
- for `Geographic applicability: country-dependent`, relevant country-specific evidence is present or the missing country verification is explicitly made the blocking unknown for evidence enrichment;
- the startup screen passes; and
- novelty and duplicate gates pass.

### `buyer_first`

Begin from identifiable budget owners or direct economic beneficiaries within the selected area, such as SMB owners, field-service operators, operations teams, employers, insurers, professional practices, property managers or local institutions.

Use the same evidence requirements as `signal_first`, and additionally require:

- an explicit likely payer or sponsoring actor;
- a plausible acquisition path to the first 20 users or buyers in the area;
- a monetary, revenue, compliance, operational or labour-saving consequence.

### `exploratory_hypothesis`

Generate promising but explicitly unvalidated area-oriented hypotheses when exploratory breadth is intended.

Rules:

- `Evidence status` must be `hypothesis-only`, unless qualifying evidence was actually collected.
- Never include unsourced factual or quantitative assertions.
- Set `Readiness: requires-evidence-enrichment` in the issue body.
- Add `status/needs-info` when possible.
- Treat these as research backlog items, not ranked startup candidates.

---

## Geographic area model

### Primary investigation areas

Use the selected `${{ inputs.geographic_area }}` as the primary discovery lens. If `custom-area` is selected, use `${{ inputs.custom_geographic_area }}` and require it to be non-empty.

Default area catalog:

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
- `custom-area`

This catalog is an investigation scaffold, not a claim that all countries inside an area are homogeneous. Evidence must determine whether a regional pain is sufficiently shared or requires narrower country validation.

### Geographic applicability

Each candidate must be classified into exactly one:

- `globally-portable` — the pain and software value mechanism plausibly transfer across many areas; the selected area is an initial discovery or launch wedge.
- `regional` — the pain is meaningfully shaped by shared language, consumer behaviour, business structures, service patterns, economic conditions or distribution channels in the selected area.
- `country-dependent` — the candidate was discovered from an area lens but the pain or viability depends on country- or municipality-level regulation, public services, insurance, payments, transport rules, identity-document rules, data access or infrastructure.

### Country refinement rule

Do not make country selection mandatory for every candidate.

Country-level examination becomes mandatory before later scoring when the core pain depends on:

- government forms, benefits, identity documents, permits, taxation or business licensing;
- national or municipal healthcare reimbursement, insurance or public-care pathways;
- banking, payments, consumer credit or financial regulation;
- transportation fines, tolls, parking, licensing or permits;
- school administration controlled by local/national rules;
- waste disposal and municipal collection rules;
- privacy/data-residency/compliance rules;
- integrations or data sources that differ by country.

When such dependency exists:

- set `Geographic applicability: country-dependent`;
- list `Countries examined, if any`;
- list `Countries requiring validation before scoring` when not fully checked;
- do not make a broad area-level factual claim from evidence concerning only one country.

### Geography-mode behavior

#### `global_portable`

- Discover pains expected to transfer across areas.
- Use `${{ inputs.geographic_area }}` as the first area for evidence and possible market entry, unless it is `global-portable`.
- Explain why this area is still useful as an entry wedge or validation environment.
- Do not force a regional narrative for a broadly portable problem.

#### `area_focus`

- Research the selected area deeply.
- Use relevant regional and local-language sources where feasible.
- Require a concrete explanation of why the area shapes pain, reachability or opportunity.
- If evidence shows that a candidate is actually country-dependent, classify it accordingly rather than over-generalizing across the area.

#### `compare_areas`

- Research the selected area and each area in `${{ inputs.comparison_areas }}`.
- Do not create variants merely by translating the same issue into different regional names.
- Prefer the area where evidence, stakes, reachable initial users, substitution gap and buildability jointly appear strongest.
- Record why the selected area appears preferable to compared areas and whether country refinement remains necessary.

### Geographic duplicate rule

Two similar issues framed for different areas are duplicates unless area context materially changes at least one of:

- workflow or regulatory mechanism;
- relevant provider or employer structure;
- payer or buyer;
- first distribution path;
- available substitutes;
- language, identity or documentation constraint;
- payments, data access, platform/infrastructure or integration environment;
- severity or recurrence supported by evidence.

If area context materially changes the opportunity, keep the new issue as a regional variant and identify the shared cluster and area-specific differentiator in the body.

---

## Stage 1 — recent-window saturation scan (MANDATORY)

Before drafting any issue:

1. Scan recent visible `type/problem` issues in the repo.
   - Scan a recent window only, not the full repo.
   - Prefer the most recent visible issues first.
   - Scan up to `${{ inputs.recent_scan_limit }}` recent visible problem issues when feasible.
   - Pay special attention to issues created in the last `${{ inputs.avoid_recent_days }}` days.

2. Build an internal recent-window map of:
   - domains;
   - personas;
   - themes and subthemes;
   - archetypes;
   - geographic areas and applicability values when present;
   - countries requiring validation when present;
   - likely product shapes;
   - obvious saturated clusters.

3. Pay extra attention to:
   - issues created by recent runs of RW: Seed Problems;
   - repeated `domain + theme + subtheme` reuse;
   - repeated `geographic area + failure moment` reuse;
   - repeated “same shape, different noun” or “same shape, different region” patterns;
   - reminder/tracker/log app repetition.

### Oversized-output fallback

If issue listing/search repeatedly returns oversized output:

- tolerate at most `${{ inputs.max_oversized_attempts }}` oversized attempts total;
- then stop broad scanning;
- switch to **recent-run avoidance mode**;
- use already-seen issues as the saturation map;
- rely on finalist-specific duplicate checks;
- do not keep attempting broad reads.

### Saturation heuristics

Treat a space as high-risk/saturated if any of the following is true in the scanned set:

- same `domain + archetype` appears 4+ times;
- same `domain + theme` appears 3+ times;
- same `persona + archetype` appears 4+ times;
- same `geographic area + domain + theme` appears repeatedly;
- same failure pattern appears repeatedly with only noun or area-name swaps;
- same likely product shape repeatedly resolves to a reminder, tracker or generic AI assistant.

---

## Stage 2 — area signal discovery and candidate generation

### Domain list

1. admin-bureaucracy
2. finance
3. health
4. work
5. home
6. mobility
7. shopping
8. education
9. family
10. food
11. security-privacy
12. travel

### Persona list

1. consumer
2. employee
3. family-parent
4. student
5. freelancer
6. smb-owner
7. senior
8. enterprise

### Archetype list

1. deadline-window-lapse
2. status-opacity
3. evidence-proof-trail
4. coordination-handoff
5. verification-mismatch
6. scheduling-booking
7. comparison-selection
8. exception-recovery
9. ongoing-upkeep-drift
10. fragmented-records

### Coverage-mode rules

#### `balanced`

- Explore multiple domains and personas.
- Use dark-space preference, but do not select weak problems just because a category is underrepresented.
- In `signal_first`, area-specific evidence strength and startup potential win over round-robin coverage.

#### `domain_focus`

- Use `focus_domain` when provided; otherwise fall back to balanced.
- Rotate personas/archetypes while prioritizing area evidence and commercial potential.

#### `persona_focus`

- Use `focus_persona` when provided; otherwise fall back to balanced.
- Rotate domains/archetypes while prioritizing area evidence and commercial potential.

### Evidence discovery loop

For each possible slot:

1. Select a domain/persona/archetype area to explore.
2. Search for concrete signals relevant to the selected geographical area.
3. Determine whether the pain appears globally portable, regionally shaped, or country-dependent.
4. When country-dependent, use `focus_countries` when supplied or record which country verification is still needed.
5. Identify the failure moment, workaround, affected user and plausible payer.
6. Gather supporting sources and record which claims each source supports.
7. Draft three materially distinct candidate formulations where possible.
8. Reject candidates that do not pass the startup screen, evidence threshold or novelty gate.
9. Search the repo specifically for the surviving finalist, including its geographic-area mechanism.
10. If it passes, immediately CALL `create_issue` for that issue before exploring the next slot.

---

## Stage 3 — startup-potential screen (MANDATORY before create)

Create only a candidate that passes all hard gates and at least five of the seven strength indicators below.

### Hard gates

A candidate must have:

- a concrete failure moment;
- a named affected persona;
- a selected geographic area;
- a stated geographic applicability;
- a clearly stated current workaround;
- a software-enabled improvement path;
- no heroic dependency required for first value;
- evidence status permitted by the selected `seed_strategy`.

### Strength indicators

Evaluate each as `strong`, `plausible` or `weak`:

1. **Material stakes** — lost money, wasted paid time, lost revenue, penalties, compliance exposure, operational delay, prevented access or significant risk.
2. **Recurrence** — repeat pain for the user or frequent occurrence across a concentrated group.
3. **Workaround failure** — users already spend time/money or accept risk because current methods fail.
4. **Payer clarity** — an identifiable actor plausibly benefits enough to pay or sponsor adoption.
5. **Reachability** — a credible channel to initial users/buyers exists in the area.
6. **MVP feasibility** — first value is deliverable without difficult partnership, inaccessible data or unnecessary regulation.
7. **Wedge seed** — there is an early hypothesis for why a narrow segment or area may be underserved.

### Decision rule

- For `signal_first` and `buyer_first`, create only when at least five indicators are `strong` or `plausible`, with no `weak` result for **Material stakes**, **Payer clarity**, or **MVP feasibility**.
- For `exploratory_hypothesis`, allow weaker or uncertain indicators only if the issue clearly records them as assumptions and sets `Readiness: requires-evidence-enrichment`.

Do not convert a weak candidate into a confident one by inventing a feature, integration, market statistic or regional gap.

---

## Stage 4 — taxonomy and geographic anchoring

Each issue must be anchored to:

- exactly one domain;
- exactly one theme;
- exactly one subtheme;
- exactly one persona;
- exactly one archetype;
- exactly one geographic area;
- exactly one geographic applicability.

The catalog below is a preferred exploration scaffold, not a closed whitelist.
An off-catalog theme or subtheme is permitted only when it fits the evidenced pain more naturally and is not a near-synonym of an existing entry.

The agent must be able to state:

- `This is a <theme> / <subtheme> problem because ...`
- `This is <globally-portable|regional|country-dependent> in the context of <geographic area> because ...`

Reject or reclassify the candidate when either explanation feels forced.

Soft caps:

- no archetype more than `${{ inputs.max_per_archetype }}` times unless count pressure truly requires it;
- no repeated `domain + theme + subtheme + geographic area` in one run;
- no more than 20% off-catalog classifications in one run unless strong sourced evidence justifies broader discovery.

---

## Stage 5 — novelty and duplicate gate (STRICT)

A finalist must be materially different from its nearest visible existing issue.

### Minimum novelty rule

The candidate must differ on at least two of:

1. trigger moment;
2. failure moment;
3. current workaround;
4. primary object being managed, coordinated or verified;
5. cadence/recurrence;
6. persona;
7. buyer/payer;
8. geographical-area mechanism;
9. distribution path.

### Same-theme rule

If it shares `domain + theme + subtheme` with a nearby issue, require differences on at least three axes above and reject it if the likely product shape remains the same.

### Same-area rule

If it shares `domain + persona + archetype + geographic area` with a nearby issue, require differences on at least three axes above or reject it.

### Regional variant rule

Do not create a geographic-area variant only because a source was found in a different region. Keep it only when an area-specific workflow, provider structure, substitute, buyer, distribution channel, language/documentation constraint or infrastructure difference materially affects the startup opportunity.

### Explicit anti-patterns

Reject candidates that are essentially:

- same pain shape, workaround and likely product with changed nouns;
- same pain shape repackaged under another geographical area without a causal difference;
- generic reminder/tracker/log ideas lacking sharp consequences;
- “AI assistant for X” without ownership of a meaningful workflow step;
- broad societal/macro problems without a target buyer and executable product wedge.

---

## Stage 6 — recent-run suppression

Avoid creating issues too close to candidates created in the last `${{ inputs.avoid_recent_days }}` days.

Suppress, unless unusually strong and clearly distinct:

- same `domain + theme + subtheme`;
- same `domain + archetype`;
- same `persona + workaround shape`;
- same `geographic area + area-specific mechanism`;
- same likely product shape.

### `novelty_mode` behavior

#### `conservative`

Strongly avoid adjacent recent clusters; prefer clearly distinct evidence-backed opportunities.

#### `balanced`

Avoid recent clusters unless the candidate has distinctly stronger evidence, stakes or regional mechanism.

#### `exploratory`

Allow closer adjacency only where the candidate reveals a genuinely new wedge, buyer, geographic-area mechanism or failure mode; never allow thin duplicates.

---

## Regulated-domain handling

If `include_regulated=false`:

- Avoid candidates requiring diagnosis, medical advice, legal advice, investment/credit advice, financial-account credentials, children’s sensitive data, or compliance-heavy workflows.
- Light administrative or documentation pains may be used when first product value is plainly non-clinical and non-advisory.

If `include_regulated=true`:

- Regulated-adjacent problems may be explored, but never provide medical, legal or financial advice.
- Frame candidate value as workflow support, coordination, verification, logistics, documentation, tracking or compliant handoff.
- Explicitly state compliance/data risks and avoid claiming an easy MVP where regulation is central.
- When the regulation differs at country level, classify as `country-dependent`.

---

## Required issue body structure

For each created issue, use this template exactly enough for downstream agents to parse it reliably:

```md
**JTBD:** When ..., I want ..., so I can ...

---

**Context & frequency:**
...

**Pain / stakes:**
...

**Current workaround:**
...

**Failure moment:**
...

**Why software may help:**
...

---

## Evidence and confidence

**Evidence status:** hypothesis-only | secondary-signalled | primary-validated
**Readiness:** ready-for-evidence-gate | requires-evidence-enrichment

### Evidence sources
| Claim supported | Source / organization | Date accessed or published | Geographic area / country | Source type |
|---|---|---|---|---|
| ... | ... | ... | ... | official / research / industry / reputable-news / qualitative-signal / competitor |

### Unsupported assumptions requiring validation
- ...

---

## Startup screen

- **Affected user:** ...
- **Likely payer / economic beneficiary:** ...
- **Material consequence:** ...
- **Recurrence signal:** ...
- **Broken workaround signal:** ...
- **Reachable first segment / channel in area:** ...
- **MVP without heroic dependencies:** ...
- **Early wedge hypothesis:** ...
- **Critical unknown to validate next:** ...

---

## Geographic framing

- **Geographic area:** <predefined area or custom area>
- **Geographic applicability:** globally-portable | regional | country-dependent
- **Areas compared, if any:** <areas or none>
- **Countries examined, if any:** <countries or none>
- **Countries requiring validation before scoring, if any:** <countries or none>
- **Source language(s):** <languages>
- **Why this area matters:** ...
- **Area-specific pain signal:** ...
- **Country-level dependency, if any:** ...
- **Transferability beyond this area:** ...
- **Area-specific competitor/substitute note:** ...

---

Domain: <domain>
Theme: <theme>
Subtheme: <subtheme>
Catalog status: <catalog|off-catalog>
Persona: <persona>
Archetype: <archetype>
Geographic area: <area>
Geographic applicability: <globally-portable|regional|country-dependent>
```

### Body rules

- Do not assert source-backed facts outside the evidence table unless the claim is clearly supported there.
- Do not describe public-web findings as `primary-validated`.
- In `signal_first` or `buyer_first`, use `Readiness: ready-for-evidence-gate` only when the seeder's evidence requirement and startup screen pass; `05-evidence-enrich.md` still makes the advancement decision.
- In `exploratory_hypothesis`, use `Readiness: requires-evidence-enrichment` unless qualifying evidence was actually gathered.
- Do not generalize a finding from one country to an entire geographical area without supporting area-level or multi-country evidence.

### Labels

- Must include: `type/problem`, `stage/0-evidence`.
- SHOULD include: `domain/<domain>`, `persona/<persona>`.
- For exploratory hypothesis issues, SHOULD include `status/needs-info` when supported by repository label policy.
- Do not create ad-hoc geography labels unless repository policy explicitly defines them; store geographic-area metadata in the body.

---

## Safe outputs (MANDATORY)

Use safeoutputs tool calls. Do NOT output NDJSON/JSON lines.

For each issue to create:

1. shortlist one finalist;
2. run its final evidence/startup/novelty/duplicate checks;
3. immediately CALL `create_issue` with title `Problem: <7–12 words>` and the full required body;
4. only then move to the next candidate.

Create between 1 and `${{ inputs.count }}` issues only when qualified candidates exist.
If no candidate qualifies, CALL `noop` exactly once with a short reason such as `no evidence-backed, novel startup-worthy candidate passed the gates for the selected geographical area`.

---

## Compact catalog themes by domain (non-exhaustive)

Use these as stable theme anchors. Choose or formulate a concrete subtheme derived from the evidence and geographical-area mechanism. A stronger sourced off-catalog problem is preferable to a weak forced catalog fit.

### admin-bureaucracy

- identity-and-record-matching
- eligibility-and-prerequisites
- applications-and-submissions
- appointments-and-in-person-visits
- status-tracking-and-follow-up
- payments-fees-and-penalties
- renewals-and-validity-windows
- rejections-appeals-and-corrections
- cross-agency-coordination
- certification-and-official-proof
- address-residency-and-local-records
- representation-and-delegation

### finance

- billing-and-payment-obligations
- refunds-reimbursements-and-credits
- disputes-chargebacks-and-fraud
- subscriptions-renewals-and-lapses
- taxes-filings-and-benefits
- household-money-coordination
- cashflow-and-timing-mismatch
- income-payroll-and-payout-errors
- claims-warranties-and-coverage-costs
- financial-document-gathering
- debt-and-repayment-organization
- price-comparison-and-commitment-decisions

### health

- appointments-referrals-and-authorizations
- care-plan-follow-through
- labs-imaging-and-results
- records-documents-and-forms
- medications-and-supplies
- caregiver-and-family-coordination
- insurance-billing-and-claims
- visit-prep-and-post-visit-recovery
- care-access-and-scheduling-friction
- home-care-and-routine-logistics
- care-transitions-and-special-events
- neutral-health-tracking

### work

- approvals-reviews-and-signoffs
- handoffs-and-cross-team-coordination
- meetings-decisions-and-follow-through
- documents-knowledge-and-versioning
- scheduling-staffing-and-shifts
- onboarding-training-and-certification
- access-permissions-and-procurement
- expense-reimbursement-and-internal-admin
- customer-vendor-and-partner-coordination
- incident-exception-and-recovery
- field-ops-and-distributed-work
- status-reporting-and-repeat-communication

### home

- maintenance-and-preventive-upkeep
- repairs-vendors-and-service-calls
- utilities-outages-and-service-accounts
- household-items-storage-and-findability
- renting-landlord-and-building-admin
- home-insurance-and-damage-events
- cleaning-chores-and-role-coordination
- packages-deliveries-and-home-access
- safety-security-and-emergency-readiness
- renovation-projects-and-change-orders
- pet-and-dependent-care-at-home
- decluttering-disposal-and-replacement

### mobility

- commute-planning-and-disruption-recovery
- parking-tolls-and-fines
- vehicle-maintenance-and-validity
- breakdowns-accidents-and-roadside-events
- public-transport-and-pass-management
- family-pickup-and-shared-ride-coordination
- accessibility-and-special-constraint-routing
- ride-cost-and-option-comparison
- shared-vehicle-and-asset-coordination
- ev-charging-and-range-logistics
- ownership-documents-and-admin
- lost-items-and-in-transit-recovery

### shopping

- comparison-and-selection
- size-fit-and-compatibility
- purchasing-proof-and-records
- delivery-preorder-and-availability
- returns-exchanges-and-recovery
- warranty-claims-and-aftercare
- recurring-rebuy-and-household-replenishment
- shared-shopping-and-list-coordination
- gift-purchasing-and-event-buying
- marketplace-and-seller-trust
- used-refurbished-and-replacement-buying
- household-stock-vs-waste-tradeoffs

### education

- assignments-deadlines-and-submissions
- study-planning-and-exam-prep
- notes-materials-and-resource-findability
- group-work-and-collaboration
- school-admin-and-family-communication
- applications-admissions-and-enrollment
- financial-aid-scholarships-and-fees
- accommodations-support-and-special-needs
- attendance-schedule-and-routine-friction
- extracurriculars-clubs-and-activities
- certifications-testing-and-registration
- feedback-progress-and-intervention

### family

- calendar-coordination-and-conflict-resolution
- child-activity-and-school-logistics
- caregiving-and-coverage
- co-parenting-and-multi-household-coordination
- household-decisions-and-memory
- documents-records-and-official-family-proof
- roles-chores-and-responsibility-balance
- events-celebrations-and-gift-coordination
- family-money-and-shared-obligations
- routines-boundaries-and-agreements
- emergency-readiness-and-contact-visibility
- intergenerational-support-and-communication

### food

- meal-planning-and-decision-friction
- pantry-fridge-and-freezer-visibility
- shopping-to-meal-execution
- leftovers-waste-and-expiry-management
- dietary-preferences-and-restrictions
- school-work-and-on-the-go-food-logistics
- hosting-guests-and-events
- batch-cooking-and-replenishment
- restaurant-takeout-and-order-accuracy
- cost-vs-convenience-tradeoffs
- nutrition-and-routine-consistency
- holiday-seasonal-and-special-occasion-food

### security-privacy

- passwords-credentials-and-access-readiness
- account-recovery-and-lockout-prevention
- device-update-and-protection-drift
- phishing-scams-and-suspicious-contact-triage
- identity-theft-and-post-incident-recovery
- privacy-settings-and-data-exposure
- secure-document-sharing-and-redaction
- permissions-and-shared-access-review
- backup-readiness-and-restoration-confidence
- device-handover-resale-and-offboarding
- child-elder-and-dependent-digital-safety
- privacy-rights-and-follow-up-requests

### travel

- pre-departure-readiness
- documents-visas-and-entry-requirements
- bookings-itinerary-and-confirmation-findability
- changes-cancellations-and-rebooking-recovery
- airport-station-and-local-transfer-coordination
- lodging-stay-and-check-in-friction
- trip-money-expenses-and-reimbursement
- insurance-claims-and-compensation
- group-travel-and-role-coordination
- health-accessibility-and-special-needs-travel
- lost-items-baggage-and-recovery
- post-trip-cleanup-and-follow-through
