import fs from 'fs';
import path from 'path';
import { isExtensionConnected, sendCommandToExtension } from '../../server/extensionBridge.js';

const DEFAULT_SCREENSHOT_DIR = path.resolve(process.cwd(), '.data/browser-screenshots');

function formatTimestamp(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}

export function createExtensionTools({ screenshotDirectory = DEFAULT_SCREENSHOT_DIR, now = () => new Date() } = {}) {
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

        extensionActivateTab: ({ query, tabId } = {}) =>
            runExtensionAction('ACTIVATE_TAB', { query, tabId }),

        extensionMediaControl: ({ tabQuery, tabId, action = 'playpause' } = {}) =>
            runExtensionAction('MEDIA_CONTROL', { tabQuery, tabId, action }),

        extensionDomSnapshot: ({ tabQuery, tabId, maxTextLength, maxElements } = {}) =>
            runExtensionAction('DOM_SNAPSHOT', { tabQuery, tabId, maxTextLength, maxElements }),

        extensionExtractPageSemantics: ({ tabQuery, tabId, maxContentLength, includeTables, includeForms, includeOutline } = {}) =>
            runExtensionAction('EXTRACT_PAGE_SEMANTICS', { tabQuery, tabId, maxContentLength, includeTables, includeForms, includeOutline }),

        extensionClick: ({ tabQuery, tabId, selector, text } = {}) =>
            runExtensionAction('CLICK_ELEMENT', { tabQuery, tabId, selector, text }),

        extensionType: ({ tabQuery, tabId, selector, text, value, clearFirst = true } = {}) =>
            runExtensionAction('TYPE_TEXT', { tabQuery, tabId, selector, text, value, clearFirst }),

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
