import {Octokit} from "@octokit/rest";
import {graphql} from "@octokit/graphql";
import {GITHUB_API_URL} from "./config";

export type Octokits = {
    rest: Octokit;
    graphql: typeof graphql;
};

/**
 * Builds configured GitHub API client with REST and GraphQL interfaces
 * @param token - GitHub authentication token
 * @returns Octokits instance with REST and GraphQL clients
 */
export function buildGitHubApiClient(token: string): Octokits {
    return {
        rest: new Octokit({
            auth: token,
            baseUrl: GITHUB_API_URL,
        }),
        graphql: graphql.defaults({
            baseUrl: GITHUB_API_URL,
            headers: {
                authorization: `token ${token}`,
            },
        }),
    };
}
