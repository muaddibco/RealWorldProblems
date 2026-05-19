export type PortalConfig = {
  owner: string;
  repo: string;
  retryCooldownSeconds: number;
  batchRetryMax: number;
  allowMockUser: boolean;
  useMockGitHub: boolean;
  orchestratorProvider: 'mock' | 'durable-http';
  functionAppName?: string;
  functionKey?: string;
  taskHub: string;
  connection: string;
};

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }
  return value.toLowerCase() === 'true';
}

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getPortalConfig(): PortalConfig {
  const owner = process.env.GITHUB_OWNER ?? 'muaddibco';
  const repo = process.env.GITHUB_REPO ?? 'RealWorldProblems';

  return {
    owner,
    repo,
    retryCooldownSeconds: readNumber(process.env.PORTAL_RETRY_COOLDOWN_SECONDS, 120),
    batchRetryMax: readNumber(process.env.PORTAL_BATCH_RETRY_MAX, 25),
    allowMockUser: readBoolean(process.env.PORTAL_ALLOW_MOCK_USER, true),
    useMockGitHub: readBoolean(process.env.PORTAL_USE_MOCK_GITHUB, !process.env.GITHUB_TOKEN && !process.env.GITHUB_APP_ID),
    orchestratorProvider: process.env.ORCHESTRATOR_STATUS_PROVIDER === 'durable-http' ? 'durable-http' : 'mock',
    functionAppName: process.env.ORCHESTRATOR_FUNCTION_APP_NAME,
    functionKey: process.env.ORCHESTRATOR_FUNCTION_KEY,
    taskHub: process.env.ORCHESTRATOR_TASK_HUB ?? 'RealWorldProblemsHub',
    connection: process.env.ORCHESTRATOR_CONNECTION ?? 'Storage'
  };
}