import {describe, test, expect} from "bun:test";
import {convertMarkdownToJiraWikiMarkup} from "./markdown-to-jira";

describe("convertMarkdownToJiraWikiMarkup", () => {
    test("converts headers", () => {
        const markdown = `# H1
## H2
### H3
#### H4`;
        const expected = `h1. H1
h2. H2
h3. H3
h4. H4`;
        expect(convertMarkdownToJiraWikiMarkup(markdown)).toBe(expected);
    });

    test("converts links", () => {
        const markdown = "[GitHub](https://github.com)";
        const expected = "[GitHub|https://github.com]";
        expect(convertMarkdownToJiraWikiMarkup(markdown)).toBe(expected);
    });

    test("converts bold text", () => {
        const markdown = "This is **bold** text";
        const expected = "This is *bold* text";
        expect(convertMarkdownToJiraWikiMarkup(markdown)).toBe(expected);
    });

    test("converts inline code", () => {
        const markdown = "Use `console.log()` for debugging";
        const expected = "Use {{console.log()}} for debugging";
        expect(convertMarkdownToJiraWikiMarkup(markdown)).toBe(expected);
    });

    test("converts code blocks", () => {
        const markdown = "```javascript\nconst x = 1;\n```";
        const expected = "{code:javascript}\nconst x = 1;\n{code}";
        expect(convertMarkdownToJiraWikiMarkup(markdown)).toBe(expected);
    });

    test("converts unordered lists", () => {
        const markdown = `- Item 1
- Item 2
* Item 3`;
        const expected = `- Item 1
- Item 2
* Item 3`;
        expect(convertMarkdownToJiraWikiMarkup(markdown)).toBe(expected);
    });

    test("converts complex example", () => {
        const markdown = `Result: Add Update User Route

### Summary
- Reviewed the project
- Located the target file at \`src/routes/users.ts\`

### Details
Check the [PR link](https://github.com/owner/repo/pull/123)`;

        const expected = `Result: Add Update User Route

h3. Summary
- Reviewed the project
- Located the target file at {{src/routes/users.ts}}

h3. Details
Check the [PR link|https://github.com/owner/repo/pull/123]`;

        expect(convertMarkdownToJiraWikiMarkup(markdown)).toBe(expected);
    });
});
