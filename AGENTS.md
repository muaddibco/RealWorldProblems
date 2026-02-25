# RealWorldProblems – Agent Operating Manual (AGENTS.md)

This repo is an “idea funnel” operated by GitHub Copilot/Workspace agents using Issues as the database.

## 0) Core Principles

1) **One problem per issue.** Problems are tracked as `type/problem`.
2) **State machine via labels.** Each problem has exactly **one** `stage/*` label at a time.
3) **No free-form edits.** Agents must write only inside predefined **islands** (HTML comment markers) using `update-issue` + `operation: replace-island`. :contentReference[oaicite:4]{index=4}
4) **Safe outputs or noop.** Every run must emit at least one safe-output operation or an explicit `noop`, otherwise the workflow can fail. :contentReference[oaicite:5]{index=5}
5) **Be explicit when archiving.** Any archive requires exactly one `archive/*` reason label.

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

## 5) Stage transitions (the conveyor belt)

Agents move issues forward by:
- adding the next stage label
- removing the current stage label
- writing their results into the correct island

Happy path:
`0-intake → 1-normalized → 2-deduped → 3-scored → 4-solution → 5-competitors → 6-shortlist → 7-validation`

Archive path:
Any stage → `stage/9-archived` + one `archive/*` reason label (+ optionally close issue as not planned/duplicate).

## 6) Competitor research standards

When `web-search`/`web-fetch` are enabled:
- List **direct competitors** and **substitutes/workarounds**
- Record what they do, target user, pricing signal, and a link/source
- If you cannot access the web (tool missing), mark the section clearly as **“Needs verification”**.

Web tools are explicitly enabled per workflow and require network allowlists. :contentReference[oaicite:6]{index=6}

## 7) No-op policy

If the workflow trigger condition does not match (wrong labels/type), or there is nothing to change:
- Emit `noop` with a short reason (e.g., “Not a type/problem issue”).
Safe outputs documentation warns missing outputs can fail a run. :contentReference[oaicite:7]{index=7}