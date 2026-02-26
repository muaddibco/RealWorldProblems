---
name: "RW: Dedupe + Cluster"
on:
  issues:
    types: [labeled]
    names: [stage/1-normalized]
    lock-for-agent: true

engine:
  id: copilot
  agent: rw-deduper

permissions:
  contents: read
  issues: read

sandbox:
  agent: awf

network: {}   # no outbound network for this step (strict mode requires explicit config) :contentReference[oaicite:8]{index=8}

tools:
  github:
    toolsets: [issues]
    read-only: true

safe-outputs:
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
  close-issue:
    max: 1
  noop:
---

# Dedupe + Cluster (stage/1-normalized → stage/2-deduped or archived)

Operate ONLY if the issue has labels:
- type/problem
- stage/1-normalized
- and does NOT have label agentic-workflows

Otherwise: emit noop.

## Tasks

1) Search for likely duplicates among open issues:
   - similar titles ("Problem: ...")
   - similar JTBD lines

2) If this issue is a duplicate:
   - Add comment: "Duplicate of #<id> (reason: ...)"
   - Add labels: status/duplicate, stage/9-archived, archive/other (or archive/low-pain etc. if appropriate)
   - Remove label: stage/1-normalized
   - Close issue with state-reason "duplicate" if supported; otherwise just label archived.

3) If NOT a duplicate:
   - Write a short summary into the Dedupe island using update-issue + replace-island semantics:
     <!-- rw:dedupe:start -->
     - Checked duplicates: #... (if any)
     - Cluster suggestion (free text): "<cluster name>"
     - Notes: ...
     <!-- rw:dedupe:end -->
   - Add label: stage/2-deduped
   - Remove label: stage/1-normalized

## Output requirements
- Use update-issue with operation: replace-island for the dedupe island.
- Always emit at least one safe output action, or noop.