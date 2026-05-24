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

  const logInfo = (message: string, details?: Record<string, unknown>) => {
    // Durable orchestrations replay execution history; skip replay logs to avoid noise.
    if (context.df.isReplaying) {
      return;
    }

    if (details) {
      context.log(`[IssuePipelineOrchestrator] ${message}`, details);
      return;
    }

    context.log(`[IssuePipelineOrchestrator] ${message}`);
  };

  logInfo("Orchestration started", {
    orchestrationId: context.df.instanceId,
    owner: input.owner,
    repo: input.repo,
    issueNumber: input.issueNumber,
    maxTimeoutRetries
  });

  while (true) {
    logInfo("Fetching issue and deciding next stage", {
      issueNumber: input.issueNumber,
      timeoutRetries,
      timeoutRetryStageId
    });

    const issue = yield context.df.callActivityWithRetry("GetIssueActivity", retryOptions, input);
    const stage = (yield context.df.callActivity("DecideNextStageActivity", {
      owner: input.owner,
      repo: input.repo,
      issue,
      stages: STAGES
    })) as StageDefinition | null;

    if (!stage) {
      logInfo("No eligible stage found; orchestration exiting", {
        issueNumber: input.issueNumber
      });

      return {
        status: "no-eligible-stage",
        issueNumber: input.issueNumber
      };
    }

    logInfo("Stage selected", {
      issueNumber: input.issueNumber,
      stageId: stage.id,
      timeoutMinutes: stage.timeoutMinutes
    });

    if (timeoutRetryStageId !== stage.id) {
      logInfo("Stage changed; resetting timeout retry counter", {
        previousStageId: timeoutRetryStageId,
        stageId: stage.id
      });

      timeoutRetryStageId = stage.id;
      timeoutRetries = 0;
    }

    const claim = yield context.df.callActivityWithRetry("ClaimIssueActivity", retryOptions, {
      ...input,
      stageId: stage.id,
      orchestrationId: context.df.instanceId
    });

    if (!claim.claimed) {
      logInfo("Issue not claimed; orchestration exiting", {
        issueNumber: input.issueNumber,
        stageId: stage.id,
        reason: claim.reason ?? "already-claimed"
      });

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

    logInfo("Dispatch activity completed", {
      issueNumber: input.issueNumber,
      stageId: stage.id,
      dispatched: dispatch.dispatched,
      reason: dispatch.reason,
      waitUntilUtc: dispatch.waitUntilUtc
    });

    if (!dispatch.dispatched) {
      yield context.df.callActivityWithRetry("ReleaseIssueActivity", retryOptions, {
        ...input,
        stageId: stage.id
      });

      const waitUntil = parseUtcDate(dispatch.waitUntilUtc);
      if (waitUntil && waitUntil.getTime() > context.df.currentUtcDateTime.getTime()) {
        logInfo("Dispatch deferred due to cooldown; waiting until next attempt", {
          issueNumber: input.issueNumber,
          stageId: stage.id,
          waitUntilUtc: dispatch.waitUntilUtc
        });

        yield context.df.createTimer(waitUntil);
        yield context.df.callActivityWithRetry("ReleaseIssueCooldownActivity", retryOptions, {
          ...input
        });

        logInfo("Cooldown elapsed; retrying stage evaluation", {
          issueNumber: input.issueNumber,
          stageId: stage.id
        });

        continue;
      }

      logInfo("Cooldown active without a future wait window; orchestration exiting", {
        issueNumber: input.issueNumber,
        stageId: stage.id,
        reason: dispatch.reason ?? "dispatch-not-executed",
        waitUntilUtc: dispatch.waitUntilUtc
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

    logInfo("Waiting for workflow completion or timeout", {
      issueNumber: input.issueNumber,
      stageId: stage.id,
      timeoutAtUtc: timeoutAt.toISOString()
    });

    const winner = yield context.df.Task.any([completionEvent, timeoutTask]);

    if (winner === timeoutTask) {
      logInfo("Stage execution timeout detected", {
        issueNumber: input.issueNumber,
        stageId: stage.id,
        currentTimeoutRetries: timeoutRetries,
        maxTimeoutRetries
      });

      const timedOutIssue = yield context.df.callActivityWithRetry("GetIssueActivity", retryOptions, input);
      const hasProcessingLabel = timedOutIssue.labels.some((label: { name: string }) => label.name === "rw/processing");

      if (!hasProcessingLabel) {
        timeoutTask.cancel();
        timeoutRetries = 0;

        logInfo("Processing label absent after timeout; continuing orchestration loop", {
          issueNumber: input.issueNumber,
          stageId: stage.id
        });

        continue;
      }

      timeoutRetries += 1;
      if (timeoutRetries <= maxTimeoutRetries) {
        logInfo("Retrying stage after timeout", {
          issueNumber: input.issueNumber,
          stageId: stage.id,
          timeoutRetries,
          maxTimeoutRetries
        });

        continue;
      }

      logInfo("Maximum timeout retries exceeded; marking issue as failed", {
        issueNumber: input.issueNumber,
        stageId: stage.id,
        timeoutRetries,
        maxTimeoutRetries
      });

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

      logInfo("Issue marked failed due to workflow timeout; orchestration exiting", {
        issueNumber: input.issueNumber,
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

    logInfo("Workflow completion event received; verifying stage transition", {
      issueNumber: input.issueNumber,
      stageId: stage.id
    });

    const verification = yield context.df.callActivityWithRetry("VerifyStageTransitionActivity", retryOptions, {
      ...input,
      stage
    });

    logInfo("Stage verification completed", {
      issueNumber: input.issueNumber,
      stageId: stage.id,
      advanced: verification.advanced,
      terminal: verification.terminal,
      reason: verification.reason
    });

    yield context.df.callActivityWithRetry("ReleaseIssueActivity", retryOptions, {
      ...input,
      stageId: stage.id
    });

    if (!verification.advanced) {
      logInfo("Stage did not advance; orchestration exiting", {
        issueNumber: input.issueNumber,
        stageId: stage.id,
        reason: verification.reason
      });

      return {
        status: "blocked-or-noop",
        issueNumber: input.issueNumber,
        stageId: stage.id,
        reason: verification.reason
      };
    }

    if (verification.terminal) {
      logInfo("Terminal stage reached; orchestration completed", {
        issueNumber: input.issueNumber,
        stageId: stage.id,
        terminalReason: verification.reason
      });

      return {
        status: "completed",
        issueNumber: input.issueNumber,
        terminalReason: verification.reason
      };
    }
  }
});
