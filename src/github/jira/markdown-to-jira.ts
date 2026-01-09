import { markdownToAdf } from 'marklassian';

/**
 * Converts GitHub Markdown to Atlassian Document Format (ADF) using marklassian library
 *
 * @param markdown - Text in GitHub Markdown format
 * @returns ADF document object
 */
export function convertMarkdownToADF(markdown: string): any {
    return markdownToAdf(markdown);
}
