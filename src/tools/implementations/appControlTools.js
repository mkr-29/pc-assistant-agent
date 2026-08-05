import fs from 'fs';
import { execFile } from 'child_process';

const OPEN_COMMAND = '/usr/bin/open';
const OSASCRIPT_COMMAND = '/usr/bin/osascript';
const OPEN_TIMEOUT_MS = 10000;
const OPEN_MAX_BUFFER_BYTES = 64 * 1024;
const UNSUPPORTED_PLATFORM_MESSAGE = 'App control tools are currently supported only on macOS.';

const APP_ALIASES = new Map([
    ['chrome', 'Google Chrome'],
    ['google chrome', 'Google Chrome'],
    ['brave', 'Brave Browser'],
    ['brave browser', 'Brave Browser'],
    ['safari', 'Safari'],
    ['edge', 'Microsoft Edge'],
    ['vs code', 'Visual Studio Code'],
    ['vscode', 'Visual Studio Code'],
    ['code', 'Visual Studio Code'],
    ['visual studio code', 'Visual Studio Code'],
    ['finder', 'Finder'],
    ['terminal', 'Terminal']
]);

function unsupportedPlatformResult(platform) {
    return {
        status: 'Error',
        message: `${UNSUPPORTED_PLATFORM_MESSAGE} Current platform: ${platform}.`
    };
}

function normalizeAppName(appName) {
    const trimmedName = String(appName || '').trim();

    if (!trimmedName) {
        return '';
    }

    return APP_ALIASES.get(trimmedName.toLowerCase()) || trimmedName;
}

function normalizeBrowserAppName(appName) {
    const raw = String(appName || '').trim().toLowerCase();
    if (raw.includes('brave')) return 'Brave Browser';
    if (raw.includes('chrome')) return 'Google Chrome';
    if (raw.includes('safari')) return 'Safari';
    if (raw.includes('edge')) return 'Microsoft Edge';
    return String(appName || '').trim() || 'Brave Browser';
}

function formatCommandError(command, error, stderr = '') {
    const detail = String(stderr || '').trim() || error?.message || String(error);
    return `${command} failed: ${detail}`;
}

function runOpenCommand(execFileImpl, args) {
    return new Promise((resolve, reject) => {
        execFileImpl(
            OPEN_COMMAND,
            args,
            {
                timeout: OPEN_TIMEOUT_MS,
                maxBuffer: OPEN_MAX_BUFFER_BYTES
            },
            (error, stdout = '', stderr = '') => {
                if (error) {
                    reject(new Error(formatCommandError(OPEN_COMMAND, error, stderr)));
                    return;
                }

                resolve({ stdout, stderr });
            }
        );
    });
}

function runAppleScript(execFileImpl, scriptText) {
    return new Promise((resolve, reject) => {
        execFileImpl(
            OSASCRIPT_COMMAND,
            ['-e', scriptText],
            { timeout: 15000, maxBuffer: OPEN_MAX_BUFFER_BYTES },
            (error, stdout = '', stderr = '') => {
                if (error) {
                    reject(new Error(formatCommandError(OSASCRIPT_COMMAND, error, stderr)));
                    return;
                }

                resolve(stdout.trim());
            }
        );
    });
}

function buildOpenArgs({ appName, resolvedPath, revealInFinder }) {
    if (revealInFinder) {
        return ['-R', resolvedPath];
    }

    if (appName && resolvedPath) {
        return ['-a', appName, resolvedPath];
    }

    if (appName) {
        return ['-a', appName];
    }

    return [resolvedPath];
}

