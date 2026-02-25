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
  firewall: true
  allowed:
    - defaults
    - github
    - "www.google.com"
    - "www.bing.com"
    - "www.producthunt.com"
    - "www.g2.com"
    - "www.capterra.com"
# Network allowlist is required in strict mode; AWF enforces it. :contentReference[oaicite:9]{index=9}

tools:
  github:
    toolsets: [issues]
    read-only: true
  web-fetch:
  web-search:   # engine-dependent; if unavailable, mark “needs verification” :contentReference[oaicite:10]{index=10}

safe-outputs:
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

If web-search/web-fetch are missing, still produce a best-effort list and clearly mark “Needs verification”.

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