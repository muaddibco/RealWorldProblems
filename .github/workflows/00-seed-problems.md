---
name: "RW: Seed Problems"
on:
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
        default: "false"
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
    # Base labels; the agent SHOULD also include domain/* and persona/* labels per issue if allowed
    labels: [type/problem, stage/0-intake]
    max: 50
  noop:
---

# Seed problems (diversity-rotated)

Tooling note:
- Search/read existing issues using GitHub MCP issue tools (issue_read/list_issues/search_issues).
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `missing_tool` once and stop.

Create `${{ inputs.count }}` new `type/problem` issues using the canonical Problem Candidate structure from AGENTS.md.
Avoid obvious duplicates by searching existing "Problem:" issues before creating.

If a generated problem is too similar to an existing issue, skip it and generate another.

## Domain list (round-robin order)
Use this exact order for **balanced** mode; wrap around as needed:

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

## Persona list (round-robin order)
Use this order; wrap around as needed:

1. consumer
2. employee
3. family-parent
4. student
5. freelancer
6. smb-owner
7. senior

## Rotation rules
### balanced
- For i = 1..count:
  - domain = Domains[(i mod #Domains)]
  - persona = Personas[(i mod #Personas)]
  - If persona repeats the previous persona, advance persona by +1 (wrap).
- Enforce caps:
  - No persona appears more than ceil(count / #Personas) + 1 times.
  - No domain appears more than ceil(count / #Domains) + 1 times.

### domain_focus
- Use focus_domain for all items (if empty, fallback to balanced).
- Rotate personas using the Persona list rules above.

### persona_focus
- Use focus_persona for all items (if empty, fallback to balanced).
- Rotate domains using the Domain list rules above.

### Theme rotation rule (applies to all modes)
- Each generated problem must be anchored to exactly one theme from the chosen domain.
- The JTBD, context, pain, and workaround must clearly reflect that theme.
- If the output looks like a near-duplicate of an earlier theme output in the same run, regenerate.

## Safe outputs (MANDATORY)
Use safeoutputs tool calls. Do NOT output NDJSON/JSON lines.

- For each issue to create, CALL `create_issue` with:
  - title: "Problem: ..."
  - body: full template text (JTBD, context/frequency, pain, workaround)
  - labels: include domain/<domain> and persona/<persona> when possible
- Create between 1 and `${{ inputs.count }}` issues.
- If you create 0 issues for any reason, CALL `noop` exactly once with a short reason.

Create issues one-by-one: draft → immediately call `create_issue`.

Also:
- Create issues one-by-one (create the issue immediately after drafting it).
- Do not spend tokens drafting all issues before creating any.

## include_regulated handling
- If include_regulated=false:
  - Avoid problems that require handling medical diagnoses, financial account credentials, children’s personal data, or anything likely to require compliance-heavy workflows.
  - It’s okay to include “light” finance/admin issues (budgeting, reminders, paperwork tracking) without sensitive data.

## Per-issue requirements
For each created issue:
- Title: `Problem: <7–12 words>`
- Body must include:
  - JTBD one-liner (“When…, I want…, so I can…”)
  - Context & frequency
  - Pain / stakes
  - Current workaround
- Labels:
  - Must include: type/problem, stage/0-intake
  - SHOULD include: domain/<domain>, persona/<persona>
    - If you cannot add variable labels at creation time, include:
      `Domain: <domain>` and `Persona: <persona>` in the body so Normalizer can label it later.

## Quality constraints (avoid low-signal issues)
- No vague items (“stress”, “productivity”) without a concrete context.
- No “macro” problems (war, politics, inflation).
- Prefer problems with a clear moment of failure:
  - missed deadline, paid fee, forgot document, lost time, got scammed, wasted money, couldn’t coordinate, etc.

Always emit create-issue actions (or noop if nothing to do).

## Theme rotation (within a domain)
For each generated item i:
- domain_theme_index = i mod (#themes for the chosen domain)
- pick that theme as the focus so we don’t generate near-duplicates.

### Themes by domain

#### admin-bureaucracy
1. Appointment booking & rescheduling (municipality, government, utilities)
2. Document renewal tracking (IDs, licenses, permits)
3. Form filling & submission errors (missing fields, wrong formats)
4. Status tracking for requests (where is my application?)
5. Fee/penalty avoidance (deadlines, late fees)
6. Collecting required documents from multiple sources
7. Transliteration/name mismatch issues across systems
8. Queue/time optimization (when to go, what to bring)
9. Cross-agency coordination (one request needs 2–3 offices)
10. Handling rejections/appeals (why rejected, what to fix)

#### finance (non-sensitive / no credentials required)
1. Subscription & renewal tracking (free trials, annual renewals)
2. Bill reminders + bill dispute workflow (no bank login)
3. Refund follow-up tracking (merchant says “processed”, user waits)
4. Expense splitting for groups (trips, roommates, dinners)
5. Budgeting with receipts (manual entry / photo capture without bank access)
6. Price-drop alerts & better-deal detection (cart, recurring purchases)
7. Warranty tracking & claims reminders (purchase → claim window)
8. Household shared spending rules (who pays what, when)
9. Savings goals & “nudges” (no investment advice)
10. Invoice/receipt organization for self-employed (lightweight)

#### health (avoid regulated / no diagnosis / no medical advice)
1. Finding and booking appointments (specialists, clinics)
2. Medication reminders (generic; user-provided schedules)
3. Tracking adherence to routines (hydration, stretching, rehab exercises)
4. Managing “health admin” documents (referrals, lab PDFs as files)
5. Waiting list / reschedule opportunity alerts
6. Family caregiver coordination (who takes whom when)
7. Symptom journaling (neutral logging; no diagnosis)
8. Insurance paperwork tracking (claims status, required docs)
9. Language barriers in health admin (translation of instructions)
10. Preventive routine tracking (checkups schedule reminders)

#### work
1. Meeting follow-ups & action items (lightweight CRM for tasks)
2. Context switching overload (focus blocks, notification control)
3. Approval/review bottlenecks (who is blocking what)
4. Document/version confusion (which file is the latest)
5. Status reporting overhead (weekly updates auto-draft)
6. Hiring/interview scheduling coordination
7. Cross-team handoffs (requirements missing, unclear ownership)
8. Onboarding checklists (role-based)
9. Repetitive form/report generation (templates)
10. Knowledge base “findability” (better search + summaries)

#### home
1. Home maintenance scheduling (filters, inspections)
2. Household inventory (where is what, what needs restock)
3. Cleaning task coordination (shared responsibilities)
4. Appliance manuals/warranties in one place
5. Energy usage nudges (no utility credentials required)
6. Repair vendor tracking (quotes, appointments, notes)
7. Pet care routines (feeding/walk schedule coordination)
8. Package delivery coordination (neighbors, safe drop spots)
9. Home safety checks (smoke alarm battery, emergency kit)
10. “Things to do before guests” checklists

#### mobility
1. Commuting plan optimization (multi-modal reminders)
2. Parking reminders & expiration (meter, permits)
3. Car maintenance reminders (service intervals)
4. Public transport disruption alerts (route alternatives)
5. Ride-sharing cost comparison (manual)
6. Travel time prediction for recurring trips
7. School run / pickup coordination for parents
8. Accessibility needs routing (elevators, stairs avoidance)
9. Lost item recovery tracking (taxis, buses)
10. Ticket/pass renewal reminders

#### shopping
1. Grocery list that maps to store layout (user-defined)
2. Meal-to-cart planning (simple)
3. “Rebuy” recurring items reminders
4. Brand substitution preferences (allergies/preferences without health claims)
5. Returns workflow tracking (labels, deadlines, status)
6. Price comparison for a shortlist (manual links)
7. Gift planning (occasions, budgets, ideas)
8. Household shared list conflict resolution (who added what)
9. Bulk buying vs waste tradeoffs (simple reminders)
10. “What can I cook with what I have” (inventory-based)

#### education
1. Homework planning & deadlines (student + parent)
2. Study habit tracking & streaks (no claims)
3. Note organization + quick summaries
4. Group project coordination (roles, deliverables)
5. Exam prep schedule generator
6. Learning resource curation (links + tags)
7. School admin deadlines (forms, permissions)
8. Parent-teacher communication tracking
9. Reading list and progress tracking
10. Language learning practice reminders

#### family
1. Family calendar conflict resolution
2. Child activities logistics (gear checklists, pickup)
3. Shared household decision tracking (“what did we decide?”)
4. Elder care coordination (tasks, meds reminders, appointments)
5. Family budgeting light (allowance tracking)
6. Parenting routine checklists (morning/evening)
7. Family document vault (IDs, school docs)
8. Coordinating celebrations/events (tasks, invites)
9. Screen time agreements (tracking + reminders)
10. Shared shopping/errands splitting

#### food
1. Meal planning from preferences + time constraints
2. Pantry-to-recipes suggestions
3. Food waste reduction reminders (expiry tracking)
4. Restaurant decision helper (constraints + distance)
5. Cooking workflow timers (multi-step)
6. Nutrition logging (basic; no medical claims)
7. Grocery substitution preferences
8. Bulk cooking planning & portioning
9. “What’s for dinner” family voting
10. Dietary preference tracking (ethical, taste; no diagnosis)

#### security-privacy (avoid hacking; focus on safety hygiene)
1. Password rotation reminders + manager onboarding (no credential collection)
2. Phishing awareness training for families
3. Personal data “where shared” tracker (accounts list)
4. Device update reminders (OS/app updates)
5. Account recovery checklist organization
6. Backup reminders and checklists
7. Scam call/SMS logging + guidance (generic)
8. Privacy settings checklist per major app (links)
9. Secure document storage + sharing for family
10. “What to do if hacked” step-by-step plan (defensive)

#### travel
1. Packing checklist per trip type
2. Visa/document readiness tracking (generic)
3. Trip itinerary consolidation (email → plan)
4. Booking confirmation vault + reminders
5. Travel insurance decision helper (non-advice; comparison)
6. Local SIM/eSIM planning checklist
7. Group travel coordination (who booked what)
8. Jet lag / schedule adjustment planner
9. Expense splitting for trips (light)
10. “What to do before departure” timeline

## Duplicate avoidance (during seeding)
Before creating an issue:
- Search existing issues for 3–6 key phrases from:
  - persona + theme + core verb (“refund tracking”, “renewal reminder”, “returns deadline”)
- If an existing issue matches the same persona+theme+JTBD structure:
  - Skip and generate a different problem for that slot.