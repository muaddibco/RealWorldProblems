"use strict";
/**
 * Mock GitHub client for testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockGitHubClient = void 0;
class MockGitHubClient {
    issues;
    comments;
    addedLabels = [];
    removedLabels = [];
    postedComments = [];
    dispatchedWorkflows = [];
    constructor(config) {
        this.issues = config?.issues || new Map();
        this.comments = config?.comments || new Map();
    }
    async getIssue(owner, repo, issueNumber) {
        const issue = this.issues.get(issueNumber);
        if (!issue) {
            throw new Error(`Issue #${issueNumber} not found`);
        }
        return {
            number: issue.number,
            title: issue.title,
            body: issue.body,
            state: issue.state,
            updated_at: issue.updated_at,
            labels: issue.labels
        };
    }
    async addLabels(owner, repo, issueNumber, labels) {
        const issue = this.issues.get(issueNumber);
        if (!issue) {
            throw new Error(`Issue #${issueNumber} not found`);
        }
        const existingLabelNames = new Set(issue.labels.map((l) => l.name));
        for (const label of labels) {
            if (!existingLabelNames.has(label)) {
                issue.labels.push({ name: label });
            }
        }
        this.addedLabels.push({ issueNumber, labels });
    }
    async removeLabelIfExists(owner, repo, issueNumber, label) {
        const issue = this.issues.get(issueNumber);
        if (!issue) {
            return;
        }
        issue.labels = issue.labels.filter((l) => l.name !== label);
        this.removedLabels.push({ issueNumber, labels: [label] });
    }
    async addComment(owner, repo, issueNumber, body) {
        if (!this.comments.has(issueNumber)) {
            this.comments.set(issueNumber, []);
        }
        this.comments.get(issueNumber).push({
            body,
            created_at: new Date().toISOString()
        });
        this.postedComments.push({ issueNumber, body });
    }
    async listIssueComments(owner, repo, issueNumber, limit) {
        const comments = this.comments.get(issueNumber) || [];
        return comments.slice(-limit);
    }
    async dispatchWorkflow(input) {
        this.dispatchedWorkflows.push({
            workflowId: input.workflowId,
            inputs: input.inputs
        });
    }
    async listIssuesByLabels(owner, repo, labels, limit) {
        const result = [];
        for (const [, issue] of this.issues) {
            if (result.length >= limit)
                break;
            const issueLabels = issue.labels.map((l) => l.name);
            if (labels.every((label) => issueLabels.includes(label))) {
                result.push({
                    number: issue.number,
                    title: issue.title,
                    body: issue.body,
                    state: issue.state,
                    updated_at: issue.updated_at,
                    labels: issue.labels
                });
            }
        }
        return result;
    }
    // Test helpers
    setIssue(issue) {
        this.issues.set(issue.number, issue);
    }
    setIssueComments(issueNumber, comments) {
        this.comments.set(issueNumber, comments);
    }
    getAddedLabels() {
        return this.addedLabels;
    }
    getRemovedLabels() {
        return this.removedLabels;
    }
    getPostedComments() {
        return this.postedComments;
    }
    getDispatchedWorkflows() {
        return this.dispatchedWorkflows;
    }
    reset() {
        this.addedLabels = [];
        this.removedLabels = [];
        this.postedComments = [];
        this.dispatchedWorkflows = [];
    }
}
exports.MockGitHubClient = MockGitHubClient;
