---
name: "RW: Competitor Scan"
on:
  issues:
    types: [labeled]
    names: [stage/5-competitors]
    lock-for-agent: true

engine:
  id: copilot
  agent: rw-competitor-scout

permissions:
  contents: read
  issues: read

sandbox:
  agent: awf

network:
  allowed:
    - defaults
    - github
    - "*.tavily.com"

mcp-servers:
  tavily:
    command: npx
    args: ["-y", "@tavily/mcp-server"]
    env:
      TAVILY_API_KEY: "${{ secrets.TAVILY_API_KEY }}"
    allowed: ["search", "search_news"]

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

# Competitor scan (rw:competitors island)

Operate ONLY if:
- type/problem
- stage/5-competitors
- and does NOT have label agentic-workflows

Tooling note:
- Read/search issues using GitHub MCP issue tools (issue_read/list_issues/search_issues).
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `missing_tool` once and stop.

Use Tavily MCP as the primary web research source (`tavily.search`, `tavily.search_news`).
Do not use direct `web-fetch` for arbitrary domains in this workflow because firewall allowlists may block it.
If Tavily tools are unavailable at runtime, still produce a best-effort list and clearly mark “Needs verification”.

## Write into competitors island

<!-- rw:competitors:start -->
### Direct competitors (3–10)
- Name — what they do — target user — pricing signal — source/link
- ...

### Substitutes / current workarounds
- ...

### Observed gaps / opportunities
- ...
<!-- rw:competitors:end -->

## Advance
- Add label: stage/6-shortlist
- Remove label: stage/5-competitors

Always emit safe outputs or noop.