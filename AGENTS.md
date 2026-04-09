# RealWorldProblems – Agent Operating Manual (AGENTS.md)

This repository is an **agent-driven pipeline** for discovering, evaluating, and validating real-world problems and potential software solutions.

Agents operate on GitHub Issues (`type/problem`) and move them through structured stages using labels and structured “islands” inside issue bodies.

## 0) Core Principles

1) **One problem per issue.** Problems are tracked as `type/problem`.
2) **State machine via labels.** Each problem has exactly **one** `stage/*` label at a time.
3) **No free-form edits.** Agents must write only inside predefined **islands** (HTML comment markers) using `update-issue` + `operation: replace-island`. :contentReference[oaicite:4]{index=4}
4) **Safe outputs or noop.** Every run must emit at least one safe-output operation or an explicit `noop`, otherwise the workflow can fail. :contentReference[oaicite:5]{index=5}
5) **Be explicit when archiving.** Any archive requires exactly one `archive/*` reason label.
6) Never overwrite user-written content outside islands
7) Each problem must have:
   - exactly one `stage/*` label
   - exactly one `persona/*` label (or `status/needs-info`)
8) Pipeline is **progressive filtering toward high-quality opportunities**

## 1) Canonical Labels

### Type (exactly one primary type per issue)
- `type/problem`
- `type/report`
- `type/experiment`
- `type/cluster` (optional; meta issues)

### Stage (exactly one per problem issue)
- `stage/0-intake`
- `stage/1-normalized`
- `stage/2-deduped`
- `stage/3-scored`
- `stage/4-solution`
- `stage/ai-defensibility`
- `stage/5-competitors`
- `stage/6-shortlist`
- `stage/7-validation`
- `stage/8-selected`
- `stage/9-archived`

### Stage semantics

- `stage/0-intake` — raw problem candidate exists but is not yet normalized
- `stage/1-normalized` — problem is rewritten into canonical JTBD/problem format
- `stage/2-deduped` — duplicate check is complete; issue is ready for software-fit evaluation
- `stage/3-scored` — software-fit passed and the issue is ready for **problem-attractiveness scoring**
- `stage/4-solution` — a solution hypothesis is drafted
- `stage/ai-defensibility` — the drafted solution is evaluated for durability against AI commoditization
- `stage/5-competitors` — direct competitors, substitutes, and market context are researched
- `stage/6-shortlist` — wedge quality is decided: credible wedge vs weak wedge
- `stage/7-validation` — next validation experiment is planned for a wedge-credible opportunity
- `stage/8-selected` — chosen for focused execution / incubation
- `stage/9-archived` — removed from the active pipeline with exactly one archive reason

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
- `software-fit/yes` = software can deliver most of the value end-to-end
- `software-fit/partial` = software can deliver meaningful value, but the solution still depends on meaningful non-software elements such as human ops, hardware, field work, partnerships, or constrained data access
- `software-fit/no` = the problem is not meaningfully solvable with software as the main product lever

Stage behavior:
- `software-fit/yes` → proceed to `stage/3-scored`
- `software-fit/partial` → proceed to `stage/3-scored`
- `software-fit/no` → archive with `archive/not-software`

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

### Archive reasons (exactly one when archived)
- `archive/not-software`
- `archive/low-pain`
- `archive/unreachable-users`
- `archive/too-regulated`
- `archive/too-dependent-on-partners`
- `archive/no-wedge`
- `archive/other`

### Domain (1–3)
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

### Persona (exactly one)
- `persona/consumer`
- `persona/family-parent`
- `persona/student`
- `persona/employee`
- `persona/freelancer`
- `persona/smb-owner`
- `persona/enterprise`
- `persona/senior`

### Marketing & sales complexity
- `marketing-sales/very-easy`
- `marketing-sales/easy`
- `marketing-sales/medium`
- `marketing-sales/hard`
- `marketing-sales/very-hard`

> Optional: `cluster/<slug>` labels are allowed if your repo owners pre-create them. If not, store cluster membership in the issue body only.

## 2) Islands (the only places agents may edit)

Agents MUST use these markers in issue bodies and only update content between them.

### Normalized Problem
<!-- rw:normalized:start -->
<!-- rw:normalized:end -->

### Dedupe / Cluster
<!-- rw:dedupe:start -->
<!-- rw:dedupe:end -->

### Software Fit
<!-- rw:software-fit:start -->
<!-- rw:software-fit:end -->

### Scorecard
<!-- rw:scorecard:start -->
<!-- rw:scorecard:end -->

### Solution Hypothesis
<!-- rw:solution:start -->
<!-- rw:solution:end -->

### AI Defensibility Scorecard
<!-- rw:ai-defensibility:start -->
<!-- rw:ai-defensibility:end -->

### Competitors & Substitutes
<!-- rw:competitors:start -->
<!-- rw:competitors:end -->

### Wedge Decision
<!-- rw:wedge:start -->
<!-- rw:wedge:end -->

### Validation Plan
<!-- rw:validation:start -->
<!-- rw:validation:end -->

