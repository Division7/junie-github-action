import {
    GraphQLPullRequest,
    GraphQLIssue,
    GraphQLFileNode,
    GraphQLReviewNode,
    GraphQLTimelineItemNode,
    isIssueCommentNode,
    isReferencedEventNode,
    isCrossReferencedEventNode
} from "../api/queries";

/**
 * Complete Pull Request context data (returned from fetchPullRequestData)
 */
export interface PullRequestContextData {
    pullRequest: GraphQLPullRequest;
}

/**
 * Complete Issue context data (returned from fetchIssueData)
 */
export interface IssueContextData {
    issue: GraphQLIssue;
}

/**
 * Comment data
 */
export interface CommentData {
    body: string;
    author: string;
}

export class GitHubPromptFormatter {

    private formatPRContext(pr: GraphQLPullRequest): string {
        return `PR #${pr.number}: ${pr.title}
Author: @${pr.author?.login || 'ghost'}
State: ${pr.state}
Branch: ${pr.headRefName} -> ${pr.baseRefName}
Additions: +${pr.additions} / Deletions: -${pr.deletions}
Changed Files: ${pr.changedFiles}
Commits: ${pr.commits.totalCount}`;
    }

    private formatChangedFiles(files: GraphQLFileNode[]): string {
        if (files.length === 0) {
            return 'No files changed';
        }

        return files.map(file =>
            `- ${file.path} (${file.changeType.toLowerCase()}) +${file.additions}/-${file.deletions}`
        ).join('\n');
    }

    private presentPullRequest(pr: GraphQLPullRequest): string {
        let result = '';

        result += `### PULL REQUEST CONTEXT:\n${this.formatPRContext(pr)}\n\n`;
        result += `### PULL REQUEST: ${pr.title} [${pr.state}]\n${pr.body || ''}\n\n`;
        result += `### CHANGED FILES:\n${this.formatChangedFiles(pr.files.nodes)}\n\n`;
        result += `### PULL REQUEST REVIEWS:\n${this.presentReviews(pr.reviews.nodes)}\n\n`;
        result += `### PULL REQUEST TIMELINE:\n${this.presentTimeline(pr.timelineItems.nodes)}`;

        return result;
    }

    private presentIssue(issue: GraphQLIssue): string {
        return `### ISSUE:
${issue.title} [${issue.state}]

${issue.body || ''}

### ISSUE TIMELINE:
${this.presentTimeline(issue.timelineItems.nodes)}`;
    }

    private presentReviews(reviews: GraphQLReviewNode[]): string {
        const reviewTexts: string[] = [];

        for (const review of reviews) {
            const reviewText = this.presentReview(review);
            if (reviewText.trim()) {
                reviewTexts.push(reviewText);
            }
        }

        if (reviewTexts.length === 0) {
            return 'No review comments found.';
        }

        return reviewTexts.join('\n\n');
    }

    private presentReview(review: GraphQLReviewNode): string {
        if (review.comments.nodes.length === 0) {
            return '';
        }

        const commentTexts: string[] = [];

        // Sort comments by creation time
        const sortedComments = [...review.comments.nodes].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        for (const comment of sortedComments) {
            const author = comment.author?.login || 'ghost';
            const body = comment.body;
            const createdAt = comment.createdAt;
            const path = comment.path;
            const position = comment.position;
            const diffHunk = comment.diffHunk;

            let commentText = `- ${createdAt} — ${path}:${position || ''} — Review comment by @${author}\n`;

            if (diffHunk) {
                const diffLines = diffHunk
                    .split('\n')
                    .map(line => `  ${line}`)
                    .join('\n');
                commentText += `  \`\`\`\`\n${diffLines}\n  \`\`\`\`\n`;
            }

            const commentBody = body
                .split('\n')
                .map(line => `  ${line}`)
                .join('\n');
            commentText += `${commentBody}`;

            commentTexts.push(commentText);
        }

        return commentTexts.join('\n\n');
    }

