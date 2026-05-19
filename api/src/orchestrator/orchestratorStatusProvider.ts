import { OrchestratorIssueStatus } from '../types';

export interface OrchestratorStatusProvider {
  getStatusForIssue(issueNumber: number, stageLabel: string | null): Promise<OrchestratorIssueStatus>;
}