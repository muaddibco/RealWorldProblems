import { InvocationContext, Timer } from "@azure/functions";
import * as df from "durable-functions";
import { STAGE_LABEL_PRIORITY } from "../domain/stages";
import { getRepoConfig } from "../github/env";
import { GitHubClient } from "../github/githubClient";

function issueInstanceId(owner: string, repo: string, issueNumber: number): string {
  return `rw:${owner}:${repo}:issue:${issueNumber}`;
}

function isActiveStatus(status: string): boolean {
  return status === "Running" || status === "Pending" || status === "ContinuedAsNew";
}

function hasAny(labels: string[], values: string[]): boolean {
  return values.some((value) => labels.includes(value));
}

df.app.client.timer("scanBacklog", {
  schedule: "0 */10 * * * *",
  handler: async (_timer: Timer, client: df.DurableClient, context: InvocationContext) => {
    const { owner, repo } = getRepoConfig();
    const github = await GitHubClient.create();
    const batchSize = Math.max(1, Number(process.env.SCAN_BATCH_SIZE ?? "10"));

    const candidates: Array<{ number: number; labels: string[] }> = [];

    for (const stageLabel of STAGE_LABEL_PRIORITY) {
      if (candidates.length >= batchSize) {
        break;
      }

      const issues = await github.listIssuesByLabels(owner, repo, ["type/problem", stageLabel], batchSize);
      for (const issue of issues) {
        const labels = issue.labels.map((label) => label.name);
        if (labels.includes("agentic-workflows") || labels.includes("rw/processing")) {
          continue;
        }

        if (hasAny(labels, ["status/needs-info", "status/orchestration-failed", "stage/9-archived"])) {
          continue;
        }

        if (!candidates.some((candidate) => candidate.number === issue.number)) {
          candidates.push({ number: issue.number, labels });
        }

        if (candidates.length >= batchSize) {
          break;
        }
      }
    }

    let started = 0;

    for (const issue of candidates) {
      const instanceId = issueInstanceId(owner, repo, issue.number);
      const existing = await client.getStatus(instanceId);

      if (existing && isActiveStatus(existing.runtimeStatus)) {
        continue;
      }

      await client.startNew("IssuePipelineOrchestrator", {
        instanceId,
        input: {
          owner,
          repo,
          issueNumber: issue.number,
          reason: "scan"
        }
      });

      started += 1;
    }

    context.log(`scanBacklog started ${started} orchestration(s)`);
  }
});
