// @ts-ignore - no types available for jira2md
import * as jira2md from 'jira2md';

/**
 * Converts GitHub Markdown to Jira Wiki Markup using jira2md library
 *
 * @param markdown - Text in GitHub Markdown format
 * @returns Text in Jira Wiki Markup format
 */
export function convertMarkdownToJiraWikiMarkup(markdown: string): string {
    return jira2md.to_jira(markdown);
}
