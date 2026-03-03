---
name: "RW: Seed Problems"
on:
  schedule: every 4h
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

Create `target_count` new `type/problem` issues using the canonical Problem Candidate structure from AGENTS.md.

Set `target_count` as follows:
- If workflow input `count` is available and numeric, use it.
- Otherwise use `25`.
- Never assume `5` by default.

Create exactly `target_count` issues unless blocked by duplicate-avoidance rules or the 500-open-problems guardrail.

Very important! Follow the following guides:
  1. Before choosing topics, run a **coverage scan** over open issues labeled `stage/7-validation`
  2. Read all open `type/problem` + `stage/7-validation` issues.
  3. Cluster them into covered topic areas by similarity of core problem/JTBD.
  4. Build a short internal list of "already covered" topic clusters.
  5. Prefer generating seeds in under-covered areas.
  6. Avoid proposing topics that are materially similar to those stage/7 clusters unless a clearly different persona/context/wedge is evident.

Before creating issues, check how many open issues currently have label `type/problem`.
- If count is **500 or more**, create nothing, CALL `noop` exactly once, and stop.
- If count is below 500, proceed normally.

Very important! If a generated problem is too similar to an existing issue, skip it and generate another.

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
- Create between 1 and `target_count` issues.
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

1. Appointment booking prerequisites checklist [public] [manual]
Failure moment: The moment it fails is when the user arrives/tries to book and learns a prerequisite is missing, which causes a wasted trip or lost slot because the portal/notice didn’t make requirements actionable.

2. Renewal deadline tracking [calendar] [inbox/pdf]
Failure moment: The moment it fails is when a renewal window passes unnoticed, which causes penalties or service interruption because reminders and documents were scattered.

3. Form rejected with vague error [manual] [inbox/pdf]
Failure moment: The moment it fails is when the portal rejects submission with an unclear message, which causes rework and delays because the user can’t map the error to the exact field/format.

4. Request status is unclear [inbox/pdf] [sms]
Failure moment: The moment it fails is when the user can’t tell if an application is progressing, which causes missed follow-ups because status updates are fragmented across channels.

5. Fee/penalty avoidance (deadlines) [inbox/pdf] [calendar]
Failure moment: The moment it fails is when a deadline in a letter/email is overlooked, which causes late fees because the date wasn’t extracted into reminders.

6. Collecting documents from multiple sources [manual] [inbox/pdf]
Failure moment: The moment it fails is when submission day arrives and one required document is missing, which causes rejection or rescheduling because requirements weren’t broken into a collection plan.

7. Name/transliteration mismatch [manual] [inbox/pdf]
Failure moment: The moment it fails is when a system rejects a request due to inconsistent name spelling, which causes delays because there’s no “name variants + proof” bundle.

8. Queue/time optimization [public] [manual]
Failure moment: The moment it fails is when the user waits hours or is turned away, which causes lost time because they didn’t know the best time/day and what to bring.

9. Cross-agency coordination dependencies [manual] [public]
Failure moment: The moment it fails is when step B can’t proceed until step A is done elsewhere, which causes bouncing between offices because dependencies weren’t explicit.

10. Rejections/appeals workflow [inbox/pdf] [manual]
Failure moment: The moment it fails is when a rejection arrives and the user doesn’t know the fix, which causes repeated rejection because “why rejected → what to change” isn’t translated into actions.

11. Address/name change propagation [manual] [inbox/pdf]
Failure moment: The moment it fails is when one agency updates but another still shows old data, which causes verification failures because propagation steps weren’t tracked.

12. Identity verification troubleshooting [public] [inbox/pdf]
Failure moment: The moment it fails is when the portal says “can’t verify,” which causes a dead-end because the user doesn’t know which evidence to gather and in what order.

#### finance (non-sensitive / no credentials)

1. Subscription/renewal tracking [inbox/pdf] [calendar]
Failure moment: The moment it fails is when a trial converts or renewal hits unexpectedly, which causes unplanned spend because cancellation steps/proof weren’t tracked.

