"use strict";
/**
 * E2E tests for multi-stage orchestration
 *
 * Scenarios covered:
 * - Multi-Stage Happy Path: Issue progresses through normalize → dedupe → software-fit
 * - Partial Multi-Stage: Stops at terminal label before reaching next stage
 */
Object.defineProperty(exports, "__esModule", { value: true });
const github_payloads_1 = require("../fixtures/github-payloads");
const mock_github_client_1 = require("../fixtures/mock-github-client");
const stageDecision_1 = require("../../domain/stageDecision");
const stages_1 = require("../../domain/stages");
describe("Multi-Stage Orchestration E2E", () => {
    let mockGitHub;
    beforeEach(() => {
        mockGitHub = new mock_github_client_1.MockGitHubClient();
    });
    afterEach(() => {
        mockGitHub.reset();
    });
    describe("Multi-Stage Happy Path: normalize → dedupe → software-fit", () => {
        it("should progress through all three stages with successful transitions", async () => {
            const issueNumber = 50;
            let issue = (0, github_payloads_1.createIssueWithLabels)(issueNumber, ["type/problem", "stage/0-intake"]);
            mockGitHub.setIssue(issue);
            // ========== STAGE 1: NORMALIZE ==========
            console.log("=== STAGE 1: NORMALIZE ===");
            // Get issue
            let retrieved = await mockGitHub.getIssue("owner", "repo", issueNumber);
            let stage = (0, stageDecision_1.decideNextStage)(retrieved, stages_1.STAGES);
            expect(stage?.id).toBe("normalize");
            // Claim
            await mockGitHub.addLabels("owner", "repo", issueNumber, [
                "rw/processing",
                "rw/stage-normalize"
            ]);
            // Dispatch
            await mockGitHub.dispatchWorkflow({
                owner: "owner",
                repo: "repo",
                workflowId: stage.workflowId,
                ref: "main",
                inputs: { issue_number: String(issueNumber), orchestration_id: "test-1" }
            });
            // Workflow completes - transition to stage/1-normalized
            issue = (0, github_payloads_1.createIssuePayload)(issueNumber, ["type/problem", "stage/1-normalized", "rw/processing", "rw/stage-normalize"], "# Problem normalized");
            mockGitHub.setIssue(issue);
            // Verify transition
            retrieved = await mockGitHub.getIssue("owner", "repo", issueNumber);
            let normalizeStage = stages_1.STAGES.find((s) => s.id === "normalize");
            let hasExpected = normalizeStage.expectedNextLabels.some((label) => retrieved.labels.some((l) => l.name === label));
            expect(hasExpected).toBe(true);
            // Release
            await mockGitHub.removeLabelIfExists("owner", "repo", issueNumber, "rw/processing");
            await mockGitHub.removeLabelIfExists("owner", "repo", issueNumber, "rw/stage-normalize");
            // ========== STAGE 2: DEDUPE ==========
            console.log("=== STAGE 2: DEDUPE ===");
            // Orchestration loops - decide next stage
            retrieved = await mockGitHub.getIssue("owner", "repo", issueNumber);
            stage = (0, stageDecision_1.decideNextStage)(retrieved, stages_1.STAGES);
            expect(stage?.id).toBe("dedupe");
            expect(stage?.stageLabel).toBe("stage/1-normalized");
            // Claim
            await mockGitHub.addLabels("owner", "repo", issueNumber, [
                "rw/processing",
                "rw/stage-dedupe"
            ]);
            // Dispatch
            await mockGitHub.dispatchWorkflow({
                owner: "owner",
                repo: "repo",
                workflowId: stage.workflowId,
                ref: "main",
                inputs: { issue_number: String(issueNumber), orchestration_id: "test-1" }
            });
            // Workflow completes - transition to stage/2-deduped
            issue = (0, github_payloads_1.createIssuePayload)(issueNumber, ["type/problem", "stage/2-deduped", "rw/processing", "rw/stage-dedupe"], "# Problem normalized\n\n<!-- rw:dedupe:start -->\nNo duplicates found\n<!-- rw:dedupe:end -->");
            mockGitHub.setIssue(issue);
            // Verify transition
            retrieved = await mockGitHub.getIssue("owner", "repo", issueNumber);
            let dedupeStage = stages_1.STAGES.find((s) => s.id === "dedupe");
            hasExpected = dedupeStage.expectedNextLabels.some((label) => retrieved.labels.some((l) => l.name === label));
            expect(hasExpected).toBe(true);
            // Release
            await mockGitHub.removeLabelIfExists("owner", "repo", issueNumber, "rw/processing");
            await mockGitHub.removeLabelIfExists("owner", "repo", issueNumber, "rw/stage-dedupe");
            // ========== STAGE 3: SOFTWARE-FIT ==========
            console.log("=== STAGE 3: SOFTWARE-FIT ===");
            // Orchestration loops - decide next stage
            retrieved = await mockGitHub.getIssue("owner", "repo", issueNumber);
            stage = (0, stageDecision_1.decideNextStage)(retrieved, stages_1.STAGES);
            expect(stage?.id).toBe("software-fit");
            expect(stage?.stageLabel).toBe("stage/2-deduped");
            // Claim
            await mockGitHub.addLabels("owner", "repo", issueNumber, [
                "rw/processing",
                "rw/stage-software-fit"
            ]);
            // Dispatch
            await mockGitHub.dispatchWorkflow({
                owner: "owner",
                repo: "repo",
                workflowId: stage.workflowId,
                ref: "main",
                inputs: { issue_number: String(issueNumber), orchestration_id: "test-1" }
            });
            // Workflow completes - transition to stage/3-scored
            issue = (0, github_payloads_1.createIssuePayload)(issueNumber, ["type/problem", "stage/3-scored", "software-fit/yes", "rw/processing", "rw/stage-software-fit"], "# Problem\n\n<!-- rw:software-fit:start -->\nSoftware fit: YES\n<!-- rw:software-fit:end -->");
            mockGitHub.setIssue(issue);
            // Verify transition
            retrieved = await mockGitHub.getIssue("owner", "repo", issueNumber);
            let fitStage = stages_1.STAGES.find((s) => s.id === "software-fit");
            hasExpected = fitStage.expectedNextLabels.some((label) => retrieved.labels.some((l) => l.name === label));
            expect(hasExpected).toBe(true);
            // Release
            await mockGitHub.removeLabelIfExists("owner", "repo", issueNumber, "rw/processing");
            await mockGitHub.removeLabelIfExists("owner", "repo", issueNumber, "rw/stage-software-fit");
            // ========== VERIFY MULTI-STAGE PROGRESS ==========
            retrieved = await mockGitHub.getIssue("owner", "repo", issueNumber);
            const finalLabels = retrieved.labels.map((l) => l.name);
            // Verify all three stages were transitioned through
            expect(finalLabels).toContain("stage/3-scored");
            expect(finalLabels).toContain("software-fit/yes");
            expect(finalLabels).not.toContain("stage/0-intake");
            expect(finalLabels).not.toContain("stage/1-normalized");
            expect(finalLabels).not.toContain("stage/2-deduped");
            expect(finalLabels).not.toContain("rw/processing");
            // Verify dispatch count
            const dispatched = mockGitHub.getDispatchedWorkflows();
            expect(dispatched).toHaveLength(3);
            expect(dispatched[0].workflowId).toBe("10-normalize.lock.yml");
            expect(dispatched[1].workflowId).toBe("20-dedupe.lock.yml");
            expect(dispatched[2].workflowId).toBe("30-software-fit.lock.yml");
        });
    });
    describe("Partial Multi-Stage: Early Terminal at Stage 2", () => {
        it("should stop progression when terminal label applied in middle stage", async () => {
            const issueNumber = 51;
            let issue = (0, github_payloads_1.createIssueWithLabels)(issueNumber, ["type/problem", "stage/0-intake"]);
            mockGitHub.setIssue(issue);
            // ========== STAGE 1: NORMALIZE → SUCCESS ==========
            let retrieved = await mockGitHub.getIssue("owner", "repo", issueNumber);
            let stage = (0, stageDecision_1.decideNextStage)(retrieved, stages_1.STAGES);
            expect(stage?.id).toBe("normalize");
            await mockGitHub.addLabels("owner", "repo", issueNumber, [
                "rw/processing",
                "rw/stage-normalize"
            ]);
            await mockGitHub.dispatchWorkflow({
                owner: "owner",
                repo: "repo",
                workflowId: stage.workflowId,
                ref: "main",
                inputs: { issue_number: String(issueNumber), orchestration_id: "test-2" }
            });
            // Transition to stage/1-normalized
            issue = (0, github_payloads_1.createIssuePayload)(issueNumber, ["type/problem", "stage/1-normalized"], "Normalized content");
            mockGitHub.setIssue(issue);
            await mockGitHub.removeLabelIfExists("owner", "repo", issueNumber, "rw/processing");
            await mockGitHub.removeLabelIfExists("owner", "repo", issueNumber, "rw/stage-normalize");
            // ========== STAGE 2: DEDUPE → TERMINAL ==========
            retrieved = await mockGitHub.getIssue("owner", "repo", issueNumber);
            stage = (0, stageDecision_1.decideNextStage)(retrieved, stages_1.STAGES);
            expect(stage?.id).toBe("dedupe");
            await mockGitHub.addLabels("owner", "repo", issueNumber, [
                "rw/processing",
                "rw/stage-dedupe"
            ]);
            await mockGitHub.dispatchWorkflow({
                owner: "owner",
                repo: "repo",
                workflowId: stage.workflowId,
                ref: "main",
                inputs: { issue_number: String(issueNumber), orchestration_id: "test-2" }
            });
            // Workflow adds archive label instead of advancing
            issue = (0, github_payloads_1.createIssuePayload)(issueNumber, ["type/problem", "stage/1-normalized", "stage/9-archived"], "Marked as duplicate");
            mockGitHub.setIssue(issue);
            // Verify it's terminal
            retrieved = await mockGitHub.getIssue("owner", "repo", issueNumber);
            const isArchived = retrieved.labels.some((l) => l.name === "stage/9-archived");
            expect(isArchived).toBe(true);
            // Clean up
            await mockGitHub.removeLabelIfExists("owner", "repo", issueNumber, "rw/processing");
            await mockGitHub.removeLabelIfExists("owner", "repo", issueNumber, "rw/stage-dedupe");
            // ========== VERIFY NO STAGE 3 ==========
            retrieved = await mockGitHub.getIssue("owner", "repo", issueNumber);
            const nextStage = (0, stageDecision_1.decideNextStage)(retrieved, stages_1.STAGES);
            // Should be terminal - no next stage
            expect(nextStage).toBeNull();
            // Verify only 2 workflows dispatched
            const dispatched = mockGitHub.getDispatchedWorkflows();
            expect(dispatched).toHaveLength(2);
            expect(dispatched[0].workflowId).toBe("10-normalize.lock.yml");
            expect(dispatched[1].workflowId).toBe("20-dedupe.lock.yml");
        });
    });
    describe("Multi-Stage - Activity Tracking", () => {
        it("should track all added/removed labels across multiple stages", async () => {
            const issueNumber = 52;
            let issue = (0, github_payloads_1.createIssueWithLabels)(issueNumber, ["type/problem", "stage/0-intake"]);
            mockGitHub.setIssue(issue);
            // Stage 1 - claim
            await mockGitHub.addLabels("owner", "repo", issueNumber, [
                "rw/processing",
                "rw/stage-normalize"
            ]);
            // Stage 1 - release and progress
            issue = (0, github_payloads_1.createIssuePayload)(issueNumber, ["type/problem", "stage/1-normalized"]);
            mockGitHub.setIssue(issue);
            await mockGitHub.removeLabelIfExists("owner", "repo", issueNumber, "rw/processing");
            await mockGitHub.removeLabelIfExists("owner", "repo", issueNumber, "rw/stage-normalize");
            // Stage 2 - claim
            await mockGitHub.addLabels("owner", "repo", issueNumber, [
                "rw/processing",
                "rw/stage-dedupe"
            ]);
            // Stage 2 - release and progress
            issue = (0, github_payloads_1.createIssuePayload)(issueNumber, ["type/problem", "stage/2-deduped"]);
            mockGitHub.setIssue(issue);
            await mockGitHub.removeLabelIfExists("owner", "repo", issueNumber, "rw/processing");
            await mockGitHub.removeLabelIfExists("owner", "repo", issueNumber, "rw/stage-dedupe");
            // Verify add/remove tracking
            const added = mockGitHub.getAddedLabels();
            const removed = mockGitHub.getRemovedLabels();
            expect(added).toContainEqual({
                issueNumber,
                labels: ["rw/processing", "rw/stage-normalize"]
            });
            expect(added).toContainEqual({
                issueNumber,
                labels: ["rw/processing", "rw/stage-dedupe"]
            });
            expect(removed).toHaveLength(4); // 2 removals per stage
        });
    });
});
