---
on:
  issues:
    types: [opened, edited]
    lock-for-agent: true
engine:
  id: copilot
  agent: rw-normalizer
permissions:
  contents: read
  issues: write
safe-outputs:
  update-issue:
    title:
    body:
    max: 1
  add-comment:
    max: 1
  add-labels:
    max: 5
  remove-labels:
    max: 5
---

# Normalize Problem Issue

Work only on issues that have label `type/problem` and `stage/0-intake`.
If not applicable, emit noop.

## If the issue is missing required info
Post a comment listing exactly what’s missing and add label `status/needs-info`.
Do NOT change the stage label.

## If the issue is complete
1) Rewrite the body to match `docs/templates/problem_body_template.md`.
2) Use an island so reruns are safe:
   <!-- rw:normalized:start --> ... <!-- rw:normalized:end -->
3) Add label `stage/1-normalized`
4) Remove label `stage/0-intake`

Always emit at least one safe output operation, or noop.