import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
    createBrowserScreenshotPath,
    createBrowserTools
} from '../../src/tools/implementations/browserTools.js';

function createTempDirectory() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'pc-assistant-browser-'));
}

class FakeLocator {
    constructor(page, target, count = 1) {
        this.page = page;
        this.target = target;
        this.matchCount = count;
    }

    first() {
        return this;
    }

    async count() {
        return this.matchCount;
    }

    async click(options) {
        this.page.actions.push({ action: 'click', target: this.target, options });
    }

    async fill(value, options) {
        this.page.actions.push({ action: 'fill', target: this.target, value, options });
    }

    async type(value, options) {
        this.page.actions.push({ action: 'type', target: this.target, value, options });
    }
}

class FakePage {
    constructor() {
        this.actions = [];
        this.currentUrl = 'about:blank';
        this.rawText = 'Hello world from the browser page';
        this.snapshotElements = [
            { tag: 'a', text: 'Home', selector: 'a[href="/"]', role: null, type: null, href: 'https://example.com/' },
            { tag: 'button', text: 'Submit', selector: 'button', role: null, type: 'button', href: null }
        ];
        this.keyboard = {
            press: async key => {
                this.actions.push({ action: 'press', key });
            }
        };
    }

    isClosed() {
        return false;
    }

    async goto(url, options) {
        this.currentUrl = url;
        this.gotoOptions = options;
    }

    url() {
        return this.currentUrl;
    }

    async title() {
        return 'Example Page';
    }

    locator(selector) {
        return new FakeLocator(this, `selector:${selector}`);
    }

    getByText(text) {
        return new FakeLocator(this, `text:${text}`);
    }

    getByLabel(text) {
        return new FakeLocator(this, `label:${text}`);
    }

    getByPlaceholder(text) {
        return new FakeLocator(this, `placeholder:${text}`, 0);
    }

    getByRole(role, options) {
        return new FakeLocator(this, `role:${role}:${options.name}`);
    }

    async evaluate(_fn, args) {
        if (args && args.textLimit !== undefined) {
            return {
                visibleText: this.rawText.slice(0, args.textLimit),
                textTruncated: this.rawText.length > args.textLimit,
                elements: this.snapshotElements.slice(0, args.elementLimit)
            };
        }
        return {
            url: this.currentUrl,
            title: 'Example Page',
            metadata: { title: 'Example Page', description: 'Test description' },
            mainContent: { text: this.rawText, truncated: false, wordCount: 6, readingTimeMinutes: 1 },
            headingOutline: [{ level: 1, text: 'Main Heading', id: null, selector: 'h1' }],
            landmarks: [],
            forms: [],
            tables: [],
            interactiveElements: this.snapshotElements
        };
    }

    async screenshot(options) {
        this.screenshotOptions = options;
        fs.writeFileSync(options.path, 'fake png data');
    }
}

function createFakeChromium() {
    const page = new FakePage();
    const browser = {
        closed: false,
        contextOptions: null,
        async newContext(options) {
            this.contextOptions = options;
            return {
                async newPage() {
                    return page;
                }
            };
        },
        async close() {
            this.closed = true;
        }
    };
    const launches = [];

    return {
        page,
        browser,
        launches,
        chromiumImpl: {
            launch: async options => {
                launches.push(options);
                return browser;
            }
        }
    };
}

