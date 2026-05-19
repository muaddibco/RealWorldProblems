import { getPortalConfig } from '../shared/portalConfig';
import { OrchestratorIssueStatus } from '../types';
import { OrchestratorStatusProvider } from './orchestratorStatusProvider';

function instanceIdForIssue(issueNumber: number, owner: string, repo: string): string {
  return `rw:${owner}:${repo}:issue:${issueNumber}`;
}

export class MockOrchestratorStatusProvider implements OrchestratorStatusProvider {
  async getStatusForIssue(issueNumber: number, stageLabel: string | null): Promise<OrchestratorIssueStatus> {
    const config = getPortalConfig();
    const instanceId = instanceIdForIssue(issueNumber, config.owner, config.repo);

    if (!stageLabel) {
      return { issueNumber, stageLabel, instanceId, status: 'no_eligible_stage', reason: 'No known stage label is present on this issue.' };
    }

    if (stageLabel === 'stage/9-archived' || stageLabel === 'stage/7.1-validated' || stageLabel === 'stage/8-selected') {
      return { issueNumber, stageLabel, instanceId, status: 'completed', reason: 'Terminal stage reached.', durableRuntimeStatus: 'Completed', orchestratorOutputStatus: 'completed' };
    }

    if (issueNumber % 11 === 0) {
      return { issueNumber, stageLabel, instanceId, status: 'failed', reason: 'Mock provider simulates an orchestration failure for repeatable test coverage.', durableRuntimeStatus: 'Failed', orchestratorOutputStatus: 'failed', createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() };
    }

    if (issueNumber % 7 === 0) {
      return { issueNumber, stageLabel, instanceId, status: 'queued', reason: 'Mock provider simulates a queued orchestration.', durableRuntimeStatus: 'Pending', createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() };
    }

    if (issueNumber % 5 === 0) {
      return { issueNumber, stageLabel, instanceId, status: 'cooldown_active', reason: 'Mock provider simulates orchestrator cooldown.', durableRuntimeStatus: 'Completed', orchestratorOutputStatus: 'cooldown-active' };
    }

    if (issueNumber % 2 === 0) {
      return { issueNumber, stageLabel, instanceId, status: 'running', reason: 'Mock provider simulates an active orchestration.', durableRuntimeStatus: 'Running', createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), updatedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString() };
    }

    return { issueNumber, stageLabel, instanceId, status: 'not_started', reason: 'No Durable orchestration instance found for this issue.' };
  }
}