2. Bill dispute workflow [photo] [sms]
Failure moment: The moment it fails is when the merchant denies responsibility, which causes time loss because the user can’t quickly compile receipt + chat + timeline into a dispute packet.

3. Refund follow-up tracking [inbox/pdf] [manual]
Failure moment: The moment it fails is when “refund processed” never arrives, which causes uncertainty and extra chasing because there’s no timeline + escalation cadence.

4. Group expense splitting [photo] [manual]
Failure moment: The moment it fails is when people disagree on who owes what, which causes awkwardness and delays because payments and receipts weren’t captured consistently.

5. Receipt-based budgeting (manual) [photo] [manual]
Failure moment: The moment it fails is when the month ends and spending is unknown, which causes overspending because receipts weren’t categorized and summarized.

6. Price-drop / better-deal detection [link] [public]
Failure moment: The moment it fails is when the user buys and then sees a cheaper price, which causes regret because tracked items and decision timing weren’t monitored.

7. Warranty tracking & claims reminders [inbox/pdf] [photo]
Failure moment: The moment it fails is when a warranty window closes or proof is missing, which causes lost reimbursement because docs and deadlines weren’t linked.

8. Household shared spending rules [manual] [calendar]
Failure moment: The moment it fails is when recurring bills cause confusion, which causes friction because rules and exceptions weren’t explicit.

9. Savings goals & nudges (non-advice) [manual] [calendar]
Failure moment: The moment it fails is when progress stalls, which causes goal abandonment because small prompts and visibility are missing.

10. Invoice/receipt organization (self-employed) [inbox/pdf] [photo]
Failure moment: The moment it fails is when a receipt can’t be found, which causes admin stress because documents aren’t searchable and completeness isn’t visible.

11. Cancellation friction tracking [public] [inbox/pdf]
Failure moment: The moment it fails is when the user can’t find how to cancel or prove it, which causes continued charges because steps and confirmation weren’t stored.

12. Chargeback evidence pack builder [inbox/pdf] [photo]
Failure moment: The moment it fails is when a chargeback is rejected for “insufficient evidence,” which causes lost money because the evidence packet wasn’t structured.

#### health (avoid regulated / no diagnosis / no medical advice)

1. Finding/booking appointments [manual] [public]
Failure moment: The moment it fails is when the user can’t secure a suitable slot, which causes delays because prerequisites and booking steps weren’t clear.

2. Medication reminders (user schedules) [manual] [calendar]
Failure moment: The moment it fails is when doses are missed, which causes routine breakdown because reminders and “refill soon” weren’t aligned to the schedule.

3. Routine adherence tracking [manual] [calendar]
Failure moment: The moment it fails is when routines fade after a few days, which causes inconsistency because there’s no lightweight logging and prompts.

4. Health admin documents vault [inbox/pdf] [manual]
Failure moment: The moment it fails is when the user needs a referral/lab PDF and can’t find it, which causes appointment delays because files aren’t organized.

5. Waiting list / reschedule alerts [calendar] [manual]
Failure moment: The moment it fails is when a better slot appears and is missed, which causes longer waits because there’s no timely alert + quick accept flow.

6. Family caregiver coordination [calendar] [manual]
Failure moment: The moment it fails is when pickup/transport responsibilities are unclear, which causes missed appointments because ownership and logistics weren’t shared.

7. Symptom journaling (neutral) [manual] [photo]
Failure moment: The moment it fails is when the user tries to recall what happened over time, which causes incomplete reporting because notes weren’t captured consistently.

8. Insurance paperwork tracking [inbox/pdf] [manual]
Failure moment: The moment it fails is when a claim stalls for missing docs, which causes delays because requests and submissions weren’t tracked end-to-end.

9. Language barrier in admin instructions [inbox/pdf] [manual]
Failure moment: The moment it fails is when the user misunderstands a required step, which causes rescheduling because instructions weren’t turned into an action checklist.

10. Preventive checkup scheduling [calendar] [manual]
Failure moment: The moment it fails is when a checkup lapses, which causes avoidable stress because cadence and reminders weren’t set.