    private presentTimeline(timelineNodes: GraphQLTimelineItemNode[]): string {
        const eventTexts: string[] = [];

        for (const node of timelineNodes) {
            let eventText: string | null = null;

            if (isIssueCommentNode(node)) {
                const author = node.author?.login || 'ghost';
                const body = node.body;
                const createdAt = node.createdAt;
                const bodyLines = body.split('\n').map(line => `  ${line}`).join('\n');
                eventText = `* ${createdAt} — Comment from @${author}:\n${bodyLines}`;
            } else if (isReferencedEventNode(node)) {
                const commitId = node.commit?.oid;
                if (commitId) {
                    const hash = commitId.substring(0, 7);
                    const createdAt = node.createdAt;
                    eventText = `* ${createdAt} — Commit: ${hash}`;
                }
            } else if (isCrossReferencedEventNode(node)) {
                const source = node.source;
                if (source) {
                    const createdAt = node.createdAt;
                    const isPullRequest = source.__typename === 'PullRequest';

                    if (isPullRequest) {
                        eventText = `* ${createdAt} — Reference to PR #${source.number}: ${source.title}`;
                    } else {
                        eventText = `* ${createdAt} — Reference to Issue #${source.number}: ${source.title}`;
                    }
                }
            }

            if (eventText) {
                eventTexts.push(eventText);
            }
        }

        return eventTexts.join('\n\n');
    }

    formatPullRequestCommentPrompt(
        prData: PullRequestContextData,
        comment: CommentData,
        basePrompt?: string
    ): string {
        const prompt = `User @${comment.author} mentioned you in the comment on pull request '#${prData.pullRequest.number} ${prData.pullRequest.title}'.
Given the following user comment (aka user issue description) \`<issue_description>\`, could you help me in implementing the necessary changes to meet the specified requirements?
<issue_description>
${basePrompt || ""}

${comment.body}
</issue_description>`;

        return `${prompt}


See below the whole PR for information:
${this.presentPullRequest(prData.pullRequest)}`;
    }

    formatPullRequestReviewCommentPrompt(
        prData: PullRequestContextData,
        comment: CommentData,
        basePrompt?: string
    ): string {
        const prompt = `User @${comment.author} mentioned you in the review comment on pull request '#${prData.pullRequest.number} ${prData.pullRequest.title}'.
Given the following user comment (aka user issue description) \`<issue_description>\`, could you help me in implementing the necessary changes to meet the specified requirements?
<issue_description>
${basePrompt || ""}

${comment.body}
</issue_description>`;

        return `${prompt}


See below the whole PR for information:
${this.presentPullRequest(prData.pullRequest)}`;
    }

    formatPullRequestReviewPrompt(
        prData: PullRequestContextData,
        review: GraphQLReviewNode,
        basePrompt?: string
    ): string {
        const prompt = `User @${review.author?.login || 'ghost'} mentioned you in the review on pull request '#${prData.pullRequest.number} ${prData.pullRequest.title}'.
Given the following user review (aka user issue description) \`<issue_description>\`, could you help me in implementing the necessary changes to meet the specified requirements?
<issue_description>
${basePrompt || ""}

${this.presentReview(review)}
</issue_description>`;

        return `${prompt}


See below the whole PR for information:
${this.presentPullRequest(prData.pullRequest)}`;
    }

    formatIssueCommentPrompt(
        issueData: IssueContextData,
        comment: CommentData,
        basePrompt?: string
    ): string {
        const prompt = `User @${comment.author} mentioned you in the comment on GitHub issue '#${issueData.issue.number} ${issueData.issue.title}'.
Given the following user comment (aka user issue description) \`<issue_description>\`, could you help me in implementing the necessary changes to meet the specified requirements?
<issue_description>
${basePrompt || ""}

${comment.body}
</issue_description>`;

        return `${prompt}


See below the whole GitHub issue for information:
${this.presentIssue(issueData.issue)}`;
    }

    formatIssuePrompt(issueData: IssueContextData, basePrompt?: string): string {
        const prompt = `Given the following issue description \`<issue_description>\`, could you help me in implementing the necessary changes to meet the specified requirements?`;

        return `${prompt}
<issue_description>
${basePrompt || ""}

${this.presentIssue(issueData.issue)}
</issue_description>`;
    }

    formatPullRequestPrompt(
        prData: PullRequestContextData,
        basePrompt?: string
    ): string {
        const prompt = `Given the following pull request \`<issue_description>\`, could you help me in implementing the necessary changes to meet the specified requirements?`;

        return `${prompt}
<issue_description>
${basePrompt || ""}

${this.presentPullRequest(prData.pullRequest)}
</issue_description>`;
    }
}
