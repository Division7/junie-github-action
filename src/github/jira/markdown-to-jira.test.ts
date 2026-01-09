import {describe, test, expect} from "bun:test";
import {convertMarkdownToADF} from "./markdown-to-jira";

describe("convertMarkdownToADF", () => {
    test("returns valid ADF document structure", () => {
        const markdown = "Simple text";
        const result = convertMarkdownToADF(markdown);

        expect(result).toHaveProperty("type", "doc");
        expect(result).toHaveProperty("version", 1);
        expect(result).toHaveProperty("content");
        expect(Array.isArray(result.content)).toBe(true);
    });

    test("converts simple text to paragraph", () => {
        const markdown = "Simple text";
        const result = convertMarkdownToADF(markdown);

        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe("paragraph");
        expect(result.content[0].content).toBeDefined();
    });

    test("converts headers", () => {
        const markdown = "# H1\n## H2\n### H3";
        const result = convertMarkdownToADF(markdown);

        expect(result.type).toBe("doc");
        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content.some((node: any) => node.type === "heading")).toBe(true);
    });

    test("converts bold text", () => {
        const markdown = "This is **bold** text";
        const result = convertMarkdownToADF(markdown);

        expect(result.type).toBe("doc");
        expect(JSON.stringify(result)).toContain("strong");
    });

    test("converts inline code", () => {
        const markdown = "Use `console.log()` for debugging";
        const result = convertMarkdownToADF(markdown);

        expect(result.type).toBe("doc");
        expect(JSON.stringify(result)).toContain("code");
    });

    test("converts links", () => {
        const markdown = "[GitHub](https://github.com)";
        const result = convertMarkdownToADF(markdown);

        expect(result.type).toBe("doc");
        expect(JSON.stringify(result)).toContain("https://github.com");
    });

    test("converts complex example", () => {
        const markdown = `Result: Add Update User Route

### Summary
- Reviewed the project
- Located the target file at \`src/routes/users.ts\`

### Details
Check the [PR link](https://github.com/owner/repo/pull/123)`;

        const result = convertMarkdownToADF(markdown);

        expect(result.type).toBe("doc");
        expect(result.version).toBe(1);
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content.length).toBeGreaterThan(0);

        // Check that it contains expected content types
        const types = result.content.map((node: any) => node.type);
        expect(types).toContain("paragraph");
    });
});
