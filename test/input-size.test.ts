import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { validateInputSize } from "../src/github/validation/input-size";
import * as core from "@actions/core";

describe("Input Size Validation", () => {
  let coreInfoSpy: any;
  let coreErrorSpy: any;

  beforeEach(() => {
    coreInfoSpy = spyOn(core, "info").mockImplementation(() => {});
    coreErrorSpy = spyOn(core, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    coreInfoSpy.mockRestore();
    coreErrorSpy.mockRestore();
  });

  describe("validateInputSize", () => {
    test("should pass for input within size limit", () => {
      const input = "This is a valid prompt".repeat(100); // ~2200 chars

      expect(() => validateInputSize(input)).not.toThrow();
      expect(coreInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("Input size validation passed")
      );
    });

    test("should pass for input exactly at size limit", () => {
      const input = "a".repeat(19000);

      expect(() => validateInputSize(input)).not.toThrow();
      expect(coreInfoSpy).toHaveBeenCalledWith(
        "✓ Input size validation passed: 19000/19000 characters"
      );
    });

    test("should throw error for input exceeding size limit", () => {
      const input = "a".repeat(19001);

      expect(() => validateInputSize(input)).toThrow(
        /Input "prompt" is too large: 19001 characters \(maximum: 19000\)/
      );
      expect(coreErrorSpy).toHaveBeenCalled();
    });

    test("should throw error for very large input", () => {
      const input = "a".repeat(50000);

      expect(() => validateInputSize(input)).toThrow(
        /Input "prompt" is too large: 50000 characters \(maximum: 19000\)/
      );
    });

    test("should include custom input name in error message", () => {
      const input = "a".repeat(20000);

      expect(() => validateInputSize(input, "description")).toThrow(
        /Input "description" is too large/
      );
      expect(() => validateInputSize(input, "description")).toThrow(
        /Please reduce the size of your description and try again/
      );
    });

    test("should mention GitHub workflow_dispatch limit in error", () => {
      const input = "a".repeat(20000);

      expect(() => validateInputSize(input)).toThrow(
        /GitHub workflow_dispatch inputs are limited to 20KB/
      );
    });

    test("should handle empty string", () => {
      const input = "";

      expect(() => validateInputSize(input)).not.toThrow();
      expect(coreInfoSpy).toHaveBeenCalledWith(
        "✓ Input size validation passed: 0/19000 characters"
      );
    });

    test("should handle multi-line input", () => {
      const input = "Line 1\nLine 2\nLine 3\n".repeat(500); // ~11500 chars

      expect(() => validateInputSize(input)).not.toThrow();
    });

    test("should handle unicode characters correctly", () => {
      const input = "🎯".repeat(5000); // Each emoji is 2 chars in JS, so 10000 chars

      expect(() => validateInputSize(input)).not.toThrow();
      expect(coreInfoSpy).toHaveBeenCalledWith(
        "✓ Input size validation passed: 10000/19000 characters"
      );
    });

    test("should handle unicode characters exceeding limit", () => {
      const input = "🎯".repeat(10000); // 20000 chars

      expect(() => validateInputSize(input)).toThrow(
        /Input "prompt" is too large: 20000 characters/
      );
    });

    test("should use default input name 'prompt' when not provided", () => {
      const input = "a".repeat(20000);

      expect(() => validateInputSize(input)).toThrow(
        /Input "prompt" is too large/
      );
    });

    test("should log actual size in success message", () => {
      const input = "test".repeat(1000); // 4000 chars

      validateInputSize(input, "task");

      expect(coreInfoSpy).toHaveBeenCalledWith(
        "✓ Input size validation passed: 4000/19000 characters"
      );
    });

    test("should handle input at boundary (19000 chars)", () => {
      const input = "x".repeat(19000);

      expect(() => validateInputSize(input)).not.toThrow();
    });

    test("should fail at boundary + 1 (19001 chars)", () => {
      const input = "x".repeat(19001);

      expect(() => validateInputSize(input)).toThrow();
    });

    test("should handle special characters", () => {
      const input = "!@#$%^&*()_+-={}[]|\\:\";<>?,./".repeat(500); // ~14500 chars

      expect(() => validateInputSize(input)).not.toThrow();
    });

    test("should include helpful suggestion in error message", () => {
      const input = "a".repeat(25000);

      expect(() => validateInputSize(input, "prompt")).toThrow(
        /Please reduce the size of your prompt and try again/
      );
    });
  });
});
