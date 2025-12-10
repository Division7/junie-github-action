import {
    GitHubContext,
    isIssueCommentEvent,
    isIssuesEvent,
    isPullRequestEvent,
    isPullRequestReviewCommentEvent,
    isPullRequestReviewEvent
} from "../context";
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
import {CliInput} from "./types/junie";


async function getValidatedTextTask(text: string, taskType: string): Promise<string> {
    // Download attachments and rewrite URLs in the text
    const textWithLocalAttachments = await downloadAttachmentsAndRewriteText(text);
    validateInputSize(textWithLocalAttachments, taskType);
    return textWithLocalAttachments
}

export async function prepareJunieTask(
    context: GitHubContext,
    branchInfo: BranchInfo,
    octokit: Octokits
): Promise<CliInput> {
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;

    const fetcher = new GraphQLGitHubDataFetcher(octokit);
    const formatter = new GitHubPromptFormatter();
    let triggerTime: string | undefined;

    const customPrompt = context.inputs.prompt || undefined;
    let taskText: string | undefined = customPrompt
    let cliInput: CliInput;

    const isMergeTask = context.inputs.resolveConflicts || isReviewOrCommentHasTrigger(context, RESOLVE_CONFLICTS_TRIGGER_PHRASE_REGEXP);
    if (isMergeTask) {
        // For merge tasks, use mergeTask field
        const targetBranch = branchInfo.prBaseBranch || branchInfo.baseBranch;
        cliInput = {
            mergeTask: {
                branch: targetBranch
            }
        };
        console.log(`Creating merge task for branch: ${targetBranch}`);
        return cliInput;
    }

    // Handle issue comment (not on PR)
    if (isIssueCommentEvent(context) && !context.isPR) {
        triggerTime = context.payload.comment.created_at
        const issueNumber = context.payload.issue.number;

        // Single GraphQL query for all issue data
        const issueData = await fetcher.fetchIssueData(owner, repo, issueNumber, triggerTime);

        const promptText = formatter.formatIssueCommentPrompt(
            issueData,
            {
                body: context.payload.comment.body,
                author: context.payload.comment.user.login
            },
            customPrompt
        );
        taskText = await getValidatedTextTask(promptText, "issue-comment");
    }

    // Handle issue event (opened/edited)
    if (isIssuesEvent(context)) {
        triggerTime = context.payload.issue.updated_at
        const issueNumber = context.payload.issue.number;

        // Single GraphQL query for all issue data
        const issueData = await fetcher.fetchIssueData(owner, repo, issueNumber, triggerTime);

        const promptText = formatter.formatIssuePrompt(issueData, customPrompt);
        taskText = await getValidatedTextTask(promptText, "issue");
    }

    // Handle PR comment
    if (isIssueCommentEvent(context) && context.isPR) {
        triggerTime = context.payload.comment.created_at
        const pullNumber = context.payload.issue.number;

        // Single GraphQL query for all PR data - much faster than 5 REST calls!
        const prData = await fetcher.fetchPullRequestData(owner, repo, pullNumber, triggerTime);

        const promptText = formatter.formatPullRequestCommentPrompt(
            prData,
            {
                body: context.payload.comment.body,
                author: context.payload.comment.user.login
            },
            customPrompt
        );
        taskText = await getValidatedTextTask(promptText, "pr-comment");
    }

    // Handle PR review
    if (isPullRequestReviewEvent(context)) {
        triggerTime = context.payload.review.submitted_at || undefined
        const pullNumber = context.payload.pull_request.number;
        const reviewId = context.payload.review.id;

        // Single GraphQL query for all PR data
        const prData = await fetcher.fetchPullRequestData(owner, repo, pullNumber, triggerTime);

        // Find the specific review from the fetched reviews
        const review = prData.pullRequest.reviews.nodes.find(r => r.databaseId === reviewId);
        if (!review) {
            throw new Error(`Review ${reviewId} not found in PR ${pullNumber}`);
        }

        const promptText = formatter.formatPullRequestReviewPrompt(
            prData,
            review,
            customPrompt
        );
        taskText = await getValidatedTextTask(promptText, "pr-review");
    }

    // Handle PR review comment
    if (isPullRequestReviewCommentEvent(context)) {
        triggerTime = context.payload.comment.created_at
        const pullNumber = context.payload.pull_request.number;

        // Single GraphQL query for all PR data
        const prData = await fetcher.fetchPullRequestData(owner, repo, pullNumber, triggerTime);

        const promptText = formatter.formatPullRequestReviewCommentPrompt(
            prData,
            {
                body: context.payload.comment.body,
                author: context.payload.comment.user.login
            },
            customPrompt
        );
        taskText = await getValidatedTextTask(promptText, "pr-review-comment");
    }

    // Handle PR event (opened/edited)
    if (isPullRequestEvent(context)) {
        triggerTime = context.payload.pull_request.updated_at
        const pullNumber = context.payload.pull_request.number;

        // Single GraphQL query for all PR data
        const prData = await fetcher.fetchPullRequestData(owner, repo, pullNumber, triggerTime);

        const promptText = formatter.formatPullRequestPrompt(prData, customPrompt);
        taskText = await getValidatedTextTask(promptText, "pull-request");
    }

    // For regular tasks, use task field
    if (!taskText) {
        throw new Error("No task was created. Please check your inputs.");
    }
    cliInput = {
        task: taskText
    };
    console.log(`Creating regular task with text length: ${taskText.length}`);


    // Save the CLI input as JSON string for the action
    core.setOutput(OUTPUT_VARS.JUNIE_JSON_TASK, JSON.stringify(cliInput));

    return cliInput;
}
