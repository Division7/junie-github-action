import {COMMIT_MESSAGE_TEMPLATE, PR_BODY_TEMPLATE, PR_TITLE_TEMPLATE} from "../constants/github";
import {GitHubContext, isEntityContext} from "../github/context";
import {execSync} from 'child_process';
import * as core from "@actions/core";
import {ENV_VARS, OUTPUT_VARS} from "../constants/environment";

export enum ActionType {
    WRITE_COMMENT = 'WRITE_COMMENT',
    CREATE_PR = 'CREATE_PR',
    COMMIT_CHANGES = 'COMMIT_CHANGES',
    PUSH = 'PUSH',
    NOTHING = 'NOTHING'
}

export async function handleResults() {
    try {
        const junieJsonOutput = JSON.parse(process.env[ENV_VARS.JSON_JUNIE_OUTPUT]!) as any
        const context = JSON.parse(process.env[OUTPUT_VARS.PARSED_CONTEXT]!) as GitHubContext
        const junieErrors = junieJsonOutput.errors
        if (junieErrors && (junieErrors as string[]).length > 0) {
            throw new Error(`Junie run failed with errors: ${junieErrors.join('\n')}`)
        }
        const actionToDo = await getActionToDo(context.inputs.silentMode);
        const title = junieJsonOutput.taskName
        const body = junieJsonOutput.result
        let issueId
        if (isEntityContext(context)) {
            issueId = context.entityNumber
        }
        const commitMessage = COMMIT_MESSAGE_TEMPLATE(title, issueId)

        // Export outputs based on action type
        switch (actionToDo) {
            case ActionType.CREATE_PR:
                exportResultsOutputs(
                    title,
                    body,
                    commitMessage,
                    PR_TITLE_TEMPLATE(title),
                    PR_BODY_TEMPLATE(body, issueId));
                break;
            case ActionType.COMMIT_CHANGES:
            case ActionType.PUSH:
                exportResultsOutputs(title, body, commitMessage);
                break;
            case ActionType.WRITE_COMMENT:
            case ActionType.NOTHING:
                exportResultsOutputs(title, body);
                break;
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.setFailed(`Handle results step failed with error: ${errorMessage}`);
        core.setOutput(OUTPUT_VARS.EXCEPTION, errorMessage);
        process.exit(1);
    }
}

async function getActionToDo(silentMode: boolean): Promise<ActionType> {
    if (silentMode) {
        console.log('Silent mode enabled - no git operations will be performed');
        return ActionType.NOTHING;
    }

    const hasChangedFiles = await checkForChangedFiles();
    const hasUnpushedCommits = await checkForUnpushedCommits();
    const initCommentId = process.env[OUTPUT_VARS.INIT_COMMENT_ID];
    const isNewBranch = process.env[OUTPUT_VARS.IS_NEW_BRANCH] === 'true';
    const workingBranch = process.env[OUTPUT_VARS.WORKING_BRANCH]!;


    console.log(`Has changed files: ${hasChangedFiles}`);
    console.log(`Has unpushed commits: ${hasUnpushedCommits}`);
    console.log(`Init comment ID: ${initCommentId}`);
    console.log(`Is new branch: ${isNewBranch}`);
    console.log(`Working branch: ${workingBranch}`);

    let action: ActionType
    if (!hasChangedFiles && !hasUnpushedCommits && initCommentId) {
        console.log('No changes and no unpushed commits but has comment ID - will write comment');
        action = ActionType.WRITE_COMMENT;
    } else if (!hasChangedFiles && hasUnpushedCommits) {
        console.log('No changes but has unpushed commits - will push');
        action = ActionType.PUSH;
    } else if (hasChangedFiles && isNewBranch) {
        console.log('Changes found and working in new branch - will create PR');
        action = ActionType.CREATE_PR;
    } else if (hasChangedFiles && !isNewBranch) {
        console.log('Changes found and working in existing branch - will commit directly');
        action = ActionType.COMMIT_CHANGES;
    } else {
        console.log('No specific action matched - do nothing');
        action = ActionType.NOTHING;
    }

    console.log("Action to do:", action);
    core.setOutput(OUTPUT_VARS.ACTION_TO_DO, action);
    return action;
}

async function checkForChangedFiles(): Promise<boolean> {
    try {
        // Check for staged and unstaged changes
        const gitStatus = execSync('git status --porcelain', {encoding: 'utf-8'});

        // If git status returns any output, there are changes
        return gitStatus.trim().length > 0;
    } catch (error) {
        console.error('Error checking for changed files:', error);
        // If we can't check, assume there are no changes to be safe
        return false;
    }
}

async function checkForUnpushedCommits(): Promise<boolean> {
    try {
        // Check for unpushed commits (commits that exist locally but not in upstream)
        const unpushedCommits = execSync('git log @{u}..HEAD --oneline', {encoding: 'utf-8'});

        // If git log returns any output, there are unpushed commits
        return unpushedCommits.trim().length > 0;
    } catch (error) {
        console.error('Error checking for unpushed commits:', error);
        // If we can't check (e.g., no upstream branch), assume there are no unpushed commits
        return false;
    }
}

function exportResultsOutputs(junieTitle: string,
                              junieSummary: string,
                              commitMessage?: string,
                              prTitle?: string,
                              prBody?: string): void {
    core.setOutput(OUTPUT_VARS.JUNIE_TITLE, junieTitle);
    core.setOutput(OUTPUT_VARS.JUNIE_SUMMARY, junieSummary);

    if (commitMessage) {
        core.setOutput(OUTPUT_VARS.COMMIT_MESSAGE, commitMessage);
    }

    if (prTitle && prBody) {
        core.setOutput(OUTPUT_VARS.PR_TITLE, prTitle);
        core.setOutput(OUTPUT_VARS.PR_BODY, prBody);
    }
}


// @ts-ignore
if (import.meta.main) {
    handleResults();
}