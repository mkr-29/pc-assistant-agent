import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const DEFAULT_BROWSER_TIMEOUT_MS = 30000;
const DEFAULT_BROWSER_SCREENSHOT_DIRECTORY = path.resolve(process.cwd(), '.data/browser-screenshots');
const DEFAULT_MAX_TEXT_LENGTH = 3000;
const MAX_TEXT_LENGTH = 10000;
const DEFAULT_MAX_ELEMENTS = 20;
const MAX_ELEMENTS = 50;

function sanitizeFileName(fileName) {
    const baseName = path.basename(String(fileName || '').trim());
    const withoutExtension = baseName.replace(/\.[^.]+$/, '');
    const safeName = withoutExtension
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '');

    return safeName || 'browser-screenshot';
}

function formatTimestamp(date) {
    return date.toISOString().replace(/[:.]/g, '-');
}

function resolveDirectory(directory) {
    if (!directory) {
        return DEFAULT_BROWSER_SCREENSHOT_DIRECTORY;
    }

    return path.isAbsolute(directory) ? directory : path.resolve(process.cwd(), directory);
}

export function createBrowserScreenshotPath({
    fileName,
    screenshotDirectory = DEFAULT_BROWSER_SCREENSHOT_DIRECTORY,
    now = () => new Date()
} = {}) {
    const safeBaseName = fileName
        ? sanitizeFileName(fileName)
        : `browser-screenshot-${formatTimestamp(now())}`;

    return path.join(resolveDirectory(screenshotDirectory), `${safeBaseName}.png`);
}

function clampPositiveInteger(value, defaultValue, maxValue) {
    if (!Number.isInteger(value) || value <= 0) {
        return defaultValue;
    }

    return Math.min(value, maxValue);
}

function validateUrl(url) {
    try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new Error('URL must use http:// or https://.');
        }

        return parsedUrl.toString();
    } catch (error) {
        throw new Error(`Invalid browser URL: ${error.message}`);
    }
}

