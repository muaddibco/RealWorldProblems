import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as df from "durable-functions";
import { getRepoConfig } from "../github/env";
import { extractWorkflowCompletion } from "../github/workflowCompletion";
import { verifyGitHubSignature } from "../github/webhookValidation";

function issueInstanceId(owner: string, repo: string, issueNumber: number): string {
  return `rw:${owner}:${repo}:issue:${issueNumber}`;
}

function accepted(body: unknown): HttpResponseInit {
  return {
    status: 202,
    jsonBody: body
  };
}

function isActiveStatus(status: string): boolean {
  return status === "Running" || status === "Pending" || status === "ContinuedAsNew";
}

function isNotFoundStatusError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    statusCode?: number;
    status?: number;
    response?: { status?: number };
    message?: string;
  };

  if (candidate.statusCode === 404 || candidate.status === 404 || candidate.response?.status === 404) {
    return true;
  }

  return typeof candidate.message === "string" && /\b404\b|not found/i.test(candidate.message);
}

async function getStatusIfExists(client: df.DurableClient, instanceId: string, context: InvocationContext) {
  try {
    return await client.getStatus(instanceId);
  } catch (error: unknown) {
    if (isNotFoundStatusError(error)) {
      context.info(`No orchestration status found for ${instanceId}; treating as not started.`);
      return undefined;
    }

    throw error;
  }
}

df.app.client.http("githubWebhook", {
  route: "github/webhook",
  methods: ["POST"],
  authLevel: "function",
  handler: async (request: HttpRequest, client: df.DurableClient, context: InvocationContext) => {
    try {
      context.info(
        `githubWebhook invoked: method=${request.method} url=${request.url} event=${request.headers.get("x-github-event") ?? "missing"} delivery=${request.headers.get("x-github-delivery") ?? "missing"}`
      );

      const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
      if (!webhookSecret) {
        context.error("githubWebhook: missing required app setting GITHUB_WEBHOOK_SECRET");
        return {
          status: 500,
          jsonBody: {
            error: "GITHUB_WEBHOOK_SECRET is not configured"
          }
        };
      }

      const rawBody = await request.text();

      try {
        verifyGitHubSignature({
          secret: webhookSecret,
          signature256: request.headers.get("x-hub-signature-256"),
          rawBody
        });
      } catch (error: unknown) {
        context.warn(`Webhook validation failed: ${error instanceof Error ? error.message : String(error)}`);
        return {
          status: 401,
          jsonBody: {
            error: "Invalid signature"
          }
        };
      }

      const event = request.headers.get("x-github-event");
      if (!event) {
        return {
          status: 400,
          jsonBody: {
            error: "Missing x-github-event header"
          }
        };
      }

      const payload = JSON.parse(rawBody) as Record<string, unknown>;

      if (event === "issues") {
        const action = typeof payload.action === "string" ? payload.action : "";
        const acceptedActions = new Set(["opened", "edited", "labeled", "unlabeled"]);
        if (!acceptedActions.has(action)) {
          return accepted({ ignored: true, reason: `unsupported issues action: ${action}` });
        }

        const repository = payload.repository as Record<string, unknown> | undefined;
        const issue = payload.issue as Record<string, unknown> | undefined;
        if (!repository || !issue) {
          return accepted({ ignored: true, reason: "missing repository/issue payload" });
        }

        const owner = ((repository.owner as Record<string, unknown> | undefined)?.login as string) ?? "";
        const repo = (repository.name as string) ?? "";
        const issueNumber = Number(issue.number);
        const { owner: expectedOwner, repo: expectedRepo } = getRepoConfig();

        if (!owner || !repo || !Number.isInteger(issueNumber) || issueNumber <= 0) {
          return accepted({ ignored: true, reason: "invalid issue identity" });
        }

        if (owner !== expectedOwner || repo !== expectedRepo) {
          return accepted({ ignored: true, reason: "repository not configured target" });
        }

        const instanceId = issueInstanceId(owner, repo, issueNumber);
        const existing = await getStatusIfExists(client, instanceId, context);
        if (existing && isActiveStatus(existing.runtimeStatus)) {
          return accepted({ status: "already-running", instanceId });
        }

        await client.startNew("IssuePipelineOrchestrator", {
          instanceId,
          input: {
            owner,
            repo,
            issueNumber,
            reason: "webhook"
          }
        });

        return accepted({ status: "started", instanceId });
      }

      if (event === "workflow_run") {
        const action = typeof payload.action === "string" ? payload.action : "";
        if (action !== "completed") {
          return accepted({ ignored: true, reason: `unsupported workflow_run action: ${action}` });
        }

        const repository = payload.repository as Record<string, unknown> | undefined;
        if (!repository) {
          return accepted({ ignored: true, reason: "missing repository payload" });
        }

        const owner = ((repository.owner as Record<string, unknown> | undefined)?.login as string) ?? "";
        const repo = (repository.name as string) ?? "";
        const { owner: expectedOwner, repo: expectedRepo } = getRepoConfig();

        if (owner !== expectedOwner || repo !== expectedRepo) {
          return accepted({ ignored: true, reason: "repository not configured target" });
        }

        const completion = extractWorkflowCompletion(payload);

        if (!completion) {
          return accepted({ ignored: true, reason: "could not correlate workflow run to issue" });
        }

        const instanceId = issueInstanceId(owner, repo, completion.issueNumber);
        const existing = await getStatusIfExists(client, instanceId, context);
        if (!existing || !isActiveStatus(existing.runtimeStatus)) {
          context.info(`Ignoring workflow_run completion for inactive orchestration ${instanceId}`);
          return accepted({ ignored: true, reason: "no active orchestration for workflow completion", instanceId });
        }

        try {
          await client.raiseEvent(instanceId, "workflowCompleted", {
            workflowRunId: completion.workflowRunId,
            conclusion: completion.conclusion,
            htmlUrl: completion.htmlUrl
          });
        } catch (error: unknown) {
          context.error(`Failed to raise workflowCompleted for ${instanceId}: ${error instanceof Error ? error.message : String(error)}`);
          return accepted({ ignored: true, reason: "failed to deliver workflow completion", instanceId });
        }

        return accepted({ status: "event-raised", instanceId });
      }

      return accepted({ ignored: true, reason: `unsupported event: ${event}` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      context.error(`githubWebhook unhandled error: ${message}`);

      return {
        status: 500,
        jsonBody: {
          error: "Internal server error"
        }
      };
    }
  }
});
