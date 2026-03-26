---
name: "RW: Seed Problems"
on:
  # schedule: every 4h
  workflow_dispatch:
    inputs:
      count:
        description: "How many problems to create in this run (suggest 10–50)"
        required: true
        default: "25"
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
        description: "If mode=persona_focus, use e.g. consumer | employee | smb-owner"
        required: false
        default: ""
      include_regulated:
        description: "Allow regulated-ish problems (health/finance/kids) in output"
        required: true
        default: "true"
        type: choice
        options:
          - "false"
          - "true"

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

safe-outputs:
  staged: false
  github-token: ${{ secrets.SAFEOUTPUTS_GITHUB_TOKEN }}
  create-issue:
    labels: [type/problem, stage/0-intake]
    max: 50
  noop:
---

# Seed problems (survival-oriented, diversity-constrained)

Tooling note:
- Search/read existing issues using GitHub MCP issue tools (issue_read/list_issues/search_issues).
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `noop` exactly once with reason `missing GitHub read tools` and stop.

## Objective
Generate new `type/problem` issues that are:
1. Novel relative to existing open problems
2. Likely to survive downstream gates:
   - software-fit/yes or software-fit/partial
   - stronger score bands
   - wedge/credible
   - eventual validation
3. Still diverse across domains, personas, and themes

Do not optimize for diversity alone.
Prefer problems with:
- a concrete failure moment
- recurring pain
- a visible manual workaround
- a plausible software wedge
- non-macro scope
- everyday user relevance

Create `target_count` new `type/problem` issues using the canonical Problem Candidate structure from AGENTS.md, augmented by the required fields below.

## Resolve inputs
Set:
- `target_count` = workflow input `count` if available and numeric; otherwise `25`
- `run_mode` = workflow input `mode` if available; otherwise `balanced`
- `run_focus_domain` = workflow input `focus_domain` if provided, normalized to one of the domain names below (without `domain/`)
- `run_focus_persona` = workflow input `focus_persona` if provided, normalized to one of the persona names below (without `persona/`)

## Strict input enforcement
Do not silently ignore invalid focus inputs.

- If `run_mode=domain_focus` and `run_focus_domain` is empty or invalid, emit `noop` exactly once with a short reason and stop.
- If `run_mode=persona_focus` and `run_focus_persona` is empty or invalid, emit `noop` exactly once with a short reason and stop.
- If `run_mode=domain_focus`, every created issue MUST use that exact domain.
- If `run_mode=persona_focus`, every created issue MUST use that exact persona.
- Do not fall back to `balanced` when a focus mode was explicitly requested.

## Backlog / volume guardrails
Before creating anything:

1. Count open issues labeled `type/problem`.
   - If count is `500` or more, create nothing, emit `noop` exactly once, and stop.

2. Count open issues labeled either:
   - `type/problem` + `stage/0-intake`
   - `type/problem` + `stage/1-normalized`
   Let `early_backlog` be the sum.
   Let `backlog_limit = max(150, 5 * target_count)`.
   - If `early_backlog >= backlog_limit`, create nothing, emit `noop` exactly once with a short reason, and stop.

## Pre-generation scans (MANDATORY)
Before choosing topics, do all of the following:

### A. Validation coverage scan
- Read all open `type/problem` + `stage/7-validation` issues.
- Cluster them into covered topic areas by similarity of:
  - core problem / JTBD
  - theme
  - trigger / failure moment
  - persona / context
- Build a short internal list of "already covered" clusters.

### B. Pipeline feedback scan
Search recent issues that indicate what tends to survive or fail:
- successful-ish signals:
  - `score/top-10`
  - `score/top-50`
  - `wedge/credible`
  - `stage/7-validation`
- failure signals:
  - `archive/not-software`
  - `archive/no-wedge`

Use this to build a lightweight internal map:
- areas that repeatedly survive
- areas that repeatedly fail software fit
- areas that repeatedly fail wedge quality

Directional judgment is enough; perfect statistics are not required.

## Seeding strategy: mixed allocation
Split the run into two lanes:

- `likely_winner_slots = ceil(target_count * 0.70)`
- `exploratory_slots = target_count - likely_winner_slots`

### likely_winner lane
Prefer candidates that are more likely to survive downstream:
- concrete failure moment
- clear recurring pain
- obvious time/money/risk reduction
- realistic software leverage
- lightweight validation path
- not heavily dependent on deep partnerships or compliance-heavy operations unless clearly justified

Use pipeline feedback scan results to bias toward themes/personas/domains that have shown better downstream survival.

### exploratory lane
Prefer under-covered areas:
- domains/themes/personas underrepresented in open `stage/7-validation`
- adjacent but still distinct spaces
- novel combinations that are meaningfully different from already-covered clusters

Exploration is for breadth, but still keep quality constraints.

## Domain list (balanced mode rotation order)
Use this exact order for `balanced` mode; wrap around as needed:

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

## Persona list (rotation order)
Use this order; wrap around as needed:

1. consumer
2. employee
3. family-parent
4. student
5. freelancer
6. smb-owner
7. senior

