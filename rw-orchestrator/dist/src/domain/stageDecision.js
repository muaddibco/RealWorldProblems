"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPipelineTerminal = isPipelineTerminal;
exports.decideNextStage = decideNextStage;
const stages_1 = require("./stages");
function toLabelSet(issue) {
    return new Set(issue.labels.map((label) => label.name));
}
function hasAll(labels, required) {
    return required.every((label) => labels.has(label));
}
function hasAny(labels, candidates) {
    return candidates.some((label) => labels.has(label));
}
function isPipelineTerminal(issue) {
    const labels = toLabelSet(issue);
    return labels.has("stage/9-archived") || labels.has("status/needs-info") || !labels.has("type/problem");
}
function decideNextStage(issue, stageDefs = stages_1.STAGES) {
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
