export type PipelineStageId =
  | "normalize"
  | "dedupe"
  | "software-fit"
  | "score"
  | "solution"
  | "ai-defensibility"
  | "competitors"
  | "wedge"
  | "validation";

export interface StageDefinition {
  id: PipelineStageId;
  stageLabel: string;
  requiredLabels: string[];
  forbiddenLabels: string[];
  workflowId: string;
  expectedNextLabels: string[];
  timeoutMinutes: number;
  terminalLabels?: string[];
}

export interface GitHubIssueLabel {
  name: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  labels: GitHubIssueLabel[];
  state: string;
  updated_at: string;
}

export interface OrchestrationInput {
  owner: string;
  repo: string;
  issueNumber: number;
  reason: "webhook" | "scan" | "manual";
}

export interface ClaimResult {
  claimed: boolean;
  reason?: string;
}

export interface DispatchResult {
  dispatched: boolean;
  workflowId: string;
}

export interface TransitionVerification {
  advanced: boolean;
  terminal: boolean;
  reason: string;
  labels: string[];
}
