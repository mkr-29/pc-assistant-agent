import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const DEFAULT_CLIPBOARD_HISTORY_FILE = path.resolve(process.cwd(), '.data/clipboard-history.json');

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

function loadLocalClipboardHistory(historyFilePath = DEFAULT_CLIPBOARD_HISTORY_FILE) {
    try {
        if (fs.existsSync(historyFilePath)) {
            const raw = fs.readFileSync(historyFilePath, 'utf8');
            const data = JSON.parse(raw);
            return Array.isArray(data) ? data : [];
        }
    } catch {
        // Fallback to empty array
    }
    return [];
}

function saveLocalClipboardItem(text, historyFilePath = DEFAULT_CLIPBOARD_HISTORY_FILE) {
    if (!text || typeof text !== 'string') return;
    try {
        const trimmed = text.trim();
        if (!trimmed) return;

        const history = loadLocalClipboardHistory(historyFilePath);
        // Deduplicate recent identical entry
        if (history.length > 0 && history[0].text === trimmed) {
            history[0].timestamp = new Date().toISOString();
        } else {
            history.unshift({
                text: trimmed,
                timestamp: new Date().toISOString()
            });
        }

        // Limit to latest 100 items
        const limited = history.slice(0, 100);
        fs.mkdirSync(path.dirname(historyFilePath), { recursive: true });
        fs.writeFileSync(historyFilePath, JSON.stringify(limited, null, 2), 'utf8');
    } catch {
        // Ignore file save failures
    }
}

async function queryMaccySqlite(query = '', limit = 10) {
    const maccyPaths = [
        path.join(os.homedir(), 'Library/Containers/org.p0deje.Maccy/Data/Library/Application Support/Maccy/Storage.sqlite'),
        path.join(os.homedir(), 'Library/Application Support/Maccy/Storage.sqlite')
    ];

    const dbPath = maccyPaths.find(p => fs.existsSync(p));
    if (!dbPath) return null;

    try {
        let sql = `SELECT value, datetime(lastCopied, 'unixepoch') FROM history_item ORDER BY lastCopied DESC LIMIT ${Math.min(limit * 3, 100)};`;
        const { stdout } = await execFileAsync('sqlite3', [dbPath, sql], { timeout: 5000 });
        if (!stdout) return [];

        const lines = stdout.split('\n').filter(Boolean);
        const results = [];

        for (const line of lines) {
            const parts = line.split('|');
            const val = parts.slice(0, -1).join('|');
            const time = parts[parts.length - 1];
            if (val) {
                if (!query || val.toLowerCase().includes(query.toLowerCase())) {
                    results.push({ text: val, timestamp: time, source: 'Maccy' });
                }
            }
        }
        return results.slice(0, limit);
    } catch {
        return null;
    }
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
    spawnImpl = spawn,
    historyFilePath = DEFAULT_CLIPBOARD_HISTORY_FILE
} = {}) {
    return {
        readClipboard: async () => {
            if (platform !== 'darwin') {
                return unsupportedPlatformResult(platform);
            }

            try {
                const content = await runReadClipboardCommand(execFileImpl);
                if (content) {
                    saveLocalClipboardItem(content, historyFilePath);
                }
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
                saveLocalClipboardItem(clipboardText, historyFilePath);
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
        },

        getMacClipboardHistory: async ({ limit = 10 } = {}) => {
            if (platform !== 'darwin') {
                return unsupportedPlatformResult(platform);
            }

            const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));

            // Try Maccy first if installed
            const maccyItems = await queryMaccySqlite('', safeLimit);
            if (maccyItems && maccyItems.length > 0) {
                return {
                    status: 'Success',
                    source: 'Maccy',
                    count: maccyItems.length,
                    history: maccyItems
                };
            }

            // Fall back to local assistant clipboard tracking
            const localHistory = loadLocalClipboardHistory(historyFilePath);
            const items = localHistory.slice(0, safeLimit);

            return {
                status: 'Success',
                source: 'local-assistant',
                count: items.length,
                history: items
            };
        },

        searchClipboardHistory: async ({ query, limit = 10 } = {}) => {
            if (platform !== 'darwin') {
                return unsupportedPlatformResult(platform);
            }

            if (!query || typeof query !== 'string') {
                return {
                    status: 'Error',
                    message: 'A search query string is required.'
                };
            }

            const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
            const searchQuery = query.trim().toLowerCase();

            // Try Maccy first
            const maccyItems = await queryMaccySqlite(searchQuery, safeLimit);
            if (maccyItems && maccyItems.length > 0) {
                return {
                    status: 'Success',
                    source: 'Maccy',
                    query,
                    count: maccyItems.length,
                    history: maccyItems
                };
            }

            // Fall back to local history
            const localHistory = loadLocalClipboardHistory(historyFilePath);
            const matched = localHistory
                .filter(item => item.text && item.text.toLowerCase().includes(searchQuery))
                .slice(0, safeLimit);

            return {
                status: 'Success',
                source: 'local-assistant',
                query,
                count: matched.length,
                history: matched
            };
        }
    };
}

