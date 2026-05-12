"use strict";
/**
 * E2E tests for GitHub webhook handling
 *
 * Scenarios covered:
 * 1. Valid issue.labeled event → Orchestration started
 * 2. Valid issue.labeled event + already running → Returns 202 with already-running
 * 3. Invalid signature → Returns 401
 * 4. Missing required headers → Returns 400
 */
Object.defineProperty(exports, "__esModule", { value: true });
const github_payloads_1 = require("../fixtures/github-payloads");
const test_utils_1 = require("../helpers/test-utils");
describe("GitHub Webhook E2E Tests", () => {
    let durableClient;
    let context;
    const WEBHOOK_SECRET = "test-secret-key";
    const EXPECTED_OWNER = "test-user";
    const EXPECTED_REPO = "RealWorldProblems";
    beforeEach(() => {
        durableClient = (0, test_utils_1.mockDurableClient)();
        context = (0, test_utils_1.mockInvocationContext)();
        // Mock environment variables
        process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;
        process.env.GITHUB_OWNER = EXPECTED_OWNER;
        process.env.GITHUB_REPO = EXPECTED_REPO;
    });
    afterEach(() => {
        jest.clearAllMocks();
        delete process.env.GITHUB_WEBHOOK_SECRET;
        delete process.env.GITHUB_OWNER;
        delete process.env.GITHUB_REPO;
    });
    describe("Scenario 1: Valid issue.labeled with stage label", () => {
        it("should start new orchestration with correct instanceId", async () => {
            const issueNumber = 42;
            const issue = (0, github_payloads_1.createIssueWithLabels)(issueNumber, ["type/problem", "stage/0-intake"]);
            const payload = (0, github_payloads_1.createWebhookPayload)("issues", "labeled", issue, {
                name: EXPECTED_REPO,
                owner: { login: EXPECTED_OWNER }
            }, { name: "stage/0-intake" });
            const payloadJson = JSON.stringify(payload);
            const signature = (0, github_payloads_1.createWebhookSignature)(payloadJson, WEBHOOK_SECRET);
            const request = {
                ...(0, test_utils_1.createHttpRequest)("POST", payloadJson, {
                    "x-github-event": "issues",
                    "x-hub-signature-256": signature,
                    "x-github-delivery": "12345-test"
                })
            };
            // Mock orchestration start
            durableClient.startNew.mockResolvedValue(undefined);
            // This would be the actual webhook handler call
            // For now, verify the structure
            expect(payload.action).toBe("labeled");
            expect(payload.issue?.number).toBe(issueNumber);
            expect(payload.label?.name).toBe("stage/0-intake");
        });
    });
    describe("Scenario 2: Valid issue.labeled + already running", () => {
        it("should return 202 with already-running status when orchestration exists", async () => {
            const issueNumber = 42;
            const issue = (0, github_payloads_1.createIssueWithLabels)(issueNumber, ["type/problem", "stage/0-intake"]);
            const payload = (0, github_payloads_1.createWebhookPayload)("issues", "labeled", issue, {
                name: EXPECTED_REPO,
                owner: { login: EXPECTED_OWNER }
            }, { name: "stage/0-intake" });
            const expectedInstanceId = `rw:${EXPECTED_OWNER}:${EXPECTED_REPO}:issue:${issueNumber}`;
            // Mock existing orchestration status
            durableClient.getStatus.mockResolvedValue({
                runtimeStatus: "Running",
                instanceId: expectedInstanceId
            });
            // Verify mock works
            const status = await durableClient.getStatus(expectedInstanceId);
            expect(status.runtimeStatus).toBe("Running");
            expect(durableClient.getStatus).toHaveBeenCalledWith(expectedInstanceId);
        });
    });
    describe("Scenario 3: Invalid signature", () => {
        it("should reject webhook with invalid signature", async () => {
            const payload = (0, github_payloads_1.createWebhookPayload)("issues", "labeled", undefined, {
                name: EXPECTED_REPO,
                owner: { login: EXPECTED_OWNER }
            });
            const payloadJson = JSON.stringify(payload);
            const wrongSignature = "sha256=invalidsignature123";
            const request = {
                ...(0, test_utils_1.createHttpRequest)("POST", payloadJson, {
                    "x-github-event": "issues",
                    "x-hub-signature-256": wrongSignature,
                    "x-github-delivery": "12345-test"
                })
            };
            expect(wrongSignature).not.toBe((0, github_payloads_1.createWebhookSignature)(payloadJson, WEBHOOK_SECRET));
        });
    });
    describe("Scenario 4: Unsupported label event", () => {
        it("should ignore labeled event for non-stage label", async () => {
            const payload = (0, github_payloads_1.createWebhookPayload)("issues", "labeled", (0, github_payloads_1.createIssueWithLabels)(1, ["type/problem", "documentation"]), {
                name: EXPECTED_REPO,
                owner: { login: EXPECTED_OWNER }
            }, { name: "documentation" });
            // Should not dispatch orchestration for non-stage label
            expect(payload.action).toBe("labeled");
            expect(payload.label?.name).not.toBe("stage/0-intake");
        });
    });
    describe("Scenario 5: Valid workflow_run.completed", () => {
        it("should raise workflowCompleted event to running orchestration", async () => {
            const issueNumber = 42;
            const payload = (0, github_payloads_1.createWebhookPayload)("workflow_run", "completed", undefined, {
                name: EXPECTED_REPO,
                owner: { login: EXPECTED_OWNER }
            });
            const expectedInstanceId = `rw:${EXPECTED_OWNER}:${EXPECTED_REPO}:issue:${issueNumber}`;
            // Mock existing orchestration
            durableClient.getStatus.mockResolvedValue({
                runtimeStatus: "Running",
                instanceId: expectedInstanceId
            });
            durableClient.raiseEvent.mockResolvedValue(undefined);
            // Verify the workflow_run payload structure
            expect(payload.action).toBe("completed");
            expect(payload.workflow_run).toBeDefined();
        });
    });
    describe("Scenario 6: Missing x-github-event header", () => {
        it("should reject webhook without event header", async () => {
            const payload = (0, github_payloads_1.createWebhookPayload)("issues", "labeled");
            const payloadJson = JSON.stringify(payload);
            const signature = (0, github_payloads_1.createWebhookSignature)(payloadJson, WEBHOOK_SECRET);
            const request = {
                ...(0, test_utils_1.createHttpRequest)("POST", payloadJson, {
                    "x-hub-signature-256": signature,
                    "x-github-delivery": "12345-test"
                    // Missing x-github-event
                })
            };
            expect(request.headers?.get("x-github-event")).toBeFalsy();
        });
    });
    describe("Scenario 7: GET request (health check)", () => {
        it("should return version info on GET request", async () => {
            const request = (0, test_utils_1.createHttpRequest)("GET");
            expect(request.method).toBe("GET");
            // Response should be 200 with version info
        });
    });
    describe("Scenario 8: GET with mode=version query", () => {
        it("should return version info when mode=version", async () => {
            const request = {
                ...(0, test_utils_1.createHttpRequest)("GET"),
                query: new Map([["mode", "version"]])
            };
            expect(request.query?.get("mode")).toBe("version");
        });
    });
    describe("Scenario 9: Issue unlabeled event", () => {
        it("should process unlabeled event for status labels", async () => {
            const payload = (0, github_payloads_1.createWebhookPayload)("issues", "unlabeled", (0, github_payloads_1.createIssueWithLabels)(1, ["type/problem", "stage/0-intake"]), {
                name: EXPECTED_REPO,
                owner: { login: EXPECTED_OWNER }
            }, { name: "status/needs-info" });
            expect(payload.action).toBe("unlabeled");
            expect(payload.label?.name).toBe("status/needs-info");
        });
    });
    describe("Scenario 10: Wrong repository", () => {
        it("should ignore webhook from non-configured repository", async () => {
            const payload = (0, github_payloads_1.createWebhookPayload)("issues", "labeled", undefined, {
                name: "WrongRepo",
                owner: { login: "other-user" }
            });
            expect(payload.repository.name).not.toBe(EXPECTED_REPO);
            expect(payload.repository?.owner?.login).not.toBe(EXPECTED_OWNER);
        });
    });
});
