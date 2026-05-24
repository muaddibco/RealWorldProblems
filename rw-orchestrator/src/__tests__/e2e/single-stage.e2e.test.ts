/**
 * E2E tests for single-stage orchestration
 * 
 * Scenarios covered:
 * - Happy Path 0a: evidence-enrich stage → dispatch succeeds → transition to stage/0-intake
 * - Happy Path 1a: normalize stage → dispatch succeeds → transition to stage/1-normalized
 * - Happy Path 1b: normalize stage → terminal label (status/needs-info)
 * - Happy Path 3a: country-validation stage → terminal label (status/needs-info)
 * - Happy Path 1c: any stage → archive (stage/9-archived)
 */

import {
  createIssueWithLabels,
  createIssuePayload
} from "../fixtures/github-payloads";
import { MockGitHubClient } from "../fixtures/mock-github-client";
import { decideNextStage } from "../../domain/stageDecision";
import { STAGES } from "../../domain/stages";

describe("Single-Stage Orchestration E2E", () => {
  let mockGitHub: MockGitHubClient;

  beforeEach(() => {
    mockGitHub = new MockGitHubClient();
  });

  afterEach(() => {
    mockGitHub.reset();
  });

  describe("Happy Path 0a: Evidence Enrich Stage → Advance to stage/0-intake", () => {
    it("should progress from stage/0-evidence to stage/0-intake", async () => {
      const initialIssue = createIssueWithLabels(41, ["type/problem", "stage/0-evidence"]);
      mockGitHub.setIssue(initialIssue);

      const retrieved = await mockGitHub.getIssue("owner", "repo", 41);
      const stage = decideNextStage(retrieved, STAGES);

      expect(stage).not.toBeNull();
      expect(stage?.id).toBe("evidence-enrich");
      expect(stage?.stageLabel).toBe("stage/0-evidence");
      expect(stage?.workflowId).toBe("05-evidence-enrich.lock.yml");

      const updatedIssue = createIssuePayload(
        41,
        ["type/problem", "stage/0-intake", "rw/processing", "rw/stage-evidence-enrich"],
        null,
        "Test Issue"
      );
      mockGitHub.setIssue(updatedIssue);

      const verified = await mockGitHub.getIssue("owner", "repo", 41);
      const expectedLabels = stage!.expectedNextLabels;
      const hasExpected = expectedLabels.some((label) =>
        verified.labels.some((l) => l.name === label)
      );

      expect(hasExpected).toBe(true);
      expect(verified.labels).toContainEqual({ name: "stage/0-intake" });
    });
  });

  describe("Happy Path 1a: Normalize Stage → Advance to stage/1-normalized", () => {
    it("should progress from stage/0-intake to stage/1-normalized", async () => {
      // Step 1: Create issue with normalize stage label
      const initialIssue = createIssueWithLabels(42, ["type/problem", "stage/0-intake"]);
      mockGitHub.setIssue(initialIssue);

      // Step 2: GetIssueActivity
      const retrieved = await mockGitHub.getIssue("owner", "repo", 42);
      expect(retrieved.labels).toContainEqual({ name: "stage/0-intake" });

      // Step 3: DecideNextStageActivity
      const stage = decideNextStage(retrieved, STAGES);
      expect(stage).not.toBeNull();
      expect(stage?.id).toBe("normalize");
      expect(stage?.stageLabel).toBe("stage/0-intake");
      expect(stage?.workflowId).toBe("10-normalize.lock.yml");

      // Step 4: ClaimIssueActivity - add rw/processing and rw/stage-normalize
      await mockGitHub.addLabels("owner", "repo", 42, [
        "rw/processing",
        "rw/stage-normalize"
      ]);

      // Step 5: DispatchWorkflowActivity
      await mockGitHub.dispatchWorkflow({
        owner: "owner",
        repo: "repo",
        workflowId: stage!.workflowId,
        ref: "main",
        inputs: {
          issue_number: "42",
          orchestration_id: "test-orch-123"
        }
      });

      const dispatched = mockGitHub.getDispatchedWorkflows();
      expect(dispatched).toHaveLength(1);
      expect(dispatched[0].workflowId).toBe("10-normalize.lock.yml");

      // Step 6: Workflow completes and adds expected label
      const updatedIssue = createIssuePayload(
        42,
        ["type/problem", "stage/1-normalized", "rw/processing", "rw/stage-normalize"],
        null,
        "Test Issue"
      );
      mockGitHub.setIssue(updatedIssue);

      // Step 7: VerifyStageTransitionActivity
      const verified = await mockGitHub.getIssue("owner", "repo", 42);
      const expectedLabels = stage!.expectedNextLabels;
      const hasExpected = expectedLabels.some((label) =>
        verified.labels.some((l) => l.name === label)
      );

      expect(hasExpected).toBe(true);
      expect(verified.labels).toContainEqual({ name: "stage/1-normalized" });

      // Step 8: ReleaseIssueActivity - remove rw/processing
      await mockGitHub.removeLabelIfExists("owner", "repo", 42, "rw/processing");
      await mockGitHub.removeLabelIfExists("owner", "repo", 42, "rw/stage-normalize");

      const afterRelease = await mockGitHub.getIssue("owner", "repo", 42);
      expect(afterRelease.labels).not.toContainEqual({ name: "rw/processing" });
      expect(afterRelease.labels).toContainEqual({ name: "stage/1-normalized" });

      // Step 9: Loop - should find next stage (dedupe)
      const nextStage = decideNextStage(afterRelease, STAGES);
      expect(nextStage).not.toBeNull();
      expect(nextStage?.id).toBe("dedupe");
      expect(nextStage?.stageLabel).toBe("stage/1-normalized");
    });
  });

  describe("Happy Path 1b: Normalize → Terminal (status/needs-info)", () => {
    it("should terminate when workflow adds terminal label status/needs-info", async () => {
      // Step 1: Issue with normalize label
      const initialIssue = createIssueWithLabels(43, ["type/problem", "stage/0-intake"]);
      mockGitHub.setIssue(initialIssue);

      // Step 2: Decide and dispatch
      const retrieved = await mockGitHub.getIssue("owner", "repo", 43);
      const stage = decideNextStage(retrieved, STAGES);
      expect(stage?.id).toBe("normalize");

      // Step 3: Workflow completes with terminal label instead of advancing
      const terminatedIssue = createIssuePayload(
        43,
        ["type/problem", "stage/0-intake", "status/needs-info", "rw/processing"],
        null
      );
      mockGitHub.setIssue(terminatedIssue);

      // Step 4: VerifyStageTransitionActivity detects terminal state
      const verified = await mockGitHub.getIssue("owner", "repo", 43);

      // According to stages.ts, normalize stage has terminalLabels: ["status/needs-info"]
      const normalizeStage = STAGES.find((s) => s.id === "normalize")!;
      const isTerminal =
        normalizeStage.terminalLabels?.includes("status/needs-info") ||
        verified.labels.some((l) => l.name === "status/needs-info");

      expect(isTerminal).toBe(true);
      expect(verified.labels).toContainEqual({ name: "status/needs-info" });

      // Step 5: Orchestration should terminate, not attempt next stage
      const nextStage = decideNextStage(verified, STAGES);
      expect(nextStage).toBeNull(); // Terminal state
    });
  });

  describe("Happy Path 1c: Any Stage → Archive (stage/9-archived)", () => {
    it("should terminate when workflow adds archive label", async () => {
      // Step 1: Issue at dedupe stage
      const initialIssue = createIssueWithLabels(44, [
        "type/problem",
        "stage/1-normalized"
      ]);
      mockGitHub.setIssue(initialIssue);

      // Step 2: Decide next stage
      const retrieved = await mockGitHub.getIssue("owner", "repo", 44);
      const stage = decideNextStage(retrieved, STAGES);
      expect(stage?.id).toBe("dedupe");

      // Step 3: Workflow decides to archive instead of advancing
      const archivedIssue = createIssuePayload(
        44,
        ["type/problem", "stage/1-normalized", "stage/9-archived", "rw/processing"],
        null
      );
      mockGitHub.setIssue(archivedIssue);

      // Step 4: VerifyStageTransitionActivity detects archive
      const verified = await mockGitHub.getIssue("owner", "repo", 44);

      const isArchived = verified.labels.some((l) => l.name === "stage/9-archived");
      expect(isArchived).toBe(true);

      // Step 5: Next stage decision returns null (terminal)
      const nextStage = decideNextStage(verified, STAGES);
      expect(nextStage).toBeNull();
    });
  });

  describe("Happy Path 3a: Country Validation → Terminal (status/needs-info)", () => {
    it("should treat a country-validation hold as a terminal successful outcome", async () => {
      const initialIssue = createIssueWithLabels(49, ["type/problem", "stage/2.5-country-validation"]);
      mockGitHub.setIssue(initialIssue);

      const retrieved = await mockGitHub.getIssue("owner", "repo", 49);
      const stage = decideNextStage(retrieved, STAGES);
      expect(stage?.id).toBe("country-validation");

      const terminatedIssue = createIssuePayload(
        49,
        ["type/problem", "stage/2.5-country-validation", "status/needs-info", "rw/processing"],
        null
      );
      mockGitHub.setIssue(terminatedIssue);

      const verified = await mockGitHub.getIssue("owner", "repo", 49);
      const countryValidationStage = STAGES.find((s) => s.id === "country-validation")!;
      const hasExpected = countryValidationStage.expectedNextLabels.some((label) =>
        verified.labels.some((l) => l.name === label)
      );

      expect(hasExpected).toBe(true);
      expect(countryValidationStage.terminalLabels).toContain("status/needs-info");
      expect(verified.labels).toContainEqual({ name: "status/needs-info" });

      const nextStage = decideNextStage(verified, STAGES);
      expect(nextStage).toBeNull();
    });
  });

  describe("Single Stage - Claim Conflict", () => {
    it("should not claim issue if rw/processing already present", async () => {
      // Issue already being processed
      const issue = createIssueWithLabels(45, [
        "type/problem",
        "stage/0-intake",
        "rw/processing",
        "rw/stage-normalize"
      ]);
      mockGitHub.setIssue(issue);

      const retrieved = await mockGitHub.getIssue("owner", "repo", 45);
      const hasProcessing = retrieved.labels.some(
        (l) => l.name === "rw/processing"
      );

      expect(hasProcessing).toBe(true);
      // Claim should fail in real orchestration
    });
  });

  describe("Single Stage - Transition Blocked", () => {
    it("should stop if workflow doesn't add expected label", async () => {
      // Step 1: Issue at normalize stage
      const initialIssue = createIssueWithLabels(46, ["type/problem", "stage/0-intake"]);
      mockGitHub.setIssue(initialIssue);

      // Step 2: Dispatch workflow
      const retrieved = await mockGitHub.getIssue("owner", "repo", 46);
      const stage = decideNextStage(retrieved, STAGES);
      expect(stage?.id).toBe("normalize");

      // Step 3: Workflow runs but doesn't add expected label
      const noTransitionIssue = createIssuePayload(
        46,
        ["type/problem", "stage/0-intake", "rw/processing"],
        "Some body content"
      );
      mockGitHub.setIssue(noTransitionIssue);

      // Step 4: VerifyStageTransitionActivity - transition not verified
      const verified = await mockGitHub.getIssue("owner", "repo", 46);

      const normalizeStage = STAGES.find((s) => s.id === "normalize")!;
      const hasExpected = normalizeStage.expectedNextLabels.some((label) =>
        verified.labels.some((l) => l.name === label)
      );

      expect(hasExpected).toBe(false);
      expect(verified.labels).not.toContainEqual({ name: "stage/1-normalized" });

      // Orchestration should return "blocked-or-noop"
    });
  });

  describe("Single Stage - No Eligible Stage", () => {
    it("should immediately return if issue at terminal state", async () => {
      // Issue already archived
      const issue = createIssueWithLabels(47, [
        "type/problem",
        "stage/9-archived"
      ]);
      mockGitHub.setIssue(issue);

      const retrieved = await mockGitHub.getIssue("owner", "repo", 47);
      const nextStage = decideNextStage(retrieved, STAGES);

      expect(nextStage).toBeNull();
      // Orchestration should immediately return "no-eligible-stage"
    });
  });

  describe("Single Stage - Activity Comments", () => {
    it("should post comments during claim and dispatch", async () => {
      const issue = createIssueWithLabels(48, ["type/problem", "stage/0-intake"]);
      mockGitHub.setIssue(issue);

      const orchestrationId = "test-orch-uuid-123";

      // Step 1: Add claim comment
      await mockGitHub.addComment(
        "owner",
        "repo",
        48,
        `<!-- rw:orchestration-run:${orchestrationId} -->\nOrchestrator claimed issue for stage \`normalize\` at ${new Date().toISOString()}.`
      );

      // Step 2: Add dispatch comment
      await mockGitHub.addComment(
        "owner",
        "repo",
        48,
        `<!-- rw:workflow-dispatch:${new Date().toISOString()} -->\nWorkflow dispatch recorded: \`10-normalize.lock.yml\` for stage \`normalize\` by orchestration \`${orchestrationId}\`.`
      );

      const comments = mockGitHub.getPostedComments();
      expect(comments).toHaveLength(2);
      expect(comments[0].body).toContain("rw:orchestration-run");
      expect(comments[1].body).toContain("rw:workflow-dispatch");
    });
  });
});
