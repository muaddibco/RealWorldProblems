---
name: "RW: Seed Problems"
strict: false
on:
  workflow_dispatch:
    inputs:
      count:
        description: "How many problems to create in this run (recommended 8–12; higher counts reduce novelty discipline)"
        required: true
        default: "10"
      mode:
        description: "Seeding mode"
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
        description: "Allow regulated-ish problems (health/finance/kids) in output"
        required: true
        default: "false"
        type: choice
        options:
          - "false"
          - "true"
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
        description: "How many oversized GitHub read/search attempts to tolerate before falling back to recent-run avoidance mode"
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
    labels: [type/problem, stage/0-intake]
    max: 25
  noop:
---

# Seed problems (recent-window, semi-open catalog, one-by-one creation)

Tooling note:
- Search/read existing issues using GitHub MCP issue tools only.
- Do NOT use `gh`, `curl`, shell scraping, `python -c`, `/tmp/gh-aw/mcp-payloads/*`, `/tmp/copilot-tool-output*`, `/tmp/gh-aw/agent/*`, or any temp-file parsing to inspect issue data.
- Do NOT reconstruct coverage maps from shell output or local temp files.
- Use MCP results directly from `list_issues`, `search_issues`, and `issue_read`.
- If GitHub read tools are unavailable in the model tool list, CALL `noop` exactly once with a short reason and stop.

Create **up to** `${{ inputs.count }}` new `type/problem` issues using the canonical Problem Candidate structure from AGENTS.md, with each issue explicitly anchored to `Domain + Theme + Subtheme + Archetype`.

The goal is not merely to hit count.
The goal is to create the highest-quality, most varied, most non-overlapping set of problems you can create in this run.

Creating fewer issues is better than creating repetitive issues.

---

## Stage 1 — recent-window saturation scan (MANDATORY)

Before drafting any issue:

1. Scan recent visible `type/problem` issues in the repo.
   - Scan a recent window only, not the full repo.
   - Prefer the most recent visible issues first.
   - Scan up to `${{ inputs.recent_scan_limit }}` recent visible problem issues when feasible.
   - Pay special attention to issues created in the last `${{ inputs.avoid_recent_days }}` days.
   - Build the scan from GitHub MCP issue-tool results directly, not from shell/temp-file parsing.

2. Build an internal recent-window map of:
   - domain counts
   - persona counts
   - theme counts
   - subtheme counts
   - archetype counts
   - obvious saturated clusters

3. Pay extra attention to:
   - issues created by recent runs of RW: Seed Problems
   - repeated `domain + theme + subtheme` reuse
   - repeated “same shape, different noun” patterns
   - recent issues created on the same calendar day

### Oversized-output fallback
If GitHub issue listing/search repeatedly returns oversized output:
- tolerate at most `${{ inputs.max_oversized_attempts }}` oversized attempts total
- then stop broad scanning
- switch to **recent-run avoidance mode**

In recent-run avoidance mode:
- use the issues you have already seen as the current saturation map
- avoid domains/themes/subthemes visibly touched by the latest runs you have already inspected
- rely on finalist-specific duplicate checks for each candidate
- do NOT keep thrashing on broader repo reads

### Saturation heuristics
Treat a space as **high-risk / saturated** if any of the following is true in the scanned visible set:
- same `domain + archetype` appears 4+ times
- same `domain + theme` appears 3+ times
- same `persona + archetype` appears 4+ times
- same `domain + theme + subtheme` appears repeatedly in recent issues
- same failure pattern appears repeatedly with only noun swaps
- same likely product shape keeps appearing as a reminder / tracker / log app

When a space is saturated, prefer a different theme, subtheme, or archetype instead of making a slightly renamed variant.

---

## Stage 2 — rotation with dark-space preference

### Domain list (canonical order)
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

### Persona list (canonical order)
1. consumer
2. employee
3. family-parent
4. student
5. freelancer
6. smb-owner
7. senior

### Archetype list (canonical order)
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

### Mode rules

#### balanced
For i = 1..count:
- start from the canonical domain order
- start from the canonical persona order
- start from the canonical archetype order
- then adjust toward underrepresented combinations if the default slot is saturated, too recent, or too similar to prior issues in this run

#### domain_focus
- Use `focus_domain` for all items if provided; otherwise fallback to balanced.
- Rotate persona and archetype with the same dark-space preference.

#### persona_focus
- Use `focus_persona` for all items if provided; otherwise fallback to balanced.
- Rotate domain and archetype with the same dark-space preference.

### Theme catalog rule (applies to all modes)
- The domain catalog is a preferred exploration scaffold, not a closed whitelist.
- For each generated problem, the agent should first try to anchor the problem to:
  - exactly one catalog theme from the chosen domain
  - exactly one catalog subtheme within that theme
- The agent may use an off-catalog theme or subtheme when the catalog does not adequately represent a strong candidate space.
- Off-catalog choices are allowed only when they are:
  - materially distinct from existing catalog entries
  - not just renamed synonyms of existing themes/subthemes
  - clearly grounded in a concrete failure moment

