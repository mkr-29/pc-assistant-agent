import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createFirecrawlTools } from '../../src/tools/implementations/firecrawlTools.js';

test('createFirecrawlTools exposes all declared firecrawl functions', () => {
    const tools = createFirecrawlTools({
        config: { firecrawl: { apiKey: 'fc-dummy' } },
        resolveToolPath: p => p
    });

    const expectedMethods = [
        'firecrawlScrape',
        'firecrawlSearch',
        'firecrawlCrawl',
        'firecrawlMap',
        'firecrawlParse',
        'firecrawlResearch',
        'firecrawlDeveloperSearch',
        'firecrawlAgent',
        'firecrawlMonitor',
        'firecrawlStatus'
    ];

    for (const method of expectedMethods) {
        assert.equal(typeof tools[method], 'function', `${method} should be a function`);
    }
});

test('firecrawl tools return error when API key is not configured', async () => {
    const originalEnv = process.env.FIRECRAWL_API_KEY;
    delete process.env.FIRECRAWL_API_KEY;

    try {
        const tools = createFirecrawlTools({
            config: { firecrawl: { apiKey: '' } },
            resolveToolPath: p => p
        });

        const scrapeRes = await tools.firecrawlScrape({ url: 'https://example.com' });
        assert.equal(scrapeRes.status, 'Error');
        assert.match(scrapeRes.message, /FIRECRAWL_API_KEY is not configured/i);

        const searchRes = await tools.firecrawlSearch({ query: 'test' });
        assert.equal(searchRes.status, 'Error');
        assert.match(searchRes.message, /FIRECRAWL_API_KEY is not configured/i);

        const statusRes = await tools.firecrawlStatus();
        assert.equal(statusRes.status, 'Error');
        assert.match(statusRes.message, /FIRECRAWL_API_KEY is not configured/i);
    } finally {
        if (originalEnv) {
            process.env.FIRECRAWL_API_KEY = originalEnv;
        }
    }
});

test('firecrawl tools validate required parameters', async () => {
    const tools = createFirecrawlTools({
        config: { firecrawl: { apiKey: 'fc-test' } },
        resolveToolPath: p => p
    });

    // Scrape missing url
    const scrapeRes = await tools.firecrawlScrape({});
    assert.equal(scrapeRes.status, 'Error');
    assert.match(scrapeRes.message, /url is required/i);

    // Search missing query
    const searchRes = await tools.firecrawlSearch({});
    assert.equal(searchRes.status, 'Error');
    assert.match(searchRes.message, /search query is required/i);

    // Crawl missing url
    const crawlRes = await tools.firecrawlCrawl({});
    assert.equal(crawlRes.status, 'Error');
    assert.match(crawlRes.message, /url is required/i);

    // Map missing url
    const mapRes = await tools.firecrawlMap({});
    assert.equal(mapRes.status, 'Error');
    assert.match(mapRes.message, /url is required/i);

    // Parse missing filePath
    const parseRes = await tools.firecrawlParse({});
    assert.equal(parseRes.status, 'Error');
    assert.match(parseRes.message, /filePath is required/i);

    // Parse non-existent file
    const parseNonExistRes = await tools.firecrawlParse({ filePath: '/tmp/non-existent-file-12345.pdf' });
    assert.equal(parseNonExistRes.status, 'Error');
    assert.match(parseNonExistRes.message, /File not found/i);

    // Research missing query
    const researchRes = await tools.firecrawlResearch({});
    assert.equal(researchRes.status, 'Error');
    assert.match(researchRes.message, /query is required/i);

    // DeveloperSearch missing query
    const devRes = await tools.firecrawlDeveloperSearch({});
    assert.equal(devRes.status, 'Error');
    assert.match(devRes.message, /query is required/i);

    // Agent missing prompt
    const agentRes = await tools.firecrawlAgent({});
    assert.equal(agentRes.status, 'Error');
    assert.match(agentRes.message, /prompt is required/i);

    // Monitor create missing url
    const monCreateRes = await tools.firecrawlMonitor({ action: 'create' });
    assert.equal(monCreateRes.status, 'Error');
    assert.match(monCreateRes.message, /url is required/i);

    // Monitor delete missing monitorId
    const monDelRes = await tools.firecrawlMonitor({ action: 'delete' });
    assert.equal(monDelRes.status, 'Error');
    assert.match(monDelRes.message, /monitorId is required/i);

    // Monitor checks missing monitorId
    const monChecksRes = await tools.firecrawlMonitor({ action: 'checks' });
    assert.equal(monChecksRes.status, 'Error');
    assert.match(monChecksRes.message, /monitorId is required/i);
});

