import {access, readFile} from 'fs/promises';
import {join} from 'path';
import {ENV_VARS} from "../../constants/environment";

export interface JunieResults {
    title: string;
    body: string;
}

export async function parseJunieResults(): Promise<JunieResults> {
    const workingDir = process.env[ENV_VARS.WORKING_DIR]!
    const filePath = join(workingDir, '.matterhorn', 'out', 'success.md');

    try {
        await access(filePath);
    } catch (error) {
        console.error(`File not found: ${filePath}`);
        throw new Error('Junie results not found');
    }

    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    let title = '';
    const bodyLines: string[] = [];

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('###')) {
            title = trimmedLine.replace(/^###\s*/, '');
        }
        bodyLines.push(trimmedLine);
    }

    const body = bodyLines.join('\n');
    if (title.length === 0) {
        title = "Junie finished task"
    }
    return {
        title,
        body
    };
}