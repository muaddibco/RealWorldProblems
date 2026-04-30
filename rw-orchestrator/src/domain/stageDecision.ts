import { STAGES } from "./stages";
import { GitHubIssue, StageDefinition } from "./types";

function toLabelSet(issue: GitHubIssue): Set<string> {
  return new Set(issue.labels.map((label) => label.name));
}

function hasAll(labels: Set<string>, required: string[]): boolean {
  return required.every((label) => labels.has(label));
}

function hasAny(labels: Set<string>, candidates: string[]): boolean {
  return candidates.some((label) => labels.has(label));
}

export function isPipelineTerminal(issue: GitHubIssue): boolean {
  const labels = toLabelSet(issue);
  return labels.has("stage/9-archived") || labels.has("status/needs-info") || !labels.has("type/problem");
}

export function decideNextStage(issue: GitHubIssue, stageDefs: StageDefinition[] = STAGES): StageDefinition | null {
  const labels = toLabelSet(issue);

  if (isPipelineTerminal(issue)) {
    return null;
  }

  for (const stage of stageDefs) {
    if (!hasAll(labels, stage.requiredLabels)) {
      continue;
    }

    if (hasAny(labels, stage.forbiddenLabels)) {
      continue;
    }

    return stage;
  }

  return null;
}
