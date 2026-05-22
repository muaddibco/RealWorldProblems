import { classifyLifecycleStatus, computeIsStuck, buildIssueCard } from '../github/issueClassification';
import { applyRetryStrategyLabels, evaluateRetryEligibility } from '../github/retryEligibility';
import { STAGE_CONFIG } from '../orchestrator/stageConfig';
import { DurableHttpOrchestratorStatusProvider } from '../orchestrator/durableHttpOrchestratorStatusProvider';
import { aggregateBatchRetryResults } from '../services/batchRetryAggregation';
import { GitHubIssueRecord, OrchestratorIssueStatus } from '../types';

const baseIssue: GitHubIssueRecord = {
  number: 42,
  title: 'Test issue',
  html_url: 'https://github.com/muaddibco/RealWorldProblems/issues/42',
  state: 'open',
  labels: ['type/problem', 'stage/3-scored'],
  updated_at: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  body: 'body',
  comments_url: 'https://api.github.com/repos/muaddibco/RealWorldProblems/issues/42/comments'
};

const activeOrchestration: OrchestratorIssueStatus = {
  issueNumber: 42,
  stageLabel: 'stage/3-scored',
  instanceId: 'rw:muaddibco:RealWorldProblems:issue:42',
  status: 'running',
  reason: 'running',
  durableRuntimeStatus: 'Running'
};

describe('stage and lifecycle classification', () => {
  it('detects the configured stage label', () => {
    const card = buildIssueCard(baseIssue, { ...activeOrchestration, status: 'not_started', reason: 'none' }, { allowed: true, strategy: 'reapplied-stage-label' });
    expect(card.stageLabel).toBe('stage/3-scored');
    expect(card.stageName).toBe(STAGE_CONFIG['stage/3-scored'].stageName);
  });

  it('classifies terminal lifecycle labels deterministically', () => {
    expect(classifyLifecycleStatus(['type/problem', 'stage/7.1-validated'], 'open')).toBe('completed');
    expect(classifyLifecycleStatus(['type/problem', 'stage/8-selected'], 'open')).toBe('selected');
    expect(classifyLifecycleStatus(['type/problem', 'stage/9-archived'], 'closed')).toBe('archived');
  });
});

describe('durable mapping and stuck detection', () => {
  it('marks old running issues as stuck', () => {
    const issue = buildIssueCard(baseIssue, activeOrchestration, { allowed: true, strategy: 'reapplied-stage-label' }, new Date('2026-01-01T00:20:00.000Z'));
    expect(computeIsStuck(issue)).toBe(true);
  });

  it('maps completed output status to cooldown_active', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ runtimeStatus: 'Completed', output: { status: 'cooldown-active' }, createdTime: '2026-01-01T00:00:00.000Z', lastUpdatedTime: '2026-01-01T00:01:00.000Z' }), { status: 200 })) as unknown as typeof fetch;

    process.env.ORCHESTRATOR_FUNCTION_APP_NAME = 'example';
    process.env.ORCHESTRATOR_FUNCTION_KEY = 'secret';
    process.env.ORCHESTRATOR_STATUS_PROVIDER = 'durable-http';

    const provider = new DurableHttpOrchestratorStatusProvider();
    const result = await provider.getStatusForIssue(42, 'stage/3-scored');

    expect(result.status).toBe('cooldown_active');
    expect(result.orchestratorOutputStatus).toBe('cooldown-active');

    global.fetch = originalFetch;
  });

  it('falls back to not_started when the durable instance is missing', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch;

    process.env.ORCHESTRATOR_FUNCTION_APP_NAME = 'example';
    process.env.ORCHESTRATOR_FUNCTION_KEY = 'secret';
    process.env.ORCHESTRATOR_STATUS_PROVIDER = 'durable-http';

    const provider = new DurableHttpOrchestratorStatusProvider();
    const result = await provider.getStatusForIssue(42, 'stage/3-scored');

    expect(result.status).toBe('not_started');
    expect(result.reason).toMatch(/No Durable orchestration instance found/);

    global.fetch = originalFetch;
  });

  it('terminates an orchestration instance using the durable webhook endpoint', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => new Response('', { status: 202 })) as unknown as typeof fetch;

    process.env.ORCHESTRATOR_FUNCTION_APP_NAME = 'example';
    process.env.ORCHESTRATOR_FUNCTION_KEY = 'secret';
    process.env.ORCHESTRATOR_TASK_HUB = 'RealWorldProblemsHub';
    process.env.ORCHESTRATOR_CONNECTION = 'Storage';
    process.env.ORCHESTRATOR_STATUS_PROVIDER = 'durable-http';

    const provider = new DurableHttpOrchestratorStatusProvider();
    await provider.terminateInstance('rw:muaddibco:RealWorldProblems:issue:42', 'manual retry from portal');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/runtime/webhooks/durabletask/instances/rw%3Amuaddibco%3ARealWorldProblems%3Aissue%3A42/terminate?'),
      { method: 'POST' }
    );

    global.fetch = originalFetch;
  });
});

describe('retry safety and aggregation', () => {
  it('allows retry for issues with rw/processing when orchestration status is available', () => {
    const issueWithProcessing: GitHubIssueRecord = {
      ...baseIssue,
      labels: ['type/problem', 'stage/3-scored', 'rw/processing']
    };

    const result = evaluateRetryEligibility(
      issueWithProcessing,
      { ...activeOrchestration, status: 'queued', reason: 'queued' }
    );

    expect(result.allowed).toBe(true);
  });

  it('aggregates batch retry results without losing per-issue results', () => {
    const aggregated = aggregateBatchRetryResults([
      { issueNumber: 1, ok: true, stageLabel: 'stage/3-scored', strategy: 'reapplied-stage-label', message: 'Retry requested' },
      { issueNumber: 2, ok: false, message: 'Retry refused: issue is closed.' }
    ]);

    expect(aggregated.ok).toBe(true);
    expect(aggregated.results).toHaveLength(2);
    expect(aggregated.results[1].message).toContain('closed');
  });

  it('removes all rw/* labels when reapplying stage label', () => {
    const action = applyRetryStrategyLabels(
      ['type/problem', 'stage/3-scored', 'rw/processing', 'rw/cooldown'],
      'reapplied-stage-label'
    );

    expect(action.remove).toEqual(expect.arrayContaining(['rw/processing', 'rw/cooldown', 'stage/3-scored']));
    expect(action.add).toEqual(['stage/3-scored']);
  });

  it('removes all rw/* labels when clearing orchestration-failed', () => {
    const action = applyRetryStrategyLabels(
      ['type/problem', 'stage/3-scored', 'status/orchestration-failed', 'rw/processing', 'rw/cooldown'],
      'removed-orchestration-failed'
    );

    expect(action.remove).toEqual(expect.arrayContaining(['rw/processing', 'rw/cooldown', 'status/orchestration-failed']));
    expect(action.add).toEqual([]);
  });
});