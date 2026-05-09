import * as df from "durable-functions";
import { decideNextStage } from "../domain/stageDecision";
import { getIslandContent } from "../domain/islands";
import { STAGE_LABEL_PRIORITY } from "../domain/stages";
import { GitHubIssue, StageDefinition } from "../domain/types";
import { getRepoConfig } from "../github/env";
import { GitHubClient } from "../github/githubClient";

const DISPATCH_COOLDOWN_SECONDS = 180;
const DISPATCH_MARKER_REGEX = /(?:<!--|\&lt;!--)\s*rw:workflow-dispatch:([^\s>]+)\s*(?:-->|\&gt;)/;

function getDispatchCooldownMs(): number {
  const raw = process.env.RW_WORKFLOW_DISPATCH_COOLDOWN_SECONDS;
  const parsed = Number(raw);

  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.floor(parsed) * 1000;
  }

  return DISPATCH_COOLDOWN_SECONDS * 1000;
}

function findLatestDispatchTimestamp(comments: { body: string, created_at: string }[]): Date | undefined {
  for (const comment of comments) {
    const markerMatch = comment.body.match(DISPATCH_MARKER_REGEX);
    if (!markerMatch) {
      continue;
    }

    const markerTimestamp = new Date(markerMatch[1]);
    if (!Number.isNaN(markerTimestamp.getTime())) {
      return markerTimestamp;
    }

    const commentTimestamp = new Date(comment.created_at);
    if (!Number.isNaN(commentTimestamp.getTime())) {
      return commentTimestamp;
    }
  }

  return undefined;
}

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
  handler: async (input: { owner: string; repo: string; issue: GitHubIssue; stages: StageDefinition[] }) => {
    return decideNextStage(input.issue, input.stages );
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
    const cooldownMs = getDispatchCooldownMs();

    if (cooldownMs > 0) {
      const comments = await github.listIssueComments(input.owner, input.repo, input.issueNumber, 50);
      const lastDispatchAt = findLatestDispatchTimestamp(comments);

      if (lastDispatchAt) {
        const nowMs = Date.now();
        const allowedAtMs = lastDispatchAt.getTime() + cooldownMs;

        if (allowedAtMs > nowMs) {
          const waitUntilUtc = new Date(allowedAtMs).toISOString()
          await github.addComment(
            input.owner,
            input.repo,
            input.issueNumber,
            [
              `<!-- rw:workflow-cooldown:${waitUntilUtc} -->`,
              `Too frequent execution detected. Workflow cooldown recorded till ${waitUntilUtc}: \`${input.stage.workflowId}\` for stage \`${input.stage.id}\` by orchestration \`${input.orchestrationId}\`.`
            ].join("\n")
          );
          await github.addLabels(input.owner, input.repo, input.issueNumber, ["rw/cooldown"]);

          return {
            dispatched: false,
            workflowId: input.stage.workflowId,
            reason: "dispatch-cooldown-active",
            waitUntilUtc
          };
        }
      }
    }

    await github.dispatchWorkflow({
      owner: input.owner,
      repo: input.repo,
      workflowId: input.stage.workflowId,
      ref,
      inputs: {
        issue_number: String(input.issueNumber),
        orchestration_id: input.orchestrationId
      }
    });

    const dispatchedAtUtc = new Date().toISOString();
    await github.addComment(
      input.owner,
      input.repo,
      input.issueNumber,
      [
        `<!-- rw:workflow-dispatch:${dispatchedAtUtc} -->`,
        `Workflow dispatch recorded: \`${input.stage.workflowId}\` for stage \`${input.stage.id}\` by orchestration \`${input.orchestrationId}\`.`
      ].join("\n")
    );

    return {
      dispatched: true,
      workflowId: input.stage.workflowId,
      dispatchedAtUtc
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

df.app.activity("ReleaseIssueCooldownActivity", {
  handler: async (input: {
    owner: string;
    repo: string;
    issueNumber: number;
  }) => {
    const github = await GitHubClient.create();

    await github.removeLabelIfExists(input.owner, input.repo, input.issueNumber, "rw/cooldown");

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
