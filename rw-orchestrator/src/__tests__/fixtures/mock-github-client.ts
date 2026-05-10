/**
 * Mock GitHub client for testing
 */

import { GitHubIssue, GitHubIssueLabel } from "../../domain/types";
import { MockGitHubIssue } from "./github-payloads";

export interface MockGitHubClientConfig {
  issues?: Map<number, MockGitHubIssue>;
  comments?: Map<number, Array<{ body: string; created_at: string }>>;
}

export class MockGitHubClient {
  private issues: Map<number, MockGitHubIssue>;
  private comments: Map<number, Array<{ body: string; created_at: string }>>;
  private addedLabels: Array<{ issueNumber: number; labels: string[] }> = [];
  private removedLabels: Array<{ issueNumber: number; labels: string[] }> = [];
  private postedComments: Array<{ issueNumber: number; body: string }> = [];
  private dispatchedWorkflows: Array<{
    workflowId: string;
    inputs: Record<string, string>;
  }> = [];

  constructor(config?: MockGitHubClientConfig) {
    this.issues = config?.issues || new Map();
    this.comments = config?.comments || new Map();
  }

  async getIssue(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<GitHubIssue> {
    const issue = this.issues.get(issueNumber);
    if (!issue) {
      throw new Error(`Issue #${issueNumber} not found`);
    }

    return {
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      updated_at: issue.updated_at,
      labels: issue.labels
    };
  }

  async addLabels(
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[]
  ): Promise<void> {
    const issue = this.issues.get(issueNumber);
    if (!issue) {
      throw new Error(`Issue #${issueNumber} not found`);
    }

    const existingLabelNames = new Set(
      issue.labels.map((l: { name: string }) => l.name)
    );
    for (const label of labels) {
      if (!existingLabelNames.has(label)) {
        issue.labels.push({ name: label });
      }
    }

    this.addedLabels.push({ issueNumber, labels });
  }

  async removeLabelIfExists(
    owner: string,
    repo: string,
    issueNumber: number,
    label: string
  ): Promise<void> {
    const issue = this.issues.get(issueNumber);
    if (!issue) {
      return;
    }

    issue.labels = issue.labels.filter((l: { name: string }) => l.name !== label);
    this.removedLabels.push({ issueNumber, labels: [label] });
  }

  async addComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<void> {
    if (!this.comments.has(issueNumber)) {
      this.comments.set(issueNumber, []);
    }

    this.comments.get(issueNumber)!.push({
      body,
      created_at: new Date().toISOString()
    });

    this.postedComments.push({ issueNumber, body });
  }

  async listIssueComments(
    owner: string,
    repo: string,
    issueNumber: number,
    limit: number
  ): Promise<Array<{ body: string; created_at: string }>> {
    const comments = this.comments.get(issueNumber) || [];
    return comments.slice(-limit);
  }

  async dispatchWorkflow(input: {
    owner: string;
    repo: string;
    workflowId: string;
    ref: string;
    inputs: Record<string, string>;
  }): Promise<void> {
    this.dispatchedWorkflows.push({
      workflowId: input.workflowId,
      inputs: input.inputs
    });
  }

  async listIssuesByLabels(
    owner: string,
    repo: string,
    labels: string[],
    limit: number
  ): Promise<GitHubIssue[]> {
    const result: GitHubIssue[] = [];
    for (const [, issue] of this.issues) {
      if (result.length >= limit) break;

      const issueLabels = issue.labels.map((l: { name: string }) => l.name);
      if (labels.every((label) => issueLabels.includes(label))) {
        result.push({
          number: issue.number,
          title: issue.title,
          body: issue.body,
          state: issue.state,
          updated_at: issue.updated_at,
          labels: issue.labels
        });
      }
    }
    return result;
  }

  // Test helpers
  setIssue(issue: MockGitHubIssue): void {
    this.issues.set(issue.number, issue);
  }

  setIssueComments(
    issueNumber: number,
    comments: Array<{ body: string; created_at: string }>
  ): void {
    this.comments.set(issueNumber, comments);
  }

  getAddedLabels(): Array<{ issueNumber: number; labels: string[] }> {
    return this.addedLabels;
  }

  getRemovedLabels(): Array<{ issueNumber: number; labels: string[] }> {
    return this.removedLabels;
  }

  getPostedComments(): Array<{ issueNumber: number; body: string }> {
    return this.postedComments;
  }

  getDispatchedWorkflows(): Array<{
    workflowId: string;
    inputs: Record<string, string>;
  }> {
    return this.dispatchedWorkflows;
  }

  reset(): void {
    this.addedLabels = [];
    this.removedLabels = [];
    this.postedComments = [];
    this.dispatchedWorkflows = [];
  }
}
