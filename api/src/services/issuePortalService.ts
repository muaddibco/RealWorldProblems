import { githubClient, orchestratorStatusProvider, portalConfig } from '../runtime';
import {
  BatchRetryResponse,
  BatchRetryResult,
  GitHubIssueRecord,
  IssueCard,
  IssueDetails,
  OrchestratorIssueStatus,
  RetryEligibility,
  RetryStrategy,
} from '../types';
import { asStringArray } from '../shared/http';
import { buildIssueCard, buildIssueDetails, classifyLifecycleStatus, matchesIssueSearch, summarizeLabels } from '../github/issueClassification';
import { applyRetryStrategyLabels, evaluateRetryEligibility } from '../github/retryEligibility';
import { getPrimaryStageLabel, getStageLabelsCount, isStageLabel } from '../orchestrator/stageConfig';
import { aggregateBatchRetryResults } from './batchRetryAggregation';

export type IssueListQuery = {
  status?: string | null;
  orchestrationStatus?: string | null;
  stage?: string | null;
  q?: string | null;
  defaultView?: boolean;
  limit?: number;
};

let cachedIssueCards: IssueCard[] | null = null;
let cachedIssueCardsAtMs = 0;
let inFlightIssueCardsPromise: Promise<IssueCard[]> | null = null;

function getIssuesCacheTtlMs(): number {
  const raw = Number(process.env.PORTAL_ISSUES_CACHE_TTL_SECONDS ?? 30);
  const seconds = Number.isFinite(raw) && raw >= 0 ? raw : 30;
  return seconds * 1000;
}

function isIssueCardsCacheFresh(nowMs = Date.now()): boolean {
  if (!cachedIssueCards) {
    return false;
  }

  const ttlMs = getIssuesCacheTtlMs();
  return nowMs - cachedIssueCardsAtMs < ttlMs;
}

function invalidateIssueCardsCache(): void {
  cachedIssueCards = null;
  cachedIssueCardsAtMs = 0;
}

function parseLabels(issue: GitHubIssueRecord): string[] {
  return asStringArray(issue.labels.map((label) => typeof label === 'string' ? label : label?.name ?? null));
}

function shouldIncludeInDefaultView(issue: IssueCard): boolean {
  if (issue.state !== 'open') {
    return false;
  }
  if (!issue.labels.includes('type/problem')) {
    return false;
  }
  if (getStageLabelsCount(issue.labels) !== 1) {
    return false;
  }
  if (issue.labels.includes('stage/7.1-validated') || issue.labels.includes('stage/8-selected') || issue.labels.includes('stage/9-archived')) {
    return false;
  }
  if (issue.labels.includes('status/needs-info') || issue.labels.includes('status/duplicate')) {
    return false;
  }
  return true;
}

function matchesLifecycleFilter(issue: IssueCard, status: string | null | undefined): boolean {
  if (!status || status === 'all') {
    return true;
  }
  if (status === 'stuck') {
    return issue.isStuck;
  }
  return issue.lifecycleStatus === status;
}

function matchesOrchestrationFilter(issue: IssueCard, orchestrationStatus: string | null | undefined): boolean {
  if (!orchestrationStatus || orchestrationStatus === 'all') {
    return true;
  }
  return issue.orchestrationStatus === orchestrationStatus;
}

function matchesStageFilter(issue: IssueCard, stage: string | null | undefined): boolean {
  if (!stage || stage === 'all') {
    return true;
  }
  return issue.stageLabel === stage;
}

function sortIssues(issues: IssueCard[]): IssueCard[] {
  return [...issues].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.number - right.number);
}

function buildSafeRetryEligibility(issue: GitHubIssueRecord, orchestrationStatus: OrchestratorIssueStatus): RetryEligibility {
  return evaluateRetryEligibility(issue, orchestrationStatus);
}

async function getIssueOrchestrationStatus(issueNumber: number, stageLabel: string | null): Promise<OrchestratorIssueStatus> {
  try {
    return await orchestratorStatusProvider.getStatusForIssue(issueNumber, stageLabel);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const instanceId = `rw:${portalConfig.owner}:${portalConfig.repo}:issue:${issueNumber}`;
    return { issueNumber, stageLabel, instanceId, status: 'unknown', reason: `Failed to fetch Durable orchestration status: ${message}` };
  }
}

async function hydrateIssueCards(): Promise<IssueCard[]> {
  const rawIssues = await githubClient.listIssues();
  return Promise.all(rawIssues.map(async (issue) => {
    const labels = parseLabels(issue);
    const stageLabel = getPrimaryStageLabel(labels);
    const orchestrationStatus = await getIssueOrchestrationStatus(issue.number, stageLabel);
    const retryEligibility = buildSafeRetryEligibility(issue, orchestrationStatus);
    return buildIssueCard(issue, orchestrationStatus, retryEligibility);
  }));
}

async function getHydratedIssueCards(): Promise<IssueCard[]> {
  if (isIssueCardsCacheFresh()) {
    return cachedIssueCards as IssueCard[];
  }

  if (inFlightIssueCardsPromise) {
    return inFlightIssueCardsPromise;
  }

  inFlightIssueCardsPromise = hydrateIssueCards();

  try {
    const cards = await inFlightIssueCardsPromise;
    cachedIssueCards = cards;
    cachedIssueCardsAtMs = Date.now();
    return cards;
  } finally {
    inFlightIssueCardsPromise = null;
  }
}

