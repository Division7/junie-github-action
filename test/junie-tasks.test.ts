import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { prepareJunieTask } from "../src/github/junie/junie-tasks";
import {
  mockIssueOpenedContext,
  mockIssueCommentContext,
  mockPullRequestCommentContext,
  mockPullRequestOpenedContext,
  mockPullRequestReviewContext,
  mockPullRequestReviewCommentContext,
  createMockContext,
} from "./mockContext";
import type { BranchInfo } from "../src/github/operations/branch";
import * as core from "@actions/core";
import type {IssueCommentEvent} from "@octokit/webhooks-types";

describe("Junie Task Preparation", () => {
  let setOutputSpy: any;
  const mockBranchInfo: BranchInfo = {
    baseBranch: "main",
    workingBranch: "junie/test-branch",
    isNewBranch: true,
  };

  beforeEach(() => {
    setOutputSpy = spyOn(core, "setOutput").mockImplementation(() => {});
  });

  afterEach(() => {
    setOutputSpy.mockRestore();
  });

  describe("prepareJunieTask", () => {
    test("should create textTask when prompt is provided", async () => {
      const context = createMockContext({
        eventName: "workflow_dispatch",
        inputs: { prompt: "Fix all bugs in the codebase" },
        payload: {
          repository: mockIssueCommentContext.payload.repository,
        },
      });

      const task = await prepareJunieTask(context, mockBranchInfo);

      expect(task.textTask).toEqual({
        text: "Fix all bugs in the codebase",
      });
    });

    test("should create gitHubIssue task for issue event", async () => {
      const task = await prepareJunieTask(mockIssueOpenedContext, mockBranchInfo);

      expect(task.gitHubIssue).toEqual({
        url: "https://github.com/test-owner/test-repo/issues/42",
      });
    });

    test("should create gitHubIssue task for issue comment (not PR)", async () => {
      const task = await prepareJunieTask(mockIssueCommentContext, mockBranchInfo);

      expect(task.gitHubIssue).toEqual({
        url: "https://github.com/test-owner/test-repo/issues/55",
      });
    });

    test("should create gitHubPullRequestComment task for PR comment", async () => {
      const task = await prepareJunieTask(mockPullRequestCommentContext, mockBranchInfo);

      expect(task.gitHubPullRequestComment).toEqual({
        pullRequestUrl: "https://github.com/test-owner/test-repo/pull/100",
        url: "https://github.com/test-owner/test-repo/pull/100#issuecomment-888",
      });
    });

    test("should create gitHubPullRequest task for PR event", async () => {
      const task = await prepareJunieTask(mockPullRequestOpenedContext, mockBranchInfo);

      expect(task.gitHubPullRequest).toEqual({
        url: "https://github.com/test-owner/test-repo/pull/200",
      });
    });

    test("should create gitHubPullRequestReview task for review event", async () => {
      const task = await prepareJunieTask(mockPullRequestReviewContext, mockBranchInfo);

      expect(task.gitHubPullRequestReview).toEqual({
        url: "https://github.com/test-owner/test-repo/pull/200#pullrequestreview-777",
      });
    });

    test("should create gitHubPullRequestComment task for review comment", async () => {
      const task = await prepareJunieTask(mockPullRequestReviewCommentContext, mockBranchInfo);

      expect(task.gitHubPullRequestComment).toEqual({
        pullRequestUrl: "https://github.com/test-owner/test-repo/pull/200",
        url: "https://github.com/test-owner/test-repo/pull/200#discussion_r666",
      });
    });

    test("should create mergeTask when resolveConflicts is enabled", async () => {
      const context = createMockContext({
        eventName: "workflow_dispatch",
        inputs: { resolveConflicts: true },
        payload: {
          repository: mockIssueCommentContext.payload.repository,
        },
      });

      const task = await prepareJunieTask(context, mockBranchInfo);

      expect(task.mergeTask).toEqual({
        branch: "main",
        type: "merge",
      });
    });

    test("should create mergeTask when resolve conflicts trigger phrase is present", async () => {
      const context = createMockContext({
        eventName: "issue_comment",
        eventAction: "created",
        payload: {
          ...mockIssueCommentContext.payload,
          comment: {
            ...(mockIssueCommentContext.payload as IssueCommentEvent).comment,
            body: "Please resolve conflicts in this PR",
          },
        },
      });

      const task = await prepareJunieTask(context, mockBranchInfo);

      expect(task.mergeTask).toEqual({
        branch: "main",
        type: "merge",
      });
    });

    test("should combine multiple task types", async () => {
      const context = createMockContext({
        eventName: "issue_comment",
        eventAction: "created",
        isPR: false,
        inputs: {
          prompt: "Additional instructions",
          resolveConflicts: false,
        },
        payload: {
          ...mockIssueCommentContext.payload,
        },
      });

      const task = await prepareJunieTask(context, mockBranchInfo);

      expect(task.textTask).toEqual({
        text: "Additional instructions",
      });
      expect(task.gitHubIssue).toEqual({
        url: "https://github.com/test-owner/test-repo/issues/55",
      });
    });

    test("should output task as JSON", async () => {
      const context = createMockContext({
        eventName: "workflow_dispatch",
        inputs: { prompt: "Test prompt" },
        payload: {
          repository: mockIssueCommentContext.payload.repository,
        },
      });

      const task = await prepareJunieTask(context, mockBranchInfo);

      expect(setOutputSpy).toHaveBeenCalledWith(
        "EJ_TASK",
        JSON.stringify(task)
      );
    });

    test("should create empty task when no conditions are met", async () => {
      const context = createMockContext({
        eventName: "workflow_dispatch",
        inputs: { prompt: "" },
      });

      const task = await prepareJunieTask(context, mockBranchInfo);

      expect(task).toEqual({});
    });

    test("should handle PR comment with custom prompt", async () => {
      const context = createMockContext({
        eventName: "issue_comment",
        eventAction: "created",
        isPR: true,
        inputs: { prompt: "Focus on security issues" },
        payload: mockPullRequestCommentContext.payload,
      });

      const task = await prepareJunieTask(context, mockBranchInfo);

      expect(task.textTask).toEqual({
        text: "Focus on security issues",
      });
      expect(task.gitHubPullRequestComment).toBeDefined();
    });

    test("should use correct base branch from branchInfo", async () => {
      const customBranchInfo: BranchInfo = {
        baseBranch: "develop",
        workingBranch: "junie/feature",
        isNewBranch: true,
      };

      const context = createMockContext({
        eventName: "workflow_dispatch",
        inputs: { resolveConflicts: true },
        payload: {
          repository: mockIssueCommentContext.payload.repository,
        },
      });

      const task = await prepareJunieTask(context, customBranchInfo);

      expect(task.mergeTask).toEqual({
        branch: "develop",
        type: "merge",
      });
    });

    test("should handle all task types together", async () => {
      const context = createMockContext({
        eventName: "pull_request_review",
        eventAction: "submitted",
        isPR: true,
        entityNumber: 200,
        inputs: {
          prompt: "Custom instructions",
          resolveConflicts: true,
        },
        payload: mockPullRequestReviewContext.payload,
      });

      const task = await prepareJunieTask(context, mockBranchInfo);

      expect(task.textTask).toBeDefined();
      expect(task.gitHubPullRequestReview).toBeDefined();
      expect(task.mergeTask).toBeDefined();
      expect(Object.keys(task).length).toBe(3);
    });
  });
});