function buildChromiumAppleScript({ browserName, query, action, jsScript }) {
    const safeQuery = String(query || '').replace(/(["\\])/g, '\\$1');
    const safeJs = String(jsScript || '').replace(/(["\\])/g, '\\$1');
    const normAction = String(action || 'playpause').toLowerCase();
    const isSafari = String(browserName || '').toLowerCase().includes('safari');

    let rawJs = '';
    if (normAction === 'executejs' && safeJs) {
        rawJs = safeJs;
    } else if (normAction === 'next') {
        rawJs = `const b = document.querySelector('.next-button, #next-button, tp-yt-paper-icon-button[title*="Next"], button[aria-label*="Next"], .ytmusic-player-bar[aria-label*="Next"]'); if (b) b.click();`;
    } else if (normAction === 'previous') {
        rawJs = `const b = document.querySelector('.previous-button, #previous-button, tp-yt-paper-icon-button[title*="Previous"], button[aria-label*="Previous"]'); if (b) b.click();`;
    } else if (normAction !== 'reload') {
        rawJs = `(() => {
            const b = document.querySelector('#play-pause-button, .play-pause-button, tp-yt-paper-icon-button#play-pause-button, button[aria-label*="Play"], button[aria-label*="Pause"], button.play-button');
            const v = document.querySelector('video, audio');
            const title = (b ? (b.getAttribute('title') || b.getAttribute('aria-label') || '') : '').toLowerCase();
            const act = '${normAction}';
            if (act === 'play') {
                if (b && (title.includes('play') || (v && v.paused))) { b.click(); }
                else if (v && v.paused) { v.play(); }
            } else if (act === 'pause') {
                if (b && (title.includes('pause') || (v && !v.paused))) { b.click(); }
                else if (v && !v.paused) { v.pause(); }
            } else {
                if (b) { b.click(); }
                else if (v) { v.paused ? v.play() : v.pause(); }
            }
        })()`;
    }

    let jsAction = '';
    if (normAction === 'reload') {
        jsAction = `reload t`;
    } else {
        const safeRawJs = rawJs.replace(/(["\\])/g, '\\$1');
        jsAction = isSafari ? `do JavaScript "${safeRawJs}" in t` : `execute t javascript "${safeRawJs}"`;
    }

    if (safeQuery) {
        return [
            `tell application "${browserName}"`,
            `    if not (exists window 1) then return "No open window found for ${browserName}"`,
            `    set foundTab to false`,
            `    repeat with w in windows`,
            `        set tabIndex to 1`,
            `        repeat with t in tabs of w`,
            `            set tTitle to title of t`,
            `            set tUrl to URL of t`,
            `            if (tTitle contains "${safeQuery}" or tUrl contains "${safeQuery}") then`,
            `                set active tab index of w to tabIndex`,
            `                set index of w to 1`,
            `                activate`,
            `                ${jsAction}`,
            `                set foundTab to true`,
            `                exit repeat`,
            `            end if`,
            `            set tabIndex to tabIndex + 1`,
            `        end repeat`,
            `        if foundTab then exit repeat`,
            `    end repeat`,
            `    if not foundTab then return "No tab matching '${safeQuery}' found in ${browserName}"`,
            `    return "Success"`,
            `end tell`
        ].join('\n');
    }

    return [
        `tell application "${browserName}"`,
        `    if not (exists window 1) then return "No open window found for ${browserName}"`,
        `    activate`,
        `    set t to active tab of window 1`,
        `    ${jsAction}`,
        `    return "Success"`,
        `end tell`
    ].join('\n');
}

export function createAppControlTools({
    resolveToolPath,
    platform = process.platform,
    execFileImpl = execFile,
    pathExists = fs.existsSync
} = {}) {
    return {
        openLocalTarget: async ({ appName, targetPath, revealInFinder = false } = {}) => {
            if (platform !== 'darwin') {
                return unsupportedPlatformResult(platform);
            }

            const normalizedAppName = normalizeAppName(appName);
            const hasTargetPath = targetPath !== undefined && targetPath !== null && String(targetPath).trim() !== '';

            if (!normalizedAppName && !hasTargetPath) {
                return {
                    status: 'Error',
                    message: 'Provide appName, targetPath, or both.'
                };
            }

            if (revealInFinder && !hasTargetPath) {
                return {
                    status: 'Error',
                    message: 'targetPath is required when revealInFinder is true.'
                };
            }

            const resolvedPath = hasTargetPath ? resolveToolPath(targetPath) : null;

            if (resolvedPath && !pathExists(resolvedPath)) {
                return {
                    status: 'Error',
                    targetPath: resolvedPath,
                    message: `Path does not exist: ${resolvedPath}`
                };
            }

            const args = buildOpenArgs({
                appName: normalizedAppName,
                resolvedPath,
                revealInFinder: Boolean(revealInFinder)
            });

            try {
                await runOpenCommand(execFileImpl, args);

                return {
                    status: 'Success',
                    appName: normalizedAppName || null,
                    targetPath: resolvedPath,
                    revealInFinder: Boolean(revealInFinder),
                    command: OPEN_COMMAND,
                    args,
                    message: revealInFinder
                        ? `Revealed ${resolvedPath} in Finder.`
                        : `Opened ${resolvedPath || normalizedAppName}.`
                };
            } catch (error) {
                return {
                    status: 'Error',
                    appName: normalizedAppName || null,
                    targetPath: resolvedPath,
                    revealInFinder: Boolean(revealInFinder),
                    command: OPEN_COMMAND,
                    args,
                    message: error.message
                };
            }
        },

        controlDesktopBrowser: async ({ browserName, tabQuery = 'YouTube Music', action = 'playpause', jsScript } = {}) => {
            if (platform !== 'darwin') {
                return unsupportedPlatformResult(platform);
            }

            const targetBrowser = normalizeBrowserAppName(browserName);
            const script = buildChromiumAppleScript({
                browserName: targetBrowser,
                query: tabQuery,
                action,
                jsScript
            });

            try {
                const output = await runAppleScript(execFileImpl, script);
                const isError = output.startsWith('No ');

                return {
                    status: isError ? 'Error' : 'Success',
                    browserName: targetBrowser,
                    tabQuery,
                    action,
                    message: output || `Executed ${action} on ${targetBrowser} tab matching '${tabQuery}'.`
                };
            } catch (error) {
                return {
                    status: 'Error',
                    browserName: targetBrowser,
                    tabQuery,
                    action,
                    message: error.message
                };
            }
        },

        controlMediaPlayback: async ({ action = 'playpause', volume, appName } = {}) => {
            if (platform !== 'darwin') {
                return unsupportedPlatformResult(platform);
            }

            const targetApp = appName ? normalizeAppName(appName) : null;
            const normAction = String(action || 'playpause').toLowerCase();

            let script = '';
            let isVolumeAction = false;
            let targetVol = null;

            if (volume !== undefined || normAction === 'volume' || normAction === 'setvolume') {
                isVolumeAction = true;
                const rawVol = volume !== undefined ? volume : parseInt(normAction.replace(/\D/g, ''), 10);
                targetVol = isNaN(Number(rawVol)) ? 50 : Math.max(0, Math.min(100, Math.round(Number(rawVol))));
                script = `set volume output volume ${targetVol}`;
            } else if (normAction === 'mute') {
                isVolumeAction = true;
                script = `set volume output muted true`;
            } else if (normAction === 'unmute') {
                isVolumeAction = true;
                script = `set volume output muted false`;
            } else {
                let keyCode = 16; // Play/Pause
                if (normAction === 'next') keyCode = 20;
                if (normAction === 'previous') keyCode = 18;

                script = targetApp
                    ? `tell application "${targetApp}" to activate\ntell application "System Events" to key code ${keyCode}`
                    : `tell application "System Events" to key code ${keyCode}`;
            }

            try {
                await runAppleScript(execFileImpl, script);

                return {
                    status: 'Success',
                    action: normAction,
                    volume: targetVol,
                    appName: targetApp,
                    message: isVolumeAction
                        ? (targetVol !== null ? `Set macOS output volume to ${targetVol}%.` : `Triggered ${normAction} audio action.`)
                        : (targetApp
                            ? `Triggered ${normAction} media control for ${targetApp}.`
                            : `Triggered ${normAction} system media control.`)
                };
            } catch (error) {
                return {
                    status: 'Error',
                    action: normAction,
                    volume: targetVol,
                    appName: targetApp,
                    message: error.message
                };
            }
        }
    };
}
