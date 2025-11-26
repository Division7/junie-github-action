import * as core from "@actions/core";

/**
 * Maximum allowed size for task input (prompt) in characters.
 * GitHub workflow_dispatch inputs are limited to 20KB.
 * We reserve 1KB for other parameters, leaving 19KB for the task description.
 */
const MAX_INPUT_SIZE = 19000;

/**
 * Validates that the input string does not exceed the maximum allowed size.
 *
 * This validation ensures that prompts fit within GitHub workflow_dispatch input limits (20KB total).
 * We reserve 1KB for other workflow parameters like action type, PR number, etc.
 *
 * @param input - The input string to validate
 * @param inputName - The name of the input field (for error messages), defaults to "prompt"
 * @throws {Error} if input exceeds MAX_INPUT_SIZE (19000 characters)
 */
export function validateInputSize(input: string, inputName: string = "prompt"): void {
    const actualSize = input.length;

    if (actualSize > MAX_INPUT_SIZE) {
        const errorMessage =
            `❌ Input "${inputName}" is too large: ${actualSize} characters (maximum: ${MAX_INPUT_SIZE}). ` +
            `This limit exists because GitHub workflow_dispatch inputs are limited to 20KB. ` +
            `Please reduce the size of your ${inputName} and try again.`;

        core.error(errorMessage);
        throw new Error(errorMessage);
    }

    core.info(`✓ Input size validation passed: ${actualSize}/${MAX_INPUT_SIZE} characters`);
}
