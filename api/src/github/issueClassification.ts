import {
  GitHubIssueRecord,
  IssueCard,
  IssueDetails,
  IssueLifecycleStatus,
  OrchestratorIssueStatus,
  RetryEligibility,
} from '../types';
import { STAGE_CONFIG, getPrimaryStageLabel, getStageConfig, getStageLabelsCount } from '../orchestrator/stageConfig';
import { safeErrorMessage } from '../shared/http';

export function getLifecycleStatusReason(labels: string[], state: 'open' | 'closed', lifecycleStatus: IssueLifecycleStatus): string {
  if (!labels.includes('type/problem')) {
    return 'Issue does not have the type/problem label.';
  }

  switch (lifecycleStatus) {
    case 'archived':
      return state === 'closed' && labels.includes('stage/9-archived') ? 'Closed issue with stage/9-archived.' : 'Terminal/archive label present.';
    case 'selected':
      return 'stage/8-selected is terminal.';
    case 'completed':
      return 'stage/7.1-validated is terminal.';
    case 'blocked':
      return 'status/needs-info is present.';
    case 'orchestration_failed':
      return 'status/orchestration-failed is present.';
    case 'cooldown':
      return 'rw/cooldown is present.';
    case 'processing':
      return 'rw/processing is present.';
    case 'invalid':
      return 'Issue has an invalid label combination or is missing a type/problem label.';
    case 'active':
    default:
      return 'Issue is ready for the current stage.';
  }
}

export function classifyLifecycleStatus(labels: string[], state: 'open' | 'closed'): IssueLifecycleStatus {
  const hasTypeProblem = labels.includes('type/problem');
  const stageCount = getStageLabelsCount(labels);

  if (state === 'closed' && labels.includes('stage/9-archived')) {
    return 'archived';
  }
  if (labels.includes('stage/9-archived')) {
    return 'archived';
  }
  if (labels.includes('stage/8-selected')) {
    return 'selected';
  }
  if (labels.includes('stage/7.1-validated')) {
    return 'completed';
  }
  if (labels.includes('status/duplicate')) {
    return 'archived';
  }
  if (labels.includes('status/needs-info')) {
    return 'blocked';
  }
  if (labels.includes('status/orchestration-failed')) {
    return 'orchestration_failed';
  }
  if (!hasTypeProblem) {
    return 'invalid';
  }
  if (stageCount !== 1) {
    return 'invalid';
  }
  if (labels.includes('rw/cooldown')) {
    return 'cooldown';
  }
  if (labels.includes('rw/processing')) {
    return 'processing';
  }
  return 'active';
}

export function getIssueStage(labels: string[]): { stageLabel: string | null; stageId: string | null; stageName: string | null; agentName: string | null; workflowId: string | null; stageConfig: (typeof STAGE_CONFIG)[string] | null } {
  const stageLabel = getPrimaryStageLabel(labels);
  const stageConfig = getStageConfig(stageLabel);

  return { stageLabel, stageId: stageConfig?.id ?? null, stageName: stageConfig?.stageName ?? null, agentName: stageConfig?.agentName ?? null, workflowId: stageConfig?.workflowId ?? null, stageConfig };
}

export function getOrchestrationReason(orchestrationStatus: OrchestratorIssueStatus): string {
  return orchestrationStatus.reason || 'No orchestration status available.';
}

export function computeAgeMinutes(updatedAt: string, now = new Date()): number {
  const updated = new Date(updatedAt).getTime();
  const diff = now.getTime() - updated;
  return Math.max(0, Math.floor(diff / 60000));
}

export function computeIsProcessing(lifecycleStatus: IssueLifecycleStatus, orchestrationStatus: OrchestratorIssueStatus['status']): boolean {
  return lifecycleStatus === 'processing' || orchestrationStatus === 'running' || orchestrationStatus === 'queued' || orchestrationStatus === 'continued_as_new';
}

export function computeIsActionable(lifecycleStatus: IssueLifecycleStatus): boolean {
  return lifecycleStatus === 'active' || lifecycleStatus === 'orchestration_failed' || lifecycleStatus === 'cooldown';
}

