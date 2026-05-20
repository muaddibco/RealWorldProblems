import { createGitHubClient } from './github/githubClient';
import { DurableHttpOrchestratorStatusProvider } from './orchestrator/durableHttpOrchestratorStatusProvider';
import { MockOrchestratorStatusProvider } from './orchestrator/mockOrchestratorStatusProvider';
import { OrchestratorStatusProvider } from './orchestrator/orchestratorStatusProvider';
import { getPortalConfig } from './shared/portalConfig';

export const portalConfig = getPortalConfig();
export const githubClient = createGitHubClient();
export const orchestratorStatusProvider: OrchestratorStatusProvider = portalConfig.orchestratorProvider === 'durable-http'
  ? new DurableHttpOrchestratorStatusProvider()
  : new MockOrchestratorStatusProvider();