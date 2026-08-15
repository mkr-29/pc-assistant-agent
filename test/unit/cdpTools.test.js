import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createCdpTools } from '../../src/tools/implementations/cdpTools.js';

describe('cdpTools', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    describe('cdpConnectChrome & cdpListTabs', () => {
        it('fetches version and tab list from CDP endpoints', async () => {
            globalThis.fetch = async (url) => {
                if (url.includes('/json/version')) {
                    return {
                        ok: true,
                        json: async () => ({ Browser: 'Chrome/125.0.0.0', 'Protocol-Version': '1.3' })
                    };
                }
                if (url.includes('/json/list')) {
                    return {
                        ok: true,
                        json: async () => [
                            { type: 'page', title: 'YouTube Music', url: 'https://music.youtube.com', id: 'tab-1' },
                            { type: 'page', title: 'Netflix', url: 'https://netflix.com', id: 'tab-2' }
                        ]
                    };
                }
                return { ok: false };
            };

            const tools = createCdpTools();
            const connectRes = await tools.cdpConnectChrome();

            assert.equal(connectRes.status, 'Success');
            assert.equal(connectRes.browser, 'Chrome/125.0.0.0');
            assert.equal(connectRes.totalOpenTabs, 2);
            assert.equal(connectRes.tabs[0].title, 'YouTube Music');

            const listRes = await tools.cdpListTabs();
            assert.equal(listRes.status, 'Success');
            assert.equal(listRes.totalTabs, 2);
        });

        it('returns clear error when CDP is unreachable', async () => {
            globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };

            const tools = createCdpTools();
            const res = await tools.cdpConnectChrome();

            assert.equal(res.status, 'Error');
            assert.match(res.message, /Cannot connect to Chrome over CDP/i);
        });
    });

    describe('cdpControlMedia', () => {
        it('controls playback on matching tab via CDP', async () => {
            const mockPage = {
                url: () => 'https://music.youtube.com/watch?v=xyz',
                title: async () => 'YouTube Music - Song Playing',
                evaluate: async (fn, arg) => ({ success: true, target: 'YouTube Music Play/Pause Button' })
            };

            const mockBrowser = {
                contexts: () => [{ pages: () => [mockPage] }],
                close: async () => {}
            };

            const mockChromium = {
                connectOverCDP: async () => mockBrowser
            };

            const tools = createCdpTools({ chromiumImpl: mockChromium });
            const res = await tools.cdpControlMedia({ tabQuery: 'music.youtube', action: 'playpause' });

            assert.equal(res.status, 'Success');
            assert.equal(res.action, 'playpause');
            assert.equal(res.tabTitle, 'YouTube Music - Song Playing');
        });
    });

    describe('cdpExecuteAction', () => {
        it('executes evaluate action on matching tab', async () => {
            const mockPage = {
                url: () => 'https://app.example.com/dashboard',
                title: async () => 'My Dashboard',
                evaluate: async () => ({ user: 'JohnDoe', loggedIn: true })
            };

            const mockBrowser = {
                contexts: () => [{ pages: () => [mockPage] }],
                close: async () => {}
            };

            const mockChromium = {
                connectOverCDP: async () => mockBrowser
            };

            const tools = createCdpTools({ chromiumImpl: mockChromium });
            const res = await tools.cdpExecuteAction({
                tabQuery: 'dashboard',
                action: 'evaluate',
                jsCode: 'window.__CURRENT_USER__'
            });

            assert.equal(res.status, 'Success');
            assert.equal(res.action, 'evaluate');
            assert.deepEqual(res.output, { user: 'JohnDoe', loggedIn: true });
        });
    });
});