export function computeIsStuck(issue: IssueCard): boolean {
  if (['archived', 'completed', 'selected', 'blocked', 'invalid'].includes(issue.lifecycleStatus)) {
    return false;
  }

  const threshold = issue.stageLabel ? STAGE_CONFIG[issue.stageLabel]?.stuckAfterMinutes ?? null : null;
  const ageMinutes = issue.ageMinutes;
  const orchestrationStatus = issue.orchestrationStatus;

  return Boolean(
    issue.lifecycleStatus === 'orchestration_failed' ||
    orchestrationStatus === 'failed' ||
    orchestrationStatus === 'terminated' ||
    orchestrationStatus === 'blocked_or_noop' ||
    orchestrationStatus === 'stale' ||
    (orchestrationStatus === 'unknown' && threshold !== null && ageMinutes > threshold) ||
    (orchestrationStatus === 'running' && threshold !== null && ageMinutes > threshold) ||
    (orchestrationStatus === 'queued' && threshold !== null && ageMinutes > threshold) ||
    (orchestrationStatus === 'continued_as_new' && threshold !== null && ageMinutes > threshold)
  );
}

export function buildIssueCard(issue: GitHubIssueRecord, orchestrationStatus: OrchestratorIssueStatus, retryEligibility: RetryEligibility, now = new Date()): IssueCard {
  const labels = issue.labels.map((label) => typeof label === 'string' ? label : label?.name ?? '').filter((label) => Boolean(label));
  const lifecycleStatus = classifyLifecycleStatus(labels, issue.state);
  const stage = getIssueStage(labels);
  const ageMinutes = computeAgeMinutes(issue.updated_at, now);
  const isProcessing = computeIsProcessing(lifecycleStatus, orchestrationStatus.status);
  const isActionable = computeIsActionable(lifecycleStatus);

  const card: IssueCard = {
    number: issue.number,
    title: issue.title,
    htmlUrl: issue.html_url,
    state: issue.state,
    labels,
    stageLabel: stage.stageLabel,
    stageName: stage.stageName,
    stageId: stage.stageId,
    agentName: stage.agentName,
    workflowId: stage.workflowId,
    lifecycleStatus,
    lifecycleStatusReason: getLifecycleStatusReason(labels, issue.state, lifecycleStatus),
    orchestrationStatus: orchestrationStatus.status,
    orchestrationStatusReason: getOrchestrationReason(orchestrationStatus),
    orchestrationInstanceId: orchestrationStatus.instanceId,
    durableRuntimeStatus: orchestrationStatus.durableRuntimeStatus,
    orchestratorOutputStatus: orchestrationStatus.orchestratorOutputStatus,
    orchestrationCreatedAt: orchestrationStatus.createdAt,
    orchestrationUpdatedAt: orchestrationStatus.updatedAt,
    isActionable,
    isProcessing,
    isStuck: false,
    updatedAt: issue.updated_at,
    ageMinutes,
    retryAllowed: retryEligibility.allowed,
    retryBlockedReason: retryEligibility.reason,
    retriedTooRecently: retryEligibility.retriedTooRecently
  };

  card.isStuck = computeIsStuck(card);
  return card;
}

export function buildIssueDetails(issue: GitHubIssueRecord, card: IssueCard, recentComments: IssueDetails['recentComments'], orchestratorRaw?: unknown): IssueDetails {
  return { ...card, body: issue.body, createdAt: issue.created_at, commentsUrl: issue.comments_url, recentComments, orchestratorRaw };
}

export function summarizeLabels(labels: string[]): string {
  const interesting = labels.filter((label) => !label.startsWith('rw/'));
  return interesting.slice(0, 5).join(', ');
}

export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function matchesIssueSearch(card: IssueCard, searchText: string): boolean {
  const query = normalizeSearchText(searchText);
  if (!query) {
    return true;
  }

  const haystack = [String(card.number), card.title, card.stageLabel ?? '', card.stageName ?? '', card.agentName ?? '', card.lifecycleStatus, card.orchestrationStatus, card.labels.join(' ')].join(' ').toLowerCase();
  return haystack.includes(query);
}

export function unknownStageLabels(labels: string[]): string[] {
  return labels.filter((label) => label.startsWith('stage/') && !getStageConfig(label));
}

export function lifecycleIncludesTypeProblem(labels: string[]): boolean {
  return labels.includes('type/problem');
}

export function explainRetrySafety(retryEligibility: RetryEligibility, error?: unknown): string {
  if (retryEligibility.allowed) {
    return 'Retry allowed.';
  }
  if (retryEligibility.reason) {
    return retryEligibility.reason;
  }
  if (error) {
    return `Retry refused: ${safeErrorMessage(error)}`;
  }
  return 'Retry refused.';
}