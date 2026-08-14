import fs from 'fs';
import path from 'path';

function htmlToMarkdown(html = '') {
    if (!html || typeof html !== 'string') return '';
    let text = html;

    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
    text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');

    const titleMatch = text.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n');
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n');
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n');
    text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n');
    text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
    text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');
    text = text.replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**');
    text = text.replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*');
    text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    text = text.replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, (match, href, linkText) => {
        const clean = linkText.replace(/<[^>]+>/g, '').trim();
        if (!clean || href.startsWith('javascript:') || href.startsWith('#')) return clean;
        return `[${clean}](${href})`;
    });
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '\n* $1');
    text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n');
    text = text.replace(/<[^>]+>/g, ' ');

    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return { title, text };
}

function parseSitemapXml(xml = '') {
    const urls = [];
    const urlBlockRegex = /<url>([\s\S]*?)<\/url>/gi;
    let match;

    while ((match = urlBlockRegex.exec(xml)) !== null) {
        const block = match[1];
        const locMatch = block.match(/<loc>(.*?)<\/loc>/i);
        const lastmodMatch = block.match(/<lastmod>(.*?)<\/lastmod>/i);
        if (locMatch) {
            urls.push({
                url: locMatch[1].trim(),
                lastmod: lastmodMatch ? lastmodMatch[1].trim() : null
            });
        }
    }

    // Check for sitemapindex
    if (urls.length === 0) {
        const sitemapBlockRegex = /<sitemap>([\s\S]*?)<\/sitemap>/gi;
        while ((match = sitemapBlockRegex.exec(xml)) !== null) {
            const block = match[1];
            const locMatch = block.match(/<loc>(.*?)<\/loc>/i);
            if (locMatch) {
                urls.push({
                    url: locMatch[1].trim(),
                    isSitemapIndex: true
                });
            }
        }
    }

    return urls;
}

export function createCrawlerTools({ resolveToolPath = p => p } = {}) {
    return {
        parseSitemap: async ({ sitemapUrl } = {}) => {
            if (!sitemapUrl || typeof sitemapUrl !== 'string') {
                return { status: 'Error', message: 'A sitemapUrl is required.' };
            }

            let normalizedUrl = sitemapUrl.trim();
            if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
                normalizedUrl = `https://${normalizedUrl}`;
            }

            try {
                const response = await fetch(normalizedUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PCAssistantBot/1.0)' }
                });

                if (!response.ok) {
                    return {
                        status: 'Error',
                        statusCode: response.status,
                        message: `Failed to fetch sitemap from ${normalizedUrl}: HTTP ${response.status}`
                    };
                }

                const xml = await response.text();
                const urls = parseSitemapXml(xml);

                return {
                    status: 'Success',
                    sitemapUrl: normalizedUrl,
                    totalUrls: urls.length,
                    urls
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Error parsing sitemap '${sitemapUrl}': ${error.message}`
                };
            }
        },

        crawlWebDocumentation: async ({
            startUrl,
            maxPages = 10,
            urlFilter = '',
            saveToDirectory = null
        } = {}) => {
            if (!startUrl || typeof startUrl !== 'string') {
                return { status: 'Error', message: 'A startUrl is required to crawl web documentation.' };
            }

            let normalizedStart = startUrl.trim();
            if (!normalizedStart.startsWith('http://') && !normalizedStart.startsWith('https://')) {
                normalizedStart = `https://${normalizedStart}`;
            }

            const limit = Math.max(1, Math.min(Number(maxPages) || 10, 50));
            const filterPattern = urlFilter ? new RegExp(urlFilter, 'i') : null;

            const visited = new Set();
            const queue = [normalizedStart];
            const crawledPages = [];

            const saveDir = saveToDirectory ? resolveToolPath(saveToDirectory) : null;
            if (saveDir) {
                fs.mkdirSync(saveDir, { recursive: true });
            }

            try {
                const origin = new URL(normalizedStart).origin;

                while (queue.length > 0 && crawledPages.length < limit) {
                    const currentUrl = queue.shift();
                    if (visited.has(currentUrl)) continue;
                    visited.add(currentUrl);

                    try {
                        const response = await fetch(currentUrl, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PCAssistantBot/1.0)' }
                        });

                        if (!response.ok) continue;

                        const contentType = response.headers.get('content-type') || '';
                        if (!contentType.includes('text/html')) continue;

                        const html = await response.text();
                        const { title, text } = htmlToMarkdown(html);

                        // Discover same-origin links
                        const linkRegex = /<a\b[^>]*href=["']([^"']*)["'][^>]*>/gi;
                        let linkMatch;
                        while ((linkMatch = linkRegex.exec(html)) !== null) {
                            let link = linkMatch[1].trim();
                            if (link.startsWith('#') || link.startsWith('mailto:') || link.startsWith('javascript:')) continue;

                            try {
                                const resolved = new URL(link, currentUrl).href;
                                if (resolved.startsWith(origin) && !visited.has(resolved)) {
                                    if (!filterPattern || filterPattern.test(resolved)) {
                                        queue.push(resolved);
                                    }
                                }
                            } catch {
                                // Skip invalid links
                            }
                        }

                        let savedFilePath = null;
                        if (saveDir) {
                            const safeFileName = `${crawledPages.length + 1}-${title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'doc'}.md`;
                            savedFilePath = path.join(saveDir, safeFileName);
                            fs.writeFileSync(savedFilePath, `# ${title}\n\nSource: ${currentUrl}\n\n${text}`, 'utf8');
                        }

                        crawledPages.push({
                            url: currentUrl,
                            title: title || currentUrl,
                            characterCount: text.length,
                            preview: text.slice(0, 300),
                            savedFilePath: savedFilePath || undefined
                        });
                    } catch (err) {
                        // Continue next URL in queue
                    }
                }

                return {
                    status: 'Success',
                    startUrl: normalizedStart,
                    pagesCrawled: crawledPages.length,
                    savedDirectory: saveDir || undefined,
                    pages: crawledPages
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Crawling failed for '${startUrl}': ${error.message}`
                };
            }
        }
    };
}