11. Appointment prep packet [inbox/pdf] [manual]
Failure moment: The moment it fails is when the user arrives missing a document or key question, which causes wasted time because prep wasn’t guided.

12. Paperwork loop tracker (referral requested/sent/received) [sms] [inbox/pdf]
Failure moment: The moment it fails is when the referral disappears between parties, which causes delays because there’s no status timeline with nudges.

#### work

1. Meeting follow-ups & action items [manual] [calendar]
Failure moment: The moment it fails is when decisions don’t turn into tasks, which causes repeated meetings because owners and due dates weren’t captured.

2. Context switching overload [calendar] [manual]
Failure moment: The moment it fails is when focus blocks are constantly broken, which causes low throughput because interruptions aren’t controlled or patterned.

3. Approval/review bottlenecks [manual] [inbox/pdf]
Failure moment: The moment it fails is when work sits waiting on review, which causes missed deadlines because the blocker and escalation path aren’t visible.

4. Document/version confusion [link] [manual]
Failure moment: The moment it fails is when someone edits the wrong doc, which causes rework because the canonical version isn’t obvious.

5. Status reporting overhead [manual] [calendar]
Failure moment: The moment it fails is when weekly updates take too long, which causes less execution because progress isn’t compiled automatically.

6. Hiring/interview scheduling coordination [calendar] [manual]
Failure moment: The moment it fails is when schedules churn and candidates drop, which causes delays because coordination isn’t centralized.

7. Cross-team handoffs (missing requirements) [manual] [link]
Failure moment: The moment it fails is when delivery starts with unclear inputs, which causes churn because acceptance criteria and ownership weren’t explicit.

8. Onboarding checklists [manual] [calendar]
Failure moment: The moment it fails is when a new hire lacks access or context, which causes idle time because steps and dependencies aren’t tracked.

9. Repetitive form/report generation [manual] [inbox/pdf]
Failure moment: The moment it fails is when teams redo the same report, which causes wasted time because templates and autofill aren’t available.

10. Knowledge base findability [manual] [link]
Failure moment: The moment it fails is when someone can’t find the answer, which causes interruptions because knowledge isn’t searchable and summarized.

11. Access/request workflow tracking [manual] [inbox/pdf]
Failure moment: The moment it fails is when access requests stall, which causes blocked work because status and nudges are missing.

12. Dependency mapping & “next unblock step” [manual] [calendar]
Failure moment: The moment it fails is when a task is blocked and nobody acts, which causes slip because the next unblock action isn’t identified.

#### home

1. Maintenance scheduling (filters/inspections) [calendar] [photo]
Failure moment: The moment it fails is when maintenance is forgotten, which causes breakdowns because intervals and “last done” proof aren’t tracked.

2. Household inventory (where is what) [manual] [photo]
Failure moment: The moment it fails is when an item is needed and can’t be found, which causes duplicate purchases because locations and counts aren’t reliable.

3. Cleaning task coordination [calendar] [manual]
Failure moment: The moment it fails is when chores are assumed “someone else did it,” which causes resentment because ownership and cadence aren’t explicit.

4. Manuals/warranties in one place [inbox/pdf] [photo]
Failure moment: The moment it fails is when a repair/claim is needed, which causes delays because documents can’t be located quickly.

5. Energy usage nudges (no credentials) [manual] [calendar]
Failure moment: The moment it fails is when bills rise unexpectedly, which causes confusion because readings and habits aren’t tracked.

6. Repair vendor tracking [manual] [inbox/pdf]
Failure moment: The moment it fails is when quotes and commitments are forgotten, which causes disputes because a timeline of “who said what” is missing.

7. Pet care routines coordination [calendar] [manual]
Failure moment: The moment it fails is when a feeding/walk is missed, which causes stress because handoffs and reminders aren’t coordinated.

8. Package delivery coordination [sms] [photo]
Failure moment: The moment it fails is when a package is marked delivered but missing, which causes loss because evidence and follow-up steps aren’t organized.

9. Home safety checks [calendar] [manual]
Failure moment: The moment it fails is when a safety item is expired/not working, which increases risk because checks weren’t scheduled.