### Theme selection and rotation (within a domain)
For each generated item:
- Prefer the next underused catalog theme for the chosen domain.
- Prefer the next underused subtheme within that theme.
- Do not force strict round-robin if doing so would create a weaker or more repetitive problem.
- Use the catalog to improve coverage, not to override judgment.

Priority order:
1. strongest novel candidate within the chosen domain
2. underused catalog theme / subtheme
3. off-catalog candidate, only if clearly better than catalog options

### Off-catalog discipline
The agent may introduce:
- `Theme (off-catalog): <name>`
- or `Subtheme (off-catalog): <name>`

only when all of the following are true:
1. no existing catalog entry fits the candidate well without distortion
2. the candidate is not a near-synonym of an existing catalog entry
3. the candidate passes duplicate and novelty checks
4. the candidate has a specific context, workaround, and failure moment

When using an off-catalog entry:
- keep the name short and concrete
- avoid broad umbrella labels
- avoid inventing taxonomy for its own sake
- prefer the minimum new structure needed to express the problem clearly

Soft cap:
- no more than 20% of created issues in one run should use off-catalog themes/subthemes unless the recent visible landscape strongly suggests the catalog is missing major areas

### Caps
Enforce these as soft caps:
- No archetype appears more than `${{ inputs.max_per_archetype }}` times unless count pressure truly requires it
- Avoid repeating the same `domain + theme + subtheme` in one run
- Avoid repeating the same `persona + archetype` pattern in one run unless later slots remain clearly novel

---

## Stage 3 — theme + subtheme + archetype pairing

Each issue must be anchored to:
- exactly **one domain theme**
- exactly **one subtheme** within that theme
- exactly **one archetype**

The final problem must clearly reflect all three.

Definitions:
- `Theme` = the broader activity or failure area inside the domain
- `Subtheme` = the narrower situation within that theme
- `Archetype` = the underlying problem shape

### Natural-fit rule (MANDATORY)
Reject a candidate if the chosen `Theme + Subtheme` does not describe the problem naturally.

The agent must be able to express the fit in one plain-English sentence of this form:

- `This is a <theme> / <subtheme> problem because ...`

If that sentence sounds strained, overly abstract, or mismatched to the actual failure moment:
- choose a better-fitting theme/subtheme
- or reject the candidate

Do not backfit taxonomy just to fill a matrix slot.
A naturally-classified problem is better than a forced catalog fit.

---

## Stage 4 — shortlist before create (MANDATORY)

For each slot, do this internally before creating anything:

1. Draft **3 candidate ideas** for the slot.
2. Make sure the 3 candidates are meaningfully distinct on at least one of:
   - trigger moment
   - failure moment
   - current workaround
   - primary object of work
   - cadence / frequency
3. Reject any candidate that:
   - crowds a saturated cluster
   - looks like a noun-swapped variant of an existing issue
   - is too generic
   - is only a “tracker/reminder” with no sharp failure moment
   - has a forced or unnatural `Theme + Subtheme` fit
4. Pick the strongest surviving candidate.
5. Search the repo again specifically for that finalist.
6. If it still passes novelty and duplicate checks, immediately call `create_issue` for that one issue before planning later slots.

### Subtheme discipline
For each slot:
- generate candidates from the chosen `theme`
- force the 3 internal candidates to come from **different subthemes** whenever possible
- do not create two issues from the same `domain + theme + subtheme` in one run unless the run size makes it unavoidable and novelty still clearly passes
- if a subtheme repeatedly collapses into the same product shape as nearby issues, reject that subtheme for the current run and choose another

Maintain an internal reject list for the current run.
If a candidate is rejected as a near-duplicate, do not circle back into the same nearby idea space again in this run.

Do not finalize the full batch first and create later.

The required loop is:
- choose one slot
- shortlist
- final duplicate check
- immediately create that issue
- only then move to the next slot

---

## Stage 5 — novelty gate (STRICT)

A candidate is acceptable only if it is materially different from the nearest visible existing issue.

### Minimum novelty rule
A new candidate must differ from the nearest similar visible issue on at least **2** of these axes:
1. trigger moment
2. failure moment
3. current workaround
4. primary object being managed / coordinated / verified
5. cadence or recurrence pattern
6. persona
7. domain context

### Subtheme overlap rule
If a candidate shares the same `domain + theme + subtheme` as a visible nearby issue, reject it unless it differs on at least **3** of these axes:
1. trigger moment
2. failure moment
3. current workaround
4. primary object being managed / coordinated / verified
5. cadence or recurrence pattern
6. persona
7. stakes / consequences

If it still appears to have the same likely product shape, reject it anyway.

### Stricter rule for high-risk spaces
If the candidate shares the same:
- domain
- persona
- and archetype

with a nearby visible issue, it must differ on at least **3** axes above or be rejected.

### Explicit anti-pattern
Reject candidates that are basically:
- same pain shape
- same workaround shape
- same likely product shape
- only the noun changed

---

## Stage 6 — recent-run suppression

