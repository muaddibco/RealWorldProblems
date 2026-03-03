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

Resolve mode inputs before topic generation:
- `run_mode` = workflow input `mode` if available; otherwise `balanced`.
- `run_focus_domain` = workflow input `focus_domain` if provided (normalized to one of the domain labels without `domain/` prefix).
- `run_focus_persona` = workflow input `focus_persona` if provided (normalized to one of the persona labels without `persona/` prefix).

Input enforcement rules (do not silently ignore):
- If `run_mode=domain_focus` and `run_focus_domain` is empty/invalid, emit `noop` with reason and stop.
- If `run_mode=persona_focus` and `run_focus_persona` is empty/invalid, emit `noop` with reason and stop.
- If `run_mode=domain_focus`, every created issue MUST use that exact domain (labels/body) and must NOT use balanced domain rotation.
- If `run_mode=persona_focus`, every created issue MUST use that exact persona (labels/body) and must NOT use balanced persona rotation.
- Do not fall back to `balanced` when a focus mode was explicitly requested.

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

Replace the fallback behavior above with strict behavior:
- For `domain_focus`, require valid `run_focus_domain` or stop with `noop`.
- For `persona_focus`, require valid `run_focus_persona` or stop with `noop`.

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

## Duplicate avoidance (during seeding)
Before creating an issue:
- Search existing issues for 3–6 key phrases from:
  - persona + theme + core verb (“refund tracking”, “renewal reminder”, “returns deadline”)
- Also compare against topic clusters from open `stage/7-validation` issues and avoid near-overlap.
- If an existing issue matches the same persona+theme+JTBD structure:
  - Skip and generate a different problem for that slot.