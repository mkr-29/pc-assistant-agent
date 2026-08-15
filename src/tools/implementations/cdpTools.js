import fs from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { chromium } from 'playwright';

const execFileAsync = promisify(execFile);
const DEFAULT_CDP_URL = 'http://127.0.0.1:9222';
const DEFAULT_SCREENSHOT_DIR = path.resolve(process.cwd(), '.data/browser-screenshots');

function formatTimestamp(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}

export function createCdpTools({
    chromiumImpl = chromium,
    screenshotDirectory = DEFAULT_SCREENSHOT_DIR,
    platform = process.platform,
    execFileImpl = execFile,
    spawnImpl = spawn
} = {}) {
    async function fetchJson(url) {
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        return await res.json();
    }

    async function getCdpBrowser(cdpUrl = DEFAULT_CDP_URL) {
        return await chromiumImpl.connectOverCDP(cdpUrl, { timeout: 10000 });
    }

    async function findCdpPage(browserInstance, tabQuery) {
        const contexts = browserInstance.contexts();
        const allPages = contexts.flatMap(ctx => ctx.pages());

        if (!tabQuery) {
            return allPages[0] || null;
        }

        const cleanQuery = String(tabQuery).toLowerCase();
        for (const page of allPages) {
            const url = (page.url() || '').toLowerCase();
            const title = (await page.title().catch(() => '')).toLowerCase();
            if (url.includes(cleanQuery) || title.includes(cleanQuery)) {
                return page;
            }
        }

        return allPages[0] || null;
    }

    return {
        cdpConnectChrome: async ({ cdpUrl = DEFAULT_CDP_URL } = {}) => {
            try {
                const versionUrl = `${cdpUrl.replace(/\/+$/, '')}/json/version`;
                const listUrl = `${cdpUrl.replace(/\/+$/, '')}/json/list`;

                const [versionData, tabsData] = await Promise.all([
                    fetchJson(versionUrl),
                    fetchJson(listUrl)
                ]);

                const openTabs = (Array.isArray(tabsData) ? tabsData : [])
                    .filter(t => t.type === 'page')
                    .map(t => ({
                        title: t.title || 'Untitled',
                        url: t.url || '',
                        id: t.id
                    }));

                return {
                    status: 'Success',
                    cdpUrl,
                    browser: versionData.Browser || 'Chrome/Chromium',
                    protocolVersion: versionData['Protocol-Version'] || '',
                    webSocketDebuggerUrl: versionData.webSocketDebuggerUrl || '',
                    totalOpenTabs: openTabs.length,
                    tabs: openTabs,
                    message: `Connected to existing Chrome with ${openTabs.length} active tabs.`
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Cannot connect to Chrome over CDP at ${cdpUrl}. Ensure Chrome is launched with '--remote-debugging-port=9222'. You can run cdpLaunchDebugChrome to launch it automatically. Details: ${error.message}`
                };
            }
        },

        cdpListTabs: async ({ cdpUrl = DEFAULT_CDP_URL } = {}) => {
            try {
                const listUrl = `${cdpUrl.replace(/\/+$/, '')}/json/list`;
                const tabsData = await fetchJson(listUrl);

                const tabs = (Array.isArray(tabsData) ? tabsData : [])
                    .filter(t => t.type === 'page')
                    .map(t => ({
                        title: t.title || 'Untitled',
                        url: t.url || '',
                        id: t.id
                    }));

                return {
                    status: 'Success',
                    totalTabs: tabs.length,
                    tabs
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to list tabs over CDP: ${error.message}. Is Chrome running with debug port 9222?`
                };
            }
        },

        cdpControlMedia: async ({ cdpUrl = DEFAULT_CDP_URL, tabQuery, action = 'playpause' } = {}) => {
            let browser = null;
            try {
                browser = await getCdpBrowser(cdpUrl);
                const page = await findCdpPage(browser, tabQuery || 'youtube,netflix,spotify,music');

                if (!page) {
                    await browser.close().catch(() => {});
                    return {
                        status: 'Error',
                        message: `No matching media tab found for query: '${tabQuery || 'media'}'.`
                    };
                }

                const pageTitle = await page.title().catch(() => 'Active Tab');
                const pageUrl = page.url();

                const result = await page.evaluate((act) => {
                    // Strategy 1: YouTube Music specific UI buttons
                    if (window.location.hostname.includes('music.youtube.com')) {
                        if (act === 'playpause') {
                            const btn = document.querySelector('#play-pause-button, tp-yt-paper-icon-button#play-pause-button');
                            if (btn) { btn.click(); return { success: true, target: 'YouTube Music Play/Pause Button' }; }
                        } else if (act === 'next') {
                            const btn = document.querySelector('.next-button, tp-yt-paper-icon-button.next-button');
                            if (btn) { btn.click(); return { success: true, target: 'YouTube Music Next Track' }; }
                        } else if (act === 'previous') {
                            const btn = document.querySelector('.previous-button, tp-yt-paper-icon-button.previous-button');
                            if (btn) { btn.click(); return { success: true, target: 'YouTube Music Previous Track' }; }
                        }
                    }

                    // Strategy 2: Generic HTML5 Audio / Video element
                    const media = document.querySelector('video, audio');
                    if (media) {
                        if (act === 'playpause') {
                            if (media.paused) media.play(); else media.pause();
                            return { success: true, paused: media.paused, target: 'HTML5 Media Element' };
                        }
                        if (act === 'volumeUp') {
                            media.volume = Math.min(1, media.volume + 0.1);
                            return { success: true, volume: Math.round(media.volume * 100) };
                        }
                        if (act === 'volumeDown') {
                            media.volume = Math.max(0, media.volume - 0.1);
                            return { success: true, volume: Math.round(media.volume * 100) };
                        }
                        if (act === 'mute') {
                            media.muted = !media.muted;
                            return { success: true, muted: media.muted };
                        }
                    }

                    // Strategy 3: Simulate spacebar or media keys
                    if (act === 'playpause') {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true }));
                        return { success: true, target: 'Space key dispatched' };
                    }

                    return { success: false, message: 'No active video or audio player detected in this tab.' };
                }, action);

                await browser.close().catch(() => {});

                return {
                    status: result.success ? 'Success' : 'Error',
                    action,
                    tabTitle: pageTitle,
                    tabUrl: pageUrl,
                    result,
                    message: result.success
                        ? `Executed media control '${action}' on "${pageTitle}".`
                        : (result.message || 'Media control failed.')
                };
            } catch (error) {
                if (browser) await browser.close().catch(() => {});
                return {
                    status: 'Error',
                    message: `CDP media control failed: ${error.message}`
                };
            }
        },

        cdpExecuteAction: async ({
            cdpUrl = DEFAULT_CDP_URL,
            tabQuery,
            action = 'click',
            selector,
            text,
            value,
            jsCode,
            takeScreenshot = false
        } = {}) => {
            let browser = null;
            try {
                browser = await getCdpBrowser(cdpUrl);
                const page = await findCdpPage(browser, tabQuery);

                if (!page) {
                    await browser.close().catch(() => {});
                    return {
                        status: 'Error',
                        message: `No matching tab found for '${tabQuery}'.`
                    };
                }

                let output = null;
                const cleanAction = String(action).toLowerCase();

                if (cleanAction === 'click') {
                    if (selector) {
                        await page.locator(selector).first().click({ timeout: 5000 });
                    } else if (text) {
                        await page.getByText(text, { exact: false }).first().click({ timeout: 5000 });
                    } else {
                        throw new Error('Provide either selector or text to click.');
                    }
                    output = { message: `Clicked element in tab "${await page.title()}".` };
                } else if (cleanAction === 'type') {
                    if (value === undefined) throw new Error('value is required for type action.');
                    if (selector) {
                        await page.locator(selector).first().fill(String(value), { timeout: 5000 });
                    } else if (text) {
                        await page.getByLabel(text).first().fill(String(value), { timeout: 5000 });
                    }
                    output = { message: `Typed into element in tab "${await page.title()}".` };
                } else if (cleanAction === 'evaluate' && jsCode) {
                    output = await page.evaluate((code) => {
                        return eval(code);
                    }, jsCode);
                } else if (cleanAction === 'navigate') {
                    if (!value) throw new Error('value (target URL) is required for navigate action.');
                    await page.goto(value, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    output = { message: `Navigated to ${value}.` };
                }

                let screenshotPath = undefined;
                if (takeScreenshot) {
                    fs.mkdirSync(screenshotDirectory, { recursive: true });
                    screenshotPath = path.join(screenshotDirectory, `cdp-tab-${formatTimestamp()}.png`);
                    await page.screenshot({ path: screenshotPath, timeout: 5000 });
                }

                const finalTitle = await page.title();
                const finalUrl = page.url();
                await browser.close().catch(() => {});

                return {
                    status: 'Success',
                    action: cleanAction,
                    tabTitle: finalTitle,
                    tabUrl: finalUrl,
                    output,
                    ...(screenshotPath ? { screenshotPath } : {})
                };
            } catch (error) {
                if (browser) await browser.close().catch(() => {});
                return {
                    status: 'Error',
                    message: `CDP action failed: ${error.message}`
                };
            }
        },

        cdpLaunchDebugChrome: async ({ port = 9222, profilePath = null } = {}) => {
            if (platform !== 'darwin') {
                return {
                    status: 'Error',
                    message: 'cdpLaunchDebugChrome helper is supported on macOS. On Linux/Windows, run chrome with --remote-debugging-port=9222.'
                };
            }

            try {
                const chromeAppPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
                if (!fs.existsSync(chromeAppPath)) {
                    return {
                        status: 'Error',
                        message: 'Google Chrome application not found in /Applications.'
                    };
                }

                const args = [`--remote-debugging-port=${port}`];
                if (profilePath) {
                    args.push(`--user-data-dir=${profilePath}`);
                }

                const child = spawnImpl(chromeAppPath, args, {
                    detached: true,
                    stdio: 'ignore'
                });
                child.unref();

                // Wait 1.5s for port to open
                await new Promise(res => setTimeout(res, 1500));

                return {
                    status: 'Success',
                    port,
                    message: `Launched Google Chrome in debug mode on port ${port}. You can now use cdpConnectChrome and cdpControlMedia.`
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to launch debug Chrome: ${error.message}`
                };
            }
        }
    };
}