Avoid creating issues that are too close to problems created in the last `${{ inputs.avoid_recent_days }}` days, with recency-weighted caution for repeated `domain + theme + subtheme` clusters.

Apply these suppressions unless the candidate is unusually strong and clearly distinct:
- same `domain + theme + subtheme`
- same `domain + archetype`
- same `subtheme + failure moment`
- same `persona + workaround shape`
- same likely product shape or same “solution gravity” toward a reminder/tracker/log app

### novelty_mode behavior

#### conservative
- strongly avoid recent clusters
- require the stricter novelty rule whenever anything feels adjacent
- prefer underrepresented domains/personas over high-confidence but nearby ideas

#### balanced
- avoid recent clusters unless the candidate is clearly sharper and different
- use the default novelty rules above

#### exploratory
- allow closer adjacency only when the candidate opens a genuinely new wedge, trigger, or failure mode
- still reject exact or thin variants

---

## Safe outputs (MANDATORY)

Use safeoutputs tool calls. Do NOT output NDJSON/JSON lines.

- For each issue to create, CALL `create_issue` with:
  - title: `Problem: ...`
  - body: full template text
  - labels: include `domain/<domain>` and `persona/<persona>` when possible
- Create between 1 and `${{ inputs.count }}` issues.
- If you create 0 issues for any reason, CALL `noop` exactly once with a short reason.

Create issues **one-by-one**:
- shortlist
- final duplicate check
- immediately call `create_issue`
- only then move to the next slot

Do not draft, finalize, or summarize a full batch before writing any issues.
If you have completed final checking for one issue, write it immediately.

---

## include_regulated handling

If `include_regulated=false`:
- avoid problems that require handling:
  - medical diagnoses
  - financial account credentials
  - children’s sensitive personal data
  - compliance-heavy clinical or legal workflows
- light admin/finance/health paperwork is still okay if the product shape is clearly non-clinical and non-sensitive

If `include_regulated=true`:
- regulated-ish problems are allowed
- still avoid giving medical, legal, or financial advice
- frame the issue as tracking, coordination, verification, logistics, documentation, or workflow support

---

## Per-issue requirements

For each created issue:

### Title
- `Problem: <7–12 words>`

### Body must include
- `**JTBD:**` one-liner in the format “When…, I want…, so I can…”
- `---`
- `**Context & frequency:**`
- `**Pain / stakes:**`
- `**Current workaround:**`
- `**Failure moment:**`
- `**Evidence strength:**` one of:
  - observed
  - inferred-strong
  - inferred-light
- `**Why software may help:**`
- `---`
- `Domain: <domain>`
- `Theme: <theme>`
- `Subtheme: <subtheme>`
- `Catalog status: <catalog|off-catalog>`
- `Persona: <persona>`
- `Archetype: <archetype>`

### Labels
- Must include: `type/problem`, `stage/0-intake`
- SHOULD include: `domain/<domain>`, `persona/<persona>`

---

## Quality constraints

Reject low-signal issues.

### Do NOT create
- vague “stress / productivity / organization” problems without a concrete failure moment
- macro problems (war, politics, inflation, society-wide complaints)
- feature requests disguised as problems
- ideas whose only plausible solution is “another dashboard”
- ideas whose only pain is mild inconvenience
- ideas that are just generic reminders without a sharp consequence

### Prefer
- clear moment of failure
- concrete money/time/coordination loss
- specific persona in a specific situation
- visible workaround already in use
- software-fit without heroic integrations
- problem shapes that feel different from recent seeds
- problems that are specific at the `theme + subtheme` level, not just the domain level
- Prefer catalog-fit problems when strong, but prefer a stronger off-catalog problem over a weak catalog-compliant one.
- taxonomy that fits naturally in plain English, not labels forced to satisfy rotation

---

## Search guidance for duplicate checks

Before creating a finalist, search existing visible problem issues using:
- persona
- domain
- theme
- subtheme
- core verb
- failure moment
- 1–2 distinctive nouns

Search both broad and narrow variants.

If a visible issue matches the same:
- theme
- subtheme
- JTBD structure
- failure moment
- and likely solution gravity

reject it and choose a different finalist.

---

## Catalog themes by domain (non-exhaustive)

These lists are intentionally non-exhaustive.
They are the default map for exploration, not the full boundary of allowed problem spaces.
Prefer them first, but allow off-catalog discovery when justified by a clearly stronger candidate.

### admin-bureaucracy

1. `identity-and-record-matching`
   - name / transliteration mismatch across agencies
   - date-of-birth / address mismatch
   - duplicate person records
   - updating changed personal details everywhere

2. `eligibility-and-prerequisites`
   - checking eligibility before applying
   - discovering missing prerequisites too late
   - understanding accepted proof types
   - sequencing dependent requirements correctly

3. `applications-and-submissions`
   - incomplete form submission
   - attachment format / size rejection
   - required-field ambiguity
   - re-entering the same data across forms