## Rotation rules
Use zero-based slot indexing for clarity:
- `slot_index = 0..target_count-1`

### balanced
For each slot:
- domain = Domains[slot_index mod #Domains]
- persona = Personas[slot_index mod #Personas]
- If persona would repeat the immediately previous persona, advance persona by +1 with wrap.

Enforce soft diversity caps:
- No persona appears more than `ceil(target_count / #Personas) + 1` times
- No domain appears more than `ceil(target_count / #Domains) + 1` times

### domain_focus
- Domain = `run_focus_domain` for every item
- Rotate personas using the Persona list rules above
- Do not use balanced domain rotation

### persona_focus
- Persona = `run_focus_persona` for every item
- Rotate domains using the Domain list rules above
- Do not use balanced persona rotation

## Theme rotation rule
Applies to all modes.

- Each generated problem must be anchored to exactly one theme from the chosen domain.
- The JTBD, context, pain, workaround, and failure moment must clearly reflect that theme.
- If output looks like a near-duplicate of an earlier theme output in the same run, regenerate.

Within a domain, rotate across themes before reusing the same theme unless the reuse is clearly for a meaningfully different persona + context + failure moment.

## Duplicate avoidance (MANDATORY)
Before creating each issue:

### 1. Phrase search
Search existing issues for 3–6 key phrases derived from:
- persona
- theme
- core verb / action
- failure moment
- desired outcome

Examples:
- `refund tracking delayed reimbursement employee`
- `renewal reminder permit late fee senior`
- `returns deadline label status consumer`

### 2. Cluster comparison
Compare candidate against:
- open `type/problem` issues
- open `stage/7-validation` clusters
- recent archived failure patterns if highly similar

### 3. Candidate fingerprint
Create an internal fingerprint with:
- domain
- theme
- persona
- trigger
- failure moment
- desired outcome
- current workaround

Treat a candidate as too similar and skip/regenerate if it matches the same underlying problem shape even when wording differs.

A near-duplicate is one where most of the following match:
- same domain + theme
- same persona or very close equivalent
- same trigger
- same failure moment
- same desired outcome
- same workaround style

## Attempt policy
- Keep generating until you create exactly `target_count` issues, unless blocked by duplicate avoidance or the guardrails above.
- Use `attempt_limit = max(20, 3 * target_count)`.
- If the limit is reached:
  - if 0 issues were created, emit `noop` exactly once with a short reason
  - if 1 or more issues were created, stop after the created issues and do not emit extra prose

## include_regulated handling
If `include_regulated=false`:
- Avoid problems that require handling:
  - medical diagnosis or medical advice
  - financial account credentials
  - children’s sensitive personal data
  - compliance-heavy regulated operations
- “Light” finance/admin problems are still okay:
  - reminders
  - tracking
  - paperwork
  - document organization
  - neutral journaling
  - general coordination

If `include_regulated=true`:
- Regulated-ish areas are allowed, but still prefer operationally lighter problems unless the problem remains clearly software-led and narrow in scope.

## Per-issue requirements
For each created issue:

### Title
- `Problem: <7–12 words>`

### Body must include
- JTBD one-liner:
  - `When …, I want …, so I can …`
- Context & frequency
- Pain / stakes
- Current workaround
- Failure moment
- Evidence strength
- Why software may help

### Evidence strength
Use exactly one:
- `observed`
- `inferred-strong`
- `inferred-weak`
- `analogy`

### Failure moment
State the concrete moment the user loses:
- time
- money
- access
- confidence
- coordination
- deadline
- safety margin

Examples:
- missed deadline
- paid a late fee
- forgot a required document
- lost time in a queue
- couldn’t coordinate pickup
- submitted the wrong form
- missed a refund window
- got stuck with unclear status

### Labels
- Must include:
  - `type/problem`
  - `stage/0-intake`
- SHOULD include:
  - `domain/<domain>`
  - `persona/<persona>`

### Body metadata
Always include both in the issue body:
- `Domain: <domain>`
- `Persona: <persona>`

These fields are the canonical fallback source for the normalizer if labels are missing or inconsistent.

## Quality constraints (avoid low-signal issues)
Do not create:
- vague abstractions like “stress”, “productivity”, “better wellness” without a concrete recurring context
- macro topics like war, politics, inflation, geopolitics
- problems that are mainly opinions, broad social commentary, or impossible to validate narrowly
- items that only make sense as giant platforms with no narrow wedge

Prefer:
- a narrow, identifiable user
- a repeatable trigger
- a clear failure moment
- a visible current workaround
- a problem that could plausibly be solved with software before requiring major services/ops

## Safe outputs (MANDATORY)
Use safeoutputs tool calls. Do NOT output NDJSON/JSON lines.

For each issue to create:
- CALL `create_issue` with:
  - title: `Problem: ...`
  - body: full template text
  - labels: include `domain/<domain>` and `persona/<persona>` when possible

Create issues one-by-one:
- draft one issue
- immediately call `create_issue`
- then move to the next issue

Do not spend tokens drafting all issues before creating any.

If you create 0 issues for any reason:
- CALL `noop` exactly once with a short reason

Always emit safe outputs or `noop`.