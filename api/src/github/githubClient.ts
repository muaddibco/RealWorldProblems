import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { GitHubCommentRecord, GitHubIssueRecord, GitHubRepositoryClient } from '../types';
import { getPortalConfig } from '../shared/portalConfig';
import { MockGitHubClient } from './mockGitHubClient';

function normalizeLabels(labels: GitHubIssueRecord['labels']): string[] {
  return labels
    .map((label) => {
      if (!label) {
        return null;
      }
      if (typeof label === 'string') {
        return label;
      }
      return label.name ?? null;
    })
    .filter((label): label is string => Boolean(label));
}

class OctokitGitHubClient implements GitHubRepositoryClient {
  private readonly octokit: Octokit;
  private readonly owner: string;
  private readonly repo: string;

  constructor() {
    const config = getPortalConfig();
    this.owner = config.owner;
    this.repo = config.repo;

    if (process.env.GITHUB_APP_ID && process.env.GITHUB_PRIVATE_KEY && process.env.GITHUB_INSTALLATION_ID) {
      this.octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: Number(process.env.GITHUB_APP_ID),
          privateKey: process.env.GITHUB_PRIVATE_KEY,
          installationId: Number(process.env.GITHUB_INSTALLATION_ID)
        }
      });
      return;
    }

    if (process.env.GITHUB_TOKEN) {
      this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      return;
    }

    throw new Error('No GitHub credentials configured');
  }

  async listIssues(): Promise<GitHubIssueRecord[]> {
    const response = await this.octokit.paginate(this.octokit.rest.issues.listForRepo, {
      owner: this.owner,
      repo: this.repo,
      state: 'all',
      per_page: 100
    });

    return response
      .filter((issue: { pull_request?: unknown }) => !issue.pull_request)
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        html_url: issue.html_url,
        state: normalizeIssueState(issue.state),
        labels: normalizeLabels(issue.labels as GitHubIssueRecord['labels']),
        updated_at: issue.updated_at,
        created_at: issue.created_at,
        body: issue.body ?? null,
        comments_url: issue.comments_url
      }));
  }

  async getIssue(issueNumber: number): Promise<GitHubIssueRecord | null> {
    const response = await this.octokit.rest.issues.get({ owner: this.owner, repo: this.repo, issue_number: issueNumber });
    if (!response.data || response.data.pull_request) {
      return null;
    }

    return {
      number: response.data.number,
      title: response.data.title,
      html_url: response.data.html_url,
      state: normalizeIssueState(response.data.state),
      labels: normalizeLabels(response.data.labels as GitHubIssueRecord['labels']),
      updated_at: response.data.updated_at,
      created_at: response.data.created_at,
      body: response.data.body ?? null,
      comments_url: response.data.comments_url
    };
  }

  async listComments(issueNumber: number): Promise<GitHubCommentRecord[]> {
    const comments = await this.octokit.paginate(this.octokit.rest.issues.listComments, {
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      per_page: 100
    });

    return comments.map((comment) => ({
      body: comment.body ?? '',
      created_at: comment.created_at,
      user: { login: comment.user?.login ?? null }
    }));
  }

  async addLabels(issueNumber: number, labels: string[]): Promise<void> {
    if (labels.length === 0) {
      return;
    }
    await this.octokit.rest.issues.addLabels({ owner: this.owner, repo: this.repo, issue_number: issueNumber, labels });
  }

  async removeLabel(issueNumber: number, label: string): Promise<void> {
    await this.octokit.rest.issues.removeLabel({ owner: this.owner, repo: this.repo, issue_number: issueNumber, name: label });
  }

  async createComment(issueNumber: number, body: string): Promise<void> {
    await this.octokit.rest.issues.createComment({ owner: this.owner, repo: this.repo, issue_number: issueNumber, body });
  }
}

export function createGitHubClient(): GitHubRepositoryClient {
  if (getPortalConfig().useMockGitHub) {
    return new MockGitHubClient();
  }

  try {
    return new OctokitGitHubClient();
  } catch {
    return new MockGitHubClient();
  }
}

function normalizeIssueState(state: string): 'open' | 'closed' {
  return state === 'open' ? 'open' : 'closed';
}