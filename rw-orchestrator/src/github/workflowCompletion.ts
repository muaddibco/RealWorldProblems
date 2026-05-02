export interface WorkflowCompletionSignal {
  issueNumber: number;
  workflowRunId: number;
  conclusion: string | null;
  htmlUrl: string;
}

function parseIssueNumber(value: string): number | null {
  const patterns = [/#(\d+)/, /issue[^\d]*(\d+)/i];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) {
      continue;
    }

    const parsed = Number(match[1]);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

export function extractWorkflowCompletion(payload: unknown): WorkflowCompletionSignal | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const workflowRun = (payload as { workflow_run?: Record<string, unknown> }).workflow_run;
  if (!workflowRun) {
    return null;
  }

  const sources = [
    workflowRun.display_title,
    workflowRun.name,
    workflowRun.event,
    workflowRun.head_branch
  ].filter((value): value is string => typeof value === "string");

  for (const source of sources) {
    const issueNumber = parseIssueNumber(source);
    if (!issueNumber) {
      continue;
    }

    const workflowRunId = Number(workflowRun.id);
    const htmlUrl = typeof workflowRun.html_url === "string" ? workflowRun.html_url : "";
    const conclusion = typeof workflowRun.conclusion === "string" ? workflowRun.conclusion : null;

    if (!Number.isInteger(workflowRunId) || workflowRunId <= 0 || !htmlUrl) {
      return null;
    }

    return {
      issueNumber,
      workflowRunId,
      conclusion,
      htmlUrl
    };
  }

  return null;
}