test('firecrawlParse parses local HTML file correctly', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-parse-test-'));
    const testFile = path.join(tempDir, 'document.html');
    const outFile = path.join(tempDir, 'output.md');
    fs.writeFileSync(testFile, '<h1>Sample Header</h1><p>Sample parsed text paragraph.</p>', 'utf8');

    try {
        const apiKey = process.env.FIRECRAWL_API_KEY || 'fc-125e63e314a643dfb697375b0d7c3576';
        const tools = createFirecrawlTools({
            config: { firecrawl: { apiKey } },
            resolveToolPath: p => path.resolve(tempDir, p)
        });

        const res = await tools.firecrawlParse({
            filePath: testFile,
            saveToFile: outFile
        });

        assert.equal(res.status, 'Success');
        assert.equal(res.fileName, 'document.html');
        assert.ok(res.markdown.includes('Sample Header'));
        assert.ok(fs.existsSync(outFile));
        assert.equal(fs.readFileSync(outFile, 'utf8'), res.markdown);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('firecrawlStatus retrieves authenticated credit details', async () => {
    const apiKey = process.env.FIRECRAWL_API_KEY || 'fc-125e63e314a643dfb697375b0d7c3576';
    const tools = createFirecrawlTools({
        config: { firecrawl: { apiKey } },
        resolveToolPath: p => p
    });

    const status = await tools.firecrawlStatus();
    assert.equal(status.status, 'Success');
    assert.equal(status.authenticated, true);
    assert.equal(typeof status.remainingCredits, 'number');
    assert.ok(status.remainingCredits > 0);
});

test('firecrawlSearch returns formatted web results', async () => {
    const apiKey = process.env.FIRECRAWL_API_KEY || 'fc-125e63e314a643dfb697375b0d7c3576';
    const tools = createFirecrawlTools({
        config: { firecrawl: { apiKey } },
        resolveToolPath: p => p
    });

    const res = await tools.firecrawlSearch({
        query: 'Firecrawl API web scraping',
        limit: 2
    });

    assert.equal(res.status, 'Success');
    assert.equal(res.query, 'Firecrawl API web scraping');
    assert.ok(res.totalResults >= 1);
    assert.ok(res.results[0].title);
    assert.ok(res.results[0].url);
});

test('firecrawlScrape retrieves clean markdown from URL and saves to file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-scrape-test-'));
    const savePath = path.join(tempDir, 'scraped.md');

    try {
        const apiKey = process.env.FIRECRAWL_API_KEY || 'fc-125e63e314a643dfb697375b0d7c3576';
        const tools = createFirecrawlTools({
            config: { firecrawl: { apiKey } },
            resolveToolPath: p => path.resolve(tempDir, p)
        });

        const res = await tools.firecrawlScrape({
            url: 'https://example.com',
            saveToFile: savePath
        });

        assert.equal(res.status, 'Success');
        assert.ok(res.markdown.includes('Example Domain'));
        assert.ok(fs.existsSync(savePath));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('firecrawlMap maps URLs on a domain', async () => {
    const apiKey = process.env.FIRECRAWL_API_KEY || 'fc-125e63e314a643dfb697375b0d7c3576';
    const tools = createFirecrawlTools({
        config: { firecrawl: { apiKey } },
        resolveToolPath: p => p
    });

    const res = await tools.firecrawlMap({
        url: 'https://example.com',
        limit: 5
    });

    assert.equal(res.status, 'Success');
    assert.ok(res.totalLinks > 0);
    assert.ok(Array.isArray(res.links));
});

test('firecrawlResearch queries scientific papers', async () => {
    const apiKey = process.env.FIRECRAWL_API_KEY || 'fc-125e63e314a643dfb697375b0d7c3576';
    const tools = createFirecrawlTools({
        config: { firecrawl: { apiKey } },
        resolveToolPath: p => p
    });

    const res = await tools.firecrawlResearch({
        query: 'CRISPR Cas9 editing',
        limit: 2
    });

    assert.equal(res.status, 'Success');
    assert.equal(res.type, 'papers');
    assert.ok(res.papers.length > 0);
    assert.ok(res.papers[0].title);
});

test('firecrawlDeveloperSearch queries developer documentation and code', async () => {
    const apiKey = process.env.FIRECRAWL_API_KEY || 'fc-125e63e314a643dfb697375b0d7c3576';
    const tools = createFirecrawlTools({
        config: { firecrawl: { apiKey } },
        resolveToolPath: p => p
    });

    const res = await tools.firecrawlDeveloperSearch({
        query: 'playwright headless browser',
        limit: 2
    });

    assert.equal(res.status, 'Success');
    assert.ok(res.results.length > 0);
    assert.ok(res.results[0].title || res.results[0].url);
});

test('firecrawlMonitor lists active monitors', async () => {
    const apiKey = process.env.FIRECRAWL_API_KEY || 'fc-125e63e314a643dfb697375b0d7c3576';
    const tools = createFirecrawlTools({
        config: { firecrawl: { apiKey } },
        resolveToolPath: p => p
    });

    const res = await tools.firecrawlMonitor({
        action: 'list'
    });

    assert.equal(res.status, 'Success');
    assert.equal(res.action, 'list');
    assert.ok(Array.isArray(res.monitors));
});
