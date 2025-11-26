#!/usr/bin/env node

import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {Octokit} from "@octokit/rest";

const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const HEAD_SHA = process.env.HEAD_SHA;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_API_URL = process.env.GITHUB_API_URL;

if (!REPO_OWNER || !REPO_NAME || !HEAD_SHA || !GITHUB_TOKEN || !GITHUB_API_URL) {
    process.exit(1);
}

const server = new McpServer({
    name: "GitHub Checks Server",
    version: "1.0.0",
});

server.tool(
    "get_pr_failed_checks_info",
    "Get detailed information about failed checks for a Pull Request, including extracted error logs",
    async () => {
        try {
            const client = new Octokit({
                auth: GITHUB_TOKEN,
                baseUrl: GITHUB_API_URL,
            });

            const failedChecksResult = await extractFailedChecksInfo(
                client,
                REPO_OWNER!,
                REPO_NAME!,
                HEAD_SHA,
                19000
            );

            if (!failedChecksResult || failedChecksResult.failedChecks.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "No failed checks found"
                        }
                    ],
                };
            }

            return {
                content: [
                    {
                        type: "text",
                        text: failedChecksResult.combinedOutput,
                    },
                ],
            };
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${errorMessage}`,
                    },
                ],
                error: errorMessage,
                isError: true,
            };
        }
    },
);

async function runServer() {
    try {
        const transport = new StdioServerTransport();

        await server.connect(transport);

        process.on("exit", () => {
            server.close();
        });
    } catch (error) {
        throw error;
    }
}

interface FailedCheckInfo {
    checkName: string;
    output: string;
}

interface ExtractFailedChecksResult {
    failedChecks: FailedCheckInfo[];
    combinedOutput: string;
}

async function extractFailedChecksInfo(
    octokit: Octokit,
    owner: string,
    repo: string,
    ref: string,
    maxLength: number = 19000
): Promise<ExtractFailedChecksResult> {

    try {
        // Get check runs for the ref
        const {data: checkRuns} = await octokit.rest.checks.listForRef({
            owner,
            repo,
            ref,
        });

        // Filter only failed check runs
        const failedCheckRuns = checkRuns.check_runs.filter(
            (check) => check.conclusion === 'failure'
        );

        const failedChecksInfo: FailedCheckInfo[] = [];

        // Extract information from each failed check
        for (const checkRun of failedCheckRuns) {
            const checkInfo = await extractCheckRunLog(
                octokit,
                owner,
                repo,
                checkRun
            );

            if (checkInfo) {
                failedChecksInfo.push({
                    checkName: checkRun.name,
                    output: checkInfo,
                });
            }
        }

        // Combine all failed checks info
        let combinedOutput = failedChecksInfo
            .map((check) => `[Check name] ${check.checkName}\n[Check output]\n${check.output}`)
            .join('\n\n');

        if (combinedOutput.length > maxLength) {
            combinedOutput = combinedOutput.substring(0, maxLength);
        }

        return {
            failedChecks: failedChecksInfo,
            combinedOutput,
        };
    } catch (error) {
        throw error;
    }
}

async function extractCheckRunLog(
    octokit: Octokit,
    owner: string,
    repo: string,
    checkRun: any
): Promise<string | null> {
    try {
        // Extract job ID from details URL
        const jobId = extractJobIdFromUrl(checkRun.html_url, `${owner}/${repo}`);

        if (!jobId) {
            // Fallback to check run output text
            return checkRun.output?.text || null;
        }

        // Try to download workflow job logs
        try {
            const logsResponse = await octokit.rest.actions.downloadJobLogsForWorkflowRun({owner, repo, job_id: jobId});
            let logText: string;
            const data: unknown = (logsResponse as any).data;
            if (typeof data === 'string') {
                logText = data;
            } else {
                logText = String(data);
            }

            const logLines = logText.split('\n');
            const cleanedLogs = clearTimestampFromGhLogs(logLines);
            const relevantInfo = extractRelevantInfo(cleanedLogs);

            return relevantInfo || null;
        } catch (logError) {
            // Fallback to check run output text
            const outputText = checkRun.output?.text;
            if (outputText) {
                const logLines = outputText.split('\n');
                const relevantInfo = extractRelevantInfo(logLines);
                return relevantInfo || null;
            }
            return null;
        }
    } catch (error) {
        return null;
    }
}

function extractJobIdFromUrl(detailsUrl: string, repoFullName: string): number | null {
    // Check if URL is related to the correct repository
    if (!detailsUrl.includes(repoFullName)) {
        return null;
    }

    // Extract job ID from URL pattern /job/{jobId}
    const match = detailsUrl.match(/\/job\/(\d+)/);
    if (!match || !match[1]) {
        return null;
    }

    const jobId = parseInt(match[1], 10);
    return isNaN(jobId) ? null : jobId;
}

function clearTimestampFromGhLogs(logLines: string[]): string[] {
    return logLines.map((line) => {
        // Remove timestamp prefix (ISO 8601 format at the start of line)
        return line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, '');
    });
}

function extractRelevantInfo(logLines: string[]): string {
    const relevantLines: string[] = [];
    let insideFailedTask = false;

    for (const line of logLines) {

        // --- 1) Maven failures ---
        if (line.startsWith("[ERROR]")) {
            relevantLines.push(line);
            continue;
        }

        // --- 2) Kotlin compiler errors ---
        if (line.startsWith("e:")) {
            relevantLines.push(line);
            continue;
        }

        // --- 3) Gradle "Task :xxx FAILED" ---
        if (/Task\s+:[\w:-]+.*FAILED/.test(line)) {
            insideFailedTask = true;
            relevantLines.push(line);
            continue;
        }

        if (insideFailedTask) {
            relevantLines.push(line);
            if (line.includes("FAILURE:")) {
                insideFailedTask = false;
            }
            continue;
        }

        // --- 4) GitHub Actions "##[error]" ---
        if (line.includes("##[error]")) {
            relevantLines.push(line);
            continue;
        }

        // --- 5) Test framework failures ---
        if (
            line.includes("FAILED") ||
            line.includes("Assertion error") ||
            /Assertion.*failed/i.test(line) ||
            line.startsWith("Error:") ||
            line.includes("exit code 1")
        ) {
            relevantLines.push(line);
        }
    }

    return relevantLines.join("\n").trim();
}

runServer().catch(() => {
    process.exit(1);
});
