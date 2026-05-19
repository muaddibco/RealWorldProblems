import { StageConfig } from '../types';

export const STAGE_CONFIG: Record<string, StageConfig> = {
  'stage/0-intake': { id: 'normalize', stageLabel: 'stage/0-intake', stageName: 'Intake', agentName: 'Normalize', workflowId: '10-normalize.lock.yml', stuckAfterMinutes: 15 },
  'stage/1-normalized': { id: 'dedupe', stageLabel: 'stage/1-normalized', stageName: 'Normalized', agentName: 'Dedupe + Cluster', workflowId: '20-dedupe.lock.yml', stuckAfterMinutes: 15 },
  'stage/2-deduped': { id: 'software-fit', stageLabel: 'stage/2-deduped', stageName: 'Deduped', agentName: 'Software Fit Gate', workflowId: '30-software-fit.lock.yml', stuckAfterMinutes: 15 },
  'stage/3-scored': { id: 'score', stageLabel: 'stage/3-scored', stageName: 'Ready for Scoring', agentName: 'Score Problems', workflowId: '40-score.lock.yml', stuckAfterMinutes: 15 },
  'stage/4-solution': { id: 'solution', stageLabel: 'stage/4-solution', stageName: 'Ready for Solution Hypothesis', agentName: 'Solution Hypothesis', workflowId: '50-solution.lock.yml', stuckAfterMinutes: 15 },
  'stage/ai-defensibility': { id: 'ai-defensibility', stageLabel: 'stage/ai-defensibility', stageName: 'AI Defensibility', agentName: 'AI Defensibility Gate', workflowId: '55-ai-defensibility.lock.yml', stuckAfterMinutes: 15 },
  'stage/5-competitors': { id: 'competitors', stageLabel: 'stage/5-competitors', stageName: 'Ready for Competitor Scan', agentName: 'Competitor Scan', workflowId: '60-competitors.lock.yml', stuckAfterMinutes: 15 },
  'stage/6-shortlist': { id: 'wedge', stageLabel: 'stage/6-shortlist', stageName: 'Shortlist', agentName: 'Wedge Filter', workflowId: '70-wedge-filter.lock.yml', stuckAfterMinutes: 15 },
  'stage/7-validation': { id: 'validation', stageLabel: 'stage/7-validation', stageName: 'Validation', agentName: 'Validation Plan', workflowId: '90-validation-plan.lock.yml', stuckAfterMinutes: 15 },
  'stage/7.1-validated': { id: null, stageLabel: 'stage/7.1-validated', stageName: 'Validated', agentName: null, workflowId: null, stuckAfterMinutes: null, terminal: true },
  'stage/8-selected': { id: null, stageLabel: 'stage/8-selected', stageName: 'Selected', agentName: null, workflowId: null, stuckAfterMinutes: null, terminal: true },
  'stage/9-archived': { id: null, stageLabel: 'stage/9-archived', stageName: 'Archived', agentName: null, workflowId: null, stuckAfterMinutes: null, terminal: true }
};

export const STAGE_LABEL_PRIORITY = Object.keys(STAGE_CONFIG);

export function isStageLabel(label: string): label is keyof typeof STAGE_CONFIG {
  return Object.prototype.hasOwnProperty.call(STAGE_CONFIG, label);
}

export function getStageConfig(stageLabel: string | null | undefined): StageConfig | null {
  if (!stageLabel || !isStageLabel(stageLabel)) {
    return null;
  }
  return STAGE_CONFIG[stageLabel];
}

export function getKnownStageLabels(labels: string[]): string[] {
  return labels.filter((label) => isStageLabel(label));
}

export function getPrimaryStageLabel(labels: string[]): string | null {
  for (const stageLabel of STAGE_LABEL_PRIORITY) {
    if (labels.includes(stageLabel)) {
      return stageLabel;
    }
  }
  return null;
}

export function getStageLabelsCount(labels: string[]): number {
  return getKnownStageLabels(labels).length;
}