### Steward Notes (automation-only)
<!-- rw:steward:start -->
<!-- rw:steward:end -->

### Marketing & sales complexity
<!-- rw:marketing-sales:start -->
<!-- rw:marketing-sales:end -->

## 3) Required structure for `type/problem` issues

If any of these are missing after normalization, set `status/needs-info` and stop.

The normalization stage is responsible for ensuring the issue has:
- exactly one `persona/*` label
- 1–3 `domain/*` labels

If missing at intake, the normalizer should backfill them from:
1. existing valid labels
2. explicit body fields such as `Domain: ...` and `Persona: ...`
3. conservative inference from the issue content when clear

If persona or domain cannot be determined confidently, the issue should receive `status/needs-info` and should not advance.

Required normalized structure:

- JTBD one-liner (“When __, I want __, so I can __.”)
- Context + frequency
- Pain / stakes
- Trigger or failure moment (what happens if the user does nothing)
- Current workaround
- Persona + domain labels

## 4) Scoring rubric (1–5 each)

Agents fill a scorecard for **problem attractiveness** (sum 6 dimensions; max 30).

1. **Severity (pain)**
   - How painful or costly the problem is when it happens

2. **Frequency**
   - How often the target user experiences it

3. **Urgency / failure cost**
   - Whether the user must act now, and what happens if they do nothing

4. **Willingness to pay / strong proxy**
   - Direct payment likelihood or strong proxy such as time saved, revenue protected, penalties avoided, or risk reduced

5. **Reachability**
   - How realistically the first users can be found and reached

6. **Feasibility**
   - How quickly an MVP can create real value with software

Interpretation:
- 1 = very weak
- 3 = medium / uncertain
- 5 = strong evidence / clear

Important:
- Stage 3 scores **problem attractiveness**, not the final company outcome.
- Do **not** score wedge here; wedge is evaluated later in the dedicated wedge stage.
- Use conservative scoring when evidence is weak.
- If software-fit is `software-fit/partial`, Feasibility should rarely exceed 3 unless the non-software portion is minor.
- If the problem clearly depends on hard-to-get APIs, partnerships, compliance approvals, hardware rollout, or difficult data access, lower Reachability and/or Feasibility and raise Risk.
- If the evidence is mostly inferred and not explicit in the issue body, lower Confidence and score conservatively.

Buckets:
- `score/top-10`: total ≥ 24 and confidence is not low
- `score/top-50`: total 20–23, or total ≥ 24 with confidence low
- `score/long-tail`: total ≤ 19, or total 20–23 with confidence low

Risk label:
- `risk/high`: regulated / partnership-dependent / difficult data access / hardware / heavy operational complexity
- otherwise `risk/medium` or `risk/low`

## 4A) AI defensibility rubric (1–5 each)

Agents fill an AI defensibility scorecard (sum 5 dimensions; max 25).

1. **Replaceability**
   - Could a better generic AI or simple prompt replace most of the value?

2. **Workflow ownership**
   - Does the product execute or control a real workflow step, rather than only advising?

3. **Data moat**
   - Does the product accumulate proprietary structure, memory, or outcome history?

4. **Integration depth**
   - Is the product embedded into meaningful systems, files, APIs, or operational tools?

5. **Switching cost**
   - Would replacing the product cause meaningful process loss, history loss, or retraining friction?

Interpretation:
- 1 = very weak
- 3 = medium / uncertain
- 5 = strong evidence / clear

Thresholds:
- `ai-defensibility/strong`: total 20–25
- `ai-defensibility/medium`: total 14–19
- `ai-defensibility/weak`: total 5–13

AI risk:
- `ai-risk/low` for strong
- `ai-risk/medium` for medium
- `ai-risk/high` for weak

AI defensibility may be backfilled onto issues in later stages without changing their current `stage/*` label.

## 5) Solution drafting rule

Solution agents must default toward **AI-defensible products**.

### Prefer

- workflow ownership
- systems of execution
- monitoring / alerts
- integration into real workflows
- structured memory / data accumulation
- narrow niche wedges

### Avoid (by default)

- “ChatGPT for X”
- summarization-only
- drafting-only
- generic copilots
- “better UI on LLM”

### Mandatory self-check

> If a much better LLM appears tomorrow, why does this product still matter?

If weak → redesign.

---

## 6) AI Defensibility stage

### Purpose

Evaluate whether the solution is:
- durable
- defensible
- not a thin AI wrapper

### Output

<!-- rw:ai-defensibility:start -->
AI Defensibility Scorecard

...

Verdict
Defensibility: strong | medium | weak
AI risk: low | medium | high
Why

...

How to improve defensibility

...

Kill shot test

...

<!-- rw:ai-defensibility:end -->

---

## 7) Competitor research standards

When `web-search`/`web-fetch` are enabled:
- List **direct competitors** and **substitutes/workarounds**
- Record what they do, target user, pricing signal, and a link/source
- If you cannot access the web (tool missing), mark the section clearly as **“Needs verification”**.

Web tools are explicitly enabled per workflow and require network allowlists. :contentReference[oaicite:6]{index=6}