4. `appointments-and-in-person-visits`
   - booking scarce slots
   - rescheduling after a missed appointment
   - preparing all required documents for the visit
   - coordinating companion / translator / escort attendance

5. `status-tracking-and-follow-up`
   - request stuck with no status visibility
   - unclear next step after submission
   - chasing updates across channels
   - knowing when to escalate

6. `payments-fees-and-penalties`
   - paying the right fee for the right process
   - proving payment to the agency
   - avoiding late penalties
   - reconciling payment receipt with case status

7. `renewals-and-validity-windows`
   - renewal windows opening and closing
   - expired document discovered during another process
   - overlapping validity periods
   - coordinating renewal dependencies

8. `rejections-appeals-and-corrections`
   - understanding why something was rejected
   - correcting and resubmitting
   - appealing within the allowed window
   - assembling supporting proof for reconsideration

9. `cross-agency-coordination`
   - one office waiting on another office
   - carrying the same document to multiple agencies
   - inconsistent instructions across institutions
   - proving one agency action to another

10. `certification-and-official-proof`
   - certified copies / notarization / apostille
   - proof of residence / family status / identity
   - official translations
   - proving authenticity of documents

11. `address-residency-and-local-records`
   - address change propagation
   - local registration / deregistration
   - proof of residence for service eligibility
   - mismatched locality records

12. `representation-and-delegation`
   - applying on behalf of a family member
   - power-of-attorney paperwork
   - guardian / caregiver authorization
   - proxy status proof across institutions

---

### finance

1. `billing-and-payment-obligations`
   - bill due-date confusion
   - autopay failures
   - partial payment tracking
   - avoiding fees from timing mismatches

2. `refunds-reimbursements-and-credits`
   - promised refund not arriving
   - expense reimbursement follow-up
   - store / airline / service credit tracking
   - proving eligibility for reimbursement

3. `disputes-chargebacks-and-fraud`
   - disputing incorrect charges
   - collecting proof for chargebacks
   - tracking bank / card issuer responses
   - recovering after suspected fraud

4. `subscriptions-renewals-and-lapses`
   - accidental renewals
   - losing access after lapse
   - overlapping subscriptions
   - cancellation timing and proof

5. `taxes-filings-and-benefits`
   - collecting tax documents
   - eligibility for deductions / credits
   - filing deadline dependencies
   - status follow-up on tax-related submissions

6. `household-money-coordination`
   - splitting irregular shared expenses
   - reconciling who paid what
   - handling family budget exceptions
   - remembering agreed money rules

7. `cashflow-and-timing-mismatch`
   - expenses due before income arrives
   - moving money across accounts on time
   - avoiding overdrafts from poor timing visibility
   - syncing payment calendars with pay cycles

8. `income-payroll-and-payout-errors`
   - paycheck discrepancy resolution
   - contractor payout follow-up
   - missing bonuses / commissions / reimbursements
   - proving hours / deliverables for payment

9. `claims-warranties-and-coverage-costs`
   - filing a claim with financial consequences
   - proving purchase / ownership
   - tracking deductible / reimbursement implications
   - timing coverage-related renewals

10. `financial-document-gathering`
   - collecting statements for applications
   - finding past invoices / receipts
   - assembling proof of income
   - preparing records for audits / reviews

11. `debt-and-repayment-organization`
   - tracking multiple repayment schedules
   - avoiding missed installments
   - prioritizing debts with different consequences
   - following up on settlement / hardship requests

12. `price-comparison-and-commitment-decisions`
   - comparing offers with different fee structures
   - spotting hidden costs
   - deciding when to lock in a rate / plan
   - tracking price commitments before expiry

---

### health

1. `appointments-referrals-and-authorizations`
   - finding the right appointment type
   - referral requirement discovered late
   - prior authorization status tracking
   - coordinating approval before care

2. `care-plan-follow-through`
   - remembering next steps after a visit
   - tracking ordered tests / consults
   - completing multi-step care tasks
   - knowing what is still pending

3. `labs-imaging-and-results`
   - preparing correctly for tests
   - following up on missing results
   - comparing results across providers
   - bringing the right records to the next visit

4. `records-documents-and-forms`
   - medical record requests
   - transferring records between providers
   - filling health-admin forms
   - keeping vaccination / clearance / exam documents organized

5. `medications-and-supplies`
   - refill timing
   - supply replenishment for ongoing use
   - coordinating prescriptions across providers
   - handling pharmacy substitution / availability issues

6. `caregiver-and-family-coordination`
   - multiple people supporting one patient
   - handoff after appointments
   - sharing instructions accurately
   - covering care when the main caregiver is unavailable

7. `insurance-billing-and-claims`
   - denied claim follow-up
   - billing code / amount mismatch
   - proving eligibility / coverage
   - reconciling provider bill vs insurer response

8. `visit-prep-and-post-visit-recovery`
   - preparing questions and documents
   - arranging transport / companion help
   - tracking recovery instructions after discharge
   - making sure follow-up tasks happen

9. `care-access-and-scheduling-friction`
   - long waitlists
   - reschedule openings
   - coordinating care across providers with conflicting calendars
   - managing missed / cancelled appointments

