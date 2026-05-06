import { Octokit } from "@octokit/rest";
import { GitHubIssue } from "../domain/types";
import { getGitHubToken } from "./env";

export interface DispatchWorkflowRequest {
  owner: string;
  repo: string;
  workflowId: string;
  ref: string;
  inputs: Record<string, string>;
}

export interface WorkflowRunInfo {
  id: number;
  conclusion: string | null;
  status: string;
  html_url: string;
  display_title?: string;
  name?: string;
}

export interface IssueCommentInfo {
  body: string;
  created_at: string;
}

interface RawIssueLabel {
  name?: string;
}

interface RawIssueLike {
  state?: string;
  labels?: Array<string | RawIssueLabel>;
}

export class GitHubClient {
  private readonly octokit: Octokit;

  private constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  static async create(): Promise<GitHubClient> {
    return new GitHubClient(getGitHubToken());
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    const response = await this.octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber
    });

    const issue = response.data;
    return {
      number: issue.number,
      title: issue.title,
      body: issue.body ?? "",
      labels: issue.labels.map((label) => ({
        name: typeof label === "string" ? label : label.name ?? ""
      })),
      state: issue.state,
      updated_at: issue.updated_at
    };
  }

  async listIssuesByLabels(owner: string, repo: string, labels: string[], max: number): Promise<GitHubIssue[]> {
    const result: GitHubIssue[] = [];
    let page = 1;

    while (result.length < max) {
      const response = await this.octokit.issues.listForRepo({
        owner,
        repo,
        state: "open",
        labels: labels.join(","),
        per_page: 100,
        page
      });

      if (response.data.length === 0) {
        break;
      }

      for (const issue of response.data) {
        if ("pull_request" in issue) {
          continue;
        }

        result.push({
          number: issue.number,
          title: issue.title,
          body: issue.body ?? "",
          labels: issue.labels.map((label) => ({
            name: typeof label === "string" ? label : label.name ?? ""
          })),
          state: issue.state,
          updated_at: issue.updated_at
        });

        if (result.length >= max) {
          break;
        }
      }

      if (response.data.length < 100) {
        break;
      }

      page += 1;
    }

    return result;
  }

  async addLabels(owner: string, repo: string, issueNumber: number, labels: string[]): Promise<void> {
    if (labels.length === 0) {
      return;
    }

    await this.octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels
    });
  }

  async removeLabelIfExists(owner: string, repo: string, issueNumber: number, label: string): Promise<void> {
    try {
      await this.octokit.issues.removeLabel({
        owner,
        repo,
        issue_number: issueNumber,
        name: label
      });
    } catch (error: unknown) {
      if (typeof error === "object" && error && "status" in error && (error as { status?: number }).status === 404) {
        return;
      }

      throw error;
    }
  }

  async addComment(owner: string, repo: string, issueNumber: number, body: string): Promise<void> {
    await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body
    });
  }

  async listIssueComments(owner: string, repo: string, issueNumber: number, max: number): Promise<IssueCommentInfo[]> {
    const perPage = Math.max(1, Math.min(max, 100));
    const response = await this.octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: perPage,
      page: 1,
      sort: "created",
      direction: "desc"
    });

    return response.data.map((comment) => ({
      body: comment.body ?? "",
      created_at: comment.created_at
    }));
  }

  async hasSubIssueWithLabel(owner: string, repo: string, issueNumber: number, label: string): Promise<boolean> {
    let page = 1;

    while (true) {
      const response = await this.octokit.request("GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues", {
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
        page
      });

      const subIssues = response.data as RawIssueLike[];
      if (subIssues.length === 0) {
        return false;
      }

      for (const subIssue of subIssues) {
        const labels = (subIssue.labels ?? []).map((entry) =>
          typeof entry === "string" ? entry : (entry as RawIssueLabel).name ?? ""
        );

        if (labels.includes(label)) {
          return true;
        }
      }

      if (subIssues.length < 100) {
        return false;
      }

      page += 1;
    }
  }

  async dispatchWorkflow(request: DispatchWorkflowRequest): Promise<void> {
    await this.octokit.actions.createWorkflowDispatch({
      owner: request.owner,
      repo: request.repo,
      workflow_id: request.workflowId,
      ref: request.ref,
      inputs: request.inputs
    });
  }

  async getWorkflowRun(owner: string, repo: string, runId: number): Promise<WorkflowRunInfo> {
    const response = await this.octokit.actions.getWorkflowRun({
      owner,
      repo,
      run_id: runId
    });

    const run = response.data;
    return {
      id: run.id,
      conclusion: run.conclusion,
      status: run.status ?? "unknown",
      html_url: run.html_url,
      display_title: run.display_title,
      name: run.name ?? undefined
    };
  }
}
