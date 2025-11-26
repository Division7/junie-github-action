// ============================================================================
// GitHub Actions Bot Configuration
// ============================================================================

export const GITHUB_ACTIONS_BOT = {
    login: "github-actions[bot]",
    id: 41898282, // Official GitHub Actions bot ID
    type: "Bot" as const,
} as const;

// ============================================================================
// Actions and Triggers
// ============================================================================

export const RESOLVE_CONFLICTS_ACTION = "resolve-conflicts";

export const RESOLVE_CONFLICTS_TRIGGER_PHRASE = "resolve conflicts"

export const RESOLVE_CONFLICTS_TRIGGER_PHRASE_REGEXP = new RegExp(RESOLVE_CONFLICTS_TRIGGER_PHRASE)

export const WORKING_BRANCH_PREFIX = "junie/";

export const DEFAULT_TRIGGER_PHRASE = "@junie";

// ============================================================================
// Templates and Messages
// ============================================================================

export const INIT_COMMENT_BODY = "Hey, it's Junie by JetBrains! I started working..."

export const PR_BODY_TEMPLATE = (junieBody: string, issueId?: number) => `
 ## 📌 Hey! This PR was made for you with Junie, the coding agent by JetBrains **Early Access Preview**

It's still learning, developing, and might make mistakes. Please make sure you review the changes before you accept them.
We'd love your feedback — join our Discord to share bugs, ideas: [here](https://jb.gg/junie/github).

${issueId ? `- 🔗 **Issue:** Fixes: #${issueId}` : ""}

### 📊 Junie Summary:
${junieBody}
`

export const PR_TITLE_TEMPLATE = (junieTitle: string) =>
    `[Junie]: ${junieTitle}`

export const COMMIT_MESSAGE_TEMPLATE = (junieTitle: string, issueId?: number) =>
    `${issueId ? `[issue-${issueId}]\n\n` : ""}${junieTitle}`;

// ============================================================================
// Feedback Comments
// ============================================================================

export const SUCCESS_FEEDBACK_COMMENT = "Junie is successful finished!"

export const ERROR_FEEDBACK_COMMENT_TEMPLATE = (details: string, jobLink: string) => `Junie is failed!

Details: ${details}

${jobLink}
`

export const PR_CREATED_FEEDBACK_COMMENT_TEMPLATE = (prLink: string) => `${SUCCESS_FEEDBACK_COMMENT}\n PR link: ${prLink}`

export const MANUALLY_PR_CREATE_FEEDBACK_COMMENT_TEMPLATE = (createPRLink: string) => `${SUCCESS_FEEDBACK_COMMENT}\n\nYou can create a PR manually: [Create Pull Request](${createPRLink})`

export const COMMIT_PUSHED_FEEDBACK_COMMENT_TEMPLATE = (commitSHA: string, junieTitle: string, junieBody: string) => `${SUCCESS_FEEDBACK_COMMENT}\n\n ${junieTitle}\n${junieBody} Commit sha: ${commitSHA}`

export const SUCCESS_FEEDBACK_COMMENT_WITH_RESULT = (junieTitle: string, junieBody: string) => `${SUCCESS_FEEDBACK_COMMENT}\n\nResult: ${junieTitle} \n ${junieBody}`
