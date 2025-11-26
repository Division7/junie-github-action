#!/usr/bin/env bun
import * as core from "@actions/core";
import {ENV_VARS, OUTPUT_VARS} from "../constants/environment";

export interface GitHubTokenConfig {
    workingToken: string;
    defaultToken: string;
    isDefaultToken: (token?: string) => boolean;
}

export async function setupGitHubToken(): Promise<GitHubTokenConfig> {
    const defaultToken = process.env[ENV_VARS.DEFAULT_WORKFLOW_TOKEN]!;
    const providedToken = process.env[ENV_VARS.OVERRIDE_GITHUB_TOKEN];

    let workingToken: string;
    if (providedToken) {
        console.log("Using provided OVERRIDE_GITHUB_TOKEN for authentication");
        workingToken = providedToken;
    } else {
        console.log("Using DEFAULT_WORKFLOW_TOKEN for authentication");
        workingToken = defaultToken;
    }

    core.setOutput(OUTPUT_VARS.EJ_AUTH_GITHUB_TOKEN, workingToken);

    return {
        workingToken,
        defaultToken,
        isDefaultToken: () => {
            return workingToken === defaultToken;
        }
    };
}
