---
name: "RW: Normalize"
on:
  workflow_dispatch:
  issues:
    types: [labeled]
    names: [stage/0-intake]
    lock-for-agent: true

engine:
  id: copilot
  agent: rw-normalizer

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
  update-issue:
    body: true
    max: 1
  add-comment:
    max: 1
  add-labels:
    blocked: ["~*", "*[bot]"]
    max: 10
  remove-labels:
    blocked: ["~*"]
    max: 10
  noop:
---

# Normalize Problem Issue

Operate ONLY if the issue has labels:
- type/problem
- stage/0-intake
- and does NOT have label agentic-workflows

Otherwise emit noop.

Tooling note:
- Read the target issue using GitHub MCP issue tools (issue_read/list_issues/search_issues).
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `noop` with a short reason and stop.

## Responsibilities of this stage
This stage is responsible for:
- validating that the originally seeded issue body contains the required seed metadata fields
- inferring any missing seed metadata fields from the problem description before falling back to `status/needs-info`
- normalizing the problem into the canonical issue structure
- ensuring the issue has exactly one `persona/*` label
- ensuring the issue has 1–3 `domain/*` labels
- backfilling persona/domain labels from the issue body when they are missing from labels

## Seed metadata gate (MANDATORY)
Before advancing, inspect the **original seeded issue content** and verify that all of the following are explicitly present as body lines:

- `Domain: <domain>`
- `Theme: <theme>`
- `Subtheme: <subtheme>`
- `Catalog status: <catalog|off-catalog>`
- `Persona: <persona>`
- `Archetype: <archetype>`

Rules:
1. If a field is explicitly present in the seeded issue body, use it as the source of truth. Content inside previously generated workflow islands or HTML comments does not count as satisfying this requirement.
2. If a field is **missing or malformed**, attempt to infer it from the problem description before falling back to `status/needs-info`. See **Seed metadata inference rules** below.
3. `Catalog status` is valid only if it is exactly:
   - `catalog`
   - `off-catalog`
4. If a field is present but clearly conflicts with the problem narrative, do not override it silently; add `status/needs-info` and a short comment describing the conflict instead.
5. Inferred values must be written to the normalized island with `(inferred)` appended so they are visible for human review. Do not silently backfill them into the original seeded body.

## Seed metadata inference rules

When any of the six seed metadata fields are absent or malformed, infer them from the problem narrative using the rules below. Use only canonical values from AGENTS.md where applicable.

**Domain**
- Choose 1–3 domains from the canonical `domain/*` list that best match the problem context.
- The primary domain becomes the `Domain:` field value; additional ones are added as extra domain labels only.

**Theme**
- Derive a short free-form thematic grouping (3–6 words) for the general problem category (e.g., `Home maintenance management`, `Personal finance tracking`).

**Subtheme**
- Derive a narrower free-form focus within the theme (3–6 words) capturing the specific pain point (e.g., `Repair scheduling and follow-up`, `Expense categorisation errors`).

**Catalog status**
- Default to `off-catalog`.
- Use `catalog` only when the problem clearly matches a pattern already widely represented in a well-known consumer pain-point catalog.
- When uncertain, always default to `off-catalog`.

**Persona**
- Choose exactly one persona from the canonical `persona/*` list that the issue narrative most clearly addresses.
- If genuinely ambiguous between two or more personas, do **not** infer; add `status/needs-info` instead.

**Archetype**
- Derive a short free-form archetype label that describes the specific type of user experiencing this pain (e.g., `Overwhelmed homeowner`, `Time-poor professional`, `Cost-conscious parent`).
- Must be consistent with the inferred or explicit Persona.

### Inference confidence threshold
- Apply an inferred value only when there is **clear evidence** in the problem narrative.
- If you cannot confidently infer a field, do not guess; add `status/needs-info` and list the uninferrable fields in the comment.

## Metadata consistency rules
When the seeded body includes the required metadata fields:

1. Prefer the explicit seeded metadata over labels.
2. If the explicit seeded metadata clearly conflicts with the narrative of the issue, do not guess; add `status/needs-info`, add a short comment describing the conflict, and do **NOT** change stage.
3. Use the explicit seeded metadata as the source of truth for normalization unless the issue body makes the intended meaning unambiguous and the seeded metadata is clearly a minor formatting error.

## Label inference rules
When persona/domain labels are missing or inconsistent:

1. Prefer existing valid labels if they are already present and unambiguous.
2. Otherwise infer from explicit body fields if present:
   - `Domain: <domain>`
   - `Persona: <persona>`
3. Otherwise infer conservatively from the issue content only if the match is clear.
4. If you cannot confidently determine:
   - exactly one persona
   - and at least one valid domain
   then add `status/needs-info`, add a short comment listing exactly what is missing, and do NOT change stage.

Use only canonical labels from AGENTS.md.

## Label hygiene rules
Before advancing:
- ensure exactly one `persona/*` label
- ensure 1–3 `domain/*` labels
- remove conflicting or duplicate persona/domain labels when the correct replacement is clear
- if persona is ambiguous, do not guess; add `status/needs-info` and stop

## If missing required info
After attempting inference, if any of the following are still unresolvable with sufficient confidence:
- `Domain: <domain>` — could not be inferred
- `Theme: <theme>` — could not be inferred
- `Subtheme: <subtheme>` — could not be inferred
- `Catalog status: <catalog|off-catalog>` — could not be inferred
- `Persona: <persona>` — ambiguous between two or more personas
- `Archetype: <archetype>` — could not be inferred
- JTBD one-liner — not present or not derivable
- Context + frequency — not present or not derivable
- Pain / stakes — not present or not derivable
- Current workaround — not present or not derivable
- persona label — ambiguous
- domain label — not determinable

Then:
- Add a short comment listing exactly what's missing, invalid, or uninferrable
- Add label: `status/needs-info`
- Do NOT change stage

## Normalized output requirements
If the issue is complete enough to normalize, the normalized island must preserve and render the resolved metadata explicitly.

Inside:
`<!-- rw:normalized:start --> ... <!-- rw:normalized:end -->`

include:
- `**JTBD:**`
- `**Context & frequency:**`
- `**Pain / stakes:**`
- `**Current workaround:**`
- `**Trigger / failure moment:**`
- `**Persona:** <persona>`
- `**Domain:** <domain>`
- `**Theme:** <theme>`
- `**Subtheme:** <subtheme>`
- `**Catalog status:** <catalog|off-catalog>`
- `**Archetype:** <archetype>`

## If complete
1) Update the normalized island only:
   `<!-- rw:normalized:start --> ... <!-- rw:normalized:end -->`
2) Add labels:
   - `stage/1-normalized`
   - exactly one resolved `persona/*`
   - resolved `domain/*` labels
3) Remove labels:
   - `stage/0-intake`
   - any conflicting `persona/*` labels
   - any conflicting `domain/*` labels
4) Optionally remove `status/needs-info` if the issue is now sufficiently complete

Always emit at least one safe output operation, or noop.