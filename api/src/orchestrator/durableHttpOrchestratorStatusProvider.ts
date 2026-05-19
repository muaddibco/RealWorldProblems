import { getPortalConfig } from '../shared/portalConfig';
import { OrchestratorIssueStatus } from '../types';
import { OrchestratorStatusProvider } from './orchestratorStatusProvider';

function instanceIdForIssue(issueNumber: number, owner: string, repo: string): string {
  return `rw:${owner}:${repo}:issue:${issueNumber}`;
}

function mapCompletedOutputStatus(output: unknown): string | undefined {
  if (!output || typeof output !== 'object') {
    return undefined;
  }
  const status = (output as { status?: unknown }).status;
  return typeof status === 'string' ? status : undefined;
}

function mapRuntimeStatus(runtimeStatus: string | undefined, outputStatus: string | undefined): OrchestratorIssueStatus['status'] {
  if (!runtimeStatus) {
    return 'unknown';
  }

  switch (runtimeStatus) {
    case 'Pending':
      return 'queued';
    case 'Running':
      return 'running';
    case 'ContinuedAsNew':
      return 'continued_as_new';
    case 'Failed':
      return 'failed';
    case 'Canceled':
      return 'cancelled';
    case 'Terminated':
      return 'terminated';
    case 'Completed':
      switch (outputStatus) {
        case 'failed':
          return 'failed';
        case 'blocked-or-noop':
          return 'blocked_or_noop';
        case 'no-eligible-stage':
          return 'no_eligible_stage';
        case 'not-claimed':
          return 'not_claimed';
        case 'cooldown-active':
          return 'cooldown_active';
        case 'completed':
        default:
          return 'completed';
      }
    default:
      return 'unknown';
  }
}

export class DurableHttpOrchestratorStatusProvider implements OrchestratorStatusProvider {
  async getStatusForIssue(issueNumber: number, stageLabel: string | null): Promise<OrchestratorIssueStatus> {
    const config = getPortalConfig();
    const instanceId = instanceIdForIssue(issueNumber, config.owner, config.repo);

    if (!config.functionAppName || !config.functionKey) {
      return { issueNumber, stageLabel, instanceId, status: 'unknown', reason: 'Failed to fetch Durable orchestration status: provider is not configured.' };
    }

    const encodedInstanceId = encodeURIComponent(instanceId);
    const url = `https://${config.functionAppName}.azurewebsites.net/runtime/webhooks/durabletask/instances/${encodedInstanceId}?taskHub=${encodeURIComponent(config.taskHub)}&connection=${encodeURIComponent(config.connection)}&code=${encodeURIComponent(config.functionKey)}`;

    try {
      const response = await fetch(url, { method: 'GET' });

      if (response.status === 404) {
        return { issueNumber, stageLabel, instanceId, status: 'not_started', reason: 'No Durable orchestration instance found for this issue.' };
      }

      if (!response.ok) {
        return { issueNumber, stageLabel, instanceId, status: 'unknown', reason: `Failed to fetch Durable orchestration status: HTTP ${response.status}` };
      }

      const raw = await response.json() as Record<string, unknown>;
      const durableRuntimeStatus = typeof raw.runtimeStatus === 'string' ? raw.runtimeStatus : undefined;
      const output = raw.output;
      const orchestratorOutputStatus = mapCompletedOutputStatus(output);
      const status = mapRuntimeStatus(durableRuntimeStatus, orchestratorOutputStatus);
      const reason = status === 'unknown' ? 'Failed to fetch Durable orchestration status: unrecognized payload.' : `Durable runtime status: ${durableRuntimeStatus ?? 'unknown'}`;

      return {
        issueNumber,
        stageLabel,
        instanceId,
        status,
        reason,
        durableRuntimeStatus,
        orchestratorOutputStatus,
        createdAt: typeof raw.createdTime === 'string' ? raw.createdTime : undefined,
        updatedAt: typeof raw.lastUpdatedTime === 'string' ? raw.lastUpdatedTime : undefined,
        customStatus: raw.customStatus,
        output,
        raw
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { issueNumber, stageLabel, instanceId, status: 'unknown', reason: `Failed to fetch Durable orchestration status: ${message}` };
    }
  }
}