10. “Before guests” checklists [manual] [calendar]
Failure moment: The moment it fails is when prep becomes chaotic, which causes last-minute stress because tasks and timeboxes weren’t planned.

11. Contractor no-show / dispute log [photo] [manual]
Failure moment: The moment it fails is when a contractor misses or denies details, which causes conflict because evidence and agreements weren’t captured.

12. Landlord/maintenance request tracker [photo] [sms]
Failure moment: The moment it fails is when a request goes unanswered, which causes prolonged issues because follow-ups and proof aren’t tracked.

#### mobility

1. Recurring commute planning [calendar] [manual]
Failure moment: The moment it fails is when the user leaves too late, which causes lateness because buffers and reminders weren’t tuned.

2. Parking reminders & expiration [calendar] [photo]
Failure moment: The moment it fails is when a meter/permit expires, which causes fines because reminders weren’t aligned to actual parking time.

3. Car maintenance reminders [calendar] [inbox/pdf]
Failure moment: The moment it fails is when service is overdue, which causes breakdown risk because intervals and last service proof weren’t tracked.

4. Public transport disruption alerts [public] [manual]
Failure moment: The moment it fails is when a route is disrupted unexpectedly, which causes missed arrivals because alternatives weren’t surfaced in time.

5. Ride-share cost comparison (manual) [manual] [public]
Failure moment: The moment it fails is when the user overpays by choosing blindly, which causes waste because comparisons weren’t logged and reusable.

6. Travel time prediction for recurring trips [manual] [calendar]
Failure moment: The moment it fails is when estimates are consistently wrong, which causes lateness because actual times weren’t tracked to adjust buffers.

7. School run / pickup coordination [calendar] [manual]
Failure moment: The moment it fails is when pickup responsibility is unclear, which causes missed pickups because assignments and contingencies weren’t shared.

8. Accessibility needs routing [manual] [public]
Failure moment: The moment it fails is when a route includes a barrier, which causes detours because constraints weren’t applied.

9. Lost item recovery tracking [manual] [sms]
Failure moment: The moment it fails is when key details are forgotten, which causes low recovery odds because reports and follow-ups aren’t tracked.

10. Ticket/pass renewal reminders [calendar] [manual]
Failure moment: The moment it fails is when a pass expires, which causes disruption because renewal deadlines weren’t surfaced.

11. Incident workflow (ticket/tow/minor accident) [photo] [manual]
Failure moment: The moment it fails is when the user doesn’t know next steps, which increases cost/time because evidence and checklist aren’t ready.

12. Transit refunds/complaints tracking [inbox/pdf] [link]
Failure moment: The moment it fails is when a claim is denied or stalls, which causes lost money because required details and deadlines weren’t organized.

#### shopping

1. Grocery list mapped to store layout [manual] [calendar]
Failure moment: The moment it fails is when shopping takes too long, which causes frustration because list order doesn’t match the store path.

2. Meal-to-cart planning [manual] [calendar]
Failure moment: The moment it fails is when meals are planned but ingredients aren’t bought, which causes fallback eating because translation to a list didn’t happen.

3. Rebuy recurring items reminders [manual] [calendar]
Failure moment: The moment it fails is when essentials run out, which causes emergency purchases because consumption cadence wasn’t tracked.

4. Substitution preferences (non-medical) [manual] [photo]
Failure moment: The moment it fails is when the wrong substitute is bought, which causes waste because preferences weren’t explicit.

5. Returns workflow tracking [photo] [inbox/pdf]
Failure moment: The moment it fails is when the return window closes, which causes loss because labels, steps, and deadlines weren’t tracked.

6. Price comparison for shortlist [link] [public]
Failure moment: The moment it fails is when the user buys without checking alternatives, which causes regret because comparisons weren’t easy.

7. Gift planning [manual] [calendar]
Failure moment: The moment it fails is when an occasion arrives unprepared, which causes stress because ideas, budgets, and purchases weren’t tracked.

8. Shared list conflict resolution [manual] [calendar]
Failure moment: The moment it fails is when duplicates or contradictions appear, which causes waste because ownership and resolution rules weren’t clear.

