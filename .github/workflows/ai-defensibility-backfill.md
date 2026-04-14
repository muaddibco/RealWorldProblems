---
name: "RW: AI Defensibility Backfill"
strict: false

on:
  workflow_dispatch:
    inputs:
      limit:
        description: "How many issues to process in this run (1–25)"
        required: true
        default: "10"

engine:
  id: copilot
  agent: rw-ai-defensibility-backfill

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
  update-issue:
    body: true
    target: "*"
    max: 25
  add-labels:
    blocked: ["~*", "*[bot]"]
    target: "*"
    max: 25
  remove-labels:
    blocked: ["~*"]
    target: "*"
    max: 25
  create-issue:
    title-prefix: "[ai-backfill] "
    labels: [type/report]
    close-older-issues: false
    max: 1
  noop:
---

# Backfill AI defensibility for already-existing validation-stage problems

Tooling note:
- Read/search issues using GitHub MCP issue tools (`issue_read`, `list_issues`, `search_issues`).
- Do NOT use `gh` CLI, `curl`, shell scripts, or local Python for issue discovery or filtering in this workflow.
- If GitHub read/search tools are unavailable in the model tool list, emit `noop` with a short reason and stop.
- Do NOT conclude "no matching issues" after checking only one page of search results.

## Goal
Find existing `type/problem` issues that:
- have `stage/7-validation`
- do NOT have label `agentic-workflows`
- do NOT already have any `ai-defensibility/*` label

Then, process up to `${{ inputs.limit }}` issues, but never more than 25 in a single run.

For each selected issue:
1. Read the issue
2. Evaluate AI defensibility using the same rubric as the normal AI-defensibility stage
3. Write/update only the `rw:ai-defensibility` island
4. Add exactly one:
   - `ai-defensibility/strong` OR
   - `ai-defensibility/medium` OR
   - `ai-defensibility/weak`
5. Add exactly one:
   - `ai-risk/low` OR
   - `ai-risk/medium` OR
   - `ai-risk/high`
6. Remove any conflicting existing `ai-defensibility/*` or `ai-risk/*` labels if present
7. DO NOT change the current `stage/*` label

## Input handling
- Treat `${{ inputs.limit }}` as the requested maximum count for this run.
- If the input is missing, invalid, non-numeric, or greater than 25, treat it as 10.
- If the input is less than 1, treat it as 1.

## Discovery rule (mandatory)
GitHub issue search is reliable for finding issues with required labels, but not for excluding an entire label prefix like `ai-defensibility/*`.

Therefore, use this two-step approach:

1. Search broadly for open issues matching:
   - `repo:${{ github.repository }} is:issue is:open label:"type/problem" label:"stage/7-validation"`

2. Then filter the returned issues client-side:
   - exclude any issue that has label `agentic-workflows`
   - exclude any issue that has any label whose name starts with `ai-defensibility/`

Do NOT try to rely on GitHub query syntax alone to exclude `ai-defensibility/*`.

## Pagination rule (mandatory)
You MUST paginate through search results until one of these happens:
- enough qualifying issues have been collected to satisfy the run limit, or
- the search results are exhausted

Use deterministic pagination:
- preferred page size: 100
- deterministic ordering: oldest first if supported (`sort: created`, `order: asc`)

Track these counters during discovery:
- `pages_scanned`
- `issues_seen`
- `qualifying_issues_found`

Minimum discovery algorithm:
1. Normalize the requested limit to an integer in the range `1..25`
2. Start at page 1
3. Search for:
   - `repo:${{ github.repository }} is:issue is:open label:"type/problem" label:"stage/7-validation"`
4. Inspect every returned issue on that page
5. Filter out:
   - issues with `agentic-workflows`
   - issues with any `ai-defensibility/*` label
   - issues lacking a meaningful `rw:solution` island
6. Keep collecting qualifying issues until the limit is reached
7. If the page is full, continue to the next page
8. Only emit `noop` after the search is exhausted and zero qualifying issues remain

Never conclude "no matching issues" after inspecting only the first page.

## Selection priority
Skip any issue that does not have a `rw:solution` island with meaningful content.
Do not create AI-defensibility output for issues that lack a drafted solution.

Prioritize issues that:
- are in `stage/7-validation`
- are missing the `rw:ai-defensibility` island
- do not yet have AI labels

If more than `${{ inputs.limit }}` issues qualify, only process the top-priority subset within the limit.

If no matching issues are found after pagination is exhausted, emit `noop`.

## Evaluation rubric
Use the same rubric as the normal AI-defensibility stage.

When choosing `ai-defensibility/*`, assess whether the likely solution has durable advantage from factors such as:
- workflow ownership
- proprietary or accumulating data
- integration depth
- switching cost
- repeatable wedge or distribution moat
- resistance to being replaced by a thin generic AI wrapper

When choosing `ai-risk/*`, assess how exposed the likely solution is to rapid model improvement or commoditization.

## Output format per touched issue
Write into:

<!-- rw:ai-defensibility:start -->
### AI Defensibility Scorecard

| Dimension | 1–5 | Rationale |
|---|---:|---|
| Replaceability | | |
| Workflow ownership | | |
| Data moat | | |
| Integration depth | | |
| Switching cost | | |
| **Total (max 25)** | | |

### Verdict
- Defensibility: strong | medium | weak
- AI risk: low | medium | high

### Why
- ...

### How to improve defensibility
- ...

### Kill shot test
"If a better LLM appears tomorrow, what happens?"
- ...
<!-- rw:ai-defensibility:end -->

Rules:
- Update only the `rw:ai-defensibility` island
- Do not erase unrelated issue content
- If the island already exists, replace only that island
- Keep the write-up concise, specific, and tied to the actual problem + proposed solution

## Label rules
For each processed issue:
- add exactly one of:
  - `ai-defensibility/strong`
  - `ai-defensibility/medium`
  - `ai-defensibility/weak`
- add exactly one of:
  - `ai-risk/low`
  - `ai-risk/medium`
  - `ai-risk/high`

If conflicting labels already exist:
- remove any existing `ai-defensibility/*` labels before adding the new one
- remove any existing `ai-risk/*` labels before adding the new one

Do not change the issue's current `stage/*` label.

## Reporting
If at least one issue is updated, create one report issue:
- title: "[ai-backfill] <YYYY-MM-DD>"
- body should include:
  - requested limit
  - actual number processed
  - pages scanned
  - issues seen during discovery
  - qualifying issues found
  - issues touched
  - assigned defensibility labels
  - assigned AI risk labels
  - any recurring weaknesses observed

If no issues are updated, emit `noop` with a short message that includes:
- pages scanned
- issues seen
- qualifying issues found

## Output discipline
If issues are processed:
- for each touched issue, emit the needed safe outputs to update the body and reconcile labels
- then create exactly one report issue

If no issues qualify:
- emit exactly one `noop`

Do not emit a "nothing found" result unless pagination has been exhausted.