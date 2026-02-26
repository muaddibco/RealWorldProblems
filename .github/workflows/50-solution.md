---
name: "RW: Solution Hypothesis"
on:
  issues:
    types: [labeled]
    names: [stage/4-solution]
    lock-for-agent: true

engine:
  id: copilot
  agent: rw-solution-drafter

permissions:
  contents: read
  issues: read

sandbox:
  agent: awf

network: {}

tools:
  github:
    toolsets: [issues, repos]
    read-only: true

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

# Solution hypothesis (rw:solution island)

Operate ONLY if:
- type/problem
- stage/4-solution
- and does NOT have label agentic-workflows

## Write into solution island

<!-- rw:solution:start -->
### Solution hypothesis (1 paragraph)
...

### Differentiation wedge (why we win)
- ...

### MVP scope (3–7 bullets)
- ...

### Not MVP (explicitly out of scope)
- ...
<!-- rw:solution:end -->

## Advance
- Add label: stage/5-competitors
- Remove label: stage/4-solution

Always emit safe outputs or noop.