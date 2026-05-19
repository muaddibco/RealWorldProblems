import { GitHubCommentRecord, GitHubIssueRecord, GitHubRepositoryClient } from '../types';

type MockIssueState = Omit<GitHubIssueRecord, 'labels'> & { labels: string[]; comments: GitHubCommentRecord[] };

function nowIso(): string {
  return new Date().toISOString();
}

function buildMockIssues(): MockIssueState[] {
  const base = new Date();
  const minutesAgo = (minutes: number) => new Date(base.getTime() - minutes * 60 * 1000).toISOString();

  return [
    {
      number: 86,
      title: 'Portal workflow gets stuck after label change',
      html_url: 'https://github.com/muaddibco/RealWorldProblems/issues/86',
      state: 'open',
      labels: ['type/problem', 'stage/3-scored', 'rw/processing'],
      updated_at: minutesAgo(32),
      created_at: minutesAgo(2600),
      body: 'A label change starts orchestration but the issue never reaches the next stage.',
      comments_url: 'https://api.github.com/repos/muaddibco/RealWorldProblems/issues/86/comments',
      comments: [{ body: '[portal] Manual retry requested for `stage/3-scored`.', created_at: minutesAgo(20), user: { login: 'copilot' } }]
    },
    {
      number: 92,
      title: 'Need a cleaner way to shortlist validation candidates',
      html_url: 'https://github.com/muaddibco/RealWorldProblems/issues/92',
      state: 'open',
      labels: ['type/problem', 'stage/6-shortlist', 'rw/cooldown'],
      updated_at: minutesAgo(14),
      created_at: minutesAgo(900),
      body: 'The wedge filter output is good, but there is no portal view to group candidates.',
      comments_url: 'https://api.github.com/repos/muaddibco/RealWorldProblems/issues/92/comments',
      comments: []
    },
    {
      number: 101,
      title: 'Orchestrator failed while checking competitor scan',
      html_url: 'https://github.com/muaddibco/RealWorldProblems/issues/101',
      state: 'open',
      labels: ['type/problem', 'stage/5-competitors', 'status/orchestration-failed'],
      updated_at: minutesAgo(70),
      created_at: minutesAgo(1800),
      body: 'The issue needs a safe reinvoke path after orchestration failure.',
      comments_url: 'https://api.github.com/repos/muaddibco/RealWorldProblems/issues/101/comments',
      comments: []
    },
    {
      number: 107,
      title: 'Validated issue should be terminal',
      html_url: 'https://github.com/muaddibco/RealWorldProblems/issues/107',
      state: 'closed',
      labels: ['type/problem', 'stage/7.1-validated'],
      updated_at: minutesAgo(220),
      created_at: minutesAgo(2400),
      body: 'A validated issue should no longer accept portal retries.',
      comments_url: 'https://api.github.com/repos/muaddibco/RealWorldProblems/issues/107/comments',
      comments: []
    },
    {
      number: 118,
      title: 'Needs info from the issue author',
      html_url: 'https://github.com/muaddibco/RealWorldProblems/issues/118',
      state: 'open',
      labels: ['type/problem', 'stage/1-normalized', 'status/needs-info'],
      updated_at: minutesAgo(58),
      created_at: minutesAgo(400),
      body: 'More detail is needed before the pipeline can continue.',
      comments_url: 'https://api.github.com/repos/muaddibco/RealWorldProblems/issues/118/comments',
      comments: []
    },
    {
      number: 120,
      title: 'Old issue missing the type label',
      html_url: 'https://github.com/muaddibco/RealWorldProblems/issues/120',
      state: 'open',
      labels: ['stage/2-deduped'],
      updated_at: minutesAgo(80),
      created_at: minutesAgo(1000),
      body: 'Used to be a problem issue, but the type label was removed.',
      comments_url: 'https://api.github.com/repos/muaddibco/RealWorldProblems/issues/120/comments',
      comments: []
    }
  ];
}

export class MockGitHubClient implements GitHubRepositoryClient {
  private readonly issues = new Map<number, MockIssueState>(buildMockIssues().map((issue) => [issue.number, issue]));

  async listIssues(): Promise<GitHubIssueRecord[]> {
    return Array.from(this.issues.values()).map((issue) => this.toRecord(issue));
  }

  async getIssue(issueNumber: number): Promise<GitHubIssueRecord | null> {
    const issue = this.issues.get(issueNumber);
    return issue ? this.toRecord(issue) : null;
  }

  async listComments(issueNumber: number): Promise<GitHubCommentRecord[]> {
    return this.issues.get(issueNumber)?.comments.map((comment) => ({ ...comment })) ?? [];
  }

  async addLabels(issueNumber: number, labels: string[]): Promise<void> {
    const issue = this.issues.get(issueNumber);
    if (!issue) {
      return;
    }
    for (const label of labels) {
      if (!issue.labels.includes(label)) {
        issue.labels.push(label);
      }
    }
    issue.updated_at = nowIso();
  }

  async removeLabel(issueNumber: number, label: string): Promise<void> {
    const issue = this.issues.get(issueNumber);
    if (!issue) {
      return;
    }
    issue.labels = issue.labels.filter((item) => item !== label);
    issue.updated_at = nowIso();
  }

  async createComment(issueNumber: number, body: string): Promise<void> {
    const issue = this.issues.get(issueNumber);
    if (!issue) {
      return;
    }
    issue.comments.push({ body, created_at: nowIso(), user: { login: 'portal' } });
    issue.updated_at = nowIso();
  }

  private toRecord(issue: MockIssueState): GitHubIssueRecord {
    return {
      number: issue.number,
      title: issue.title,
      html_url: issue.html_url,
      state: issue.state,
      labels: issue.labels,
      updated_at: issue.updated_at,
      created_at: issue.created_at,
      body: issue.body,
      comments_url: issue.comments_url
    };
  }
}