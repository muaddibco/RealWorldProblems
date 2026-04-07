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
1. These must be present in the seeded issue body itself, not merely inferable from labels or later-added normalized content.
2. Do **not** count content inside any previously generated workflow island or comment as satisfying this requirement.
3. `Catalog status` is valid only if it is exactly:
   - `catalog`
   - `off-catalog`
4. If any of these six fields are missing, malformed, or ambiguous, add `status/needs-info`, add a short comment listing exactly what is missing or invalid, and do **NOT** change stage.
5. Do not silently synthesize missing seed metadata into the source issue just to make it pass the gate.

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
If any of these are still missing, malformed, inconsistent, or unclear after validation:
- `Domain: <domain>`
- `Theme: <theme>`
- `Subtheme: <subtheme>`
- `Catalog status: <catalog|off-catalog>`
- `Persona: <persona>`
- `Archetype: <archetype>`
- JTBD one-liner
- Context + frequency
- Pain / stakes
- Current workaround
- persona label
- domain label

Then:
- Add a short comment listing exactly what’s missing or invalid
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