10. `home-care-and-routine-logistics`
   - daily routine adherence
   - home monitoring record-keeping
   - care tasks across different times of day
   - coordinating temporary substitute caregivers

11. `care-transitions-and-special-events`
   - hospital discharge to home
   - starting care in a new clinic / city / insurer
   - temporary travel while maintaining care routines
   - transferring responsibility between family members

12. `neutral-health-tracking`
   - journaling symptoms / side effects neutrally
   - tracking triggers or context around episodes
   - spotting missing logs needed for appointments
   - organizing observations for a future visit

---

### work

1. `approvals-reviews-and-signoffs`
   - waiting on approvals
   - unclear approver ownership
   - lost context in review loops
   - following up without spamming

2. `handoffs-and-cross-team-coordination`
   - task dropped between teams
   - dependency blocked by another function
   - unclear handoff ownership
   - missing information during transfer

3. `meetings-decisions-and-follow-through`
   - action items disappearing after meetings
   - decision memory getting lost
   - prep work not completed on time
   - attendees not aligned on next steps

4. `documents-knowledge-and-versioning`
   - finding the latest document
   - conflicting versions in circulation
   - knowledge trapped in chats / folders
   - missing context for new joiners

5. `scheduling-staffing-and-shifts`
   - shift swaps and coverage gaps
   - interview scheduling friction
   - vacation / leave coordination
   - on-call / rota confusion

6. `onboarding-training-and-certification`
   - onboarding tasks scattered across systems
   - required training completion drift
   - certification / access expiry
   - unclear readiness for role responsibilities

7. `access-permissions-and-procurement`
   - waiting for system access
   - permission request ambiguity
   - purchasing request status opacity
   - missing prerequisites for equipment / software

8. `expense-reimbursement-and-internal-admin`
   - expense claims missing proof
   - policy confusion during submission
   - late reimbursement follow-up
   - recurring internal form friction

9. `customer-vendor-and-partner-coordination`
   - contractor / vendor follow-up
   - external dependency causing internal delay
   - unclear status between organizations
   - documenting commitments from outside parties

10. `incident-exception-and-recovery`
   - unexpected work disruption
   - triage ownership confusion
   - recovery checklist gaps
   - lessons / actions not captured after the event

11. `field-ops-and-distributed-work`
   - technician / field worker coordination
   - location-specific prep requirements
   - route + task sequencing issues
   - proof of visit / completion collection

12. `status-reporting-and-repeat-communication`
   - repeating the same updates to many stakeholders
   - assembling status from scattered systems
   - weekly reporting overhead
   - inconsistent status wording across audiences

---

### home

1. `maintenance-and-preventive-upkeep`
   - recurring maintenance schedules
   - seasonal home prep
   - forgetting low-frequency tasks
   - tracking what was last done and by whom

2. `repairs-vendors-and-service-calls`
   - comparing repair options
   - coordinating appointments with service providers
   - following up on unfinished work
   - tracking quotes, warranties, and callbacks

3. `utilities-outages-and-service-accounts`
   - opening / closing accounts
   - outage follow-up and updates
   - meter / billing discrepancies
   - proving account ownership / address details

4. `household-items-storage-and-findability`
   - not knowing where items are stored
   - duplicate purchases because items cannot be found
   - seasonal item rotation
   - keeping manuals / spare parts tied to items

5. `renting-landlord-and-building-admin`
   - tracking landlord requests
   - building management communication
   - lease-related deadlines
   - documenting home issues and follow-up

6. `home-insurance-and-damage-events`
   - documenting incidents for claims
   - gathering proof of ownership / value
   - repair coordination after damage
   - claim status follow-up

7. `cleaning-chores-and-role-coordination`
   - recurring chores unevenly distributed
   - unclear ownership of tasks
   - prep for guests / events
   - exceptions when one person is unavailable

8. `packages-deliveries-and-home-access`
   - delivery timing uncertainty
   - package handoff coordination
   - missed deliveries
   - access instructions for workers / couriers

9. `safety-security-and-emergency-readiness`
   - safety check routines
   - emergency supply rotation
   - household contact / utility information readiness
   - incident prep and recovery checklists

10. `renovation-projects-and-change-orders`
   - managing multi-step home projects
   - contractor timeline drift
   - scope changes and cost tracking
   - dependencies between trades / workers

11. `pet-and-dependent-care-at-home`
   - feeding / medicine / routine coordination
   - sitter / walker handoff notes
   - temporary coverage planning
   - keeping supplies stocked

12. `decluttering-disposal-and-replacement`
   - deciding what to keep / donate / toss
   - special disposal rules
   - replacing items after disposal
   - maintaining a record of what left the home

---

### mobility

1. `commute-planning-and-disruption-recovery`
   - recurring route planning
   - disruption fallback choices
   - deciding when to leave earlier
   - preserving commitments when transport fails

2. `parking-tolls-and-fines`
   - parking session expiry
   - toll / violation follow-up
   - proving payment or entitlement
   - appeal timing and evidence

