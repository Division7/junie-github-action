import {describe, expect, test} from "bun:test";
import {checkContainsTrigger, escapeRegExp} from "../src/github/validation/trigger";
import {
    createMockContext,
    mockIssueAssignedContext,
    mockIssueCommentContext,
    mockIssueLabeledContext,
    mockIssueOpenedContext,
    mockPullRequestCommentContext,
    mockPullRequestOpenedContext,
    mockPullRequestReviewCommentContext,
    mockPullRequestReviewContext,
} from "./mockContext";
import type {IssueCommentEvent, IssuesEvent, PullRequestEvent, PullRequestReviewEvent} from "@octokit/webhooks-types";

describe("Trigger Validation", () => {
  describe("escapeRegExp", () => {
    test("should escape special regex characters", () => {
      expect(escapeRegExp("@junify")).toBe("@junify");
      expect(escapeRegExp("$test")).toBe("\\$test");
      expect(escapeRegExp("test.")).toBe("test\\.");
      expect(escapeRegExp("[bot]")).toBe("\\[bot\\]");
      expect(escapeRegExp("(group)")).toBe("\\(group\\)");
      expect(escapeRegExp("a*b+c?")).toBe("a\\*b\\+c\\?");
    });
  });

  describe("checkContainsTrigger", () => {
    describe("assignee trigger", () => {
      test("should trigger when issue is assigned to trigger user", () => {
        const context = createMockContext({
          eventName: "issues",
          eventAction: "assigned",
          inputs: { assigneeTrigger: "junie-bot" },
          payload: {
            ...mockIssueAssignedContext.payload,
            assignee: { login: "junie-bot" },
          },
        });

        expect(checkContainsTrigger(context)).toBe(true);
      });

      test("should handle @ prefix in trigger user", () => {
        const context = createMockContext({
          eventName: "issues",
          eventAction: "assigned",
          inputs: { assigneeTrigger: "@junify-bot" },
          payload: {
            ...mockIssueAssignedContext.payload,
            assignee: { login: "junify-bot" },
          },
        });

        expect(checkContainsTrigger(context)).toBe(true);
      });

      test("should not trigger when assigned to different user", () => {
        const context = createMockContext({
          eventName: "issues",
          eventAction: "assigned",
          inputs: { assigneeTrigger: "junie-bot" },
          payload: {
            ...mockIssueAssignedContext.payload,
            assignee: { login: "other-user" },
          },
        });

        expect(checkContainsTrigger(context)).toBe(false);
      });

      test("should not trigger when assignee is missing", () => {
        const context = createMockContext({
          eventName: "issues",
          eventAction: "assigned",
          inputs: { assigneeTrigger: "junie-bot" },
          payload: {
            ...mockIssueAssignedContext.payload,
            assignee: undefined,
          },
        });

        expect(checkContainsTrigger(context)).toBe(false);
      });
    });

    describe("label trigger", () => {
      test("should trigger when issue is labeled with trigger label", () => {
        const context = createMockContext({
          eventName: "issues",
          eventAction: "labeled",
          inputs: { labelTrigger: "junie" },
          payload: {
            ...mockIssueLabeledContext.payload,
            label: { name: "junie" },
          },
        });

        expect(checkContainsTrigger(context)).toBe(true);
      });

      test("should not trigger when labeled with different label", () => {
        const context = createMockContext({
          eventName: "issues",
          eventAction: "labeled",
          inputs: { labelTrigger: "junie" },
          payload: {
            ...mockIssueLabeledContext.payload,
            label: { name: "bug" },
          },
        });

        expect(checkContainsTrigger(context)).toBe(false);
      });

      test("should not trigger when label is missing", () => {
        const context = createMockContext({
          eventName: "issues",
          eventAction: "labeled",
          inputs: { labelTrigger: "junie" },
          payload: {
            ...mockIssueLabeledContext.payload,
            label: undefined,
          },
        });

        expect(checkContainsTrigger(context)).toBe(false);
      });
    });

    describe("trigger phrase in issue", () => {
      test("should trigger when phrase is in issue body", () => {
        const context = createMockContext({
          eventName: "issues",
          eventAction: "opened",
          inputs: { triggerPhrase: "@junify" },
          payload: {
            ...mockIssueOpenedContext.payload,
            issue: {
              ...(mockIssueOpenedContext.payload as IssuesEvent).issue,
              body: "@junify please help with this bug",
              title: "Bug report",
            },
          },
        });

        expect(checkContainsTrigger(context)).toBe(true);
      });

      test("should trigger when phrase is in issue title", () => {
        const context = createMockContext({
          eventName: "issues",
          eventAction: "opened",
          inputs: { triggerPhrase: "@junify" },
          payload: {
            ...mockIssueOpenedContext.payload,
            issue: {
              ...(mockIssueOpenedContext.payload as IssuesEvent).issue,
              body: "Description here",
              title: "@junify Fix login bug",
            },
          },
        });

        expect(checkContainsTrigger(context)).toBe(true);
      });

      test("should trigger when phrase is at start of text", () => {
        const context = createMockContext({
          eventName: "issues",
          eventAction: "opened",
          inputs: { triggerPhrase: "@junify" },
          payload: {
            ...mockIssueOpenedContext.payload,
            issue: {
              ...(mockIssueOpenedContext.payload as IssuesEvent).issue,
              body: "@junify help",
            },
          },
        });

        expect(checkContainsTrigger(context)).toBe(true);
      });

      test("should trigger when phrase is at end of text", () => {
        const context = createMockContext({
          eventName: "issues",
          eventAction: "opened",
          inputs: { triggerPhrase: "@junify" },
          payload: {
            ...mockIssueOpenedContext.payload,
            issue: {
              ...(mockIssueOpenedContext.payload as IssuesEvent).issue,
              body: "Please help @junify",
            },
          },
        });

        expect(checkContainsTrigger(context)).toBe(true);
      });

      test("should trigger with punctuation after phrase", () => {
        const testCases = [
          "@junify, can you help?",
          "@junify. Fix this bug",
          "@junify! Please review",
          "@junify? What do you think",
          "@junify; also check this",
          "@junify: review needed",
        ];

        testCases.forEach((body) => {
          const context = createMockContext({
            eventName: "issues",
            eventAction: "opened",
            inputs: { triggerPhrase: "@junify" },
            payload: {
              ...mockIssueOpenedContext.payload,
              issue: {
                ...(mockIssueOpenedContext.payload as IssuesEvent).issue,
                body,
              },
            },
          });

          expect(checkContainsTrigger(context)).toBe(true);
        });
      });

      test("should not trigger when phrase is part of another word", () => {
        const testCases = [
          "email@junify.com",
          "user@junify-test",
          "contact@junifybot.io",
        ];

        testCases.forEach((body) => {
          const context = createMockContext({
            eventName: "issues",
            eventAction: "opened",
            inputs: { triggerPhrase: "@junify" },
            payload: {
              ...mockIssueOpenedContext.payload,
              issue: {
                ...(mockIssueOpenedContext.payload as IssuesEvent).issue,
                body,
              },
            },
          });

          expect(checkContainsTrigger(context)).toBe(false);
        });
      });

      test("should not trigger when phrase is missing", () => {
        const context = createMockContext({
          eventName: "issues",
          eventAction: "opened",
          inputs: { triggerPhrase: "@junify" },
          payload: {
            ...mockIssueOpenedContext.payload,
            issue: {
              ...(mockIssueOpenedContext.payload as IssuesEvent).issue,
              body: "This is a regular bug report",
              title: "Regular bug",
            },
          },
        });

        expect(checkContainsTrigger(context)).toBe(false);
      });

      test("should handle empty body and title", () => {
        const context = createMockContext({
          eventName: "issues",
          eventAction: "opened",
          inputs: { triggerPhrase: "@junify" },
          payload: {
            ...mockIssueOpenedContext.payload,
            issue: {
              ...(mockIssueOpenedContext.payload as IssuesEvent).issue,
              body: "",
              title: "",
            },
          },
        });

        expect(checkContainsTrigger(context)).toBe(false);
      });

      test("should handle null body", () => {
        const context = createMockContext({
          eventName: "issues",
          eventAction: "opened",
          inputs: { triggerPhrase: "@junify" },
          payload: {
            ...mockIssueOpenedContext.payload,
            issue: {
              ...(mockIssueOpenedContext.payload as IssuesEvent).issue,
              body: null,
              title: "Test",
            },
          },
        });

        expect(checkContainsTrigger(context)).toBe(false);
      });
    });

    describe("trigger phrase in PR", () => {
      test("should trigger when phrase is in PR body", () => {
        const context = createMockContext({
          eventName: "pull_request",
          eventAction: "opened",
          inputs: { triggerPhrase: "@junify" },
          payload: {
            ...mockPullRequestOpenedContext.payload,
            pull_request: {
              ...(mockPullRequestOpenedContext.payload as PullRequestEvent).pull_request,
              body: "@junify please review this PR",
            },
          },
        });

        expect(checkContainsTrigger(context)).toBe(true);
      });

      test("should trigger when phrase is in PR title", () => {
        const context = createMockContext({
          eventName: "pull_request",
          eventAction: "opened",
          inputs: { triggerPhrase: "@junify" },
          payload: {
            ...mockPullRequestOpenedContext.payload,
            pull_request: {
                ...(mockPullRequestOpenedContext.payload as PullRequestEvent).pull_request,
              title: "@junify Add new feature",
              body: "Description",
            },
          },
        });

        expect(checkContainsTrigger(context)).toBe(true);
      });
    });

    describe("trigger phrase in comments", () => {
      test("should trigger on issue comment", () => {
          expect(checkContainsTrigger(mockIssueCommentContext)).toBe(true);
      });

      test("should trigger on PR comment", () => {
          expect(checkContainsTrigger(mockPullRequestCommentContext)).toBe(true);
      });

      test("should trigger on PR review", () => {
          expect(checkContainsTrigger(mockPullRequestReviewContext)).toBe(true);
      });

      test("should trigger on PR review comment", () => {
          expect(checkContainsTrigger(mockPullRequestReviewCommentContext)).toBe(true);
      });

      test("should not trigger when comment lacks trigger phrase", () => {
        const context = createMockContext({
          eventName: "issue_comment",
          eventAction: "created",
          inputs: { triggerPhrase: "@junify" },
          payload: {
            ...mockIssueCommentContext.payload,
            comment: {
              ...(mockIssueCommentContext.payload as IssueCommentEvent).comment,
              body: "This is a regular comment without the trigger",
            },
          },
        });

        expect(checkContainsTrigger(context)).toBe(false);
      });
    });

    describe("custom trigger phrases", () => {
      test("should work with custom trigger phrase", () => {
        const context = createMockContext({
          eventName: "issue_comment",
          eventAction: "created",
          inputs: { triggerPhrase: "/ai" },
          payload: {
            ...mockIssueCommentContext.payload,
            comment: {
                ...(mockIssueCommentContext.payload as IssueCommentEvent).comment,
              body: "/ai help with this",
            },
          },
        });

        expect(checkContainsTrigger(context)).toBe(true);
      });

      test("should escape special characters in custom trigger", () => {
        const context = createMockContext({
          eventName: "issue_comment",
          eventAction: "created",
          inputs: { triggerPhrase: "$bot" },
          payload: {
            ...mockIssueCommentContext.payload,
            comment: {
              ...(mockIssueCommentContext.payload as IssueCommentEvent).comment,
              body: "$bot please review",
            },
          },
        });

        expect(checkContainsTrigger(context)).toBe(true);
      });
    });

    describe("PR review comment with edited action", () => {
      test("should trigger on edited review", () => {
        const context = createMockContext({
          eventName: "pull_request_review",
          eventAction: "edited",
          inputs: { triggerPhrase: "@junify" },
          payload: {
            ...mockPullRequestReviewContext.payload,
            action: "edited",
            review: {
              ...(mockPullRequestReviewContext.payload as PullRequestReviewEvent).review,
              body: "@junify check this again",
            },
          },
        });

        expect(checkContainsTrigger(context)).toBe(true);
      });
    });
  });
});
