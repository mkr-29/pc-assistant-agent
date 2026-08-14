import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createMcpTools } from '../../src/tools/implementations/mcpTools.js';
import { customTools, braveWebSearchTool, braveLocalSearchTool, fetchUrlTool } from '../../src/tools/definitions.js';
import { createToolRegistry } from '../../src/tools/registry.js';

describe('mcpTools (Brave Search & Fetch MCP)', () => {
    const originalFetch = globalThis.fetch;
    const originalEnv = process.env.BRAVE_API_KEY;

    afterEach(() => {
        globalThis.fetch = originalFetch;
        if (originalEnv !== undefined) {
            process.env.BRAVE_API_KEY = originalEnv;
        } else {
            delete process.env.BRAVE_API_KEY;
        }
    });

    describe('braveWebSearch', () => {
        it('returns error when query is missing', async () => {
            const tools = createMcpTools({ config: { braveApiKey: 'test-key' } });
            const res = await tools.braveWebSearch({});
            assert.equal(res.status, 'Error');
            assert.match(res.message, /search query string is required/i);
        });

        it('returns error with setup instructions when BRAVE_API_KEY is not set', async () => {
            delete process.env.BRAVE_API_KEY;
            const tools = createMcpTools({ config: { braveApiKey: '' } });
            const res = await tools.braveWebSearch({ query: 'nodejs tutorial' });
            assert.equal(res.status, 'Error');
            assert.match(res.message, /BRAVE_API_KEY is not set/i);
            assert.match(res.message, /brave\.com\/search\/api/i);
        });

        it('executes search and returns formatted results when API responds successfully', async () => {
            globalThis.fetch = async (url, options) => {
                assert.ok(url.includes('api.search.brave.com/res/v1/web/search'));
                assert.ok(url.includes('q=docker+containers'));
                assert.equal(options.headers['X-Subscription-Token'], 'secret-token-123');

                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        web: {
                            results: [
                                {
                                    title: 'Docker Overview',
                                    url: 'https://docs.docker.com/get-started/overview/',
                                    description: 'Docker is an open platform for developing, shipping, and running applications.',
                                    page_age: '2025-01-10',
                                    extra_snippets: ['Containerization explained']
                                },
                                {
                                    title: 'Get Started with Docker',
                                    url: 'https://docs.docker.com/get-started/',
                                    description: 'Getting started guide for developers.',
                                    age: '2 days ago'
                                }
                            ]
                        }
                    })
                };
            };

            const tools = createMcpTools({ config: { braveApiKey: 'secret-token-123' } });
            const res = await tools.braveWebSearch({ query: 'docker containers', count: 5 });

            assert.equal(res.status, 'Success');
            assert.equal(res.totalResults, 2);
            assert.equal(res.results[0].title, 'Docker Overview');
            assert.equal(res.results[0].url, 'https://docs.docker.com/get-started/overview/');
            assert.equal(res.results[0].published, '2025-01-10');
            assert.deepEqual(res.results[0].extraSnippets, ['Containerization explained']);
        });

        it('handles API error status code gracefully', async () => {
            globalThis.fetch = async () => ({
                ok: false,
                status: 401,
                text: async () => 'Unauthorized: Invalid Subscription Token'
            });

            const tools = createMcpTools({ config: { braveApiKey: 'invalid-key' } });
            const res = await tools.braveWebSearch({ query: 'test query' });

            assert.equal(res.status, 'Error');
            assert.equal(res.statusCode, 401);
            assert.match(res.message, /401/);
        });
    });

    describe('braveLocalSearch', () => {
        it('returns error when query is missing', async () => {
            const tools = createMcpTools({ config: { braveApiKey: 'test-key' } });
            const res = await tools.braveLocalSearch({});
            assert.equal(res.status, 'Error');
        });

        it('executes local search and returns results', async () => {
            globalThis.fetch = async (url) => {
                assert.ok(url.includes('api.search.brave.com/res/v1/local/search'));
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        results: [
                            {
                                id: 'loc-1',
                                name: 'Artisan Coffee',
                                address: '123 Market St, San Francisco, CA',
                                phone: '555-0199'
                            }
                        ]
                    })
                };
            };

            const tools = createMcpTools({ config: { braveApiKey: 'test-key' } });
            const res = await tools.braveLocalSearch({ query: 'coffee near me', count: 3 });

            assert.equal(res.status, 'Success');
            assert.equal(res.totalResults, 1);
            assert.equal(res.results[0].name, 'Artisan Coffee');
        });
    });

    describe('fetchUrl', () => {
        it('returns error when url is empty or invalid', async () => {
            const tools = createMcpTools();
            const res = await tools.fetchUrl({});
            assert.equal(res.status, 'Error');
            assert.match(res.message, /valid URL string is required/i);
        });

        it('fetches HTML and converts it to clean Markdown with headings, links, lists', async () => {
            const sampleHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Test Documentation</title>
                    <style>.hidden { display: none; }</style>
                    <script>console.log("bad");</script>
                </head>
                <body>
                    <h1>Getting Started</h1>
                    <p>Welcome to <strong>FastAPI</strong>. Check <a href="https://fastapi.tiangolo.com">the docs</a>.</p>
                    <h2>Features</h2>
                    <ul>
                        <li>High performance</li>
                        <li>Easy to learn</li>
                    </ul>
                    <pre><code>pip install fastapi</code></pre>
                </body>
                </html>
            `;

            globalThis.fetch = async (url) => {
                assert.equal(url, 'https://example.com/docs');
                return {
                    ok: true,
                    status: 200,
                    headers: new Map([['content-type', 'text/html; charset=utf-8']]),
                    text: async () => sampleHtml
                };
            };

            const tools = createMcpTools();
            const res = await tools.fetchUrl({ url: 'example.com/docs' });

            assert.equal(res.status, 'Success');
            assert.equal(res.title, 'Test Documentation');
            assert.ok(res.content.includes('# Getting Started'));
            assert.ok(res.content.includes('**FastAPI**'));
            assert.ok(res.content.includes('[the docs](https://fastapi.tiangolo.com)'));
            assert.ok(res.content.includes('* High performance'));
            assert.ok(res.content.includes('```\npip install fastapi\n```'));
            // Scripts and styles should be stripped
            assert.ok(!res.content.includes('console.log'));
            assert.ok(!res.content.includes('.hidden'));
        });

        it('handles pagination via startIndex and maxLength', async () => {
            const longText = 'A'.repeat(500) + 'B'.repeat(500);

            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'text/plain']]),
                text: async () => longText
            });

            const tools = createMcpTools();
            const res = await tools.fetchUrl({ url: 'https://example.com/long.txt', startIndex: 500, maxLength: 200 });

            assert.equal(res.status, 'Success');
            assert.equal(res.length, 200);
            assert.equal(res.totalLength, 1000);
            assert.equal(res.hasMore, true);
            assert.equal(res.content, 'B'.repeat(200));
            assert.equal(res.nextStartIndex, 700);
        });

        it('returns raw text when raw: true is passed', async () => {
            const rawJson = '{"key":"value","count":42}';

            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                text: async () => rawJson
            });

            const tools = createMcpTools();
            const res = await tools.fetchUrl({ url: 'https://api.example.com/data', raw: true });

            assert.equal(res.status, 'Success');
            assert.equal(res.content, rawJson);
        });

        it('handles 404 / 500 HTTP errors gracefully', async () => {
            globalThis.fetch = async () => ({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            });

            const tools = createMcpTools();
            const res = await tools.fetchUrl({ url: 'https://example.com/missing' });

            assert.equal(res.status, 'Error');
            assert.equal(res.statusCode, 404);
            assert.match(res.message, /404/);
        });
    });

    describe('Definitions and Registry Integration', () => {
        it('exports braveWebSearch, braveLocalSearch, and fetchUrl in customTools', () => {
            const toolNames = customTools.map(t => t.name);
            assert.ok(toolNames.includes('braveWebSearch'));
            assert.ok(toolNames.includes('braveLocalSearch'));
            assert.ok(toolNames.includes('fetchUrl'));
        });

        it('includes mcp tool implementations in createToolRegistry', () => {
            const registry = createToolRegistry({
                bot: {},
                chatId: '123',
                resolveToolPath: p => p,
                ai: {},
                config: { targetProjectPath: '.', braveApiKey: 'test-key' }
            });

            assert.equal(typeof registry.braveWebSearch, 'function');
            assert.equal(typeof registry.braveLocalSearch, 'function');
            assert.equal(typeof registry.fetchUrl, 'function');
        });
    });
});
