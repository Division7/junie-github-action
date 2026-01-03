#!/usr/bin/env bun

import {acquireGitHubAuthentication} from "../github/token";
import {buildGitHubApiClient} from "../github/api/client";
import {extractJunieWorkflowContext} from "../github/context";
import {fetchGitHubTokenOwnerDetails} from "../github/operations/auth";
import {handleStepError} from "../utils/error-handler";
import {initializeJunieExecution} from "../github/junie/prepare-junie";

async function run() {
    try {
        const tokenConfig = await acquireGitHubAuthentication();
        const octokit = buildGitHubApiClient(tokenConfig.workingToken);
        const tokenOwner = await fetchGitHubTokenOwnerDetails(octokit, tokenConfig);
        const context = extractJunieWorkflowContext(tokenOwner);

        await initializeJunieExecution({
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
