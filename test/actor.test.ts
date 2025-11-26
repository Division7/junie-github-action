import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { checkHumanActor } from "../src/github/validation/actor";
import { mockIssueCommentContext } from "./mockContext";
import type { Octokit } from "@octokit/rest";

describe("Actor Validation", () => {
  let getUserByUsernameSpy: any;
  let mockOctokit: Octokit;

  beforeEach(() => {
    mockOctokit = {
      users: {
        getByUsername: async () => ({ data: { type: "User" } }),
      },
    } as any;
  });

  afterEach(() => {
    if (getUserByUsernameSpy) {
      getUserByUsernameSpy.mockRestore();
    }
  });

  describe("checkHumanActor", () => {
    test("should pass for human actor (type: User)", async () => {
      getUserByUsernameSpy = spyOn(mockOctokit.users, "getByUsername").mockResolvedValue({
        data: { type: "User", login: "contributor-user" },
      } as any);

      expect(checkHumanActor(mockOctokit, mockIssueCommentContext)).resolves.toBeUndefined();
      expect(getUserByUsernameSpy).toHaveBeenCalledWith({
        username: "contributor-user",
      });
    });

    test("should reject bot actor (type: Bot)", async () => {
      getUserByUsernameSpy = spyOn(mockOctokit.users, "getByUsername").mockResolvedValue({
        data: { type: "Bot", login: "dependabot[bot]" },
      } as any);

      const context = { ...mockIssueCommentContext, actor: "dependabot[bot]" };

        expect(checkHumanActor(mockOctokit, context)).rejects.toThrow(/Workflow initiated by non-human actor: dependabot/);
    });

    test("should strip [bot] suffix from error message", async () => {
      getUserByUsernameSpy = spyOn(mockOctokit.users, "getByUsername").mockResolvedValue({
        data: { type: "Bot", login: "github-actions[bot]" },
      } as any);

      const context = { ...mockIssueCommentContext, actor: "github-actions[bot]" };

        expect(checkHumanActor(mockOctokit, context)).rejects.toThrow(
            /Workflow initiated by non-human actor: github-actions \(type: Bot\)/
        );
    });

    test("should call GitHub API with correct username", async () => {
      getUserByUsernameSpy = spyOn(mockOctokit.users, "getByUsername").mockResolvedValue({
        data: { type: "User", login: "alice" },
      } as any);

      const context = { ...mockIssueCommentContext, actor: "alice" };

      await checkHumanActor(mockOctokit, context);

      expect(getUserByUsernameSpy).toHaveBeenCalledWith({
        username: "alice",
      });
      expect(getUserByUsernameSpy).toHaveBeenCalledTimes(1);
    });

    test("should handle API errors gracefully", async () => {
      getUserByUsernameSpy = spyOn(mockOctokit.users, "getByUsername").mockRejectedValue(
        new Error("API rate limit exceeded")
      );

        expect(checkHumanActor(mockOctokit, mockIssueCommentContext)).rejects.toThrow(
            "API rate limit exceeded"
        );
    });

    test("should handle 404 user not found", async () => {
      getUserByUsernameSpy = spyOn(mockOctokit.users, "getByUsername").mockRejectedValue({
        status: 404,
        message: "Not Found",
      });

        expect(checkHumanActor(mockOctokit, mockIssueCommentContext)).rejects.toThrow();
    });

    test("should work with different actor names", async () => {
      const actors = ["john-doe", "jane_smith", "user123", "test-user-42"];

      for (const actor of actors) {
        getUserByUsernameSpy = spyOn(mockOctokit.users, "getByUsername").mockResolvedValue({
          data: { type: "User", login: actor },
        } as any);

        const context = { ...mockIssueCommentContext, actor };
          expect(checkHumanActor(mockOctokit, context)).resolves.toBeUndefined();

        getUserByUsernameSpy.mockRestore();
      }
    });
  });
});
