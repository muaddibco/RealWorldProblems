"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGitHubToken = getGitHubToken;
exports.getRepoConfig = getRepoConfig;
function getGitHubToken() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error("GITHUB_TOKEN is required");
    }
    return token;
}
function getRepoConfig() {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const workflowRef = process.env.GITHUB_WORKFLOW_REF ?? "main";
    if (!owner || !repo) {
        throw new Error("GITHUB_OWNER and GITHUB_REPO are required");
    }
    return { owner, repo, workflowRef };
}
