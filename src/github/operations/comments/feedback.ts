#!/usr/bin/env bun

import * as core from "@actions/core";
import {createCommentBody, createJobRunLink} from "./common";
import {GitHubContext, isPullRequestReviewCommentEvent,} from "../../context";
import type {Octokit} from "@octokit/rest";
import {createOctokit} from "../../api/client";
import {ActionType} from "../../../entrypoints/handle-results";
import {GITHUB_SERVER_URL} from "../../api/config";
import {OUTPUT_VARS} from "../../../constants/environment";
import {
    COMMIT_PUSHED_FEEDBACK_COMMENT_TEMPLATE,
    ERROR_FEEDBACK_COMMENT_TEMPLATE, MANUALLY_PR_CREATE_FEEDBACK_COMMENT_TEMPLATE, PR_CREATED_FEEDBACK_COMMENT_TEMPLATE,
    SUCCESS_FEEDBACK_COMMENT_WITH_RESULT
} from "../../../constants/github";

/**
 * Creates an initial "Junie is working..." feedback comment on the issue/PR.
 *
 * This provides immediate feedback to users that Junie has started processing.
 * The comment includes a link to the GitHub Actions run for monitoring progress.
 * Later, this comment is updated with the final result.
 *
 * @param octokit - Octokit REST client for GitHub API
 * @param context - GitHub context (contains event payload and entity number)
 * @returns The comment ID (used later for updating), or undefined if skipped
 * @throws {Error} if unable to create comment (permissions, API limits, locked issue/PR)
 */
