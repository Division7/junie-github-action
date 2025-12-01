#!/usr/bin/env bun

import * as core from "@actions/core";
import {setupGitHubToken} from "../github/token";
import {createOctokit} from "../github/api/client";
import {parseGitHubContext} from "../github/context";
import {prepare} from "../github/junie/prepare-junie";
import {getTokenOwnerInfo} from "../github/operations/auth";
import {handleStepError} from "../utils/error-handler";

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
        handleStepError("Prepare step", error);
    }
}

// @ts-ignore
if (import.meta.main) {
    run();
}