function formatBrowserError(error) {
    const detail = error?.message || String(error);
    if (/Executable doesn't exist|browserType\.launch/i.test(detail)) {
        return `Failed to start browser. If Playwright browsers are not installed, run: npx playwright install chromium. Details: ${detail}`;
    }

    return detail;
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveLocator(page, { selector, text, forTyping = false }) {
    if (selector) {
        return page.locator(selector).first();
    }

    if (!text) {
        throw new Error('Provide either selector or text.');
    }

    if (forTyping) {
        const escapedText = escapeRegex(text);
        const candidates = [
            page.getByLabel(text).first(),
            page.getByPlaceholder(text).first(),
            page.getByRole('textbox', { name: new RegExp(escapedText, 'i') }).first()
        ];

        for (const candidate of candidates) {
            try {
                if (await candidate.count() > 0) {
                    return candidate;
                }
            } catch {
                // Some injected test doubles may not implement count; fall through.
            }
        }

        return candidates[0];
    }

    return page.getByText(text, { exact: false }).first();
}

async function collectSnapshot(page, { maxTextLength, maxElements }) {
    const textLimit = clampPositiveInteger(maxTextLength, DEFAULT_MAX_TEXT_LENGTH, MAX_TEXT_LENGTH);
    const elementLimit = clampPositiveInteger(maxElements, DEFAULT_MAX_ELEMENTS, MAX_ELEMENTS);
    const [title, pageUrl, pageSnapshot] = await Promise.all([
        page.title(),
        page.url(),
        page.evaluate(({ textLimit: pageTextLimit, elementLimit: pageElementLimit }) => {
            function escapeAttribute(value) {
                return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            }

            function selectorFor(element) {
                const tagName = element.tagName.toLowerCase();
                if (element.id && globalThis.CSS?.escape) {
                    return `#${globalThis.CSS.escape(element.id)}`;
                }
                if (element.getAttribute('data-testid')) {
                    return `${tagName}[data-testid="${escapeAttribute(element.getAttribute('data-testid'))}"]`;
                }
                if (element.getAttribute('name')) {
                    return `${tagName}[name="${escapeAttribute(element.getAttribute('name'))}"]`;
                }
                if (element.getAttribute('aria-label')) {
                    return `${tagName}[aria-label="${escapeAttribute(element.getAttribute('aria-label'))}"]`;
                }

                return tagName;
            }

            function isVisible(element) {
                const style = globalThis.getComputedStyle(element);
                const rect = element.getBoundingClientRect();

                return style.visibility !== 'hidden'
                    && style.display !== 'none'
                    && rect.width > 0
                    && rect.height > 0;
            }

            function labelFor(element) {
                return (
                    element.innerText
                    || element.value
                    || element.getAttribute('aria-label')
                    || element.getAttribute('placeholder')
                    || element.getAttribute('title')
                    || element.getAttribute('name')
                    || ''
                ).trim().replace(/\s+/g, ' ').slice(0, 120);
            }

            const rawText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
            const elementSelectors = 'a,button,input,textarea,select,[role="button"],[role="link"],[contenteditable="true"]';
            const elements = Array.from(document.querySelectorAll(elementSelectors))
                .filter(isVisible)
                .slice(0, pageElementLimit)
                .map(element => ({
                    tag: element.tagName.toLowerCase(),
                    text: labelFor(element),
                    selector: selectorFor(element),
                    role: element.getAttribute('role') || null,
                    type: element.getAttribute('type') || null,
                    href: element.href || null
                }));

            return {
                visibleText: rawText.slice(0, pageTextLimit),
                textTruncated: rawText.length > pageTextLimit,
                elements
            };
        }, { textLimit, elementLimit })
    ]);

    return {
        status: 'Success',
        url: pageUrl,
        title,
        visibleText: pageSnapshot.visibleText,
        textTruncated: pageSnapshot.textTruncated,
        elements: pageSnapshot.elements
    };
}

export function createBrowserTools({
    config = {},
    chromiumImpl = chromium,
    screenshotDirectory,
    now = () => new Date()
} = {}) {
    const browserConfig = config.browser || {};
    const timeout = browserConfig.timeoutMs || DEFAULT_BROWSER_TIMEOUT_MS;
    const headless = browserConfig.headless !== false;
    const browserScreenshotDirectory = screenshotDirectory || browserConfig.screenshotDirectory || DEFAULT_BROWSER_SCREENSHOT_DIRECTORY;
    let browser = null;
    let context = null;
    let page = null;

    async function ensurePage() {
        if (!browser) {
            browser = await chromiumImpl.launch({ headless, timeout });
        }

        if (!context) {
            context = await browser.newContext({
                viewport: { width: 1280, height: 800 },
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            });
        }

        if (!page || page.isClosed?.()) {
            page = await context.newPage();
        }

        return page;
    }

    async function runBrowserAction(action) {
        try {
            return await action();
        } catch (error) {
            return {
                status: 'Error',
                message: formatBrowserError(error)
            };
        }
    }

    async function maybeTakeScreenshot(activePage, takeScreenshot, fileNamePrefix = 'browser-step') {
        if (takeScreenshot !== true) {
            return undefined;
        }

        const filePath = createBrowserScreenshotPath({
            fileName: `${fileNamePrefix}-${formatTimestamp(now())}`,
            screenshotDirectory: browserScreenshotDirectory,
            now
        });

        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        if (typeof activePage.waitForTimeout === 'function') {
            await activePage.waitForTimeout(500).catch(() => {});
        }
        await activePage.screenshot({ path: filePath, timeout });
        return filePath;
    }

    return {
        browserNavigate: ({ url, takeScreenshot } = {}) => runBrowserAction(async () => {
            const targetUrl = validateUrl(url);
            const activePage = await ensurePage();
            await activePage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout });
            if (typeof activePage.waitForLoadState === 'function') {
                await activePage.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
            }
            const screenshotPath = await maybeTakeScreenshot(activePage, takeScreenshot, 'navigate');

            return {
                status: 'Success',
                url: activePage.url(),
                title: await activePage.title(),
                ...(screenshotPath ? { screenshotPath } : {})
            };
        }),

        browserSnapshot: ({ maxTextLength, maxElements, takeScreenshot } = {}) => runBrowserAction(async () => {
            const activePage = await ensurePage();
            const result = await collectSnapshot(activePage, { maxTextLength, maxElements });
            const screenshotPath = await maybeTakeScreenshot(activePage, takeScreenshot, 'snapshot');

            return {
                ...result,
                ...(screenshotPath ? { screenshotPath } : {})
            };
        }),

        browserClick: ({ selector, text, takeScreenshot } = {}) => runBrowserAction(async () => {
            const activePage = await ensurePage();
            const locator = await resolveLocator(activePage, { selector, text });
            await locator.click({ timeout });
            const screenshotPath = await maybeTakeScreenshot(activePage, takeScreenshot, 'click');

            return {
                status: 'Success',
                url: activePage.url(),
                title: await activePage.title(),
                message: 'Clicked element.',
                ...(screenshotPath ? { screenshotPath } : {})
            };
        }),

        browserType: ({ selector, text, value, clearFirst = true, takeScreenshot } = {}) => runBrowserAction(async () => {
            if (value === undefined) {
                throw new Error('value is required.');
            }

            const activePage = await ensurePage();
            const locator = await resolveLocator(activePage, { selector, text, forTyping: true });
            if (clearFirst) {
                await locator.fill(String(value), { timeout });
            } else {
                await locator.type(String(value), { timeout });
            }
            const screenshotPath = await maybeTakeScreenshot(activePage, takeScreenshot, 'type');

            return {
                status: 'Success',
                url: activePage.url(),
                title: await activePage.title(),
                message: 'Typed into element.',
                ...(screenshotPath ? { screenshotPath } : {})
            };
        }),

        browserPressKey: ({ key, takeScreenshot } = {}) => runBrowserAction(async () => {
            if (!key) {
                throw new Error('key is required.');
            }

            const activePage = await ensurePage();
            await activePage.keyboard.press(key);
            const screenshotPath = await maybeTakeScreenshot(activePage, takeScreenshot, 'presskey');

            return {
                status: 'Success',
                url: activePage.url(),
                title: await activePage.title(),
                message: `Pressed ${key}.`,
                ...(screenshotPath ? { screenshotPath } : {})
            };
        }),

        browserScreenshot: ({ fileName, fullPage = false } = {}) => runBrowserAction(async () => {
            const activePage = await ensurePage();
            const filePath = createBrowserScreenshotPath({
                fileName,
                screenshotDirectory: browserScreenshotDirectory,
                now
            });

            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            if (typeof activePage.waitForTimeout === 'function') {
                await activePage.waitForTimeout(500).catch(() => {});
            }
            await activePage.screenshot({ path: filePath, fullPage: fullPage === true, timeout });

            return {
                status: 'Success',
                filePath,
                message: `Browser screenshot captured at ${filePath}`
            };
        }),

        browserClose: () => runBrowserAction(async () => {
            if (!browser) {
                return {
                    status: 'Success',
                    message: 'No active browser session.'
                };
            }

            await browser.close();
            browser = null;
            context = null;
            page = null;

            return {
                status: 'Success',
                message: 'Browser session closed.'
            };
        })
    };
}