9. Bulk buying vs waste tradeoffs [manual] [calendar]
Failure moment: The moment it fails is when bulk items expire, which causes waste because consume-by reminders and portioning weren’t planned.

10. “Cook with what I have” (inventory-based) [manual] [link]
Failure moment: The moment it fails is when the user can’t think of meals, which causes takeout because inventory wasn’t connected to options.

11. Delivery exception handling [photo] [sms]
Failure moment: The moment it fails is when a delivery is damaged/missing, which causes long support cycles because evidence and steps aren’t organized.

12. Post-purchase decision log (warranty/return windows) [inbox/pdf] [calendar]
Failure moment: The moment it fails is when the user forgets return/warranty deadlines, which causes lost value because actions weren’t scheduled.

#### education

1. Homework planning & deadlines [calendar] [manual]
Failure moment: The moment it fails is when homework is started too late, which causes poor quality because tasks weren’t scheduled with buffers.

2. Study habit tracking & streaks [manual] [calendar]
Failure moment: The moment it fails is when consistency breaks, which causes last-minute cramming because sessions weren’t logged and nudged.

3. Note organization + quick summaries [manual] [inbox/pdf]
Failure moment: The moment it fails is when notes can’t be found or used, which causes relearning because organization and summaries are missing.

4. Group project coordination [manual] [calendar]
Failure moment: The moment it fails is when someone misses their part, which causes crunch because roles and deliverables weren’t tracked.

5. Exam prep schedule generator [manual] [calendar]
Failure moment: The moment it fails is when revision is uneven, which causes weak areas because a topic-by-topic plan didn’t exist.

6. Learning resource curation [link] [manual]
Failure moment: The moment it fails is when resources are lost or duplicated, which causes wasted time because tagging and “best for” notes are missing.

7. School admin deadlines (forms/permissions) [inbox/pdf] [calendar]
Failure moment: The moment it fails is when a form deadline is missed, which causes exclusion because dates and requirements weren’t extracted.

8. Parent-teacher communication tracking [sms] [manual]
Failure moment: The moment it fails is when follow-ups are forgotten, which causes unresolved issues because messages weren’t converted into actions.

9. Reading list progress tracking [manual] [calendar]
Failure moment: The moment it fails is when reading falls behind, which causes stress because progress and cadence weren’t visible.

10. Language learning practice reminders [manual] [calendar]
Failure moment: The moment it fails is when practice stops, which causes slow progress because prompts and quick sessions weren’t scheduled.

11. Assignment spec clarification workflow [manual] [inbox/pdf]
Failure moment: The moment it fails is when the student misinterprets the rubric, which causes rework because unclear requirements weren’t flagged early.

12. Materials fragmentation (files/links) [link] [inbox/pdf]
Failure moment: The moment it fails is when the needed file isn’t accessible, which causes missed study time because materials aren’t consolidated.

#### family

1. Family calendar conflict resolution [calendar] [manual]
Failure moment: The moment it fails is when two commitments collide, which causes cancellations because conflicts weren’t detected early.

2. Child activities logistics [calendar] [manual]
Failure moment: The moment it fails is when gear/pickup details are missed, which causes stress because checklists and assignments weren’t shared.

3. Shared household decision tracking [manual] [calendar]
Failure moment: The moment it fails is when a decision is re-argued, which causes friction because “what we decided and why” isn’t recorded.

4. Elder care coordination [calendar] [manual]
Failure moment: The moment it fails is when responsibilities are unclear, which causes missed tasks because ownership and schedules aren’t centralized.

5. Allowance tracking (light) [manual] [calendar]
Failure moment: The moment it fails is when expectations differ, which causes arguments because rules and tracking aren’t transparent.

6. Parenting routines checklists [calendar] [manual]
Failure moment: The moment it fails is when routines slip on handoff days, which causes chaos because steps and notes aren’t shared.

7. Family document vault [inbox/pdf] [manual]
Failure moment: The moment it fails is when a document is needed urgently, which causes delays because it can’t be found or shared quickly.

