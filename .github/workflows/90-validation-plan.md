---
name: "RW: Validation Plan"
on:
  issues:
    types: [labeled]
    names: [stage/7-validation]
    lock-for-agent: true

engine:
  id: copilot
  agent: rw-validation-planner

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
    max: 1
  create-issue:
    title-prefix: "[experiment] "
    labels: [type/experiment]
    max: 1
  add-labels:
    blocked: ["~*", "*[bot]"]
    max: 10
  remove-labels:
    blocked: ["~*"]
    max: 10
  noop:
---

# Create validation experiment plan for shortlisted problems

Operate ONLY if:
- type/problem
- stage/7-validation
- and wedge/credible OR status/shortlisted
- and does NOT have label agentic-workflows

Tooling note:
- Read/search issues using GitHub MCP issue tools (issue_read/list_issues/search_issues).
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `missing_tool` once and stop.

## 1) Write the validation plan into the parent issue

<!-- rw:validation:start -->
### Hypothesis
...

### Method (choose 1–2)
- Interviews (10–15)
- Landing page + waitlist
- Concierge MVP
- Paid pilot

### Success criteria (pass/fail)
- ...

### Interview questions (optional)
- ...

### Next action if PASS / if FAIL
- PASS: ...
- FAIL: archive with reason ...
<!-- rw:validation:end -->

## 2) Create a child experiment issue (optional but recommended)
Create one `type/experiment` issue with:
- Title: "[experiment] <short problem name>"
- Body: copy the same hypothesis/method/success criteria
- Include a link back to the parent problem issue.

If you create the experiment issue, also add a short line in the parent’s validation island:
- "Experiment issue: #<new id>"

Tip: If you use temporary IDs (aw_...) for references, safe outputs can replace them later. :contentReference[oaicite:12]{index=12}

Always emit safe outputs or noop.