3. `vehicle-maintenance-and-validity`
   - service schedules
   - inspection / registration renewal
   - warranty and repair-history tracking
   - coordinating maintenance around daily use

4. `breakdowns-accidents-and-roadside-events`
   - roadside assistance coordination
   - accident proof gathering
   - insurance / repair handoff after an incident
   - temporary mobility fallback while vehicle is unavailable

5. `public-transport-and-pass-management`
   - pass renewal / expiry
   - disruption alerts that need action
   - transfer timing uncertainty
   - proving fare / discount eligibility

6. `family-pickup-and-shared-ride-coordination`
   - school pickup exceptions
   - ride-sharing responsibilities
   - custody / two-household transport coordination
   - backup driver arrangements

7. `accessibility-and-special-constraint-routing`
   - stroller / wheelchair / mobility constraints
   - elevator / station access uncertainty
   - route suitability under special needs
   - choosing the least-friction trip option

8. `ride-cost-and-option-comparison`
   - taxi / transit / parking tradeoffs
   - recurring trip cost comparison
   - choosing between speed and predictability
   - comparing multimodal options

9. `shared-vehicle-and-asset-coordination`
   - household vehicle sharing
   - company car / pool car booking
   - handoff of keys / passes / charging cards
   - condition / fuel / charge visibility between users

10. `ev-charging-and-range-logistics`
   - planning charging around commitments
   - charger availability uncertainty
   - home vs public charging tradeoffs
   - tracking charging accessories / cards / apps

11. `ownership-documents-and-admin`
   - title / insurance / registration paperwork
   - proving ownership during transactions
   - updating records after sale / purchase
   - document readiness during travel or incidents

12. `lost-items-and-in-transit-recovery`
   - items left on transport
   - tracking recovery attempts
   - proving ownership of lost items
   - coordinating pickup / return after recovery

---

### shopping

1. `comparison-and-selection`
   - comparing similar products with different tradeoffs
   - choosing among confusing bundles / plans
   - deciding with incomplete specs
   - narrowing options for a specific constraint

2. `size-fit-and-compatibility`
   - sizing uncertainty across brands
   - compatibility with existing gear / appliances
   - replacement-part fit verification
   - avoiding wrong-format purchases

3. `purchasing-proof-and-records`
   - keeping receipts accessible
   - matching order to proof of purchase
   - preserving warranty-relevant details
   - finding proof later for returns / claims

4. `delivery-preorder-and-availability`
   - preorder status opacity
   - partial shipment confusion
   - restock timing uncertainty
   - deciding whether to wait, switch, or cancel

5. `returns-exchanges-and-recovery`
   - return window management
   - exchange vs refund decision tracking
   - partial return complications
   - proving condition / eligibility during disputes

6. `warranty-claims-and-aftercare`
   - warranty coverage interpretation
   - repair vs replacement path
   - claim evidence gathering
   - following up with manufacturer / retailer

7. `recurring-rebuy-and-household-replenishment`
   - running out of essentials
   - timing reorders across many items
   - balancing bulk vs freshness / storage
   - remembering preferred versions of repeat buys

8. `shared-shopping-and-list-coordination`
   - duplicate buys by family members
   - unclear ownership of shopping tasks
   - conflict between preferences on the same list
   - handling substitutions when one person shops for another

9. `gift-purchasing-and-event-buying`
   - remembering constraints and preferences
   - tracking gift ideas over time
   - timing deliveries around events
   - exchanges / returns after gifting

10. `marketplace-and-seller-trust`
   - comparing sellers, not just products
   - spotting risky listings
   - tracking promises made by sellers
   - documenting issues for disputes

11. `used-refurbished-and-replacement-buying`
   - verifying condition before purchase
   - comparing repair vs replacement economics
   - checking missing accessories / documentation
   - tracking serial / model details for fit

12. `household-stock-vs-waste-tradeoffs`
   - overbuying because visibility is poor
   - buying too little and running out
   - perishable vs non-perishable planning
   - storage-capacity-aware shopping decisions

---

### education

1. `assignments-deadlines-and-submissions`
   - missing due dates across platforms
   - attachment / format submission issues
   - unclear rubric or submission method
   - late-work exception handling

2. `study-planning-and-exam-prep`
   - balancing multiple exams
   - planning review cadence
   - spotting what has not been covered yet
   - adjusting after falling behind

3. `notes-materials-and-resource-findability`
   - scattered class resources
   - confusion over latest study material
   - losing access to key notes
   - organizing material by topic and assessment

4. `group-work-and-collaboration`
   - task ownership ambiguity
   - missed handoffs in group projects
   - version confusion in shared work
   - contribution evidence during disputes

5. `school-admin-and-family-communication`
   - parent notices getting lost
   - permissions / forms / signatures
   - absence paperwork
   - event / trip / school-day logistics

6. `applications-admissions-and-enrollment`
   - application component tracking
   - recommendation / document collection
   - enrollment step dependencies
   - decision / waitlist follow-up

