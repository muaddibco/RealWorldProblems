export type StageConfig = {
  id: string | null;
  stageLabel: string;
  stageName: string;
  agentName: string | null;
  workflowId: string | null;
  stuckAfterMinutes: number | null;
  terminal?: boolean;
};

export type IssueLifecycleStatus = 'active' | 'processing' | 'cooldown' | 'blocked' | 'orchestration_failed' | 'archived' | 'completed' | 'selected' | 'invalid';

export type OrchestrationStatus = 'not_started' | 'queued' | 'running' | 'continued_as_new' | 'completed' | 'failed' | 'cancelled' | 'terminated' | 'cooldown_active' | 'blocked_or_noop' | 'no_eligible_stage' | 'not_claimed' | 'stale' | 'unknown';

export type OrchestratorIssueStatus = {
  issueNumber: number;
  stageLabel: string | null;
  instanceId: string;
  status: OrchestrationStatus;
  reason: string;
  durableRuntimeStatus?: string;
  orchestratorOutputStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  customStatus?: unknown;
  output?: unknown;
  raw?: unknown;
};

export type RetryStrategy = 'removed-orchestration-failed' | 'reapplied-stage-label';

export type IssueCard = {
  number: number;
  title: string;
  htmlUrl: string;
  state: 'open' | 'closed';
  labels: string[];
  stageLabel: string | null;
  stageName: string | null;
  stageId: string | null;
  agentName: string | null;
  workflowId: string | null;
  lifecycleStatus: IssueLifecycleStatus;
  lifecycleStatusReason: string;
  orchestrationStatus: OrchestrationStatus;
  orchestrationStatusReason: string;
  orchestrationInstanceId: string;
  durableRuntimeStatus?: string;
  orchestratorOutputStatus?: string;
  orchestrationCreatedAt?: string;
  orchestrationUpdatedAt?: string;
  isActionable: boolean;
  isProcessing: boolean;
  isStuck: boolean;
  updatedAt: string;
  ageMinutes: number;
  retryAllowed: boolean;
  retryBlockedReason?: string;
};

export type IssueDetails = IssueCard & {
  body: string | null;
  createdAt: string;
  commentsUrl: string;
  recentComments: {
    author: string;
    body: string;
    createdAt: string;
  }[];
  orchestratorRaw?: unknown;
};

export type BatchRetryResult = {
  issueNumber: number;
  ok: boolean;
  stageLabel?: string;
  strategy?: RetryStrategy;
  message: string;
};

export type BatchRetryResponse = { ok: true; results: BatchRetryResult[] };

export type ApiError = { ok: false; message: string; details?: unknown };

export type PortalUser = { isAuthenticated: boolean; userId?: string; displayName?: string; email?: string; authProvider?: string; roles?: string[]; mock?: boolean };

export type RetryEligibility = { allowed: boolean; reason?: string; strategy?: RetryStrategy };

export type GitHubIssueRecord = {
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  labels: Array<string | { name?: string | null } | null>;
  updated_at: string;
  created_at: string;
  body: string | null;
  comments_url: string;
  pull_request?: unknown;
};

export type GitHubCommentRecord = { user?: { login?: string | null } | null; body: string; created_at: string };

export type GitHubRepositoryClient = {
  listIssues(): Promise<GitHubIssueRecord[]>;
  getIssue(issueNumber: number): Promise<GitHubIssueRecord | null>;
  listComments(issueNumber: number): Promise<GitHubCommentRecord[]>;
  addLabels(issueNumber: number, labels: string[]): Promise<void>;
  removeLabel(issueNumber: number, label: string): Promise<void>;
  createComment(issueNumber: number, body: string): Promise<void>;
};