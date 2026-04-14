---
name: "RW: Validation Plan"
strict: false
on:
  workflow_dispatch:
    inputs:
      issue_number:
        description: "Target issue number"
        required: true
        type: string
      trigger_label:
        description: "Stage label that triggered this run"
        required: true
        type: string

concurrency:
  group: rw-validation-plan-${{ github.repository }}-${{ inputs.issue_number }}
  cancel-in-progress: false

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
  staged: false
  github-token: ${{ secrets.SAFEOUTPUTS_GITHUB_TOKEN }}
  update-issue:
    body: true
    target: "*"
    max: 1
  create-issue:
    title-prefix: "[experiment] "
    labels: [type/experiment]
    max: 1
  add-comment:
    target: "*"
    max: 1
  add-labels:
    blocked: ["~*", "*[bot]"]
    max: 10
  remove-labels:
    blocked: ["~*"]
    max: 10
  close-issue:
    target: "*"
    max: 1
  noop:
---

# Create a validation plan focused on the next highest-value uncertainty

## Dispatch context

- Target issue: #${{ inputs.issue_number }}
- Trigger label: `${{ inputs.trigger_label }}`

Before doing anything else:
- Read issue #${{ inputs.issue_number }} using GitHub MCP issue tools.
- Operate ONLY if issue #${{ inputs.issue_number }} has labels `type/problem`, `stage/7-validation`, and `wedge/credible`, and does NOT have labels `agentic-workflows` or `stage/9-archived`.
- Otherwise `noop`.

## Mandatory completion rule

A successful run MUST end with at least one safe-output tool call.

Valid endings are only:
- `update_issue` plus any needed `add_labels` / `remove_labels`
- `add_comment` plus `add_labels` when info is missing
- `noop` when the issue should not be processed

Do not end with prose-only output.
Do not stop after analysis.
A run with no safe-output tool call is invalid.

## Mandatory write targeting rule

Because this workflow runs via `workflow_dispatch`, there is no implicit triggering issue.

For every write action, always target:
- `repo: ${{ github.repository }}`
- `issue_number: ${{ inputs.issue_number }}` for `update_issue`
- `item_number: ${{ inputs.issue_number }}` for `add_comment`
- `item_number: ${{ inputs.issue_number }}` for `add_labels`
- `item_number: ${{ inputs.issue_number }}` for `remove_labels`

Never rely on implicit targeting.

## What this stage is for
This stage should turn a validation-ready problem into a **practical next experiment**.

It should align with the updated pipeline logic:
- stage 3 scored **problem attractiveness**
- stage 6 decided the **market-entry wedge**
- stage 7 should test the **most decision-critical remaining assumption** before more build or go-to-market work

Do **not** produce a generic plan that tries to validate everything at once.
Choose the single highest-value uncertainty, or at most two closely related uncertainties.

## Preconditions
Expected inputs before planning:
- scorecard island present
- wedge island present
- solution island present

Competitors island is helpful context and should usually exist by this stage, but the plan may still proceed if the scorecard, solution, and wedge are all present and sufficiently specific.

If any required island is clearly missing:
- add one short comment explaining what is missing
- add label: status/needs-info
- stop

Tooling note:
- Read/search issues using GitHub MCP issue tools (issue_read/list_issues/search_issues).
- Do NOT use `gh` CLI or `curl` for issue reads in this workflow.
- If GitHub read tools are unavailable in the model tool list, emit `noop` with a short reason and stop.

## Planning logic
Use the scorecard and wedge islands as the source of truth.

Prioritize the experiment around the weakest decision-critical assumption, especially when one of these is uncertain:
- willingness-to-pay
- reachability / ability to access the initial ICP
- wedge adoption / whether the narrow entry angle is compelling
- feasibility of the MVP delivering value in the target workflow
- urgency / failure cost being strong enough to trigger action now

### Method selection guidance
Prefer methods based on confidence, evidence, and the type of uncertainty:
- If **Evidence** is weak or **Confidence** is low, prefer **interviews** or a **concierge MVP** first.
- If willingness-to-pay is the main open question, prefer **paid pilot**, pricing conversations, or a **landing page + waitlist** with a concrete offer.
- If reachability / channel is the main open question, prefer **landing page + waitlist** or direct outreach tests tied to the wedge ICP.
- If workflow fit is the main open question, prefer **concierge MVP** or structured interviews around the trigger moment and current workaround.
- If feasibility is the main open question, define a small technical proof or fake-door test that validates whether users would adopt the MVP behavior.

Do **not** recommend a paid pilot when the issue still lacks a credible ICP, recruiter path, or concrete value proposition.

## Write the validation plan into the parent issue

<!-- rw:validation:start -->
### Validation goal
- Primary uncertainty: ...
- Why this is the next thing to test now: ...

### Hypothesis
...

### Method (choose 1 primary, optional 1 secondary)
- ...

### Target participant / customer
- ...

### Recruiting path
- ...

### Success criteria (pass/fail)
- ...

### Evidence to collect
- ...

### Interview questions or test script (optional)
- ...

### Next action if PASS / if FAIL
- PASS: ...
- FAIL: ...

### Planning notes
- Scorecard signals used: confidence=..., evidence=..., risk=...
- Wedge assumption being tested: ...
- Experiment issue: #<new id> (if created)
<!-- rw:validation:end -->

## Child experiment issue
Create one `type/experiment` child issue when the plan is concrete enough to run.

Issue requirements:
- Title: `[experiment] <short problem name> - <primary uncertainty>`
- Body should mirror the parent validation island in compact form
- Include:
  - parent problem link/reference
  - primary uncertainty
  - hypothesis
  - method
  - recruiting path
  - success criteria
  - pass/fail next action

If an experiment issue is created, add its reference in the parent validation island.

## Label handling
If the validation plan is created successfully:
- optionally remove `status/needs-info` if the issue is now sufficiently complete

Do **not** advance the issue to another stage here.
This stage prepares validation work; it does not claim validation has been completed.

Always emit safe outputs or noop.
