#!/usr/bin/env bun

import * as core from "@actions/core";
import {setupGitHubToken} from "../github/token";
import {createOctokit} from "../github/api/client";
import {parseGitHubContext} from "../github/context";
import {prepare} from "../github/junie/prepare-junie";
import {getTokenOwnerInfo} from "../github/operations/auth";
import {OUTPUT_VARS} from "../constants/environment";

async function run() {
    try {
        const tokenConfig = await setupGitHubToken();
        const octokit = createOctokit(tokenConfig.workingToken);
        const tokenOwner = await getTokenOwnerInfo(octokit, tokenConfig);
        const context = parseGitHubContext(tokenOwner);

        await prepare({
            context,
            octokit,
            tokenConfig
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.setFailed(`Prepare step failed with error: ${errorMessage}`);
        core.setOutput(OUTPUT_VARS.EXCEPTION, errorMessage);
        process.exit(1);
    }
}

// @ts-ignore
if (import.meta.main) {
    run();
}
