"use strict";
/**
 * Fixture payloads for GitHub webhook testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIssuePayload = createIssuePayload;
exports.createWebhookPayload = createWebhookPayload;
exports.createIssueWithLabels = createIssueWithLabels;
exports.createIssueWithIsland = createIssueWithIsland;
exports.createIssueWithDispatchMarker = createIssueWithDispatchMarker;
exports.createWebhookSignature = createWebhookSignature;
function createIssuePayload(issueNumber, labels, body = null, title = "Test Issue") {
    return {
        number: issueNumber,
        title,
        body,
        state: "open",
        updated_at: new Date().toISOString(),
        labels: labels.map((name) => ({ name }))
    };
}
function createWebhookPayload(event, action, issue, repository, label) {
    const repo = repository || {
        name: "RealWorldProblems",
        owner: { login: "test-user" }
    };
    if (event === "issues") {
        return {
            action,
            issue: issue || createIssuePayload(1, []),
            label: label || null,
            repository: repo,
            sender: { login: "github-user" }
        };
    }
    // workflow_run event
    return {
        action,
        workflow_run: {
            id: 12345,
            name: "Test Workflow",
            conclusion: "success",
            html_url: "https://github.com/test/repo/actions/runs/12345"
        },
        repository: repo,
        sender: { login: "github-user" }
    };
}
function createIssueWithLabels(issueNumber, labels) {
    return createIssuePayload(issueNumber, labels, "# Problem\n\nTest body");
}
function createIssueWithIsland(issueNumber, labels, islandName) {
    const body = `# Problem

<!-- rw:${islandName}:start -->
Test content for ${islandName}
<!-- rw:${islandName}:end -->

More content`;
    return createIssuePayload(issueNumber, labels, body);
}
function createIssueWithDispatchMarker(issueNumber, labels, dispatchedAtUtc) {
    const body = `# Problem

Some content

Comments section:
<!-- rw:workflow-dispatch:${dispatchedAtUtc} -->
Workflow dispatch recorded: \`10-normalize.lock.yml\` for stage \`normalize\` by orchestration \`orch-123\`.`;
    return createIssuePayload(issueNumber, labels, body);
}
function createWebhookSignature(payload, secret) {
    const crypto = require("crypto");
    return ("sha256=" +
        crypto.createHmac("sha256", secret).update(payload).digest("hex"));
}
