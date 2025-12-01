import {
    GitHubContext,
    isIssueCommentEvent,
    isIssuesEvent,
    isPullRequestEvent,
    isPullRequestReviewCommentEvent,
    isPullRequestReviewEvent
} from "../context";
import {JunieTask} from "./types/junie";
import * as core from "@actions/core";
import {BranchInfo} from "../operations/branch";
import {isReviewOrCommentHasTrigger} from "../validation/trigger";
import {OUTPUT_VARS} from "../../constants/environment";
import {RESOLVE_CONFLICTS_TRIGGER_PHRASE_REGEXP} from "../../constants/github";
import {Octokits} from "../api/client";
import {GitHubPromptFormatter} from "./prompt-formatter";
import {validateInputSize} from "../validation/input-size";
import {downloadAttachmentsAndRewriteText} from "./attachment-downloader";
import {GraphQLGitHubDataFetcher} from "../api/graphql-data-fetcher";

async function setValidatedTextTask(junieTask: JunieTask, text: string, taskType: string): Promise<void> {
    // Download attachments and rewrite URLs in the text
    const textWithLocalAttachments = await downloadAttachmentsAndRewriteText(text);
    validateInputSize(textWithLocalAttachments, taskType);
    junieTask.textTask = {text: textWithLocalAttachments};
}

export async function prepareJunieTask(
    context: GitHubContext,
    branchInfo: BranchInfo,
    octokit: Octokits
) {
    const junieTask: JunieTask = {}
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;

    // Create fetcher and formatter instances
    const fetcher = new GraphQLGitHubDataFetcher(octokit);
    const formatter = new GitHubPromptFormatter();

    // Store the custom prompt to be used as base prompt in formatters
    const customPrompt = context.inputs.prompt || undefined;

    // Handle issue comment (not on PR)
    if (isIssueCommentEvent(context) && !context.isPR) {
        const issueNumber = context.payload.issue.number;

        // Single GraphQL query for all issue data
        const issueData = await fetcher.fetchIssueData(owner, repo, issueNumber);

        const promptText = formatter.formatIssueCommentPrompt(
            issueData,
            {
                body: context.payload.comment.body,
                author: context.payload.comment.user.login
            },
            customPrompt
        );
        await setValidatedTextTask(junieTask, promptText, "issue-comment");
    }

    // Handle issue event (opened/edited)
    if (isIssuesEvent(context)) {
        const issueNumber = context.payload.issue.number;

        // Single GraphQL query for all issue data
        const issueData = await fetcher.fetchIssueData(owner, repo, issueNumber);

        const promptText = formatter.formatIssuePrompt(issueData, customPrompt);
        await setValidatedTextTask(junieTask, promptText, "issue");
    }

    // Handle PR comment
    if (isIssueCommentEvent(context) && context.isPR) {
        const pullNumber = context.payload.issue.number;

        // Single GraphQL query for all PR data - much faster than 5 REST calls!
        const prData = await fetcher.fetchPullRequestData(owner, repo, pullNumber);

        const promptText = formatter.formatPullRequestCommentPrompt(
            prData,
            {
                body: context.payload.comment.body,
                author: context.payload.comment.user.login
            },
            customPrompt
        );
        await setValidatedTextTask(junieTask, promptText, "pr-comment");
    }

    // Handle PR review
    if (isPullRequestReviewEvent(context)) {
        const pullNumber = context.payload.pull_request.number;
        const reviewId = context.payload.review.id;

        // Single GraphQL query for all PR data
        const prData = await fetcher.fetchPullRequestData(owner, repo, pullNumber);

        // Find the specific review from the fetched reviews
        const review = prData.reviews.reviews.find(r => r.id === reviewId);
        if (!review) {
            throw new Error(`Review ${reviewId} not found in PR ${pullNumber}`);
        }

        const promptText = formatter.formatPullRequestReviewPrompt(
            prData,
            review,
            customPrompt
        );
        await setValidatedTextTask(junieTask, promptText, "pr-review");
    }

    // Handle PR review comment
    if (isPullRequestReviewCommentEvent(context)) {
        const pullNumber = context.payload.pull_request.number;

        // Single GraphQL query for all PR data
        const prData = await fetcher.fetchPullRequestData(owner, repo, pullNumber);

        const promptText = formatter.formatPullRequestReviewCommentPrompt(
            prData,
            {
                body: context.payload.comment.body,
                author: context.payload.comment.user.login
            },
            customPrompt
        );
        await setValidatedTextTask(junieTask, promptText, "pr-review-comment");
    }

    // Handle PR event (opened/edited)
    if (isPullRequestEvent(context)) {
        const pullNumber = context.payload.pull_request.number;

        // Single GraphQL query for all PR data
        const prData = await fetcher.fetchPullRequestData(owner, repo, pullNumber);

        const promptText = formatter.formatPullRequestPrompt(prData, customPrompt);
        await setValidatedTextTask(junieTask, promptText, "pull-request");
    }

    // If no event-specific prompt was set but custom prompt exists, use it directly
    if (!junieTask.textTask && customPrompt) {
        await setValidatedTextTask(junieTask, customPrompt, "user-prompt");
    }

    if (context.inputs.resolveConflicts || isReviewOrCommentHasTrigger(context, RESOLVE_CONFLICTS_TRIGGER_PHRASE_REGEXP)) {
        junieTask.mergeTask = {branch: branchInfo.prBaseBranch || branchInfo.baseBranch, type: "merge"}
    }

    core.setOutput(OUTPUT_VARS.EJ_TASK, JSON.stringify(junieTask));

    return junieTask;
}
