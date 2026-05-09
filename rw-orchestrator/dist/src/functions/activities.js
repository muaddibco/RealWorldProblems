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
const stageDecision_1 = require("../domain/stageDecision");
const islands_1 = require("../domain/islands");
const stages_1 = require("../domain/stages");
const githubClient_1 = require("../github/githubClient");
const DISPATCH_COOLDOWN_SECONDS = 180;
const DISPATCH_MARKER_REGEX = /(?:<!--|\&lt;!--)\s*rw:workflow-dispatch:([^\s>]+)\s*(?:-->|\&gt;)/;
function getDispatchCooldownMs() {
    const raw = process.env.RW_WORKFLOW_DISPATCH_COOLDOWN_SECONDS;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.floor(parsed) * 1000;
    }
    return DISPATCH_COOLDOWN_SECONDS * 1000;
}
function findLatestDispatchTimestamp(comments) {
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
function labelNames(issue) {
    return issue.labels.map((label) => label.name);
}
function hasAnyLabel(labels, candidates) {
    return candidates.some((candidate) => labels.includes(candidate));
}
df.app.activity("GetIssueActivity", {
    handler: async (input) => {
        const github = await githubClient_1.GitHubClient.create();
        return github.getIssue(input.owner, input.repo, input.issueNumber);
    }
});
df.app.activity("DecideNextStageActivity", {
    handler: async (input) => {
        return (0, stageDecision_1.decideNextStage)(input.issue, input.stages);
    }
});
df.app.activity("ClaimIssueActivity", {
    handler: async (input) => {
        const github = await githubClient_1.GitHubClient.create();
        const issue = await github.getIssue(input.owner, input.repo, input.issueNumber);
        const labels = labelNames(issue);
        if (labels.includes("rw/processing")) {
            return {
                claimed: false,
                reason: "rw/processing already present"
            };
        }
        await github.addLabels(input.owner, input.repo, input.issueNumber, ["rw/processing", `rw/stage-${input.stageId}`]);
        await github.addComment(input.owner, input.repo, input.issueNumber, [
            `<!-- rw:orchestration-run:${input.orchestrationId} -->`,
            `Orchestrator claimed issue for stage \`${input.stageId}\` at ${new Date().toISOString()}.`
        ].join("\n"));
        return {
            claimed: true
        };
    }
});
df.app.activity("DispatchWorkflowActivity", {
    handler: async (input) => {
        const github = await githubClient_1.GitHubClient.create();
        const ref = process.env.GITHUB_WORKFLOW_REF ?? "main";
        const cooldownMs = getDispatchCooldownMs();
        if (cooldownMs > 0) {
            const comments = await github.listIssueComments(input.owner, input.repo, input.issueNumber, 50);
            const lastDispatchAt = findLatestDispatchTimestamp(comments);
            if (lastDispatchAt) {
                const nowMs = Date.now();
                const allowedAtMs = lastDispatchAt.getTime() + cooldownMs;
                if (allowedAtMs > nowMs) {
                    const waitUntilUtc = new Date(allowedAtMs).toISOString();
                    await github.addComment(input.owner, input.repo, input.issueNumber, [
                        `<!-- rw:workflow-cooldown:${waitUntilUtc} -->`,
                        `Too frequent execution detected. Workflow cooldown recorded till ${waitUntilUtc}: \`${input.stage.workflowId}\` for stage \`${input.stage.id}\` by orchestration \`${input.orchestrationId}\`.`
                    ].join("\n"));
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
        await github.addComment(input.owner, input.repo, input.issueNumber, [
            `<!-- rw:workflow-dispatch:${dispatchedAtUtc} -->`,
            `Workflow dispatch recorded: \`${input.stage.workflowId}\` for stage \`${input.stage.id}\` by orchestration \`${input.orchestrationId}\`.`
        ].join("\n"));
        return {
            dispatched: true,
            workflowId: input.stage.workflowId,
            dispatchedAtUtc
        };
    }
});
df.app.activity("VerifyStageTransitionActivity", {
    handler: async (input) => {
        const github = await githubClient_1.GitHubClient.create();
        const issue = await github.getIssue(input.owner, input.repo, input.issueNumber);
        const labels = labelNames(issue);
        const hasExpected = hasAnyLabel(labels, input.stage.expectedNextLabels);
        const isArchived = labels.includes("stage/9-archived");
        const validationDone = input.stage.id === "validation" && (0, islands_1.getIslandContent)(issue.body, "validation").length > 0;
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
    handler: async (input) => {
        const github = await githubClient_1.GitHubClient.create();
        await github.removeLabelIfExists(input.owner, input.repo, input.issueNumber, "rw/processing");
        await github.removeLabelIfExists(input.owner, input.repo, input.issueNumber, `rw/stage-${input.stageId}`);
        return {
            released: true
        };
    }
});
df.app.activity("ReleaseIssueCooldownActivity", {
    handler: async (input) => {
        const github = await githubClient_1.GitHubClient.create();
        await github.removeLabelIfExists(input.owner, input.repo, input.issueNumber, "rw/cooldown");
        return {
            released: true
        };
    }
});
df.app.activity("MarkIssueFailedActivity", {
    handler: async (input) => {
        const github = await githubClient_1.GitHubClient.create();
        await github.addLabels(input.owner, input.repo, input.issueNumber, ["status/orchestration-failed"]);
        await github.addComment(input.owner, input.repo, input.issueNumber, [
            "Orchestration failed.",
            `- Stage: \`${input.stageId}\``,
            `- Reason: \`${input.reason}\``,
            `- Orchestration: \`${input.orchestrationId}\``
        ].join("\n"));
        return {
            marked: true
        };
    }
});
df.app.activity("FindEligibleIssuesActivity", {
    handler: async (input) => {
        const github = await githubClient_1.GitHubClient.create();
        const max = Math.max(1, input.max);
        const candidates = [];
        for (const stageLabel of stages_1.STAGE_LABEL_PRIORITY) {
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