8. Celebrations/events coordination [calendar] [sms]
Failure moment: The moment it fails is when tasks fall through, which causes last-minute scramble because roles and RSVPs weren’t tracked.

9. Screen time agreements [manual] [calendar]
Failure moment: The moment it fails is when rules are disputed, which causes conflict because agreements and exceptions weren’t recorded.

10. Shared shopping/errands splitting [manual] [calendar]
Failure moment: The moment it fails is when errands are duplicated or forgotten, which wastes time because assignments and confirmations aren’t tracked.

11. Co-parenting schedule changes (generic) [calendar] [manual]
Failure moment: The moment it fails is when a change isn’t communicated, which causes missed pickups because updates weren’t reflected everywhere.

12. Household agreements tracker [manual] [calendar]
Failure moment: The moment it fails is when people follow different rules, which causes friction because the “current agreement” isn’t visible.

#### food

1. Meal planning (preferences + time) [manual] [calendar]
Failure moment: The moment it fails is when dinner time arrives with no plan, which causes stress because fallback options weren’t prepared.

2. Pantry-to-recipes suggestions [manual] [link]
Failure moment: The moment it fails is when the user can’t decide what to cook, which causes takeout because pantry items aren’t mapped to ideas.

3. Food waste reduction (expiry) [manual] [calendar]
Failure moment: The moment it fails is when items expire unused, which wastes money because expiries weren’t tracked with prompts.

4. Restaurant decision helper [public] [manual]
Failure moment: The moment it fails is when the group can’t agree, which wastes time because constraints and options weren’t narrowed quickly.

5. Cooking workflow timers (multi-step) [manual] [calendar]
Failure moment: The moment it fails is when steps are mistimed, which harms results because timers and sequencing weren’t coordinated.

6. Basic nutrition logging (non-medical) [manual] [calendar]
Failure moment: The moment it fails is when tracking is too hard to sustain, which causes drop-off because logging isn’t lightweight.

7. Grocery substitution preferences [manual] [link]
Failure moment: The moment it fails is when a missing ingredient derails a recipe, which causes frustration because acceptable substitutions weren’t known.

8. Bulk cooking planning & portioning [manual] [calendar]
Failure moment: The moment it fails is when bulk meals aren’t used, which wastes food because portioning and consume-by reminders weren’t planned.

9. Family voting “what’s for dinner” [sms] [manual]
Failure moment: The moment it fails is when voting drags on, which delays eating because choices and constraints weren’t structured.

10. Dietary preference tracking (ethical/taste) [manual] [calendar]
Failure moment: The moment it fails is when meals clash with preferences, which causes dissatisfaction because preferences weren’t captured clearly.

11. Leftovers lifecycle [manual] [calendar]
Failure moment: The moment it fails is when leftovers are forgotten, which causes waste because storage notes and prompts weren’t present.

12. Pantry confidence reconcile [manual] [calendar]
Failure moment: The moment it fails is when inventory is wrong, which causes extra trips because quick reconciliation wasn’t built-in.

#### security-privacy (defensive; no hacking)

1. Password hygiene + manager onboarding [manual] [calendar]
Failure moment: The moment it fails is when passwords stay weak/reused, which increases risk because the user never completes onboarding steps.

2. Phishing awareness training [manual] [calendar]
Failure moment: The moment it fails is when someone clicks a suspicious link, which increases risk because practice and reminders weren’t ongoing.

3. “Where shared my data” tracker [manual] [link]
Failure moment: The moment it fails is when the user can’t remember which services hold their data, which increases exposure because there’s no inventory.

4. Device update reminders [calendar] [manual]
Failure moment: The moment it fails is when updates are delayed, which increases vulnerability because there’s no cadence and confirmation.

5. Account recovery checklist organization [manual] [inbox/pdf]
Failure moment: The moment it fails is when account recovery is needed, which causes lockout because recovery steps and backup codes aren’t accessible.

6. Backup reminders and checklists [calendar] [manual]
Failure moment: The moment it fails is when a device is lost/blocked, which causes data loss because backups weren’t verified.

