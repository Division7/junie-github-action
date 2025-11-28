import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from "bun:test";
import {
  writeInitialFeedbackComment,
  writeFinishFeedbackComment,
  type FinishFeedbackData,
} from "../src/github/operations/comments/feedback";
import {
  mockIssueCommentContext,
  mockPullRequestCommentContext,
  mockPullRequestReviewCommentContext,
} from "./mockContext";
import type { Octokit } from "@octokit/rest";
import * as core from "@actions/core";
import * as clientModule from "../src/github/api/client";
import {GitHubContext} from "../src/github/context";

describe("Comment Feedback Operations", () => {
  let createCommentSpy: any;
  let updateCommentSpy: any;
  let createReplyForReviewCommentSpy: any;
  let updateReviewCommentSpy: any;
  let setOutputSpy: any;
  let createOctokitSpy: any;
  let mockOctokit: Octokit;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        issues: {
          createComment: mock(async () => ({ data: { id: 12345 } })),
          updateComment: mock(async () => ({ data: { id: 12345 } })),
        },
        pulls: {
          createReplyForReviewComment: mock(async () => ({ data: { id: 67890 } })),
          updateReviewComment: mock(async () => ({ data: { id: 67890 } })),
        },
      },
    } as any;

    createCommentSpy = mockOctokit.rest.issues.createComment;
    updateCommentSpy = mockOctokit.rest.issues.updateComment;
    createReplyForReviewCommentSpy = mockOctokit.rest.pulls.createReplyForReviewComment;
    updateReviewCommentSpy = mockOctokit.rest.pulls.updateReviewComment;

    // Mock createOctokit to return our mock
    createOctokitSpy = spyOn(clientModule, "createOctokit").mockReturnValue(mockOctokit as any);

    setOutputSpy = spyOn(core, "setOutput").mockImplementation(() => {});
  });

  afterEach(() => {
    createOctokitSpy.mockRestore();
    setOutputSpy.mockRestore();
  });

  describe("writeInitialFeedbackComment", () => {
    test("should create comment on issue", async () => {
      const commentId = await writeInitialFeedbackComment(
        mockOctokit,
        mockIssueCommentContext
      );

      expect(commentId).toBe(12345);
      expect(createCommentSpy).toHaveBeenCalledTimes(1);
      const callArgs = createCommentSpy.mock.calls[0][0];
      expect(callArgs.owner).toBe("test-owner");
      expect(callArgs.repo).toBe("test-repo");
      expect(callArgs.issue_number).toBe(55);
      expect(callArgs.body).toContain("Junie");
      expect(setOutputSpy).toHaveBeenCalledWith("INIT_COMMENT_ID", 12345);
    });

    test("should create comment on PR", async () => {
      const commentId = await writeInitialFeedbackComment(
        mockOctokit,
        mockPullRequestCommentContext
      );

      expect(commentId).toBe(12345);
      expect(createCommentSpy).toHaveBeenCalledTimes(1);
      const callArgs = createCommentSpy.mock.calls[0][0];
      expect(callArgs.owner).toBe("test-owner");
      expect(callArgs.repo).toBe("test-repo");
      expect(callArgs.issue_number).toBe(100);
      expect(callArgs.body).toContain("Junie");
    });

    test("should create reply for review comment", async () => {
      const commentId = await writeInitialFeedbackComment(
        mockOctokit,
        mockPullRequestReviewCommentContext
      );

      expect(commentId).toBe(67890);
      expect(createReplyForReviewCommentSpy).toHaveBeenCalledTimes(1);
      const callArgs = createReplyForReviewCommentSpy.mock.calls[0][0];
      expect(callArgs.owner).toBe("test-owner");
      expect(callArgs.repo).toBe("test-repo");
      expect(callArgs.pull_number).toBe(200);
      expect(callArgs.comment_id).toBe(666);
      expect(callArgs.body).toContain("Junie");
    });

    test("should skip creating comment for events without entity number", async () => {
      const context = {
        ...mockIssueCommentContext,
        entityNumber: undefined,
        eventName: "workflow_dispatch" as const,
      } as GitHubContext;

      const commentId = await writeInitialFeedbackComment(mockOctokit, context);

      expect(commentId).toBeUndefined();
      expect(createCommentSpy).not.toHaveBeenCalled();
    });

    test("should include job run link in comment body", async () => {
      await writeInitialFeedbackComment(mockOctokit, mockIssueCommentContext);

      expect(createCommentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringMatching(
            /https:\/\/github\.com\/test-owner\/test-repo\/actions\/runs\/1234567890/
          ),
        })
      );
    });

    test("should handle API errors", async () => {
      createCommentSpy.mockRejectedValue(new Error("API Error"));

        expect(
            writeInitialFeedbackComment(mockOctokit, mockIssueCommentContext)
        ).rejects.toThrow("API Error");
    });

    test("should skip comment creation in silent mode", async () => {
      const silentModeContext = {
        ...mockIssueCommentContext,
        inputs: {
          ...mockIssueCommentContext.inputs,
          silentMode: true,
        },
      } as GitHubContext;

      const commentId = await writeInitialFeedbackComment(mockOctokit, silentModeContext);

      expect(commentId).toBeUndefined();
      expect(createCommentSpy).not.toHaveBeenCalled();
      expect(setOutputSpy).not.toHaveBeenCalled();
    });
  });

  describe("writeFinishFeedbackComment", () => {
    const baseFinishData: Omit<FinishFeedbackData, "isJobFailed" | "successData" | "failureData"> = {
      initCommentId: "12345",
      githubToken: "test-token",
      parsedContext: mockIssueCommentContext,
    };

    test("should update comment with success for COMMIT_CHANGES", async () => {
      const data: FinishFeedbackData = {
        ...baseFinishData,
        isJobFailed: false,
        successData: {
          actionToDo: "COMMIT_CHANGES",
          commitSHA: "abc123def456",
          junieTitle: "Fixed bug",
          junieSummary: "Applied fix to login function",
        },
      };

      await writeFinishFeedbackComment(data);

      expect(updateCommentSpy).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        comment_id: 12345,
        body: expect.stringContaining("abc123def456"),
      });
    });

    test("should update comment with success for CREATE_PR", async () => {
      const data: FinishFeedbackData = {
        ...baseFinishData,
        isJobFailed: false,
        successData: {
          actionToDo: "CREATE_PR",
          prLink: "https://github.com/test-owner/test-repo/pull/300",
          junieTitle: "Fixed bug",
          junieSummary: "Created PR with fix",
        },
      };

      await writeFinishFeedbackComment(data);

      expect(updateCommentSpy).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        comment_id: 12345,
        body: expect.stringContaining("https://github.com/test-owner/test-repo/pull/300"),
      });
    });

    test("should update comment with manual PR creation link when no PR link", async () => {
      const data: FinishFeedbackData = {
        ...baseFinishData,
        isJobFailed: false,
        successData: {
          actionToDo: "CREATE_PR",
          workingBranch: "junie/issue-42",
          baseBranch: "main",
          junieTitle: "Fixed bug",
          junieSummary: "Created branch with fix",
        },
      };

      await writeFinishFeedbackComment(data);

      expect(updateCommentSpy).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        comment_id: 12345,
        body: expect.stringMatching(
          /compare\/main\.\.\.junie\/issue-42/
        ),
      });
    });

    test("should update comment with success for PUSH", async () => {
      const data: FinishFeedbackData = {
        ...baseFinishData,
        isJobFailed: false,
        successData: {
          actionToDo: "PUSH",
          junieTitle: "Pushed changes",
          junieSummary: "Unpushed commits have been pushed",
        },
      };

      await writeFinishFeedbackComment(data);

      expect(updateCommentSpy).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        comment_id: 12345,
        body: expect.stringContaining("Pushed changes"),
      });
    });

    test("should update comment with success for WRITE_COMMENT", async () => {
      const data: FinishFeedbackData = {
        ...baseFinishData,
        isJobFailed: false,
        successData: {
          actionToDo: "WRITE_COMMENT",
          junieTitle: "Analysis complete",
          junieSummary: "Here are my findings...",
        },
      };

      await writeFinishFeedbackComment(data);

      expect(updateCommentSpy).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        comment_id: 12345,
        body: expect.stringContaining("Analysis complete"),
      });
    });

    test("should update comment with failure message", async () => {
      const data: FinishFeedbackData = {
        ...baseFinishData,
        isJobFailed: true,
        failureData: {
          error: "Junie encountered an error",
        },
      };

      await writeFinishFeedbackComment(data);

      expect(updateCommentSpy).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        comment_id: 12345,
        body: expect.stringContaining("Junie encountered an error"),
      });
    });

    test("should include job link in failure message", async () => {
      const data: FinishFeedbackData = {
        ...baseFinishData,
        isJobFailed: true,
        failureData: {
          error: "Something went wrong",
        },
      };

      await writeFinishFeedbackComment(data);

      expect(updateCommentSpy).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        comment_id: 12345,
        body: expect.stringMatching(/actions\/runs\/1234567890/),
      });
    });

    test("should update review comment for review comment context", async () => {
      const data: FinishFeedbackData = {
        ...baseFinishData,
        parsedContext: mockPullRequestReviewCommentContext,
        isJobFailed: false,
        successData: {
          actionToDo: "WRITE_COMMENT",
          junieTitle: "Done",
          junieSummary: "Fixed the issue",
        },
      };

      await writeFinishFeedbackComment(data);

      expect(updateReviewCommentSpy).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        comment_id: 12345,
        body: expect.stringContaining("Done"),
      });
      expect(updateCommentSpy).not.toHaveBeenCalled();
    });

    test("should handle failure without error message", async () => {
      const data: FinishFeedbackData = {
        ...baseFinishData,
        isJobFailed: true,
        failureData: {},
      };

      await writeFinishFeedbackComment(data);

      expect(updateCommentSpy).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        comment_id: 12345,
        body: expect.stringContaining("Check job logs for more details"),
      });
    });
  });
});