export async function listIssues(query: IssueListQuery = {}): Promise<{ issues: IssueCard[]; total: number }> {
  const cards = await getHydratedIssueCards();

  const filtered = sortIssues(cards).filter((issue) => {
    if (query.defaultView ?? true) {
      if (!shouldIncludeInDefaultView(issue)) {
        return false;
      }
    }
    if (!matchesLifecycleFilter(issue, query.status)) {
      return false;
    }
    if (!matchesOrchestrationFilter(issue, query.orchestrationStatus)) {
      return false;
    }
    if (!matchesStageFilter(issue, query.stage)) {
      return false;
    }
    if (!matchesIssueSearch(issue, query.q ?? '')) {
      return false;
    }
    return true;
  });

  const limit = Math.min(Math.max(query.limit ?? 100, 1), 250);
  return { issues: filtered.slice(0, limit), total: filtered.length };
}

export async function getIssueDetails(issueNumber: number): Promise<IssueDetails | null> {
  const issue = await githubClient.getIssue(issueNumber);
  if (!issue) {
    return null;
  }

  const labels = parseLabels(issue);
  const stageLabel = getPrimaryStageLabel(labels);
  const orchestrationStatus = await getIssueOrchestrationStatus(issue.number, stageLabel);
  const recentCommentRecords = await githubClient.listComments(issue.number);
  const recentComments = recentCommentRecords.slice(-5).map((comment) => ({ author: comment.user?.login ?? 'unknown', body: comment.body, createdAt: comment.created_at }));
  const retryEligibility = buildSafeRetryEligibility(issue, orchestrationStatus);
  const card = buildIssueCard(issue, orchestrationStatus, retryEligibility);

  return buildIssueDetails(issue, card, recentComments, orchestrationStatus.raw ?? orchestrationStatus.output ?? orchestrationStatus);
}

export async function retryIssue(issueNumber: number, reason: string, requestedBy?: string): Promise<{ ok: true; issueNumber: number; stageLabel: string; strategy: RetryStrategy; message: string } | { ok: false; issueNumber: number; message: string }> {
  const issue = await githubClient.getIssue(issueNumber);
  if (!issue) {
    return { ok: false, issueNumber, message: 'Retry refused: issue not found.' };
  }

  const labels = parseLabels(issue);
  const stageLabel = getPrimaryStageLabel(labels);
  const orchestrationStatus = await getIssueOrchestrationStatus(issue.number, stageLabel);
  const retryEligibility = evaluateRetryEligibility(issue, orchestrationStatus);
  const lifecycleStatus = classifyLifecycleStatus(labels, issue.state);

  if (!retryEligibility.allowed) {
    return { ok: false, issueNumber, message: `Retry refused: ${retryEligibility.reason ?? 'unknown safety rule'}` };
  }

  if (orchestrationStatus.status === 'queued' || orchestrationStatus.status === 'running') {
    if (!orchestratorStatusProvider.terminateInstance) {
      return { ok: false, issueNumber, message: 'Retry refused: orchestrator status provider does not support termination.' };
    }

    try {
      await orchestratorStatusProvider.terminateInstance(orchestrationStatus.instanceId, reason);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { ok: false, issueNumber, message: `Retry refused: ${message}` };
    }
  }

  if (lifecycleStatus === 'processing' && labels.includes('rw/processing')) {
    await githubClient.removeLabel(issue.number, 'rw/processing');
  }

  const strategy = retryEligibility.strategy ?? 'reapplied-stage-label';
  const action = applyRetryStrategyLabels(labels, strategy);

  for (const label of action.remove) {
    await githubClient.removeLabel(issue.number, label);
  }
  for (const label of action.add) {
    await githubClient.addLabels(issue.number, [label]);
  }

  const comment = [
    `[portal] Manual retry requested for \`${stageLabel ?? 'unknown'}\`.`,
    '',
    `Strategy: ${strategy}`,
    `Reason: ${reason}`,
    `Requested by: ${requestedBy ?? 'unknown'}`
  ].join('\n');
  await githubClient.createComment(issue.number, comment);

  invalidateIssueCardsCache();

  return {
    ok: true,
    issueNumber,
    stageLabel: stageLabel ?? 'unknown',
    strategy,
    message: 'Retry requested'
  };
}

export async function retryIssues(issueNumbers: number[], reason: string, requestedBy?: string): Promise<{ ok: true; results: BatchRetryResult[] }> {
  const limited = issueNumbers.slice(0, portalConfig.batchRetryMax);
  const results: BatchRetryResult[] = [];

  for (const issueNumber of limited) {
    try {
      const result = await retryIssue(issueNumber, reason, requestedBy);
      if (result.ok) {
        results.push({ issueNumber, ok: true, stageLabel: result.stageLabel, strategy: result.strategy, message: result.message });
      } else {
        results.push({ issueNumber, ok: false, message: result.message });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      results.push({ issueNumber, ok: false, message: `Retry refused: ${message}` });
    }
  }

  return aggregateBatchRetryResults(results);
}

export function buildIssueSummary(issues: IssueCard[]): Record<string, number> {
  return issues.reduce<Record<string, number>>((summary, issue) => {
    summary[issue.lifecycleStatus] = (summary[issue.lifecycleStatus] ?? 0) + 1;
    summary[`orchestration:${issue.orchestrationStatus}`] = (summary[`orchestration:${issue.orchestrationStatus}`] ?? 0) + 1;
    if (issue.stageLabel) {
      summary[`stage:${issue.stageLabel}`] = (summary[`stage:${issue.stageLabel}`] ?? 0) + 1;
    }
    if (issue.isStuck) {
      summary.stuck = (summary.stuck ?? 0) + 1;
    }
    return summary;
  }, { total: issues.length });
}