export type IssueLifecycleStatus = 'active' | 'processing' | 'cooldown' | 'blocked' | 'orchestration_failed' | 'archived' | 'completed' | 'selected' | 'invalid';

export type OrchestrationStatus = 'not_started' | 'queued' | 'running' | 'continued_as_new' | 'completed' | 'failed' | 'cancelled' | 'terminated' | 'cooldown_active' | 'blocked_or_noop' | 'no_eligible_stage' | 'not_claimed' | 'stale' | 'unknown';

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

export type BatchRetryResponse = {
  ok: true;
  results: BatchRetryResult[];
};

export type PortalUser = {
  isAuthenticated: boolean;
  userId?: string;
  displayName?: string;
  email?: string;
  authProvider?: string;
  roles?: string[];
  mock?: boolean;
};

export type IssueListResponse = {
  ok: true;
  issues: IssueCard[];
  total: number;
  summary: Record<string, number>;
};

export type PortalApiResult<T> = Promise<T>;