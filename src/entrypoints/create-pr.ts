#!/usr/bin/env bun

import * as core from "@actions/core";
import { Octokit } from "@octokit/rest";
import { GitHubContext } from "../github/context";
import { ENV_VARS, OUTPUT_VARS } from "../constants/environment";

export async function createPullRequest() {
    try {
        const githubToken = process.env[ENV_VARS.GITHUB_TOKEN]!;
        const context = JSON.parse(process.env[OUTPUT_VARS.PARSED_CONTEXT]!) as GitHubContext;
        const prTitle = process.env[OUTPUT_VARS.PR_TITLE]!;
        const prBody = process.env[OUTPUT_VARS.PR_BODY]!;
        const baseBranch = process.env[OUTPUT_VARS.BASE_BRANCH]!;
        const headBranch = process.env[OUTPUT_VARS.WORKING_BRANCH]!;

        console.log(`Creating PR from ${headBranch} to ${baseBranch}`);
        console.log(`PR Title: ${prTitle}`);

        const octokit = new Octokit({
            auth: githubToken,
        });

        const { data: pr } = await octokit.rest.pulls.create({
            owner: context.payload.repository.owner.login,
            repo: context.payload.repository.name,
            title: prTitle,
            body: prBody,
            head: headBranch,
            base: baseBranch,
        });

        console.log(`Successfully created PR #${pr.number}: ${pr.html_url}`);
        core.setOutput("pull-request-url", pr.html_url);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.setFailed(`Create PR step failed with error: ${errorMessage}`);
        core.setOutput(OUTPUT_VARS.EXCEPTION, errorMessage);
        process.exit(1);
    }
}

// @ts-ignore
if (import.meta.main) {
    createPullRequest();
}
