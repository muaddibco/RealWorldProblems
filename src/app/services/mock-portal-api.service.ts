import { Injectable } from '@angular/core';
import { BatchRetryResponse, BatchRetryResult, CacheRefreshResponse, IssueCard, IssueDetails, IssueListResponse, PortalUser } from '../types/models';
import { PortalApiService } from './portal-api.service';

function nowIso(): string {
  return new Date().toISOString();
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

type MockIssue = IssueDetails;

const MOCK_ISSUES: MockIssue[] = [
  {
    number: 86,
    title: 'Portal workflow gets stuck after label change',
    htmlUrl: 'https://github.com/muaddibco/RealWorldProblems/issues/86',
    state: 'open',
    labels: ['type/problem', 'stage/3-scored', 'rw/processing'],
    stageLabel: 'stage/3-scored',
    stageName: 'Ready for Scoring',
    stageId: 'score',
    agentName: 'Score Problems',
    workflowId: '40-score.lock.yml',
    lifecycleStatus: 'processing',
    lifecycleStatusReason: 'rw/processing is present.',
    orchestrationStatus: 'running',
    orchestrationStatusReason: 'Mock live data: Durable runtime status Running.',
    orchestrationInstanceId: 'rw:muaddibco:RealWorldProblems:issue:86',
    durableRuntimeStatus: 'Running',
    orchestrationCreatedAt: minutesAgo(28),
    orchestrationUpdatedAt: minutesAgo(8),
    isActionable: false,
    isProcessing: true,
    isStuck: true,
    updatedAt: minutesAgo(32),
    ageMinutes: 32,
    retryAllowed: false,
    retryBlockedReason: 'Retry refused: issue is currently processing in Durable Functions.',
    body: 'A label change starts orchestration but the issue never reaches the next stage.',
    createdAt: minutesAgo(2600),
    commentsUrl: 'https://api.github.com/repos/muaddibco/RealWorldProblems/issues/86/comments',
    recentComments: [{ author: 'copilot', body: '[portal] Manual retry requested for `stage/3-scored`.', createdAt: minutesAgo(20) }],
    orchestratorRaw: { runtimeStatus: 'Running' }
  },
  {
    number: 92,
    title: 'Need a cleaner way to shortlist validation candidates',
    htmlUrl: 'https://github.com/muaddibco/RealWorldProblems/issues/92',
    state: 'open',
    labels: ['type/problem', 'stage/6-shortlist', 'rw/cooldown'],
    stageLabel: 'stage/6-shortlist',
    stageName: 'Shortlist',
    stageId: 'wedge',
    agentName: 'Wedge Filter',
    workflowId: '70-wedge-filter.lock.yml',
    lifecycleStatus: 'cooldown',
    lifecycleStatusReason: 'rw/cooldown is present.',
    orchestrationStatus: 'cooldown_active',
    orchestrationStatusReason: 'Mock live data: orchestrator cooldown.',
    orchestrationInstanceId: 'rw:muaddibco:RealWorldProblems:issue:92',
    durableRuntimeStatus: 'Completed',
    orchestratorOutputStatus: 'cooldown-active',
    isActionable: true,
    isProcessing: false,
    isStuck: false,
    updatedAt: minutesAgo(14),
    ageMinutes: 14,
    retryAllowed: true,
    body: 'The wedge filter output is good, but there is no portal view to group candidates.',
    createdAt: minutesAgo(900),
    commentsUrl: 'https://api.github.com/repos/muaddibco/RealWorldProblems/issues/92/comments',
    recentComments: [],
    orchestratorRaw: { runtimeStatus: 'Completed', output: { status: 'cooldown-active' } }
  },
  {
    number: 101,
    title: 'Orchestrator failed while checking competitor scan',
    htmlUrl: 'https://github.com/muaddibco/RealWorldProblems/issues/101',
    state: 'open',
    labels: ['type/problem', 'stage/5-competitors', 'status/orchestration-failed'],
    stageLabel: 'stage/5-competitors',
    stageName: 'Ready for Competitor Scan',
    stageId: 'competitors',
    agentName: 'Competitor Scan',
    workflowId: '60-competitors.lock.yml',
    lifecycleStatus: 'orchestration_failed',
    lifecycleStatusReason: 'status/orchestration-failed is present.',
    orchestrationStatus: 'failed',
    orchestrationStatusReason: 'Mock live data: orchestration failed.',
    orchestrationInstanceId: 'rw:muaddibco:RealWorldProblems:issue:101',
    durableRuntimeStatus: 'Failed',
    orchestrationCreatedAt: minutesAgo(70),
    orchestrationUpdatedAt: minutesAgo(18),
    isActionable: true,
    isProcessing: false,
    isStuck: true,
    updatedAt: minutesAgo(70),
    ageMinutes: 70,
    retryAllowed: true,
    body: 'The issue needs a safe reinvoke path after orchestration failure.',
    createdAt: minutesAgo(1800),
    commentsUrl: 'https://api.github.com/repos/muaddibco/RealWorldProblems/issues/101/comments',
    recentComments: [],
    orchestratorRaw: { runtimeStatus: 'Failed' }
  },
  {
    number: 107,
    title: 'Validated issue should be terminal',
    htmlUrl: 'https://github.com/muaddibco/RealWorldProblems/issues/107',
    state: 'closed',
    labels: ['type/problem', 'stage/7.1-validated'],
    stageLabel: 'stage/7.1-validated',
    stageName: 'Validated',
    stageId: null,
    agentName: null,
    workflowId: null,
    lifecycleStatus: 'completed',
    lifecycleStatusReason: 'stage/7.1-validated is terminal.',
    orchestrationStatus: 'completed',
    orchestrationStatusReason: 'Mock live data: terminal orchestration.',
    orchestrationInstanceId: 'rw:muaddibco:RealWorldProblems:issue:107',
    durableRuntimeStatus: 'Completed',
    orchestratorOutputStatus: 'completed',
    isActionable: false,
    isProcessing: false,
    isStuck: false,
    updatedAt: minutesAgo(220),
    ageMinutes: 220,
    retryAllowed: false,
    retryBlockedReason: 'Retry refused: issue is stage/7.1-validated.',
    body: 'A validated issue should no longer accept portal retries.',
    createdAt: minutesAgo(2400),
    commentsUrl: 'https://api.github.com/repos/muaddibco/RealWorldProblems/issues/107/comments',
    recentComments: [],
    orchestratorRaw: { runtimeStatus: 'Completed' }
  },
  {
    number: 118,
    title: 'Needs info from the issue author',
    htmlUrl: 'https://github.com/muaddibco/RealWorldProblems/issues/118',
    state: 'open',
    labels: ['type/problem', 'stage/1-normalized', 'status/needs-info'],
    stageLabel: 'stage/1-normalized',
    stageName: 'Normalized',
    stageId: 'dedupe',
    agentName: 'Dedupe + Cluster',
    workflowId: '20-dedupe.lock.yml',
    lifecycleStatus: 'blocked',
    lifecycleStatusReason: 'status/needs-info is present.',
    orchestrationStatus: 'not_started',
    orchestrationStatusReason: 'Mock live data: not started.',
    orchestrationInstanceId: 'rw:muaddibco:RealWorldProblems:issue:118',
    isActionable: false,
    isProcessing: false,
    isStuck: false,
    updatedAt: minutesAgo(58),
    ageMinutes: 58,
    retryAllowed: false,
    retryBlockedReason: 'Retry refused: issue has status/needs-info.',
    body: 'More detail is needed before the pipeline can continue.',
    createdAt: minutesAgo(400),
    commentsUrl: 'https://api.github.com/repos/muaddibco/RealWorldProblems/issues/118/comments',
    recentComments: [],
    orchestratorRaw: { runtimeStatus: 'Completed', output: { status: 'not-claimed' } }
  }
];

@Injectable({ providedIn: 'root' })
export class MockPortalApiService extends PortalApiService {
  private readonly issues: MockIssue[] = MOCK_ISSUES.map((issue) => ({
    ...issue,
    labels: [...issue.labels],
    recentComments: [...issue.recentComments]
  }));

  async getHealth(): Promise<{ ok: true }> {
    return { ok: true };
  }

  async getMe(): Promise<{ ok: true; user: PortalUser }> {
    return { ok: true, user: { isAuthenticated: true, displayName: 'Mock Portal User', email: 'mock@local', authProvider: 'mock', roles: ['authenticated', 'admin'], mock: true } };
  }

  async listIssues(params: Record<string, string | number | boolean | undefined>): Promise<IssueListResponse> {
    const issues = this.filterIssues(params);
    return {
      ok: true,
      issues,
      total: issues.length,
      summary: this.buildSummary(issues)
    };
  }

  async getIssue(issueNumber: number): Promise<{ ok: true; issue: IssueDetails }> {
    const issue = this.issues.find((item) => item.number === issueNumber);
    if (!issue) {
      throw new Error('Issue not found');
    }
    return { ok: true, issue: issue as IssueDetails };
  }

  async retryIssue(issueNumber: number, reason: string): Promise<{ ok: boolean; issueNumber: number; message: string; stageLabel?: string; strategy?: string }> {
    const issue = this.issues.find((item) => item.number === issueNumber);
    if (!issue) {
      return { ok: false, issueNumber, message: 'Retry refused: issue not found.' };
    }
    if (!issue.retryAllowed) {
      return { ok: false, issueNumber, message: issue.retryBlockedReason ?? 'Retry refused.' };
    }
    issue.recentComments = [...issue.recentComments, { author: 'portal', body: `[portal] Manual retry requested for \`${issue.stageLabel ?? 'unknown'}\`.\n\nStrategy: ${issue.labels.includes('status/orchestration-failed') ? 'removed-orchestration-failed' : 'reapplied-stage-label'}\nReason: ${reason}\nRequested by: mock-user`, createdAt: nowIso() }];
    issue.updatedAt = nowIso();
    return { ok: true, issueNumber, stageLabel: issue.stageLabel ?? 'unknown', strategy: issue.labels.includes('status/orchestration-failed') ? 'removed-orchestration-failed' : 'reapplied-stage-label', message: 'Retry requested' };
  }

  async retryBatch(issueNumbers: number[], reason: string): Promise<BatchRetryResponse> {
    const results: BatchRetryResult[] = [];
    for (const issueNumber of issueNumbers) {
      const result = await this.retryIssue(issueNumber, reason);
      results.push(result.ok ? { issueNumber, ok: true, stageLabel: result.stageLabel, strategy: result.strategy as any, message: result.message } : { issueNumber, ok: false, message: result.message });
    }
    return { ok: true, results };
  }

    async refreshCache(): Promise<CacheRefreshResponse> {
      const issues = this.filterIssues({ defaultView: false, limit: 250 });
      return {
        ok: true,
        issues,
        total: issues.length,
        message: 'Cache refreshed (mock data)'
      };
    }

  private filterIssues(params: Record<string, string | number | boolean | undefined>): IssueCard[] {
    const status = typeof params.status === 'string' ? params.status : 'all';
    const orchestrationStatus = typeof params.orchestrationStatus === 'string' ? params.orchestrationStatus : 'all';
    const stage = typeof params.stage === 'string' ? params.stage : 'all';
    const q = typeof params.q === 'string' ? params.q : '';
    const defaultView = params.defaultView !== false;

    return this.issues
      .filter((issue) => (defaultView ? issue.state === 'open' && issue.labels.includes('type/problem') && issue.labels.some((label) => label.startsWith('stage/')) && !issue.labels.includes('stage/7.1-validated') && !issue.labels.includes('stage/8-selected') && !issue.labels.includes('stage/9-archived') && !issue.labels.includes('status/needs-info') && !issue.labels.includes('status/duplicate') : true))
      .filter((issue) => status === 'all' || issue.lifecycleStatus === status || (status === 'stuck' && issue.isStuck))
      .filter((issue) => orchestrationStatus === 'all' || issue.orchestrationStatus === orchestrationStatus)
      .filter((issue) => stage === 'all' || issue.stageLabel === stage)
      .filter((issue) => !q || `${issue.number} ${issue.title} ${issue.labels.join(' ')} ${issue.stageName ?? ''} ${issue.agentName ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  }

  private buildSummary(issues: IssueCard[]): Record<string, number> {
    return issues.reduce<Record<string, number>>((summary, issue) => {
      summary[issue.lifecycleStatus] = (summary[issue.lifecycleStatus] ?? 0) + 1;
      summary[`orchestration:${issue.orchestrationStatus}`] = (summary[`orchestration:${issue.orchestrationStatus}`] ?? 0) + 1;
      if (issue.stageLabel) {
        summary[`stage:${issue.stageLabel}`] = (summary[`stage:${issue.stageLabel}`] ?? 0) + 1;
      }
      return summary;
    }, { total: issues.length });
  }
}

