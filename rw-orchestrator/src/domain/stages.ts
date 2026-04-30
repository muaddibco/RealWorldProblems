import { StageDefinition } from "./types";

export const STAGES: StageDefinition[] = [
  {
    id: "normalize",
    stageLabel: "stage/0-intake",
    requiredLabels: ["type/problem", "stage/0-intake"],
    forbiddenLabels: ["agentic-workflows", "rw/processing", "stage/9-archived"],
    workflowId: "10-normalize.lock.yml",
    expectedNextLabels: ["stage/1-normalized", "status/needs-info"],
    timeoutMinutes: 30,
    terminalLabels: ["status/needs-info"]
  },
  {
    id: "dedupe",
    stageLabel: "stage/1-normalized",
    requiredLabels: ["type/problem", "stage/1-normalized"],
    forbiddenLabels: ["agentic-workflows", "rw/processing", "stage/9-archived"],
    workflowId: "20-dedupe.lock.yml",
    expectedNextLabels: ["stage/2-deduped", "stage/9-archived"],
    timeoutMinutes: 30
  },
  {
    id: "software-fit",
    stageLabel: "stage/2-deduped",
    requiredLabels: ["type/problem", "stage/2-deduped"],
    forbiddenLabels: ["agentic-workflows", "rw/processing", "stage/9-archived"],
    workflowId: "30-software-fit.lock.yml",
    expectedNextLabels: ["stage/3-scored", "stage/9-archived"],
    timeoutMinutes: 30
  },
  {
    id: "score",
    stageLabel: "stage/3-scored",
    requiredLabels: ["type/problem", "stage/3-scored"],
    forbiddenLabels: ["agentic-workflows", "rw/processing", "stage/9-archived"],
    workflowId: "40-score.lock.yml",
    expectedNextLabels: ["stage/4-solution"],
    timeoutMinutes: 30
  },
  {
    id: "solution",
    stageLabel: "stage/4-solution",
    requiredLabels: ["type/problem", "stage/4-solution"],
    forbiddenLabels: ["agentic-workflows", "rw/processing", "stage/9-archived"],
    workflowId: "50-solution.lock.yml",
    expectedNextLabels: ["stage/ai-defensibility"],
    timeoutMinutes: 30
  },
  {
    id: "ai-defensibility",
    stageLabel: "stage/ai-defensibility",
    requiredLabels: ["type/problem", "stage/ai-defensibility"],
    forbiddenLabels: ["agentic-workflows", "rw/processing", "stage/9-archived"],
    workflowId: "55-ai-defensibility.lock.yml",
    expectedNextLabels: ["stage/5-competitors"],
    timeoutMinutes: 30
  },
  {
    id: "competitors",
    stageLabel: "stage/5-competitors",
    requiredLabels: ["type/problem", "stage/5-competitors"],
    forbiddenLabels: ["agentic-workflows", "rw/processing", "stage/9-archived"],
    workflowId: "60-competitors.lock.yml",
    expectedNextLabels: ["stage/6-shortlist"],
    timeoutMinutes: 45
  },
  {
    id: "wedge",
    stageLabel: "stage/6-shortlist",
    requiredLabels: ["type/problem", "stage/6-shortlist"],
    forbiddenLabels: ["agentic-workflows", "rw/processing", "stage/9-archived"],
    workflowId: "70-wedge-filter.lock.yml",
    expectedNextLabels: ["stage/7-validation", "stage/9-archived", "stage/6-shortlist"],
    timeoutMinutes: 30
  },
  {
    id: "validation",
    stageLabel: "stage/7-validation",
    requiredLabels: ["type/problem", "stage/7-validation"],
    forbiddenLabels: ["agentic-workflows", "rw/processing", "stage/9-archived"],
    workflowId: "90-validation-plan.lock.yml",
    expectedNextLabels: ["stage/7-validation"],
    timeoutMinutes: 45
  }
];

export const STAGE_LABEL_PRIORITY = STAGES.map((stage) => stage.stageLabel);
