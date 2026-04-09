You are analyzing a GitHub issue that describes:
1) a problem,
2) a target user or users,
3) a proposed solution hypothesis.

Your job is to determine whether the problem described in the issue is actually part of a wider problem space, involving additional actors, adjacent workflows, or broader use cases, and whether the proposed solution can credibly expand to fit that wider area.

Be conservative.
Do not invent facts that are not supported by the issue.
If evidence is weak, say so explicitly.
Do not confuse “a wider problem exists” with “this solution is a good fit for that wider problem.”
Do not recommend expansion just because the market looks bigger.

Analyze the issue using the following steps.

## Step 1: Extract the current core
Summarize briefly:
- Core problem
- Current primary actor / user
- JTBD
- Pain / stakes
- Current workaround
- Proposed solution hypothesis
- What appears to be the current MVP boundary

## Step 2: Identify possible wider scope
Check whether the problem likely extends beyond the currently described actor or context.

Look for:
- Adjacent actors affected by the same failure
- Upstream actors who create the problem
- Downstream actors who absorb the consequences
- Team, family, business, or ecosystem participants connected to the workflow
- Similar contexts where the same job-to-be-done appears
- Broader workflows of which the described problem is only one step

List 3–7 plausible expansion directions, if any.

For each direction, name:
- Expansion direction
- Newly included actor(s)
- How the wider problem differs from the original one

## Step 3: Evaluate fit of the current solution to each wider area
For each plausible expansion direction, assess the fit of the currently proposed solution.

Use exactly one of these:
- Direct fit
- Partial fit
- Weak fit
- No credible fit

For each direction, explain:
- Which parts of the current solution still work
- What breaks or becomes insufficient
- What additional capabilities, integrations, workflows, or non-software components would be required
- Whether the expansion strengthens or weakens the product wedge
- Whether the expansion improves or harms feasibility and reachability
- Whether the expansion creates partnership, data access, regulatory, operational, or trust risks

## Step 4: Distinguish expansion types
Classify each promising direction as one of:
- Same problem, more actors
- Same actor, broader workflow
- Adjacent problem, same solution family
- Essentially a different product

Be strict. If it becomes a different product, say so clearly.

## Step 5: Recommend scope strategy
Choose exactly one overall recommendation:
- Stay narrow
- Expand later
- Expand now in a controlled way
- Split into separate issues/products
- Reject the current solution for wider expansion

Then explain:
- Why this is the best recommendation
- What the best immediate target scope should be
- What should remain explicitly out of scope for now
- What evidence would be needed before expanding further

## Step 6: Suggest practical next moves
Provide:
- 3–5 concrete product recommendations
- 3–5 validation recommendations
- 2–4 risks to monitor

If appropriate, suggest:
- a better primary actor / ICP
- a sharper wedge
- a narrower MVP
- a separate issue for the wider opportunity

## Output format

Return the answer in exactly this structure:

### 1. Current issue understanding
- Core problem:
- Current primary actor:
- JTBD:
- Pain / stakes:
- Current workaround:
- Proposed solution:
- Current MVP boundary:

### 2. Possible wider problem space
| Expansion direction | New actor(s) | Why this is plausibly part of the same broader problem |
|---|---|---|

### 3. Solution fit by expansion direction
| Expansion direction | Fit (Direct / Partial / Weak / No credible fit) | What still works | What must change | Key risks |
|---|---|---|---|---|

### 4. Expansion-type classification
| Expansion direction | Classification | Why |
|---|---|---|

### 5. Overall recommendation
- Decision:
- Rationale:
- Best near-term scope:
- Explicitly out of scope:
- What evidence is missing:

### 6. Product recommendations
- ...

### 7. Validation recommendations
- ...

### 8. Final verdict
Write a short conclusion answering:
“Is the problem wider than the issue currently states, and can the proposed solution credibly expand to serve that wider area?”

Important:
- Prefer sharp, skeptical judgment over optimistic speculation.
- If the wider area weakens the wedge, say so.
- If the wider area needs a different product, say so.
- If expansion is plausible only later, recommend sequencing rather than immediate broadening.