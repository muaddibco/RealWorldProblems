import { GitHubIssueRecord, OrchestratorIssueStatus, RetryEligibility, RetryStrategy } from '../types';
import { classifyLifecycleStatus, lifecycleIncludesTypeProblem, unknownStageLabels } from './issueClassification';
import { isStageLabel } from '../orchestrator/stageConfig';

function getStageLabels(labels: string[]): string[] {
  return labels.filter((label) => label.startsWith('stage/'));
}

export function determineRetryStrategy(issue: GitHubIssueRecord): RetryStrategy | null {
  const labels = issue.labels.map((label) => typeof label === 'string' ? label : label?.name ?? '').filter(Boolean);
  if (labels.includes('status/orchestration-failed')) {
    return 'removed-orchestration-failed';
  }
  return 'reapplied-stage-label';
}

export function evaluateRetryEligibility(issue: GitHubIssueRecord, orchestrationStatus: OrchestratorIssueStatus): RetryEligibility {
  const labels = issue.labels.map((label) => typeof label === 'string' ? label : label?.name ?? '').filter(Boolean);
  const stageLabels = getStageLabels(labels);
  const lifecycleStatus = classifyLifecycleStatus(labels, issue.state);

  if (!lifecycleIncludesTypeProblem(labels)) {
    return { allowed: false, reason: 'Retry refused: issue does not have type/problem.' };
  }
  if (issue.state === 'closed') {
    return { allowed: false, reason: 'Retry refused: issue is closed.' };
  }
  if (labels.includes('status/needs-info')) {
    return { allowed: false, reason: 'Retry refused: issue has status/needs-info.' };
  }
  if (labels.includes('status/duplicate')) {
    return { allowed: false, reason: 'Retry refused: issue has status/duplicate.' };
  }
  if (labels.includes('agentic-workflows')) {
    return { allowed: false, reason: 'Retry refused: issue has agentic-workflows.' };
  }
  if (labels.includes('stage/7.1-validated')) {
    return { allowed: false, reason: 'Retry refused: issue is stage/7.1-validated.' };
  }
  if (labels.includes('stage/8-selected')) {
    return { allowed: false, reason: 'Retry refused: issue is stage/8-selected.' };
  }
  if (labels.includes('stage/9-archived')) {
    return { allowed: false, reason: 'Retry refused: issue is stage/9-archived.' };
  }
  if (stageLabels.length !== 1) {
    return { allowed: false, reason: 'Retry refused: issue must have exactly one stage label.' };
  }
  if (unknownStageLabels(labels).length > 0) {
    return { allowed: false, reason: 'Retry refused: issue has an unknown stage label.' };
  }

  if (orchestrationStatus.status === 'unknown') {
    return { allowed: false, reason: 'Retry refused: Failed to fetch Durable orchestration status.' };
  }

  if (lifecycleStatus === 'invalid') {
    return { allowed: false, reason: 'Retry refused: issue is invalid.' };
  }

  const strategy = determineRetryStrategy(issue);
  if (!strategy) {
    return { allowed: false, reason: 'Retry refused: unable to determine strategy.' };
  }

  return { allowed: true, strategy };
}

export function applyRetryStrategyLabels(labels: string[], strategy: RetryStrategy): { remove: string[]; add: string[] } {
  const stageLabel = labels.find((label) => isStageLabel(label)) ?? null;
  if (strategy === 'removed-orchestration-failed') {
    return { remove: ['status/orchestration-failed'], add: [] };
  }

  return stageLabel ? { remove: [stageLabel], add: [stageLabel] } : { remove: [], add: [] };
}