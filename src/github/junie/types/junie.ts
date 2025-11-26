import {GitHubContext} from "../../context";
import {Octokits} from "../../api/client";
import type {GitHubTokenConfig} from "../../token";


export interface JunieTask {
    gitHubIssue?: GitHubIssue | null;
    gitHubPullRequestReview?: GitHubPullRequestReview | null;
    gitHubPullRequestComment?: GitHubPullRequestComment | null;
    gitHubPullRequest?: GitHubPullRequest | null;
    mergeTask?: MergeTask | null;
    textTask?: TextTask | null;
}

export interface MergeTask {
    branch: string, // ref: branch, sha or tag
    type: string, // rebase or merge
}

export interface GitHubIssue {
    url: string;
}

export interface GitHubPullRequestReview {
    url: string;
}

export interface GitHubPullRequestComment {
    pullRequestUrl: string;
    url: string;
}

export interface GitHubPullRequest {
    url: string;
}

export interface TextTask {
    text: string;
}


export type PrepareJunieOptions = {
    context: GitHubContext;
    octokit: Octokits;
    tokenConfig: GitHubTokenConfig;
};