import fs from 'fs';
import { exec, execFile } from 'child_process';

const OSASCRIPT_PATH = '/usr/bin/osascript';

function runAppleScript(execFileImpl, scriptText) {
    return new Promise((resolve, reject) => {
        execFileImpl(
            OSASCRIPT_PATH,
            [
                '-e', scriptText,
                '-e', 'tell application "Terminal" to activate'
            ],
            { timeout: 10000 },
            (error, stdout = '', stderr = '') => {
                if (error) {
                    reject(new Error(stderr.trim() || error.message));
                    return;
                }
                resolve({ stdout, stderr });
            }
        );
    });
}

export function createTerminalTools({
    resolveToolPath,
    platform = process.platform,
    execFileImpl = execFile,
    execImpl = exec,
    pathExists = fs.existsSync
} = {}) {
    return {
        executeCommand: ({ command, cwd }) => {
            const resolvedCwd = resolveToolPath(cwd);

            if (!pathExists(resolvedCwd)) {
                fs.mkdirSync(resolvedCwd, { recursive: true });
            }

            return new Promise(resolve => {
                execImpl(command, { cwd: resolvedCwd }, (error, stdout, stderr) => {
                    resolve({
                        stdout: stdout || '',
                        stderr: stderr || '',
                        error: error ? error.message : null
                    });
                });
            });
        },

        openTerminal: async ({ command, cwd } = {}) => {
            if (platform !== 'darwin') {
                return {
                    status: 'Error',
                    message: `Opening Terminal GUI is currently supported only on macOS. Current platform: ${platform}.`
                };
            }

            const resolvedCwd = resolveToolPath(cwd);

            if (!pathExists(resolvedCwd)) {
                fs.mkdirSync(resolvedCwd, { recursive: true });
            }

            const safeCwd = resolvedCwd.replace(/(["\\])/g, '\\$1');
            const trimmedCmd = String(command || '').trim();
            const safeCmd = trimmedCmd.replace(/(["\\])/g, '\\$1');

            const scriptText = safeCmd
                ? `tell application "Terminal" to do script "cd \\"${safeCwd}\\" && ${safeCmd}"`
                : `tell application "Terminal" to do script "cd \\"${safeCwd}\\""`;

            try {
                await runAppleScript(execFileImpl, scriptText);
                return {
                    status: 'Success',
                    appName: 'Terminal',
                    cwd: resolvedCwd,
                    command: trimmedCmd || null,
                    message: trimmedCmd
                        ? `Opened Terminal window in ${resolvedCwd} and executed: ${trimmedCmd}`
                        : `Opened Terminal window in ${resolvedCwd}`
                };
            } catch (error) {
                return {
                    status: 'Error',
                    appName: 'Terminal',
                    cwd: resolvedCwd,
                    command: trimmedCmd || null,
                    message: `Failed to open Terminal: ${error.message}`
                };
            }
        }
    };
}