test('browserNavigate lazily launches Chromium and navigates the managed page', async () => {
    const fake = createFakeChromium();
    const tools = createBrowserTools({
        config: { browser: { headless: false, timeoutMs: 1234 } },
        chromiumImpl: fake.chromiumImpl
    });

    assert.equal(fake.launches.length, 0);

    const result = await tools.browserNavigate({ url: 'https://example.com/path' });

    assert.equal(result.status, 'Success');
    assert.equal(result.url, 'https://example.com/path');
    assert.equal(result.title, 'Example Page');
    assert.deepEqual(fake.launches, [{ headless: false, timeout: 1234 }]);
    assert.deepEqual(fake.browser.contextOptions, {
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    assert.deepEqual(fake.page.gotoOptions, { waitUntil: 'domcontentloaded', timeout: 1234 });
});

test('browserSnapshot returns bounded text and interactive elements', async () => {
    const fake = createFakeChromium();
    const tools = createBrowserTools({ chromiumImpl: fake.chromiumImpl });

    await tools.browserNavigate({ url: 'https://example.com' });
    const result = await tools.browserSnapshot({ maxTextLength: 5, maxElements: 1 });

    assert.equal(result.status, 'Success');
    assert.equal(result.visibleText, 'Hello');
    assert.equal(result.textTruncated, true);
    assert.deepEqual(result.elements, [fake.page.snapshotElements[0]]);
});

test('browser interaction tools call the expected Playwright APIs', async () => {
    const fake = createFakeChromium();
    const tools = createBrowserTools({
        config: { browser: { timeoutMs: 4321 } },
        chromiumImpl: fake.chromiumImpl
    });

    await tools.browserClick({ selector: '#submit' });
    await tools.browserType({ selector: '#name', value: 'MKR', clearFirst: false });
    await tools.browserType({ text: 'Email', value: 'user@example.com' });
    await tools.browserPressKey({ key: 'Enter' });

    assert.deepEqual(fake.page.actions, [
        { action: 'click', target: 'selector:#submit', options: { timeout: 4321 } },
        { action: 'type', target: 'selector:#name', value: 'MKR', options: { timeout: 4321 } },
        { action: 'fill', target: 'label:Email', value: 'user@example.com', options: { timeout: 4321 } },
        { action: 'press', key: 'Enter' }
    ]);
});

test('browser tools take screenshots when takeScreenshot is true', async () => {
    const screenshotDirectory = createTempDirectory();
    const fake = createFakeChromium();

    try {
        const tools = createBrowserTools({
            chromiumImpl: fake.chromiumImpl,
            screenshotDirectory
        });

        const navResult = await tools.browserNavigate({ url: 'https://example.com', takeScreenshot: true });
        const snapshotResult = await tools.browserSnapshot({ takeScreenshot: true });
        const clickResult = await tools.browserClick({ selector: '#btn', takeScreenshot: true });

        assert.equal(navResult.status, 'Success');
        assert.ok(navResult.screenshotPath.endsWith('.png'));
        assert.equal(fs.existsSync(navResult.screenshotPath), true);

        assert.equal(snapshotResult.status, 'Success');
        assert.ok(snapshotResult.screenshotPath.endsWith('.png'));
        assert.equal(fs.existsSync(snapshotResult.screenshotPath), true);

        assert.equal(clickResult.status, 'Success');
        assert.ok(clickResult.screenshotPath.endsWith('.png'));
        assert.equal(fs.existsSync(clickResult.screenshotPath), true);
    } finally {
        fs.rmSync(screenshotDirectory, { recursive: true, force: true });
    }
});

test('browserScreenshot creates safe png paths inside the screenshot directory', async () => {
    const screenshotDirectory = createTempDirectory();
    const fake = createFakeChromium();

    try {
        const tools = createBrowserTools({
            chromiumImpl: fake.chromiumImpl,
            screenshotDirectory,
            now: () => new Date('2026-07-21T18:00:00.000Z')
        });

        const filePath = createBrowserScreenshotPath({
            fileName: '../Browser Shot?.jpg',
            screenshotDirectory
        });
        const result = await tools.browserScreenshot({
            fileName: '../Browser Shot?.jpg',
            fullPage: true
        });

        assert.equal(filePath, path.join(screenshotDirectory, 'Browser-Shot.png'));
        assert.equal(result.status, 'Success');
        assert.equal(result.filePath, filePath);
        assert.deepEqual(fake.page.screenshotOptions, {
            path: filePath,
            fullPage: true,
            timeout: 30000
        });
        assert.equal(fs.existsSync(filePath), true);
    } finally {
        fs.rmSync(screenshotDirectory, { recursive: true, force: true });
    }
});

test('browserClose closes and resets the managed browser session', async () => {
    const fake = createFakeChromium();
    const tools = createBrowserTools({ chromiumImpl: fake.chromiumImpl });

    await tools.browserNavigate({ url: 'https://example.com' });
    const firstClose = await tools.browserClose();
    const secondClose = await tools.browserClose();

    assert.equal(firstClose.status, 'Success');
    assert.equal(firstClose.message, 'Browser session closed.');
    assert.equal(fake.browser.closed, true);
    assert.equal(secondClose.status, 'Success');
    assert.equal(secondClose.message, 'No active browser session.');
});

test('browser tools return structured errors', async () => {
    const tools = createBrowserTools();

    const result = await tools.browserNavigate({ url: 'file:///tmp/index.html' });

    assert.equal(result.status, 'Error');
    assert.match(result.message, /http:\/\/ or https:\/\//);
});

test('browserExtractPageSemantics extracts semantic page data', async () => {
    const fake = createFakeChromium();
    const tools = createBrowserTools({ chromiumImpl: fake.chromiumImpl });

    const result = await tools.browserExtractPageSemantics({ url: 'https://example.com/article' });

    assert.equal(result.status, 'Success');
    assert.equal(result.url, 'https://example.com/article');
    assert.equal(result.title, 'Example Page');
    assert.ok(result.data);
    assert.equal(result.data.mainContent.text, 'Hello world from the browser page');
    assert.equal(result.data.headingOutline.length, 1);
});
