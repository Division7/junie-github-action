import {GITHUB_API_URL} from "../github/api/config";
import {mkdir, readFile, writeFile} from 'fs/promises';
import {join} from 'path';
import {homedir} from 'os';
import * as core from "@actions/core";
import {OUTPUT_VARS} from "../constants/environment";

type PrepareConfigParams = {
    junieWorkingDir: string;
    githubToken: string;
    owner: string;
    repo: string;
    currentBranch: string;
    allowedMcpServers: string[];
};


export async function prepareMcpConfig(
    params: PrepareConfigParams,
): Promise<string> {
    const {
        githubToken,
        owner,
        repo,
        currentBranch,
        allowedMcpServers,
    } = params;

    const hasGHCheksServer = allowedMcpServers.some((name) =>
        name == "mcp_github_checks_server"
    );

    const baseMcpConfig: { mcpServers: Record<string, unknown> } = {
        mcpServers: {},
    };


    if (hasGHCheksServer) {
        baseMcpConfig.mcpServers.github_checks = {
            command: "bun",
            args: [
                "run",
                `${process.env.GITHUB_ACTION_PATH}/src/mcp/github-checks-server.ts`,
            ],
            env: {
                GITHUB_API_URL: GITHUB_API_URL,
                GITHUB_TOKEN: githubToken,
                REPO_OWNER: owner,
                REPO_NAME: repo,
                HEAD_SHA: currentBranch,
            },
        };
    }

    const configJsonString = JSON.stringify(baseMcpConfig, null, 2);

    // Create ~/.junie directory if it doesn't exist
    const junieDir = join(homedir(), '.junie');
    await mkdir(junieDir, {recursive: true});

    // Write mcp.json config file to ~/.junie/mcp.json
    const mcpConfigPath = join(junieDir, 'mcp.json');
    await writeFile(mcpConfigPath, configJsonString, 'utf-8');
    console.log(`File content ${await readFile(mcpConfigPath)}`)
    console.log(`MCP config written to: ${mcpConfigPath}`);
    core.setOutput(OUTPUT_VARS.EJ_MCP_CONFIG, configJsonString);
    return configJsonString;
}