export async function writeInitialFeedbackComment(
    octokit: Octokit,
    context: GitHubContext,
) {
    const {owner, name} = context.payload.repository;
    const ownerLogin = owner.login;

    const jobRunLink = createJobRunLink(ownerLogin, name, context.runId);
    const initialBody = createCommentBody(jobRunLink);

    try {
        let response;

        // Different comment APIs based on context type
        if (isPullRequestReviewCommentEvent(context)) {
            // For review comments (code-level comments), create a reply to the review comment
            response = await octokit.rest.pulls.createReplyForReviewComment({
                owner: ownerLogin,
                repo: name,
                pull_number: context.entityNumber!,
                comment_id: context.payload.comment.id,
                body: initialBody,
            });
        } else if (context.entityNumber) {
            // For issue comments and PR comments (conversation-level), use issues API
            // Note: GitHub treats PR comments as issue comments in the API
            response = await octokit.rest.issues.createComment({
                owner: ownerLogin,
                repo: name,
                issue_number: context.entityNumber,
                body: initialBody,
            });
        } else {
            // No entity number means this is an automated event (workflow_dispatch, schedule, etc.)
            // These don't have a specific issue/PR to comment on
            console.log(`Skip creating initial comment for ${context.eventName} event`);
            return;
        }

        console.log(`Created initial comment with ID: ${response.data.id}`);
        const initCommentId = response.data.id;

        // Save comment ID as output for later retrieval in finish-feedback step
        core.setOutput(OUTPUT_VARS.INIT_COMMENT_ID, initCommentId);

        return initCommentId;
    } catch (error) {
        const entityType = context.isPR ? 'PR' : context.entityNumber ? `issue #${context.entityNumber}` : 'event';
        const repoFullName = `${ownerLogin}/${name}`;
        console.error(`❌ Failed to create initial feedback comment for ${entityType}:`, error);
        throw new Error(
            `❌ Failed to create initial feedback comment on ${repoFullName}. ` +
            `This could be due to:\n` +
            `• Insufficient token permissions (needs 'issues:write' or 'pull_requests:write' scope)\n` +
            `• GitHub API rate limits\n` +
            `• The issue or PR may be locked or deleted\n` +
            `• Network connectivity issues\n` +
            `Original error: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}


/**
 * Updates the initial feedback comment with the final Junie result.
 *
 * This is called after Junie completes (success or failure) to provide final feedback.
 * Updates the previously created comment with:
 * - Success: Commit SHA, PR link, or task completion message
 * - Failure: Error details and link to job logs
 *
 * @param data - Feedback data containing result, comment ID, and context
 * @throws {Error} if unable to update comment (permissions, comment deleted, API limits)
 */
export async function writeFinishFeedbackComment(data: FinishFeedbackData) {
    const {owner, name} = data.parsedContext.payload.repository;
    const ownerLogin = owner.login;
    const repoFullName = `${ownerLogin}/${name}`;
    let feedbackBody: string | undefined;
    if (data.isJobFailed) {
        feedbackBody = getFailedBody(ownerLogin, name, data.parsedContext.runId, data.failureData!)
    } else {
        feedbackBody = getSuccessBody(repoFullName, data.successData!)
    }

    if (!feedbackBody) {
        console.log('No feedback body - skipping feedback');
        return;
    }

    const octokit = createOctokit(data.githubToken);

    const isReviewComment = isPullRequestReviewCommentEvent(data.parsedContext);
    const initCommentId = data.initCommentId;
    console.log(`Updating comment ${initCommentId} (review comment: ${isReviewComment})`);

    try {
        // Use the appropriate API based on comment type
        // Review comments (code-level) and issue comments (conversation-level) use different endpoints
        if (isReviewComment) {
            // Code-level review comments use pulls API
            await octokit.rest.pulls.updateReviewComment({
                owner: ownerLogin,
                repo: name,
                comment_id: +initCommentId,
                body: feedbackBody,
            });
        } else {
            // Issue comments and PR conversation comments use issues API
            await octokit.rest.issues.updateComment({
                owner: ownerLogin,
                repo: name,
                comment_id: +initCommentId,
                body: feedbackBody,
            });
        }

        console.log('✓ Feedback comment updated successfully');
    } catch (error) {
        console.error(`❌ Failed to update feedback comment ${initCommentId}:`, error);
        throw new Error(
            `❌ Failed to update feedback comment on ${repoFullName}. ` +
            `This could be due to:\n` +
            `• Insufficient token permissions (needs 'issues:write' or 'pull_requests:write' scope)\n` +
            `• GitHub API rate limits\n` +
            `• The comment may have been deleted\n` +
            `• Network connectivity issues\n` +
            `Original error: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

export interface FinishFeedbackData {
    initCommentId: string;
    isJobFailed: boolean;
    githubToken: string;
    parsedContext: GitHubContext;
    successData?: SuccessFeedbackData;
    failureData?: FailureFeedbackData;
}

interface SuccessFeedbackData {
    actionToDo: keyof typeof ActionType;
    prLink?: string;
    commitSHA?: string;
    junieTitle?: string;
    junieSummary?: string;
    workingBranch?: string;
    baseBranch?: string;
}

interface FailureFeedbackData {
    error?: string;
}

function getFailedBody(owner: string, repoName: string, runId: string, failureData: FailureFeedbackData): string | undefined {
    const details = failureData.error || "Check job logs for more details"
    const jobLink = createJobRunLink(owner, repoName, runId)
    return `${ERROR_FEEDBACK_COMMENT_TEMPLATE(details, jobLink)}`;
}

function getSuccessBody(repoFullName: string, successData: SuccessFeedbackData): string | undefined {
    let result: string | undefined;
    switch (successData.actionToDo) {
        case "COMMIT_CHANGES":
            console.log(`Commit pushed to current branch: ${successData.commitSHA}`);
            result = COMMIT_PUSHED_FEEDBACK_COMMENT_TEMPLATE(successData.commitSHA!, successData.junieTitle!, successData.junieSummary!);
            break;
        case "PUSH":
            console.log('Unpushed commits were pushed to remote');
            result = SUCCESS_FEEDBACK_COMMENT_WITH_RESULT(successData.junieTitle || 'Changes pushed', successData.junieSummary || 'Unpushed commits have been pushed to the remote branch');
            break;
        case "CREATE_PR":
            if (successData.prLink) {
                console.log(`PR was created: ${successData.prLink}`);
                result = PR_CREATED_FEEDBACK_COMMENT_TEMPLATE(successData.prLink);
            } else {
                console.log(`Create PR manually`);
                const createPRLink = `${GITHUB_SERVER_URL}/${repoFullName}/compare/${successData.baseBranch}...${successData.workingBranch}`;
                result = MANUALLY_PR_CREATE_FEEDBACK_COMMENT_TEMPLATE(createPRLink);
            }
            break;
        case "WRITE_COMMENT":
            console.log('No PR or commit - using Junie result');
            result = SUCCESS_FEEDBACK_COMMENT_WITH_RESULT(successData.junieTitle || 'Task completed', successData.junieSummary || 'No additional details');
            break;
    }

    return result;
}