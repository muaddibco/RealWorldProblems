---
name: "RW: AI Defensibility Gate"
on:
  issues:
    types: [labeled]
    names: [stage/ai-defensibility]
    lock-for-agent: true

engine:
  id: copilot
  agent: rw-ai-defensibility

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
  add-labels:
    blocked: ["~*", "*[bot]"]
    max: 10
  remove-labels:
    blocked: ["~*"]
    max: 10
  noop:
---

# AI defensibility evaluation (rw:ai-defensibility island)

Operate ONLY if:
- type/problem
- stage/ai-defensibility
- and does NOT have label agentic-workflows

Otherwise noop.

Tooling note:
- Read/search issues using GitHub MCP issue tools (issue_read/list_issues/search_issues).
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `missing_tool` once and stop.

## Evaluate AI defensibility
Choose exactly one:
- ai-defensibility/strong
- ai-defensibility/medium
- ai-defensibility/weak

Choose exactly one:
- ai-risk/low
- ai-risk/medium
- ai-risk/high

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

## Scoring guidance
Score each dimension from 1 to 5.

### Replaceability
- 1 = trivial prompt or generic chat can replace most of the value
- 3 = needs some workflow/product layer
- 5 = requires system-level execution, trust, or embedded operational context

### Workflow ownership
- 1 = advice/content only
- 3 = supports part of the workflow
- 5 = controls or executes a meaningful workflow step end-to-end

### Data moat
- 1 = no meaningful retained advantage
- 3 = useful structured history
- 5 = strong proprietary memory, usage data, or outcome history

### Integration depth
- 1 = standalone
- 3 = useful but non-essential integrations
- 5 = deeply embedded in important systems/files/APIs

### Switching cost
- 1 = easy to replace tomorrow
- 3 = moderate process/history loss
- 5 = strong habit, operational reliance, or reconfiguration cost

## Label thresholds
- Total 20–25:
  - ai-defensibility/strong
  - ai-risk/low
- Total 14–19:
  - ai-defensibility/medium
  - ai-risk/medium
- Total 5–13:
  - ai-defensibility/weak
  - ai-risk/high

## Heuristics
Usually weak:
- generic AI copilot
- summarization-only
- drafting-only
- Q&A over files
- “better UI on top of an LLM”

Usually stronger:
- owns execution
- embedded in a painful workflow step
- accumulates structured memory/data
- has meaningful integrations
- has a narrow, credible wedge

## Advance
- Add labels:
  - exactly one ai-defensibility/*
  - exactly one ai-risk/*
  - stage/5-competitors
- Remove label:
  - stage/ai-defensibility

Always emit safe outputs or noop.