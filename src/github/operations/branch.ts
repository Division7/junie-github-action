#!/usr/bin/env bun

import * as core from "@actions/core";
import {$} from "bun";
import {
    GitHubContext,
    isPullRequestEvent,
    isPullRequestReviewCommentEvent,
    isPullRequestReviewEvent,
    isPushEvent,
} from "../context";
import type {Octokits} from "../api/client";
import {WORKING_BRANCH_PREFIX} from "../constants";
import {OUTPUT_VARS} from "../../constants/environment";

export type BranchInfo = {
    baseBranch: string;
    workingBranch: string;
    isNewBranch: boolean;
};

/**
 * Determines if the existing PR branch should be used instead of creating a new one.
 *
 * This logic handles different collaboration scenarios:
 * - PR author making changes to their own PR (always use existing branch)
 * - Bot/App making changes to PR it created (always use existing branch)
 * - External contributor helping with PR (configurable via createNewBranchForPR setting)
 *
 * @param createNewBranchForPR - Setting to create new branches for external contributors
 * @param actor - Current user triggering the workflow
 * @param prAuthor - Original author of the pull request
 * @param tokenOwnerLogin - Owner of the token being used (often a bot or app)
 * @returns `true` if existing PR branch should be used, `false` to create new branch
 */
function shouldUseExistingPRBranch(
    createNewBranchForPR: boolean,
    actor: string,
    prAuthor: string,
    tokenOwnerLogin: string,
): boolean {
    console.log(`PR author: ${prAuthor}`);
    console.log(`Actor: ${actor}`);
    console.log(`Token owner: ${tokenOwnerLogin}`);
    console.log(`Create new branch setting: ${createNewBranchForPR}`);

    if (!createNewBranchForPR) {
        console.log(`Using existing branch: setting disabled`);
        return true;
    }

    if (actor === prAuthor) {
        console.log(`Using existing branch: actor is PR author`);
        return true;
    }

    if (prAuthor === tokenOwnerLogin) {
        console.log(`Using existing branch: PR author is token owner`);
        return true;
    }

    console.log(`Creating new branch: none of the conditions matched`);
    return false;
}

/**
 * Creates and checks out a new git branch based on a base branch.
 *
 * Branch name is normalized: lowercased and truncated to 50 characters for safety.
 *
 * @param baseBranch - The base branch to branch from (e.g., "main", "develop")
 * @param branchName - Desired name for the new branch (will be normalized)
 * @returns Branch information object with base, working branch names and isNewBranch flag
 * @throws {Error} if git operations fail (branch doesn't exist, network issues, etc.)
 */
