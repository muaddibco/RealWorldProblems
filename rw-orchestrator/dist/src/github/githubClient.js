"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubClient = void 0;
const rest_1 = require("@octokit/rest");
const env_1 = require("./env");
class GitHubClient {
    octokit;
    constructor(token) {
        this.octokit = new rest_1.Octokit({ auth: token });
    }
    static async create() {
        return new GitHubClient((0, env_1.getGitHubToken)());
    }
    async getIssue(owner, repo, issueNumber) {
        const response = await this.octokit.issues.get({
            owner,
            repo,
            issue_number: issueNumber
        });
        const issue = response.data;
        return {
            number: issue.number,
            title: issue.title,
            body: issue.body ?? "",
            labels: issue.labels.map((label) => ({
                name: typeof label === "string" ? label : label.name ?? ""
            })),
            state: issue.state,
            updated_at: issue.updated_at
        };
    }
    async listIssuesByLabels(owner, repo, labels, max) {
        const result = [];
        let page = 1;
        while (result.length < max) {
            const response = await this.octokit.issues.listForRepo({
                owner,
                repo,
                state: "open",
                labels: labels.join(","),
                per_page: 100,
                page
            });
            if (response.data.length === 0) {
                break;
            }
            for (const issue of response.data) {
                if ("pull_request" in issue) {
                    continue;
                }
                result.push({
                    number: issue.number,
                    title: issue.title,
                    body: issue.body ?? "",
                    labels: issue.labels.map((label) => ({
                        name: typeof label === "string" ? label : label.name ?? ""
                    })),
                    state: issue.state,
                    updated_at: issue.updated_at
                });
                if (result.length >= max) {
                    break;
                }
            }
            if (response.data.length < 100) {
                break;
            }
            page += 1;
        }
        return result;
    }
    async addLabels(owner, repo, issueNumber, labels) {
        if (labels.length === 0) {
            return;
        }
        await this.octokit.issues.addLabels({
            owner,
            repo,
            issue_number: issueNumber,
            labels
        });
    }
    async removeLabelIfExists(owner, repo, issueNumber, label) {
        try {
            await this.octokit.issues.removeLabel({
                owner,
                repo,
                issue_number: issueNumber,
                name: label
            });
        }
        catch (error) {
            if (typeof error === "object" && error && "status" in error && error.status === 404) {
                return;
            }
            throw error;
        }
    }
    async addComment(owner, repo, issueNumber, body) {
        await this.octokit.issues.createComment({
            owner,
            repo,
            issue_number: issueNumber,
            body
        });
    }
    async dispatchWorkflow(request) {
        await this.octokit.actions.createWorkflowDispatch({
            owner: request.owner,
            repo: request.repo,
            workflow_id: request.workflowId,
            ref: request.ref,
            inputs: request.inputs
        });
    }
    async getWorkflowRun(owner, repo, runId) {
        const response = await this.octokit.actions.getWorkflowRun({
            owner,
            repo,
            run_id: runId
        });
        const run = response.data;
        return {
            id: run.id,
            conclusion: run.conclusion,
            status: run.status ?? "unknown",
            html_url: run.html_url,
            display_title: run.display_title,
            name: run.name ?? undefined
        };
    }
}
exports.GitHubClient = GitHubClient;
