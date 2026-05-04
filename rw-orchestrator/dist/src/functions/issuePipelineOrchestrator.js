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
const retryOptions = new df.RetryOptions(5000, 5);
retryOptions.backoffCoefficient = 2;
retryOptions.maxRetryIntervalInMilliseconds = 60000;
function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}
df.app.orchestration("IssuePipelineOrchestrator", function* (context) {
    const input = context.df.getInput();
    while (true) {
        const issue = yield context.df.callActivityWithRetry("GetIssueActivity", retryOptions, input);
        const stage = (yield context.df.callActivity("DecideNextStageActivity", {
            owner: input.owner,
            repo: input.repo,
            issue,
            stages: stages_1.STAGES
        }));
        if (!stage) {
            return {
                status: "no-eligible-stage",
                issueNumber: input.issueNumber
            };
        }
        const claim = yield context.df.callActivityWithRetry("ClaimIssueActivity", retryOptions, {
            ...input,
            stageId: stage.id,
            orchestrationId: context.df.instanceId
        });
        if (!claim.claimed) {
            return {
                status: "not-claimed",
                issueNumber: input.issueNumber,
                reason: claim.reason ?? "already-claimed"
            };
        }
        const dispatch = (yield context.df.callActivityWithRetry("DispatchWorkflowActivity", retryOptions, {
            ...input,
            stage,
            orchestrationId: context.df.instanceId
        }));
        if (!dispatch.dispatched) {
            yield context.df.callActivityWithRetry("ReleaseIssueActivity", retryOptions, {
                ...input,
                stageId: stage.id
            });
            return {
                status: "cooldown-active",
                issueNumber: input.issueNumber,
                stageId: stage.id,
                reason: dispatch.reason ?? "dispatch-not-executed",
                waitUntilUtc: dispatch.waitUntilUtc
            };
        }
        const timeoutAt = addMinutes(context.df.currentUtcDateTime, stage.timeoutMinutes);
        const completionEvent = context.df.waitForExternalEvent("workflowCompleted");
        const timeoutTask = context.df.createTimer(timeoutAt);
        const winner = yield context.df.Task.any([completionEvent, timeoutTask]);
        if (winner === timeoutTask) {
            yield context.df.callActivityWithRetry("MarkIssueFailedActivity", retryOptions, {
                ...input,
                stageId: stage.id,
                reason: "workflow-timeout",
                orchestrationId: context.df.instanceId
            });
            yield context.df.callActivityWithRetry("ReleaseIssueActivity", retryOptions, {
                ...input,
                stageId: stage.id
            });
            return {
                status: "failed",
                issueNumber: input.issueNumber,
                stageId: stage.id,
                reason: "workflow-timeout"
            };
        }
        timeoutTask.cancel();
        const verification = yield context.df.callActivityWithRetry("VerifyStageTransitionActivity", retryOptions, {
            ...input,
            stage
        });
        yield context.df.callActivityWithRetry("ReleaseIssueActivity", retryOptions, {
            ...input,
            stageId: stage.id
        });
        if (!verification.advanced) {
            return {
                status: "blocked-or-noop",
                issueNumber: input.issueNumber,
                stageId: stage.id,
                reason: verification.reason
            };
        }
        if (verification.terminal) {
            return {
                status: "completed",
                issueNumber: input.issueNumber,
                terminalReason: verification.reason
            };
        }
    }
});
