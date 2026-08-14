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

        browserExtractPageSemantics: ({ url, maxContentLength, includeTables, includeForms, includeOutline, takeScreenshot } = {}) => runBrowserAction(async () => {
            const activePage = await ensurePage();
            if (url) {
                const targetUrl = validateUrl(url);
                await activePage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout });
                if (typeof activePage.waitForLoadState === 'function') {
                    await activePage.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
                }
            }

            const semantics = await activePage.evaluate(({ maxContentLength: maxLen, includeTables: incTables, includeForms: incForms, includeOutline: incOutline }) => {
                function isVisibleEl(el) {
                    if (!el) return false;
                    const style = globalThis.getComputedStyle ? globalThis.getComputedStyle(el) : null;
                    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return false;
                    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
                    return rect.width > 0 && rect.height > 0;
                }

                function selectorForEl(el) {
                    if (!el) return '';
                    const tagName = el.tagName.toLowerCase();
                    if (el.id && globalThis.CSS?.escape) return `#${globalThis.CSS.escape(el.id)}`;
                    if (el.getAttribute('data-testid')) return `${tagName}[data-testid="${el.getAttribute('data-testid').replace(/"/g, '\\"')}"]`;
                    if (el.getAttribute('name')) return `${tagName}[name="${el.getAttribute('name').replace(/"/g, '\\"')}"]`;
                    if (el.getAttribute('aria-label')) return `${tagName}[aria-label="${el.getAttribute('aria-label').replace(/"/g, '\\"')}"]`;
                    return tagName;
                }

                function labelForEl(el) {
                    return (
                        el.innerText
                        || el.value
                        || el.getAttribute('aria-label')
                        || el.getAttribute('placeholder')
                        || el.getAttribute('title')
                        || el.getAttribute('name')
                        || ''
                    ).trim().replace(/\s+/g, ' ').slice(0, 120);
                }

                const doc = document;
                const getMeta = (query) => {
                    const el = doc.querySelector(query);
                    return el ? (el.getAttribute('content') || el.getAttribute('href') || '').trim() : null;
                };

                const metadata = {
                    title: doc.title || getMeta('meta[property="og:title"]') || getMeta('meta[name="twitter:title"]') || '',
                    description: getMeta('meta[name="description"]') || getMeta('meta[property="og:description"]') || getMeta('meta[name="twitter:description"]') || '',
                    canonicalUrl: getMeta('link[rel="canonical"]') || doc.location?.href || '',
                    language: doc.documentElement?.getAttribute('lang') || '',
                    author: getMeta('meta[name="author"]') || getMeta('meta[property="article:author"]') || '',
                    publishedDate: getMeta('meta[property="article:published_time"]') || getMeta('meta[name="pubdate"]') || '',
                    siteName: getMeta('meta[property="og:site_name"]') || '',
                    openGraph: {
                        title: getMeta('meta[property="og:title"]'),
                        description: getMeta('meta[property="og:description"]'),
                        image: getMeta('meta[property="og:image"]'),
                        type: getMeta('meta[property="og:type"]')
                    },
                    twitterCard: {
                        card: getMeta('meta[name="twitter:card"]'),
                        title: getMeta('meta[name="twitter:title"]'),
                        description: getMeta('meta[name="twitter:description"]'),
                        image: getMeta('meta[name="twitter:image"]')
                    }
                };

                const headingOutline = incOutline !== false
                    ? Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))
                        .filter(h => isVisibleEl(h) && (h.innerText || '').trim().length > 0)
                        .map(h => ({
                            level: parseInt(h.tagName.substring(1), 10),
                            text: (h.innerText || '').trim().replace(/\s+/g, ' '),
                            id: h.id || null,
                            selector: selectorForEl(h)
                        }))
                    : [];

                const landmarks = Array.from(doc.querySelectorAll('main, nav, header, footer, aside, article, form, [role="main"], [role="navigation"]'))
                    .filter(isVisibleEl)
                    .map(el => ({
                        type: el.getAttribute('role') || el.tagName.toLowerCase(),
                        tag: el.tagName.toLowerCase(),
                        selector: selectorForEl(el),
                        textSummary: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 120)
                    }));

                const candidateSelectors = 'article, main, [role="main"], .post-content, .article-content, #content, .content, section, body';
                const candidates = Array.from(doc.querySelectorAll(candidateSelectors));
                let bestCandidate = doc.body || doc.documentElement;
                let maxScore = -1;

                for (const el of candidates) {
                    if (!isVisibleEl(el)) continue;
                    let score = 0;
                    const tag = el.tagName.toLowerCase();
                    if (tag === 'article') score += 30;
                    if (tag === 'main' || el.getAttribute('role') === 'main') score += 25;
                    const paragraphs = Array.from(el.querySelectorAll('p'));
                    score += paragraphs.length * 5;
                    const rawText = (el.innerText || '').trim();
                    score += Math.min(Math.floor(rawText.length / 100), 50);
                    if (score > maxScore) {
                        maxScore = score;
                        bestCandidate = el;
                    }
                }

                let extractedText = '';
                if (bestCandidate) {
                    const clone = bestCandidate.cloneNode(true);
                    const noiseEls = clone.querySelectorAll ? clone.querySelectorAll('script, style, noscript, svg, nav, footer, header, aside, .ad, .ads') : [];
                    noiseEls.forEach(n => n.remove());
                    extractedText = (clone.innerText || clone.textContent || '').replace(/\n\s*\n+/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
                }
                if (!extractedText && doc.body) {
                    extractedText = (doc.body.innerText || '').replace(/\s+/g, ' ').trim();
                }

                const limit = maxLen || 5000;
                const truncated = extractedText.length > limit;
                const finalContent = extractedText.slice(0, limit);
                const wordCount = finalContent.split(/\s+/).filter(Boolean).length;

                const mainContent = {
                    text: finalContent,
                    truncated,
                    wordCount,
                    readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200))
                };

                const forms = incForms !== false
                    ? Array.from(doc.querySelectorAll('form'))
                        .filter(isVisibleEl)
                        .map((formEl, idx) => ({
                            id: formEl.id || `form_${idx + 1}`,
                            action: formEl.getAttribute('action') || formEl.action || '',
                            method: (formEl.getAttribute('method') || 'GET').toUpperCase(),
                            selector: selectorForEl(formEl),
                            fields: Array.from(formEl.querySelectorAll('input, select, textarea')).map(input => ({
                                label: labelForEl(input),
                                name: input.getAttribute('name') || input.id || '',
                                type: input.getAttribute('type') || input.tagName.toLowerCase(),
                                value: input.value || '',
                                placeholder: input.getAttribute('placeholder') || '',
                                selector: selectorForEl(input)
                            })),
                            submitButtons: Array.from(formEl.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type="button"]):not([type="reset"])'))
                                .map(btn => ({ text: labelForEl(btn) || 'Submit', selector: selectorForEl(btn) }))
                        }))
                    : [];

                const tables = incTables !== false
                    ? Array.from(doc.querySelectorAll('table'))
                        .filter(isVisibleEl)
                        .map((tableEl, idx) => {
                            const caption = tableEl.querySelector('caption')?.innerText?.trim() || '';
                            const headers = Array.from(tableEl.querySelectorAll('th')).map(th => th.innerText.trim().replace(/\s+/g, ' '));
                            const rows = Array.from(tableEl.querySelectorAll('tbody tr, tr'))
                                .filter(tr => tr.querySelector('td'))
                                .map(tr => Array.from(tr.querySelectorAll('td, th')).map(td => td.innerText.trim().replace(/\s+/g, ' ')));

                            let markdown = '';
                            if (headers.length > 0 || rows.length > 0) {
                                const colCount = Math.max(headers.length, ...rows.map(r => r.length));
                                const paddedHeaders = Array.from({ length: colCount }, (_, i) => headers[i] || `Column ${i + 1}`);
                                markdown += `| ${paddedHeaders.join(' | ')} |\n| ${paddedHeaders.map(() => '---').join(' | ')} |\n`;
                                for (const row of rows) {
                                    const paddedRow = Array.from({ length: colCount }, (_, i) => row[i] || '');
                                    markdown += `| ${paddedRow.join(' | ')} |\n`;
                                }
                            }

                            return {
                                id: tableEl.id || `table_${idx + 1}`,
                                caption,
                                headers,
                                rows,
                                markdown: markdown.trim(),
                                selector: selectorForEl(tableEl)
                            };
                        })
                    : [];

                const interactiveElements = Array.from(doc.querySelectorAll('a, button, input, textarea, select, [role="button"], [role="link"]'))
                    .filter(isVisibleEl)
                    .slice(0, 30)
                    .map(el => ({
                        tag: el.tagName.toLowerCase(),
                        text: labelForEl(el),
                        selector: selectorForEl(el),
                        role: el.getAttribute('role') || null,
                        type: el.getAttribute('type') || null,
                        href: el.href || el.getAttribute('href') || null
                    }));

                return {
                    url: doc.location?.href || '',
                    title: metadata.title || doc.title || '',
                    metadata,
                    mainContent,
                    headingOutline,
                    landmarks,
                    forms,
                    tables,
                    interactiveElements
                };
            }, { maxContentLength, includeTables, includeForms, includeOutline });

            const screenshotPath = await maybeTakeScreenshot(activePage, takeScreenshot, 'semantics');

            return {
                status: 'Success',
                url: activePage.url(),
                title: await activePage.title(),
                data: semantics,
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
