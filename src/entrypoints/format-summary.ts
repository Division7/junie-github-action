/**
 * Formats Junie execution summary for GitHub Actions Job Summary
 * Reads JSON output from Junie and generates a markdown report
 */

interface JunieOutput {
  title?: string;
  summary?: string;
  error?: string;
  duration_ms?: number;
  [key: string]: any;
}

/**
 * Formats Junie output into a markdown summary for GitHub Actions
 */
export function formatJunieSummary(
  junieOutput: JunieOutput,
  actionToDo?: string,
  commitSha?: string,
  prUrl?: string,
  branchName?: string,
): string {
  let markdown = "## 🤖 Junie Execution Report\n\n";

  // Add title if available
  if (junieOutput.title) {
    markdown += `### ${junieOutput.title}\n\n`;
  }

  // Add summary section
  if (junieOutput.summary) {
    markdown += `${junieOutput.summary}\n\n`;
  }

  // Add error section if present
  if (junieOutput.error) {
    markdown += `### ❌ Error\n\n\`\`\`\n${junieOutput.error}\n\`\`\`\n\n`;
  }

  // Add execution details
  markdown += "---\n\n### 📊 Execution Details\n\n";
  markdown += "| Detail | Value |\n";
  markdown += "|--------|-------|\n";

  if (actionToDo) {
    const actionEmoji = {
      COMMIT_CHANGES: "💾",
      CREATE_PR: "🔀",
      PUSH: "⬆️",
      WRITE_COMMENT: "💬",
    }[actionToDo] || "📝";

    markdown += `| Action | ${actionEmoji} ${actionToDo} |\n`;
  }

  if (branchName) {
    markdown += `| Branch | \`${branchName}\` |\n`;
  }

  if (commitSha) {
    markdown += `| Commit | \`${commitSha.substring(0, 7)}\` |\n`;
  }

  if (prUrl) {
    markdown += `| Pull Request | [View PR](${prUrl}) |\n`;
  }

  if (junieOutput.duration_ms) {
    const durationSec = (junieOutput.duration_ms / 1000).toFixed(1);
    markdown += `| Duration | ${durationSec}s |\n`;
  }

  markdown += "\n";

  return markdown;
}
