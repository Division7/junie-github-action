import {GITHUB_SERVER_URL} from "../../api/config";
import {INIT_COMMENT_BODY} from "../../constants";

export function createJobRunLink(
    owner: string,
    repo: string,
    runId: string,
): string {
    const jobRunUrl = `${GITHUB_SERVER_URL}/${owner}/${repo}/actions/runs/${runId}`;
    return `[View job run](${jobRunUrl})`;
}

export function createBranchLink(
    owner: string,
    repo: string,
    branchName: string,
): string {
    const branchUrl = `${GITHUB_SERVER_URL}/${owner}/${repo}/tree/${branchName}`;
    return `\n[View branch](${branchUrl})`;
}

export function createCommentBody(
    jobRunLink: string
): string {
    return `${INIT_COMMENT_BODY}

${jobRunLink}`;
}
