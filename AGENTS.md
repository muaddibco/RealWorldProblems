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

### Status
- `status/needs-info`
- `status/duplicate`
- `status/blocked`
- `status/shortlisted`

### Software fit
- `software-fit/yes`
- `software-fit/partial`
- `software-fit/no`

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

## 3) Required structure for `type/problem` issues

If any of these are missing after normalization, set `status/needs-info` and stop.

- JTBD one-liner (“When __, I want __, so I can __.”)
- Context + frequency
- Pain / stakes
- Current workaround
- Persona + domain labels

## 4) Scoring rubric (1–5 each)

Agents fill a scorecard (sum 6 dimensions; max 30).

1. **Severity (pain)**
2. **Frequency**
3. **Willingness to pay / strong proxy** (time, money, risk)
4. **Reachability** (distribution: SEO/community/marketplaces/sales)
5. **Feasibility** (MVP in weeks, not months)
6. **Wedge plausibility** (clear reason we win)

Interpretation:
- 1 = very weak
- 3 = medium / uncertain
- 5 = strong evidence / clear

Buckets:
- `score/top-10`: total ≥ 24
- `score/top-50`: total 20–23
- `score/long-tail`: total ≤ 19

Risk label:
- `risk/high`: regulated / partnerships / heavy dependencies
- else `risk/medium` or `risk/low`

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

- duplicate → `archive/duplicate`
- not software → `archive/not-software`
- weak wedge → `archive/no-wedge`

### Important

`ai-defensibility/weak` ≠ automatic archive

Instead:
- prefer solution rewrite
- only archive if wedge also weak

---

## 10) Downstream interpretation

### Competitor stage

- weak defensibility → look for AI substitutes
- strong defensibility → validate uniqueness

### Wedge stage

- weak + weak defensibility → likely `wedge/weak`

### Validation stage

If defensibility is not strong:
- test against “AI + manual workflow”
- verify users prefer product over generic AI

---

## 11) Steward rules

For up to 10 issues per run:

- ensure exactly one `stage/*`
- ensure persona exists
- ensure archive reason exists if archived
- ensure islands exist

### AI-specific checks

If issue is in or past AI stage:

- ensure ≤1 `ai-defensibility/*`
- ensure ≤1 `ai-risk/*`
- ensure `rw:ai-defensibility` island exists

If missing:

<!-- rw:ai-defensibility:start --> <!-- rw:ai-defensibility:end -->

---

## 12) No-op policy

If the workflow trigger condition does not match (wrong labels/type), or there is nothing to change:
- Emit `noop` with a short reason (e.g., “Not a type/problem issue”).
Safe outputs documentation warns missing outputs can fail a run. :contentReference[oaicite:7]{index=7}

## 13) Philosophy

This repo does NOT optimize for:
- ideas that sound good today

It optimizes for:
- problems that matter
- solutions that can be built quickly
- products that survive AI commoditization

---

# Final rule

**AI should be inside the product — not the product itself.**
