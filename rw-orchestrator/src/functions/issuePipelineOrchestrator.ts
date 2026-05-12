import * as df from "durable-functions";
import { STAGES } from "../domain/stages";
import { DispatchResult, OrchestrationInput, StageDefinition } from "../domain/types";

const retryOptions = new df.RetryOptions(5000, 5);
retryOptions.backoffCoefficient = 2;
retryOptions.maxRetryIntervalInMilliseconds = 60000;

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function parseUtcDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

df.app.orchestration("IssuePipelineOrchestrator", function* (context) {
  const input = context.df.getInput() as OrchestrationInput;
  const maxTimeoutRetries = 3;
  let timeoutRetries = 0;
  let timeoutRetryStageId: string | undefined;

  while (true) {
    const issue = yield context.df.callActivityWithRetry("GetIssueActivity", retryOptions, input);
    const stage = (yield context.df.callActivity("DecideNextStageActivity", {
      owner: input.owner,
      repo: input.repo,
      issue,
      stages: STAGES
    })) as StageDefinition | null;

    if (!stage) {
      return {
        status: "no-eligible-stage",
        issueNumber: input.issueNumber
      };
    }

    if (timeoutRetryStageId !== stage.id) {
      timeoutRetryStageId = stage.id;
      timeoutRetries = 0;
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
    })) as DispatchResult;

    if (!dispatch.dispatched) {
      yield context.df.callActivityWithRetry("ReleaseIssueActivity", retryOptions, {
        ...input,
        stageId: stage.id
      });

      const waitUntil = parseUtcDate(dispatch.waitUntilUtc);
      if (waitUntil && waitUntil.getTime() > context.df.currentUtcDateTime.getTime()) {
        yield context.df.createTimer(waitUntil);
        yield context.df.callActivityWithRetry("ReleaseIssueCooldownActivity", retryOptions, {
          ...input
        });
        continue;
      }

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
      const timedOutIssue = yield context.df.callActivityWithRetry("GetIssueActivity", retryOptions, input);
      const hasProcessingLabel = timedOutIssue.labels.some((label: { name: string }) => label.name === "rw/processing");

      if (!hasProcessingLabel) {
        timeoutTask.cancel();
        timeoutRetries = 0;
        continue;
      }

      timeoutRetries += 1;
      if (timeoutRetries <= maxTimeoutRetries) {
        continue;
      }

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
    timeoutRetries = 0;

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