7. Scam call/SMS logging + guidance [sms] [manual]
Failure moment: The moment it fails is when a scam repeats or escalates, which increases risk because evidence and response steps weren’t tracked.

8. Privacy settings checklist per app [link] [manual]
Failure moment: The moment it fails is when privacy settings drift over time, which increases exposure because reviews weren’t scheduled.

9. Secure document storage + sharing (family) [inbox/pdf] [manual]
Failure moment: The moment it fails is when a sensitive doc is shared unsafely, which increases risk because sharing rules and access aren’t controlled.

10. “What to do if hacked” plan (defensive) [manual] [calendar]
Failure moment: The moment it fails is when a compromise is suspected, which increases damage because the user doesn’t have a ready, ordered checklist.

11. 2FA rollout tracker [manual] [calendar]
Failure moment: The moment it fails is when an account is taken over, which becomes easier because 2FA wasn’t enabled everywhere.

12. Recovery readiness drill [calendar] [manual]
Failure moment: The moment it fails is when recovery steps haven’t been tested, which causes panic and delay because gaps were never discovered.

#### travel

1. Packing checklist per trip type [manual] [calendar]
Failure moment: The moment it fails is when the user forgets a critical item, which causes stress/cost because packing wasn’t guided by trip type.

2. Visa/document readiness (generic) [manual] [calendar]
Failure moment: The moment it fails is when a document is expired/missing, which causes denied boarding/entry risk because readiness wasn’t tracked.

3. Itinerary consolidation (email → plan) [inbox/pdf] [manual]
Failure moment: The moment it fails is when details are scattered across confirmations, which causes missed check-ins because the itinerary wasn’t unified.

4. Booking confirmation vault + reminders [inbox/pdf] [calendar]
Failure moment: The moment it fails is when a deadline passes (check-in/cancel), which costs money because reminders weren’t extracted.

5. Insurance decision helper (non-advice) [manual] [link]
Failure moment: The moment it fails is when the user can’t compare options clearly, which causes poor confidence because tradeoffs weren’t structured.

6. SIM/eSIM planning checklist [public] [manual]
Failure moment: The moment it fails is when the user lands without connectivity, which causes friction because setup steps and timing weren’t planned.

7. Group travel coordination [manual] [calendar]
Failure moment: The moment it fails is when nobody knows who booked what, which causes duplication/confusion because responsibilities weren’t tracked.

8. Jet lag / schedule adjustment planner (non-medical) [calendar] [manual]
Failure moment: The moment it fails is when the first days are unproductive, which causes poor experience because the adjustment plan wasn’t followed.

9. Trip expense splitting [photo] [manual]
Failure moment: The moment it fails is when people argue about reimbursements, which causes tension because receipts and who-fronted-what weren’t captured.

10. Pre-departure timeline [calendar] [manual]
Failure moment: The moment it fails is when day-of tasks pile up, which causes missed steps because actions weren’t staged (T-7/T-2/day-of).

11. Disruption workflow (delay/cancel) [inbox/pdf] [photo]
Failure moment: The moment it fails is when disruption happens, which causes extra cost/time because the user lacks a checklist and evidence pack.

12. Requirement monitoring (public) [public] [manual]
Failure moment: The moment it fails is when rules change unnoticed, which risks denial because monitoring and impact checks weren’t in place.

### Tag legend (lightweight):
[manual] user types/chooses info
[inbox/pdf] email, PDF, scans, screenshots
[calendar] calendar events/reminders
[sms] SMS/WhatsApp messages (user-provided)
[photo] photos of receipts/docs/items
[public] public info sources (no credentials)
[link] saved links/URLs

## Duplicate avoidance (during seeding)
Before creating an issue:
- Search existing issues for 3–6 key phrases from:
  - persona + theme + core verb (“refund tracking”, “renewal reminder”, “returns deadline”)
- Also compare against topic clusters from open `stage/7-validation` issues and avoid near-overlap.
- If an existing issue matches the same persona+theme+JTBD structure:
  - Skip and generate a different problem for that slot.