## 8) Stage transitions (the conveyor belt)

Agents move issues forward by:
- adding the next stage label
- removing the current stage label
- writing their results into the correct island

Happy path:
`stage/0-intake → stage/1-normalized → stage/2-deduped → stage/3-scored → stage/4-solution → stage/ai-defensibility → stage/5-competitors → stage/6-shortlist → stage/7-validation`

Decision ownership by stage:
- Normalize stage defines the canonical problem statement
- Dedupe stage decides duplicate vs distinct problem
- Software-fit gate decides whether software can realistically solve the problem
- Score stage evaluates **problem attractiveness**
- Solution stage drafts a solution hypothesis
- AI Defensibility stage evaluates whether the solution is durable vs thin AI-wrapper risk
- Competitor stage maps direct competitors, substitutes, and gaps
- Wedge stage decides whether there is a **credible market-entry wedge**
- Validation stage defines the **next decision-critical experiment**

Each stage:
- writes its island
- updates labels
- advances exactly one step

## Special sequencing

### Solution → AI Defensibility

- `stage/4-solution`
→ write solution
→ move to `stage/ai-defensibility`

### AI Defensibility → Competitors

- write defensibility island
- apply:
  - one `ai-defensibility/*`
  - one `ai-risk/*`
- move to `stage/5-competitors`

---

## 9) Archive rules

Archive when:

- duplicate → add `status/duplicate` and archive with `archive/other`
- not software → `archive/not-software`
- weak wedge → `archive/no-wedge`

### Important

- Duplicates do **not** use a dedicated `archive/duplicate` label.
- Use `status/duplicate` to indicate duplicate status.
- Use `archive/other` as the archive reason for duplicates.

`ai-defensibility/weak` ≠ automatic archive

Instead:
- prefer solution rewrite
- only archive if wedge is also weak

## 10) Downstream interpretation

### Score stage
- evaluates **problem attractiveness**
- does not decide market wedge
- does not decide final company quality

### AI defensibility stage
- evaluates whether the proposed solution is durable or easily commoditized by better general AI
- weak defensibility should usually trigger redesign, not automatic archive

### Competitor stage
- weak defensibility → look carefully for AI substitutes and thin-wrapper risks
- strong defensibility → validate whether the claimed uniqueness is real in-market

### Wedge stage
- decides whether there is a believable narrow entry path into the market
- a high score does **not** automatically imply a credible wedge
- weak wedge plus weak AI defensibility is a strong archive signal

### Validation stage
- tests the most decision-critical remaining uncertainty
- if defensibility is not strong, test against “AI + manual workflow”
- verify that users prefer the product over generic AI plus existing tools

### Optional manual analysis: rw:expansion
Purpose: assess whether a currently framed problem and its proposed solution can credibly expand to a wider actor set, broader workflow, or adjacent use case.

Island:
- `<!-- rw:expansion:start --> ... <!-- rw:expansion:end -->`

Rules:
- Optional/manual only; not a stage.
- Does not advance or archive issues.
- Does not add or remove labels.
- Should be conservative about expansion and explicit when broader scope becomes a different product.

## 11) Steward rules

For up to 10 issues per run:

- ensure exactly one `stage/*`
- ensure persona exists
- ensure archive reason exists if archived
- ensure stage-relevant islands exist

Expected islands by stage:
- `stage/1-normalized` or later → `rw:normalized`
- `stage/2-deduped` or later → `rw:dedupe`
- if software-fit has been decided → `rw:software-fit`
- `stage/3-scored` or later → `rw:scorecard`
- `stage/4-solution` or later → `rw:solution`
- `stage/ai-defensibility` or later → `rw:ai-defensibility`
- `stage/5-competitors` or later → `rw:competitors`
- `stage/6-shortlist` or later → `rw:wedge`
- `stage/7-validation` or later → `rw:validation`

AI-specific checks:
- ensure at most one `ai-defensibility/*`
- ensure at most one `ai-risk/*`
- ensure `rw:ai-defensibility` island exists for issues in or past AI defensibility stage

If missing, insert empty island markers only.
Do not rewrite substantive stage content during stewardship.

## 12) No-op policy

If the workflow trigger condition does not match (wrong labels/type), or there is nothing to change:
- Emit `noop` with a short reason (for example: `Not a type/problem issue`).

If a required workflow tool is unavailable:
- Emit `noop` with a short reason describing the missing requirement.
- Example: `missing GitHub read tools`

If an optional tool is unavailable but the workflow defines a fallback:
- follow the fallback behavior instead of nooping

Safe outputs documentation warns missing outputs can fail a run.

## 13) Philosophy

This repo does NOT optimize for:
- ideas that sound good today

It optimizes for:
- problems that matter
- solutions that can be built quickly
- products that survive AI commoditization

## 14) Marketing & sales rules
- At most one `marketing-sales/*` label may exist on a problem issue.
- This assessment is orthogonal metadata and does not advance the stage by itself.

# Final rule

**AI should be inside the product — not the product itself.**
