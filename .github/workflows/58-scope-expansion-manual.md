---
name: "RW: Scope Expansion Review (Manual)"
on:
  workflow_dispatch:
    inputs:
      issue_number:
        description: "Issue number to analyze"
        required: true
        default: ""
      overwrite_existing:
        description: "Replace existing rw:expansion island if present"
        required: true
        default: "true"
        type: choice
        options:
          - "true"
          - "false"

engine:
  id: copilot
  agent: rw-scope-expander

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
    target: "*"
    max: 1
  noop:
---

# Manual scope expansion review (optional add-on)

This workflow is a manual utility. It does NOT participate in the normal pipeline.
It does NOT change labels, stages, or issue state.
It only writes or refreshes the `rw:expansion` island on one selected issue.

## Target
Analyze issue #${{ inputs.issue_number }}.

## Operate ONLY if
- the target issue exists
- it has label `type/problem`
- it does NOT have label `agentic-workflows`

Otherwise emit noop.

Tooling note:
- Read the selected issue using GitHub MCP issue tools (`issue_read`, `list_issues`, `search_issues`) as needed.
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `missing_tool` once and stop.

## Minimum basis required
Only proceed if the target issue contains enough information to assess scope expansion:
- a problem statement, preferably normalized (`rw:normalized`) or equivalent JTBD/context/pain/workaround
- and a proposed solution hypothesis (`rw:solution`) or equivalent solution description

If the issue lacks enough basis, emit noop with a short reason and do not modify the issue.

## Existing island handling
- If `${{ inputs.overwrite_existing }}` is `true`, replace the existing `rw:expansion` island if present.
- If `${{ inputs.overwrite_existing }}` is `false` and an `rw:expansion` island already exists, emit noop.

## Write into expansion island

<!-- rw:expansion:start -->
### Current core
- Primary actor: ...
- JTBD: ...
- Current scope boundary: ...
- Proposed solution boundary: ...

### Wider problem directions
| Direction | New actor(s) / context | Fit | Why |
|---|---|---|---|
| ... | ... | direct|partial|weak|no credible fit | ... |

### Best recommendation
- Decision: stay-narrow|expand-later|expand-now|split-issue|reject-wider-expansion
- Best expansion direction: ...
- Why: ...
- What must change in the solution: ...
- What should remain out of scope for now: ...
- Key risks: ...
- Validation next step: ...

### Final verdict
One short paragraph answering:
Is the problem wider than currently stated, and can the current solution credibly expand into that wider area?
<!-- rw:expansion:end -->

## Output requirements
- Use `update-issue` with replace-island semantics for `rw:expansion`.
- Do not rewrite the full issue body.
- Do not add or remove labels.
- Do not change the issue stage.

Always emit one safe output action, or noop.