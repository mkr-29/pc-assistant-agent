import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { isExtensionConnected, sendCommandToExtension } from '../../server/extensionBridge.js';

const DEFAULT_SCREENSHOT_DIR = path.resolve(process.cwd(), '.data/browser-screenshots');

function formatTimestamp(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}

export function createExtensionTools({
    screenshotDirectory = DEFAULT_SCREENSHOT_DIR,
    now = () => new Date(),
    execFileImpl = execFile
} = {}) {
    async function runExtensionAction(action, payload) {
        if (!isExtensionConnected()) {
            return {
                status: 'ExtensionNotConnected',
                message: 'PC Assistant Chrome Extension is not connected. Load unpacked extension from pc-assistant-extension in Chrome/Brave.'
            };
        }

        try {
            return await sendCommandToExtension({ action, payload });
        } catch (error) {
            return {
                status: 'Error',
                message: error.message
            };
        }
    }

    return {
        extensionListTabs: () => runExtensionAction('LIST_TABS', {}),

        extensionGetActiveTab: () => runExtensionAction('GET_ACTIVE_TAB', {}),

        extensionActivateTab: ({ query, tabId } = {}) =>
            runExtensionAction('ACTIVATE_TAB', { query, tabId }),

        extensionOpenUrl: async ({ url, tabQuery, tabId, createNewTab = false, active = true } = {}) => {
            if (!url) {
                return { status: 'Error', message: 'url parameter is required for extensionOpenUrl' };
            }

            if (isExtensionConnected()) {
                try {
                    const res = await sendCommandToExtension({
                        action: 'OPEN_URL',
                        payload: { url, tabQuery, tabId, createNewTab, active }
                    });
                    if (res && res.status === 'Success') {
                        return res;
                    }
                } catch {
                    // Fall through to native OS browser open
                }
            }

            // Fallback: Open in real desktop browser via macOS open command
            return new Promise(resolve => {
                execFileImpl('/usr/bin/open', [url], { timeout: 10000 }, error => {
                    if (error) {
                        resolve({
                            status: 'Error',
                            message: `Failed to open ${url} in browser: ${error.message}`
                        });
                        return;
                    }
                    resolve({
                        status: 'Success',
                        url,
                        message: `Opened ${url} in desktop browser.`
                    });
                });
            });
        },

        extensionCloseTab: ({ tabQuery, tabId } = {}) =>
            runExtensionAction('CLOSE_TAB', { tabQuery, tabId }),

        extensionReloadTab: ({ tabQuery, tabId } = {}) =>
            runExtensionAction('RELOAD_TAB', { tabQuery, tabId }),

        extensionMediaControl: ({ tabQuery, tabId, action = 'playpause', seekSeconds, volumePercent } = {}) =>
            runExtensionAction('MEDIA_CONTROL', { tabQuery, tabId, action, seekSeconds, volumePercent }),

        extensionDomSnapshot: ({ tabQuery, tabId, maxTextLength, maxElements } = {}) =>
            runExtensionAction('DOM_SNAPSHOT', { tabQuery, tabId, maxTextLength, maxElements }),

        extensionExtractPageSemantics: ({ tabQuery, tabId, maxContentLength, includeTables, includeForms, includeOutline } = {}) =>
            runExtensionAction('EXTRACT_PAGE_SEMANTICS', { tabQuery, tabId, maxContentLength, includeTables, includeForms, includeOutline }),

        extensionClick: ({ tabQuery, tabId, selector, text, elementId, index } = {}) =>
            runExtensionAction('CLICK_ELEMENT', { tabQuery, tabId, selector, text, elementId, index }),

        extensionType: ({ tabQuery, tabId, selector, text, elementId, index, value, clearFirst = true, pressEnter = false } = {}) =>
            runExtensionAction('TYPE_TEXT', { tabQuery, tabId, selector, text, elementId, index, value, clearFirst, pressEnter }),

        extensionScroll: ({ tabQuery, tabId, direction = 'down', amount = 500, selector, elementId, index } = {}) =>
            runExtensionAction('SCROLL_PAGE', { tabQuery, tabId, direction, amount, selector, elementId, index }),

        extensionPressKey: ({ tabQuery, tabId, key = 'Enter', code, selector, elementId, index } = {}) =>
            runExtensionAction('PRESS_KEY', { tabQuery, tabId, key, code, selector, elementId, index }),

        extensionExecuteJs: ({ tabQuery, tabId, jsCode } = {}) =>
            runExtensionAction('EXECUTE_JS', { tabQuery, tabId, jsCode }),

        extensionTakeScreenshot: async ({ tabQuery, tabId } = {}) => {
            const res = await runExtensionAction('TAKE_SCREENSHOT', { tabQuery, tabId });
            if (res && res.status === 'Success' && res.dataUrl) {
                const base64Data = res.dataUrl.replace(/^data:image\/png;base64,/, '');
                const filePath = path.join(screenshotDirectory, `extension-tab-${formatTimestamp(now())}.png`);
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
                return {
                    status: 'Success',
                    screenshotPath: filePath,
                    message: `Captured tab screenshot at ${filePath}`
                };
            }
            return res;
        }
    };
}
