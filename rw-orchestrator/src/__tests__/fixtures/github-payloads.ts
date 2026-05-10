/**
 * Fixture payloads for GitHub webhook testing
 */

export interface MockGitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  updated_at: string;
  labels: Array<{ name: string }>;
}

export interface MockGitHubRepository {
  name: string;
  owner: {
    login: string;
  };
}

export function createIssuePayload(
  issueNumber: number,
  labels: string[],
  body: string | null = null,
  title: string = "Test Issue"
): MockGitHubIssue {
  return {
    number: issueNumber,
    title,
    body,
    state: "open",
    updated_at: new Date().toISOString(),
    labels: labels.map((name) => ({ name }))
  };
}

export function createWebhookPayload(
  event: "issues" | "workflow_run",
  action: string,
  issue?: MockGitHubIssue,
  repository?: Partial<MockGitHubRepository>,
  label?: { name: string }
) {
  const repo = repository || {
    name: "RealWorldProblems",
    owner: { login: "test-user" }
  };

  if (event === "issues") {
    return {
      action,
      issue: issue || createIssuePayload(1, []),
      label: label || null,
      repository: repo,
      sender: { login: "github-user" }
    };
  }

  // workflow_run event
  return {
    action,
    workflow_run: {
      id: 12345,
      name: "Test Workflow",
      conclusion: "success",
      html_url: "https://github.com/test/repo/actions/runs/12345"
    },
    repository: repo,
    sender: { login: "github-user" }
  };
}

export function createIssueWithLabels(issueNumber: number, labels: string[]): MockGitHubIssue {
  return createIssuePayload(issueNumber, labels, "# Problem\n\nTest body");
}

export function createIssueWithIsland(
  issueNumber: number,
  labels: string[],
  islandName: string
): MockGitHubIssue {
  const body = `# Problem

<!-- rw:${islandName}:start -->
Test content for ${islandName}
<!-- rw:${islandName}:end -->

More content`;
  return createIssuePayload(issueNumber, labels, body);
}

export function createIssueWithDispatchMarker(
  issueNumber: number,
  labels: string[],
  dispatchedAtUtc: string
): MockGitHubIssue {
  const body = `# Problem

Some content

Comments section:
<!-- rw:workflow-dispatch:${dispatchedAtUtc} -->
Workflow dispatch recorded: \`10-normalize.lock.yml\` for stage \`normalize\` by orchestration \`orch-123\`.`;
  return createIssuePayload(issueNumber, labels, body);
}

export function createWebhookSignature(payload: string, secret: string): string {
  const crypto = require("crypto");
  return (
    "sha256=" +
    crypto.createHmac("sha256", secret).update(payload).digest("hex")
  );
}
