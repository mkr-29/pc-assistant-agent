import { execFile, spawn } from 'child_process';

const UNSUPPORTED_PLATFORM_MESSAGE = 'Clipboard tools are currently supported only on macOS via pbpaste and pbcopy.';

function unsupportedPlatformResult(platform) {
    return {
        status: 'Error',
        message: `${UNSUPPORTED_PLATFORM_MESSAGE} Current platform: ${platform}.`
    };
}

function formatCommandError(command, error, stderr = '') {
    const detail = String(stderr || '').trim() || error?.message || String(error);
    return `${command} failed: ${detail}`;
}

function runReadClipboardCommand(execFileImpl) {
    return new Promise((resolve, reject) => {
        execFileImpl('pbpaste', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout = '', stderr = '') => {
            if (error) {
                reject(new Error(formatCommandError('pbpaste', error, stderr)));
                return;
            }

            resolve(stdout || '');
        });
    });
}

function runWriteClipboardCommand(spawnImpl, content) {
    return new Promise((resolve, reject) => {
        const child = spawnImpl('pbcopy', [], { stdio: ['pipe', 'ignore', 'pipe'] });
        let stderr = '';
        let settled = false;

        function fail(error) {
            if (settled) {
                return;
            }

            settled = true;
            reject(error);
        }

        child.stderr?.setEncoding?.('utf8');
        child.stderr?.on?.('data', chunk => {
            stderr += chunk;
        });

        child.on('error', error => {
            fail(new Error(formatCommandError('pbcopy', error, stderr)));
        });

        child.on('close', code => {
            if (settled) {
                return;
            }

            settled = true;
            if (code === 0) {
                resolve();
                return;
            }

            const detail = stderr.trim() ? `: ${stderr.trim()}` : '';
            reject(new Error(`pbcopy failed with exit code ${code}${detail}`));
        });

        child.stdin?.on?.('error', error => {
            fail(new Error(formatCommandError('pbcopy', error, stderr)));
        });
        child.stdin.end(content, 'utf8');
    });
}

export function createClipboardTools({
    platform = process.platform,
    execFileImpl = execFile,
    spawnImpl = spawn
} = {}) {
    return {
        readClipboard: async () => {
            if (platform !== 'darwin') {
                return unsupportedPlatformResult(platform);
            }

            try {
                const content = await runReadClipboardCommand(execFileImpl);
                return {
                    status: 'Success',
                    content,
                    length: content.length
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: error.message
                };
            }
        },

        writeClipboard: async ({ content } = {}) => {
            if (platform !== 'darwin') {
                return unsupportedPlatformResult(platform);
            }

            if (content === undefined || content === null) {
                return {
                    status: 'Error',
                    message: 'content is required.'
                };
            }

            const clipboardText = String(content);

            try {
                await runWriteClipboardCommand(spawnImpl, clipboardText);
                return {
                    status: 'Success',
                    length: clipboardText.length,
                    message: 'Clipboard updated.'
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: error.message
                };
            }
        }
    };
}
