import * as df from "durable-functions";
import { decideNextStage } from "../domain/stageDecision";
import { getIslandContent } from "../domain/islands";
import { STAGE_LABEL_PRIORITY } from "../domain/stages";
import { GitHubIssue, StageDefinition } from "../domain/types";
import { getRepoConfig } from "../github/env";
import { GitHubClient } from "../github/githubClient";

function labelNames(issue: GitHubIssue): string[] {
  return issue.labels.map((label) => label.name);
}

function hasAnyLabel(labels: string[], candidates: string[]): boolean {
  return candidates.some((candidate) => labels.includes(candidate));
}

df.app.activity("GetIssueActivity", {
  handler: async (input: { owner: string; repo: string; issueNumber: number }) => {
    const github = await GitHubClient.create();
    return github.getIssue(input.owner, input.repo, input.issueNumber);
  }
});

df.app.activity("DecideNextStageActivity", {
  handler: async (input: { issue: GitHubIssue; stages: StageDefinition[] }) => {
    return decideNextStage(input.issue, input.stages);
  }
});

df.app.activity("ClaimIssueActivity", {
  handler: async (input: {
    owner: string;
    repo: string;
    issueNumber: number;
    stageId: string;
    orchestrationId: string;
  }) => {
    const github = await GitHubClient.create();
    const issue = await github.getIssue(input.owner, input.repo, input.issueNumber);
    const labels = labelNames(issue);

    if (labels.includes("rw/processing")) {
      return {
        claimed: false,
        reason: "rw/processing already present"
      };
    }

    await github.addLabels(input.owner, input.repo, input.issueNumber, ["rw/processing", `rw/stage-${input.stageId}`]);
    await github.addComment(
      input.owner,
      input.repo,
      input.issueNumber,
      [
        `<!-- rw:orchestration-run:${input.orchestrationId} -->`,
        `Orchestrator claimed issue for stage \`${input.stageId}\` at ${new Date().toISOString()}.`
      ].join("\n")
    );

    return {
      claimed: true
    };
  }
});

df.app.activity("DispatchWorkflowActivity", {
  handler: async (input: {
    owner: string;
    repo: string;
    issueNumber: number;
    stage: StageDefinition;
    orchestrationId: string;
  }) => {
    const github = await GitHubClient.create();
    const ref = process.env.GITHUB_WORKFLOW_REF ?? "main";

    await github.dispatchWorkflow({
      owner: input.owner,
      repo: input.repo,
      workflowId: input.stage.workflowId,
      ref,
      inputs: {
        issue_number: String(input.issueNumber),
        trigger_label: input.stage.stageLabel,
        orchestration_id: input.orchestrationId
      }
    });

    return {
      dispatched: true,
      workflowId: input.stage.workflowId
    };
  }
});

df.app.activity("VerifyStageTransitionActivity", {
  handler: async (input: {
    owner: string;
    repo: string;
    issueNumber: number;
    stage: StageDefinition;
  }) => {
    const github = await GitHubClient.create();
    const issue = await github.getIssue(input.owner, input.repo, input.issueNumber);
    const labels = labelNames(issue);

    const hasExpected = hasAnyLabel(labels, input.stage.expectedNextLabels);
    const isArchived = labels.includes("stage/9-archived");
    const validationDone = input.stage.id === "validation" && getIslandContent(issue.body, "validation").length > 0;
    const terminalByLabel = hasAnyLabel(labels, input.stage.terminalLabels ?? []);

    return {
      advanced: hasExpected || validationDone || isArchived,
      terminal: isArchived || validationDone || terminalByLabel || labels.includes("status/needs-info"),
      labels,
      reason: hasExpected || validationDone ? "expected transition detected" : "expected transition not detected"
    };
  }
});

df.app.activity("ReleaseIssueActivity", {
  handler: async (input: {
    owner: string;
    repo: string;
    issueNumber: number;
    stageId: string;
  }) => {
    const github = await GitHubClient.create();

    await github.removeLabelIfExists(input.owner, input.repo, input.issueNumber, "rw/processing");
    await github.removeLabelIfExists(input.owner, input.repo, input.issueNumber, `rw/stage-${input.stageId}`);

    return {
      released: true
    };
  }
});

df.app.activity("MarkIssueFailedActivity", {
  handler: async (input: {
    owner: string;
    repo: string;
    issueNumber: number;
    stageId: string;
    reason: string;
    orchestrationId: string;
  }) => {
    const github = await GitHubClient.create();

    await github.addLabels(input.owner, input.repo, input.issueNumber, ["status/orchestration-failed"]);
    await github.addComment(
      input.owner,
      input.repo,
      input.issueNumber,
      [
        "Orchestration failed.",
        `- Stage: \`${input.stageId}\``,
        `- Reason: \`${input.reason}\``,
        `- Orchestration: \`${input.orchestrationId}\``
      ].join("\n")
    );

    return {
      marked: true
    };
  }
});

df.app.activity("FindEligibleIssuesActivity", {
  handler: async (input: { owner: string; repo: string; max: number }) => {
    const github = await GitHubClient.create();
    const max = Math.max(1, input.max);
    const candidates: GitHubIssue[] = [];

    for (const stageLabel of STAGE_LABEL_PRIORITY) {
      if (candidates.length >= max) {
        break;
      }

      const stageIssues = await github.listIssuesByLabels(input.owner, input.repo, ["type/problem", stageLabel], max);
      for (const issue of stageIssues) {
        const labels = labelNames(issue);
        if (labels.includes("agentic-workflows")) {
          continue;
        }

        if (labels.includes("rw/processing")) {
          continue;
        }

        if (labels.includes("status/needs-info") || labels.includes("status/orchestration-failed")) {
          continue;
        }

        if (!candidates.some((candidate) => candidate.number === issue.number)) {
          candidates.push(issue);
        }

        if (candidates.length >= max) {
          break;
        }
      }
    }

    return candidates;
  }
});