7. `financial-aid-scholarships-and-fees`
   - scholarship deadline coordination
   - fee payment proof
   - document gathering for aid
   - status opacity in aid processing

8. `accommodations-support-and-special-needs`
   - arranging accommodations on time
   - proving eligibility for support
   - renewing support documentation
   - coordinating accommodations across courses / systems

9. `attendance-schedule-and-routine-friction`
   - timetable changes
   - missed sessions from schedule confusion
   - balancing travel / work / school constraints
   - keeping recurring academic routines stable

10. `extracurriculars-clubs-and-activities`
   - registration windows
   - schedule conflicts between activities
   - parent / student / coach coordination
   - tracking requirements and equipment

11. `certifications-testing-and-registration`
   - exam registration readiness
   - external certification prerequisites
   - test-day document preparation
   - retake / validity window tracking

12. `feedback-progress-and-intervention`
   - seeing patterns across teacher feedback
   - spotting missing or late grades
   - deciding when support is needed
   - coordinating remediation or catch-up plans

---

### family

1. `calendar-coordination-and-conflict-resolution`
   - overlapping family commitments
   - last-minute schedule changes
   - remembering which plan is current
   - resolving conflicts between priorities

2. `child-activity-and-school-logistics`
   - pickup / drop-off coordination
   - equipment / permission / event readiness
   - rotating responsibilities between adults
   - handling exceptions and cancellations

3. `caregiving-and-coverage`
   - elder-care coverage gaps
   - babysitting / respite coordination
   - backup care when routines break
   - transferring care instructions between people

4. `co-parenting-and-multi-household-coordination`
   - schedule handoffs between homes
   - document / clothing / equipment transfer
   - shared decision follow-through
   - exception handling during travel / sickness

5. `household-decisions-and-memory`
   - forgetting what was agreed
   - repeated discussions because decisions are not recorded
   - keeping rationale for future reference
   - tracking unresolved family decisions

6. `documents-records-and-official-family-proof`
   - keeping certificates / IDs / school records organized
   - retrieving the right record quickly
   - knowing what must be updated after life changes
   - preparing family documents for applications or travel

7. `roles-chores-and-responsibility-balance`
   - uneven invisible labor
   - unclear ownership of recurring tasks
   - temporary swaps when someone is unavailable
   - accountability without over-managing

8. `events-celebrations-and-gift-coordination`
   - remembering milestones
   - planning across preferences and budgets
   - coordinating contributions from multiple relatives
   - managing post-event cleanup and returns

9. `family-money-and-shared-obligations`
   - who pays for what in a family context
   - tracking reimbursements between relatives
   - budget exceptions for kids / elders / events
   - aligning spending with family rules

10. `routines-boundaries-and-agreements`
   - screen-time / bedtime / household-rule consistency
   - keeping agreements visible
   - handling exceptions fairly
   - maintaining routines across caregivers or households

11. `emergency-readiness-and-contact-visibility`
   - knowing who to reach and when
   - keeping critical medical / school / contact info current
   - temporary guardianship / pickup authorizations
   - emergency plan coordination

12. `intergenerational-support-and-communication`
   - coordinating help for older relatives
   - translating / relaying information between generations
   - remembering preferences and constraints
   - reducing confusion in multi-person family support

---

### food

1. `meal-planning-and-decision-friction`
   - deciding what to eat under time constraints
   - matching meals to available ingredients
   - balancing variety with routine
   - planning for different schedules in one household

2. `pantry-fridge-and-freezer-visibility`
   - not knowing what is already at home
   - duplicate buying
   - item rotation by freshness
   - using freezer inventory intentionally

3. `shopping-to-meal-execution`
   - turning meal ideas into a practical shopping list
   - substituting missing ingredients
   - adjusting plans after items are unavailable
   - syncing purchases with when food will actually be cooked

4. `leftovers-waste-and-expiry-management`
   - forgetting leftovers
   - expiring produce / dairy / prepared food
   - deciding what can still be used
   - planning meals around high-risk items

5. `dietary-preferences-and-restrictions`
   - feeding multiple people with different restrictions
   - allergy / intolerance-safe planning
   - tracking accepted substitutions
   - restaurant or guest meal coordination with constraints

6. `school-work-and-on-the-go-food-logistics`
   - lunch prep for repeated weekdays
   - snack / meal packing under time pressure
   - remembering supplies for different routines
   - coordinating food responsibilities across caregivers

7. `hosting-guests-and-events`
   - planning menus for mixed preferences
   - timing prep across many dishes
   - scaling quantities
   - tracking what guests are bringing

8. `batch-cooking-and-replenishment`
   - planning what to cook in bulk
   - portioning and labeling
   - knowing when to restock staples
   - syncing prep with freezer capacity and household demand

9. `restaurant-takeout-and-order-accuracy`
   - choosing among options quickly
   - remembering repeat preferences
   - checking order completeness / correctness
   - coordinating group ordering without confusion

