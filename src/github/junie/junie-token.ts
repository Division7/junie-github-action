import {GitHubContext} from "../context";
import * as core from "@actions/core";
import {OUTPUT_VARS} from "../../constants/environment";

export async function prepareJunieCLIToken(context: GitHubContext) {
    core.setOutput(OUTPUT_VARS.EJ_CLI_TOKEN, context.inputs.appToken);
}