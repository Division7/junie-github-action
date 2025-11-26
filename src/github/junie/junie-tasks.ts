import {
    GitHubContext,
    isIssueCommentEvent,
    isIssuesEvent,
    isPullRequestEvent,
    isPullRequestReviewCommentEvent,
    isPullRequestReviewEvent
} from "../context";
import {JunieTask} from "./types/junie";
import * as core from "@actions/core";
import {BranchInfo} from "../operations/branch";
import {isReviewOrCommentHasTrigger} from "../validation/trigger";
import {RESOLVE_CONFLICTS_TRIGGER_PHRASE_REGEXP} from "../constants";
import {OUTPUT_VARS} from "../../constants/environment";

export async function prepareJunieTask(context: GitHubContext, branchInfo: BranchInfo) {
    const junieTask: JunieTask = {}

    if (context.inputs.prompt) {
        junieTask.textTask = {text: context.inputs.prompt}
    }

    if ((isIssueCommentEvent(context) && !context.isPR) || isIssuesEvent(context)) {
        junieTask.gitHubIssue = {url: context.payload.issue.html_url}
    }

    if (isIssueCommentEvent(context) && context.isPR) {
        junieTask.gitHubPullRequestComment =
            {
                pullRequestUrl: context.payload.issue.pull_request!.html_url!,
                url: context.payload.comment.html_url
            }
    }

    if (isPullRequestReviewEvent(context)) {
        junieTask.gitHubPullRequestReview = {url: context.payload.review.html_url}
    }

    if (isPullRequestReviewCommentEvent(context)) {
        junieTask.gitHubPullRequestComment =
            {
                pullRequestUrl: context.payload.pull_request.html_url!,
                url: context.payload.comment.html_url
            }
    }

    if (isPullRequestEvent(context)) {
        junieTask.gitHubPullRequest = {url: context.payload.pull_request.html_url}
    }

    if (context.inputs.resolveConflicts || isReviewOrCommentHasTrigger(context, RESOLVE_CONFLICTS_TRIGGER_PHRASE_REGEXP)) {
        junieTask.mergeTask = {branch: branchInfo.baseBranch, type: "merge"}
    }

    core.setOutput(OUTPUT_VARS.EJ_TASK, JSON.stringify(junieTask));
    // core.setOutput(OUTPUT_VARS.EJ_TASK_TEXT, junieTaskText);

    return junieTask;
}
