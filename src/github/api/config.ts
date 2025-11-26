import {ENV_VARS} from "../../constants/environment";

export const GITHUB_API_URL =
    process.env[ENV_VARS.GITHUB_API_URL] || "https://api.github.com";
export const GITHUB_SERVER_URL =
    process.env[ENV_VARS.GITHUB_SERVER_URL] || "https://github.com";