10. `cost-vs-convenience-tradeoffs`
   - deciding when convenience is worth paying for
   - comparing homemade vs store-bought paths
   - balancing healthy intent with time reality
   - making budget-aware food choices without constant recalculation

11. `nutrition-and-routine-consistency`
   - maintaining a simple eating routine
   - spotting skipped meals / patterns
   - coordinating food with activity / school / work constraints
   - keeping tracking lightweight enough to sustain

12. `holiday-seasonal-and-special-occasion-food`
   - special menu planning
   - ingredient sourcing for limited-time items
   - timing prep around traditions or guests
   - managing leftovers and storage after big meals

---

### security-privacy

1. `passwords-credentials-and-access-readiness`
   - keeping account access recoverable
   - tracking where credentials matter most
   - rotating weak or reused credentials
   - preparing trusted access for emergencies

2. `account-recovery-and-lockout-prevention`
   - backup code readiness
   - recovery method drift after phone/email changes
   - proving account ownership during recovery
   - family or team recovery handoff planning

3. `device-update-and-protection-drift`
   - delayed updates across many devices
   - unclear protection status
   - coordinating updates for less technical family members
   - reducing disruption while staying current

4. `phishing-scams-and-suspicious-contact-triage`
   - suspicious SMS / calls / emails
   - deciding what is safe to ignore or escalate
   - keeping proof of incidents
   - helping family members handle suspicious contact safely

5. `identity-theft-and-post-incident-recovery`
   - response steps after suspected compromise
   - documenting what was affected
   - tracking notifications / freezes / follow-up
   - coordinating recovery across multiple services

6. `privacy-settings-and-data-exposure`
   - checking high-risk privacy settings
   - visibility drift after app / platform changes
   - understanding what is publicly exposed
   - maintaining a lightweight review routine

7. `secure-document-sharing-and-redaction`
   - sending sensitive documents safely
   - sharing only the necessary fields
   - keeping an audit trail of what was shared
   - reusing safe redaction / sharing practices

8. `permissions-and-shared-access-review`
   - who has access to what
   - stale shared access
   - family / team admin roles getting messy
   - periodic review of delegated permissions

9. `backup-readiness-and-restoration-confidence`
   - not knowing what is actually backed up
   - missing important categories of data
   - restoration uncertainty before a real incident
   - scheduling lightweight checks

10. `device-handover-resale-and-offboarding`
   - preparing devices for sale / transfer
   - removing accounts and personal data fully
   - tracking accessories / serial numbers / reset status
   - handing a device to a relative safely

11. `child-elder-and-dependent-digital-safety`
   - helping less technical users stay safe
   - keeping guidance simple and repeatable
   - balancing oversight with autonomy
   - coordinating safety settings across caregivers

12. `privacy-rights-and-follow-up-requests`
   - requesting data deletion / export
   - tracking responses from companies
   - proving the request scope and timing
   - following up when the process stalls

---

### travel

1. `pre-departure-readiness`
   - packing by trip type
   - departure checklist timing
   - last-mile prep before leaving home
   - avoiding forgotten essentials for early departures

2. `documents-visas-and-entry-requirements`
   - passport / visa readiness
   - destination-specific entry rule verification
   - family document dependencies
   - gathering supporting proof for travel admin

3. `bookings-itinerary-and-confirmation-findability`
   - scattered reservations
   - version confusion after changes
   - keeping one usable itinerary view
   - retrieving key confirmations quickly during travel

4. `changes-cancellations-and-rebooking-recovery`
   - missed or changed connections
   - cancellation follow-up
   - choosing among rebooking options under pressure
   - keeping commitments aligned after travel disruption

5. `airport-station-and-local-transfer-coordination`
   - first / last mile planning
   - transfer timing uncertainty
   - multi-person arrival coordination
   - backup options when transport fails

6. `lodging-stay-and-check-in-friction`
   - check-in instructions buried in messages
   - arrival-time coordination
   - exceptions or issues during the stay
   - proving what was promised vs delivered

7. `trip-money-expenses-and-reimbursement`
   - splitting travel costs
   - keeping receipts for work or shared trips
   - expense categorization while moving
   - reimbursement follow-up after return

8. `insurance-claims-and-compensation`
   - deciding when a travel issue is claim-worthy
   - collecting proof during disruption
   - tracking claim steps after the trip
   - compensation follow-up with airlines / providers

9. `group-travel-and-role-coordination`
   - keeping everyone aligned on timing
   - task division across travelers
   - handling partial plan changes for one person
   - reducing repeated coordination messages

10. `health-accessibility-and-special-needs-travel`
   - medication / equipment readiness
   - accessibility constraints in itinerary choices
   - planning around rest, food, or care routines
   - keeping essential support details accessible during travel

11. `lost-items-baggage-and-recovery`
   - baggage status uncertainty
   - lost item reporting and proof
   - deciding what to replace immediately
   - coordinating pickup / return after recovery

12. `post-trip-cleanup-and-follow-through`
   - expense and receipt cleanup
   - returning borrowed / rented items
   - organizing photos / documents / leftover credits
   - wrapping unresolved travel admin after arrival home