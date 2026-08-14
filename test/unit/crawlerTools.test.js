import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createCrawlerTools } from '../../src/tools/implementations/crawlerTools.js';

describe('crawlerTools', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    describe('parseSitemap', () => {
        it('returns error when sitemapUrl is missing', async () => {
            const tools = createCrawlerTools();
            const res = await tools.parseSitemap({});
            assert.equal(res.status, 'Error');
            assert.match(res.message, /sitemapUrl is required/i);
        });

        it('parses standard XML sitemap correctly', async () => {
            const sampleSitemap = `
                <?xml version="1.0" encoding="UTF-8"?>
                <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                    <url>
                        <loc>https://example.com/page1</loc>
                        <lastmod>2025-01-15</lastmod>
                    </url>
                    <url>
                        <loc>https://example.com/page2</loc>
                        <lastmod>2025-01-20</lastmod>
                    </url>
                </urlset>
            `;

            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => sampleSitemap
            });

            const tools = createCrawlerTools();
            const res = await tools.parseSitemap({ sitemapUrl: 'example.com/sitemap.xml' });

            assert.equal(res.status, 'Success');
            assert.equal(res.totalUrls, 2);
            assert.equal(res.urls[0].url, 'https://example.com/page1');
            assert.equal(res.urls[0].lastmod, '2025-01-15');
            assert.equal(res.urls[1].url, 'https://example.com/page2');
        });
    });

    describe('crawlWebDocumentation', () => {
        it('returns error when startUrl is missing', async () => {
            const tools = createCrawlerTools();
            const res = await tools.crawlWebDocumentation({});
            assert.equal(res.status, 'Error');
            assert.match(res.message, /startUrl is required/i);
        });

        it('crawls pages and converts them to markdown files', async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crawl-test-'));

            globalThis.fetch = async (url) => {
                if (url.includes('/docs/page1')) {
                    return {
                        ok: true,
                        headers: new Map([['content-type', 'text/html']]),
                        text: async () => `
                            <html>
                            <head><title>Doc Page 1</title></head>
                            <body>
                                <h1>Doc Page 1</h1>
                                <p>Welcome to page 1.</p>
                                <a href="https://example.com/docs/page2">Next</a>
                            </body>
                            </html>
                        `
                    };
                }
                if (url.includes('/docs/page2')) {
                    return {
                        ok: true,
                        headers: new Map([['content-type', 'text/html']]),
                        text: async () => `
                            <html>
                            <head><title>Doc Page 2</title></head>
                            <body>
                                <h1>Doc Page 2</h1>
                                <p>This is page 2 content.</p>
                            </body>
                            </html>
                        `
                    };
                }
                return { ok: false };
            };

            const tools = createCrawlerTools({ resolveToolPath: p => p });
            const res = await tools.crawlWebDocumentation({
                startUrl: 'https://example.com/docs/page1',
                maxPages: 2,
                saveToDirectory: tempDir
            });

            assert.equal(res.status, 'Success');
            assert.equal(res.pagesCrawled, 2);
            assert.equal(res.pages[0].title, 'Doc Page 1');
            assert.equal(res.pages[1].title, 'Doc Page 2');

            // Verify files written to disk
            const files = fs.readdirSync(tempDir);
            assert.equal(files.length, 2);

            fs.rmSync(tempDir, { recursive: true, force: true });
        });
    });
});
