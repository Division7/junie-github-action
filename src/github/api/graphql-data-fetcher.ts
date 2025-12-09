import {ISSUE_QUERY, IssueQueryResponse, PULL_REQUEST_QUERY, PullRequestQueryResponse} from "../api/queries";
import {Octokits} from "./client";
import pRetry, {AbortError} from "p-retry";

/**
 * GraphQL-based data fetcher - fetches all data in a single request
 * This is much more efficient than making multiple REST API calls
 */
export class GraphQLGitHubDataFetcher {
    constructor(private octokit: Octokits) {}

    /**
     * Execute a GraphQL query with retry logic for transient failures
     * Retries on network errors and rate limit errors, but not on schema/validation errors
     */
    private async executeGraphQLWithRetry<T>(
        query: string,
        variables: Record<string, any>
    ): Promise<T> {
        return pRetry(
            async () => {
                try {
                    return await this.octokit.graphql<T>(query, variables);
                } catch (error: any) {
                    // Ensure we have an Error object for p-retry
                    const errorObj = error instanceof Error
                        ? error
                        : new Error(error.message || String(error));

                    // Copy status property if it exists
                    if (error.status) {
                        (errorObj as any).status = error.status;
                    }

                    // Don't retry on permanent errors (schema errors, not found, etc)
                    if (error.status === 404 || error.status === 422) {
                        console.error(`Non-retryable GraphQL error: ${error.message || error}`);
                        throw new AbortError(errorObj);
                    }

                    // Don't retry on authentication errors
                    if (error.status === 401 || error.status === 403) {
                        console.error(`Authentication error: ${error.message || error}`);
                        throw new AbortError(errorObj);
                    }

                    // Retry on rate limit and transient network errors
                    console.warn(`GraphQL request failed, will retry: ${error.message || error}`);
                    throw errorObj;
                }
            },
            {
                retries: 3,
                minTimeout: 1000,
                maxTimeout: 5000,
                onFailedAttempt: (error) => {
                    console.log(
                        `GraphQL attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
                    );
                }
            }
        );
    }

    /**
     * Fetch all PR data in a single GraphQL query
     */
    async fetchPullRequestData(owner: string, repo: string, pullNumber: number) {
        const response = await this.executeGraphQLWithRetry<PullRequestQueryResponse>(
            PULL_REQUEST_QUERY,
            {
                owner,
                repo,
                number: pullNumber
            }
        );

        return {
            pullRequest: response.repository.pullRequest
        };
    }

    /**
     * Fetch all issue data in a single GraphQL query
     */
    async fetchIssueData(owner: string, repo: string, issueNumber: number) {
        const response = await this.executeGraphQLWithRetry<IssueQueryResponse>(
            ISSUE_QUERY,
            {
                owner,
                repo,
                number: issueNumber
            }
        );

        return {
            issue: response.repository.issue
        };
    }
}
