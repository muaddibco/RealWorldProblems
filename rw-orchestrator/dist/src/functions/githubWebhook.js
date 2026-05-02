"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const df = __importStar(require("durable-functions"));
const env_1 = require("../github/env");
const workflowCompletion_1 = require("../github/workflowCompletion");
const webhookValidation_1 = require("../github/webhookValidation");
function issueInstanceId(owner, repo, issueNumber) {
    return `rw:${owner}:${repo}:issue:${issueNumber}`;
}
function accepted(body) {
    return {
        status: 202,
        jsonBody: body
    };
}
function isActiveStatus(status) {
    return status === "Running" || status === "Pending" || status === "ContinuedAsNew";
}
df.app.client.http("githubWebhook", {
    route: "github/webhook",
    methods: ["POST"],
    authLevel: "function",
    handler: async (request, client, context) => {
        const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
        if (!webhookSecret) {
            return {
                status: 500,
                jsonBody: {
                    error: "GITHUB_WEBHOOK_SECRET is not configured"
                }
            };
        }
        const rawBody = await request.text();
        try {
            (0, webhookValidation_1.verifyGitHubSignature)({
                secret: webhookSecret,
                signature256: request.headers.get("x-hub-signature-256"),
                rawBody
            });
        }
        catch (error) {
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
        const payload = JSON.parse(rawBody);
        if (event === "issues") {
            const action = typeof payload.action === "string" ? payload.action : "";
            const acceptedActions = new Set(["opened", "edited", "labeled", "unlabeled"]);
            if (!acceptedActions.has(action)) {
                return accepted({ ignored: true, reason: `unsupported issues action: ${action}` });
            }
            const repository = payload.repository;
            const issue = payload.issue;
            if (!repository || !issue) {
                return accepted({ ignored: true, reason: "missing repository/issue payload" });
            }
            const owner = repository.owner?.login ?? "";
            const repo = repository.name ?? "";
            const issueNumber = Number(issue.number);
            const { owner: expectedOwner, repo: expectedRepo } = (0, env_1.getRepoConfig)();
            if (!owner || !repo || !Number.isInteger(issueNumber) || issueNumber <= 0) {
                return accepted({ ignored: true, reason: "invalid issue identity" });
            }
            if (owner !== expectedOwner || repo !== expectedRepo) {
                return accepted({ ignored: true, reason: "repository not configured target" });
            }
            const instanceId = issueInstanceId(owner, repo, issueNumber);
            const existing = await client.getStatus(instanceId);
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
            const repository = payload.repository;
            if (!repository) {
                return accepted({ ignored: true, reason: "missing repository payload" });
            }
            const owner = repository.owner?.login ?? "";
            const repo = repository.name ?? "";
            const { owner: expectedOwner, repo: expectedRepo } = (0, env_1.getRepoConfig)();
            if (owner !== expectedOwner || repo !== expectedRepo) {
                return accepted({ ignored: true, reason: "repository not configured target" });
            }
            const completion = (0, workflowCompletion_1.extractWorkflowCompletion)(payload);
            if (!completion) {
                return accepted({ ignored: true, reason: "could not correlate workflow run to issue" });
            }
            const instanceId = issueInstanceId(owner, repo, completion.issueNumber);
            const existing = await client.getStatus(instanceId);
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
            }
            catch (error) {
                context.error(`Failed to raise workflowCompleted for ${instanceId}: ${error instanceof Error ? error.message : String(error)}`);
                return accepted({ ignored: true, reason: "failed to deliver workflow completion", instanceId });
            }
            return accepted({ status: "event-raised", instanceId });
        }
        return accepted({ ignored: true, reason: `unsupported event: ${event}` });
    }
});
