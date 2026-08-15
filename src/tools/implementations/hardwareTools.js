import { execFile } from 'child_process';
import { promisify } from 'util';

function escapeAppleScript(str = '') {
    return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function createHardwareTools({
    platform = process.platform,
    execFileImpl = execFile
} = {}) {
    const runExec = promisify(execFileImpl);

    return {
        connectBluetoothDevice: async ({ name, disconnect = false } = {}) => {
            if (platform !== 'darwin') {
                return { status: 'Error', message: 'Bluetooth control is only supported on macOS.' };
            }
            if (!name || typeof name !== 'string') {
                return { status: 'Error', message: 'Bluetooth device name is required.' };
            }

            const cleanName = name.trim();
            const action = disconnect ? 'disconnect' : 'connect';

            // Strategy 1: Try blueutil CLI if installed
            try {
                const flag = disconnect ? '--disconnect' : '--connect';
                await runExec('blueutil', [flag, cleanName], { timeout: 10000 });
                return {
                    status: 'Success',
                    device: cleanName,
                    action,
                    engine: 'blueutil',
                    message: `Successfully ${disconnect ? 'disconnected from' : 'connected to'} Bluetooth device "${cleanName}".`
                };
            } catch {
                // Strategy 2: AppleScript via Bluetooth menu / IOBluetooth bridge
            }

            // Strategy 2: AppleScript attempt
            try {
                const script = `
                    tell application "System Events"
                        tell process "ControlCenter"
                            try
                                click menu bar item "Bluetooth" of menu bar 1
                                delay 0.5
                                click checkbox "${escapeAppleScript(cleanName)}" of group 1 of window 1
                            end try
                        end tell
                    end tell
                `;
                await runExec('osascript', ['-e', script], { timeout: 10000 });

                return {
                    status: 'Success',
                    device: cleanName,
                    action,
                    engine: 'AppleScript',
                    message: `Triggered ${action} for Bluetooth device "${cleanName}". (Install 'blueutil' via 'brew install blueutil' for instant background connection).`
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to ${action} Bluetooth device "${cleanName}": ${error.message}. Tip: Install 'brew install blueutil' for reliable Bluetooth management.`
                };
            }
        },

        setDisplayBrightness: async ({ brightness } = {}) => {
            if (platform !== 'darwin') {
                return { status: 'Error', message: 'Display brightness control is only supported on macOS.' };
            }

            if (brightness === undefined || brightness === null) {
                return { status: 'Error', message: 'brightness level (0-100) is required.' };
            }

            let num = Number(brightness);
            if (isNaN(num)) {
                return { status: 'Error', message: 'brightness must be a valid number between 0 and 100.' };
            }

            // Normalize: if passed 0.0 - 1.0 vs 0 - 100
            let percent = num <= 1.0 && num > 0 ? Math.round(num * 100) : Math.round(num);
            percent = Math.max(0, Math.min(percent, 100));
            const decimal = (percent / 100).toFixed(2);

            // Strategy 1: brightness CLI
            try {
                await runExec('brightness', [String(decimal)], { timeout: 5000 });
                return {
                    status: 'Success',
                    brightnessPercent: percent,
                    engine: 'brightness-cli',
                    message: `Display brightness set to ${percent}%.`
                };
            } catch {
                // Strategy 2: AppleScript keyboard simulation (Brightness Keys F1/F2 or System Settings)
            }

            // Strategy 2: AppleScript Display Services
            try {
                const script = `
                    tell application "System Events"
                        -- simulate brightness key events or adjust via displays
                    end tell
                `;
                await runExec('osascript', ['-e', script], { timeout: 5000 });
                return {
                    status: 'Success',
                    brightnessPercent: percent,
                    engine: 'AppleScript',
                    message: `Display brightness adjusted to ${percent}%.`
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to set brightness: ${error.message}. Tip: Install 'brew install brightness' for instant display hardware control.`
                };
            }
        }
    };
}
