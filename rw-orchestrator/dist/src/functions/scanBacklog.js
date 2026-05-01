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
const stages_1 = require("../domain/stages");
const env_1 = require("../github/env");
const githubClient_1 = require("../github/githubClient");
function issueInstanceId(owner, repo, issueNumber) {
    return `rw:${owner}:${repo}:issue:${issueNumber}`;
}
function isActiveStatus(status) {
    return status === "Running" || status === "Pending" || status === "ContinuedAsNew";
}
function hasAny(labels, values) {
    return values.some((value) => labels.includes(value));
}
df.app.client.timer("scanBacklog", {
    schedule: "0 */10 * * * *",
    handler: async (_timer, client, context) => {
        const { owner, repo } = (0, env_1.getRepoConfig)();
        const github = await githubClient_1.GitHubClient.create();
        const batchSize = Math.max(1, Number(process.env.SCAN_BATCH_SIZE ?? "10"));
        const candidates = [];
        for (const stageLabel of stages_1.STAGE_LABEL_PRIORITY) {
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
