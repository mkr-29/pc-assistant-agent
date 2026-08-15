import { execFile } from 'child_process';
import { promisify } from 'util';

function escapeAppleScript(str = '') {
    return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function createWindowTools({
    platform = process.platform,
    execFileImpl = execFile
} = {}) {
    const runExec = promisify(execFileImpl);

    async function runOsaScript(script) {
        if (platform !== 'darwin') {
            return {
                status: 'Error',
                message: `Window management tools are only supported on macOS. Current platform: ${platform}.`
            };
        }
        try {
            const res = await runExec('osascript', ['-e', script], { timeout: 10000 });
            const stdout = typeof res === 'string' ? res : (res?.stdout || '');
            return { status: 'Success', output: stdout.trim() };
        } catch (error) {
            return {
                status: 'Error',
                message: `AppleScript failed: ${error.message}`
            };
        }
    }

    return {
        listOpenWindows: async () => {
            if (platform !== 'darwin') {
                return { status: 'Error', message: 'Window management is only supported on macOS.' };
            }

            const script = `
                tell application "System Events"
                    set winList to {}
                    set appList to (every application process whose visible is true)
                    repeat with appProc in appList
                        set appName to name of appProc
                        try
                            set wList to (every window of appProc)
                            repeat with w in wList
                                set wName to name of w
                                if wName is not "" then
                                    set end of winList to (appName & "|" & wName)
                                end if
                            end repeat
                        end try
                    end repeat
                    set AppleScript's text item delimiters to linefeed
                    return winList as string
                end tell
            `;

            const res = await runOsaScript(script);
            if (res.status === 'Error') return res;

            const lines = res.output ? res.output.split('\n').filter(Boolean) : [];
            const windows = lines.map(line => {
                const parts = line.split('|');
                return {
                    application: parts[0],
                    title: parts.slice(1).join('|')
                };
            });

            return {
                status: 'Success',
                totalWindows: windows.length,
                windows
            };
        },

        focusWindow: async ({ appName, windowTitle } = {}) => {
            if (platform !== 'darwin') {
                return { status: 'Error', message: 'Window management is only supported on macOS.' };
            }
            if (!appName || typeof appName !== 'string') {
                return { status: 'Error', message: 'appName is required to focus a window.' };
            }

            const cleanApp = escapeAppleScript(appName);
            const script = `
                tell application "${cleanApp}"
                    activate
                end tell
            `;

            const res = await runOsaScript(script);
            if (res.status === 'Error') return res;

            return {
                status: 'Success',
                application: appName,
                message: `Brought "${appName}" to the foreground.`
            };
        },

        tileWindows: async ({ leftApp, rightApp } = {}) => {
            if (platform !== 'darwin') {
                return { status: 'Error', message: 'Window management is only supported on macOS.' };
            }
            if (!leftApp || !rightApp) {
                return { status: 'Error', message: 'Both leftApp and rightApp names are required for tiling.' };
            }

            const cleanLeft = escapeAppleScript(leftApp);
            const cleanRight = escapeAppleScript(rightApp);

            const script = `
                tell application "Finder"
                    set screenBounds to bounds of window of desktop
                    set screenWidth to item 3 of screenBounds
                    set screenHeight to item 4 of screenBounds
                end tell
                set halfWidth to screenWidth / 2

                tell application "${cleanLeft}" to activate
                tell application "System Events"
                    tell process "${cleanLeft}"
                        try
                            set position of window 1 to {0, 0}
                            set size of window 1 to {halfWidth, screenHeight}
                        end try
                    end tell
                end tell

                tell application "${cleanRight}" to activate
                tell application "System Events"
                    tell process "${cleanRight}"
                        try
                            set position of window 1 to {halfWidth, 0}
                            set size of window 1 to {halfWidth, screenHeight}
                        end try
                    end tell
                end tell
            `;

            const res = await runOsaScript(script);
            if (res.status === 'Error') return res;

            return {
                status: 'Success',
                leftApp,
                rightApp,
                message: `Tiled "${leftApp}" on the left half and "${rightApp}" on the right half.`
            };
        },

        minimizeAllWindows: async () => {
            if (platform !== 'darwin') {
                return { status: 'Error', message: 'Window management is only supported on macOS.' };
            }

            const script = `
                tell application "System Events"
                    set visible of every process whose visible is true and name is not "Finder" to false
                end tell
            `;

            const res = await runOsaScript(script);
            if (res.status === 'Error') return res;

            return {
                status: 'Success',
                message: 'Minimized all active application windows.'
            };
        }
    };
}
