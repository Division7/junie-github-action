import {describe, expect, test} from "bun:test";
import {detectJunieTriggerPhrase} from "../src/github/validation/trigger";
import {createMockContext, mockPullRequestCommentContext} from "./mockContext";
import type {IssuesEvent, IssueCommentEvent} from "@octokit/webhooks-types";

describe("Trigger Validation - case insensitive", () => {
  test("should match trigger phrase in issue body regardless of case", () => {
    const context = createMockContext({
      eventName: "issues",
      eventAction: "opened",
      inputs: { triggerPhrase: "@junie-agent" },
      payload: {
        ...(createMockContext({eventName: "issues", eventAction: "opened"}).payload as any),
        issue: {
          ...((createMockContext({eventName: "issues", eventAction: "opened"}).payload as IssuesEvent).issue),
          body: "@junie-agent please help",
          title: "regular title"
        }
      }
    });

    expect(detectJunieTriggerPhrase(context)).toBe(true);
  });

  test("should match trigger phrase in issue title regardless of case", () => {
    const context = createMockContext({
      eventName: "issues",
      eventAction: "opened",
      inputs: { triggerPhrase: "@junie-agent" },
      payload: {
        ...(createMockContext({eventName: "issues", eventAction: "opened"}).payload as any),
        issue: {
          ...((createMockContext({eventName: "issues", eventAction: "opened"}).payload as IssuesEvent).issue),
          body: "no trigger here",
          title: "@junie-agent please"
        }
      }
    });

    expect(detectJunieTriggerPhrase(context)).toBe(true);
  });

  test("should match trigger phrase in comments regardless of case", () => {
    const context = createMockContext({
      eventName: "issue_comment",
      eventAction: "created",
      inputs: { triggerPhrase: "@junie-agent" },
      payload: {
        ...(mockPullRequestCommentContext.payload as any),
        comment: {
          ...((mockPullRequestCommentContext.payload as IssueCommentEvent).comment),
          body: "@junie-agent could you check this?"
        }
      }
    });

    expect(detectJunieTriggerPhrase(context)).toBe(true);
  });
});