async function createNewBranch(baseBranch: string, branchName: string) {
    // Normalize branch name: lowercase and limit to 50 chars for git compatibility
    const newBranch = branchName.toLowerCase().substring(0, 50);

    try {
        console.log(`Creating new branch ${newBranch} from ${baseBranch}`);
        await $`git fetch origin ${baseBranch} --depth=1`;
        await $`git checkout -b ${newBranch} origin/${baseBranch}`;

        console.log(`✓ Successfully created and checked out new branch: ${newBranch}`);

        return {
            baseBranch: baseBranch,
            workingBranch: newBranch,
            isNewBranch: true,
        };
    } catch (error) {
        console.error(`❌ Failed to create branch "${newBranch}" from "${baseBranch}":`, error);
        throw new Error(
            `❌ Failed to create working branch "${newBranch}" from base branch "${baseBranch}". ` +
            `This could be due to:\n` +
            `• Base branch "${baseBranch}" does not exist in the repository\n` +
            `• Insufficient permissions to fetch from the repository\n` +
            `• Network connectivity issues\n` +
            `• Git authentication problems\n` +
            `Original error: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

async function setupWorkingBranch(context: GitHubContext, octokit: Octokits) {
    let baseBranch = context.inputs.baseBranch || context.payload.repository.default_branch
    const entityNumber = context.entityNumber;
    const isPR = context.isPR;
    const createNewBranchForPR = context.inputs.createNewBranchForPR;

    if (isPR && entityNumber) {
        let sourceBranch: string
        let state: string;
        let prAuthor: string;
        if (isPullRequestEvent(context)
            || isPullRequestReviewEvent(context)
            || isPullRequestReviewCommentEvent(context)) {
            baseBranch = context.payload.pull_request.base.ref;
            sourceBranch = context.payload.pull_request.head.ref;
            state = context.payload.pull_request.state;
            prAuthor = context.payload.pull_request.user.login;
        } else {
            try {
                const data = (await octokit.rest.pulls.get({
                    owner: context.payload.repository.owner.login,
                    repo: context.payload.repository.name,
                    pull_number: entityNumber,
                })).data;
                baseBranch = data.base.ref;
                sourceBranch = data.head.ref
                state = data.state;
                prAuthor = data.user.login;
            } catch (error) {
                const repoFullName = `${context.payload.repository.owner.login}/${context.payload.repository.name}`;
                throw new Error(
                    `❌ Failed to fetch PR #${entityNumber} information from ${repoFullName}. ` +
                    `This could be due to:\n` +
                    `• PR #${entityNumber} does not exist\n` +
                    `• Insufficient token permissions (needs 'repo' or 'pull_requests:read' scope)\n` +
                    `• GitHub API rate limits\n` +
                    `Original error: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }

        console.log(`Base branch: ${baseBranch}`);
        console.log(`Target branch: ${sourceBranch}`);

        const useExistingBranch = shouldUseExistingPRBranch(
            createNewBranchForPR,
            context.actor,
            prAuthor,
            context.tokenOwner.login,
        );

        if (state === "CLOSED" || state === "MERGED") {
            console.log(`PR #${entityNumber} is ${state}, creating new branch`);
        } else if (useExistingBranch) {
            try {
                const fetchDepth = 20
                await $`git fetch origin --depth=${fetchDepth} ${sourceBranch}`;
                await $`git checkout ${sourceBranch}`;

                console.log(`✓ Successfully checked out PR branch for PR #${entityNumber}`);

                return {
                    baseBranch: baseBranch,
                    workingBranch: sourceBranch!,
                    isNewBranch: false,
                };
            } catch (error) {
                throw new Error(
                    `❌ Failed to checkout existing PR branch "${sourceBranch}" for PR #${entityNumber}. ` +
                    `This could be due to:\n` +
                    `• Branch "${sourceBranch}" does not exist or was deleted\n` +
                    `• Insufficient permissions to fetch from the repository\n` +
                    `• Network connectivity issues\n` +
                    `• Git authentication problems\n` +
                    `Original error: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        } else {
            console.log(`Creating new branch for PR #${entityNumber} based on ${sourceBranch}`);
            baseBranch = sourceBranch;
        }
    }

    if (isPushEvent(context)) {
        baseBranch = context.payload.ref.replace("refs/heads/", "");
        console.log(`Push event detected, base branch: ${baseBranch}`);
    }

    const entityType = isPR ? "pr" : entityNumber ? "issue" : "run";
    const branchName = `${WORKING_BRANCH_PREFIX}${entityType}-${entityNumber || context.runId}`;
    return await createNewBranch(baseBranch, branchName)
}

/**
 * Sets up the working branch for Junie to make changes.
 *
 * This is the main entry point for branch management. It handles different scenarios:
 * - Issues: Creates new branch from base (e.g., "junie/issue-123")
 * - PRs: Uses existing PR branch or creates new one based on settings
 * - Push events: Uses the pushed branch as base
 *
 * Sets GitHub Actions outputs: BASE_BRANCH, WORKING_BRANCH, IS_NEW_BRANCH
 *
 * @param octokit - Octokit clients (rest and graphql)
 * @param context - GitHub context (event payload, inputs, etc.)
 * @returns Branch information with base branch, working branch, and isNewBranch flag
 * @throws {Error} if unable to fetch PR information or create/checkout branches
 */
export async function setupBranch(octokit: Octokits, context: GitHubContext) {
    let branchInfo = await setupWorkingBranch(context, octokit)

    // Set GitHub Actions outputs for use in subsequent steps
    core.setOutput(OUTPUT_VARS.BASE_BRANCH, branchInfo.baseBranch);
    core.setOutput(OUTPUT_VARS.WORKING_BRANCH, branchInfo.workingBranch);
    core.setOutput(OUTPUT_VARS.IS_NEW_BRANCH, branchInfo.isNewBranch.toString());

    return branchInfo;
}
