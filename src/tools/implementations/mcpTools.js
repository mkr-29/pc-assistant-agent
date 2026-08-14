/**
 * MCP Tools Implementation: Brave Search & Fetch MCP
 */

function htmlToMarkdown(html = '') {
    if (!html || typeof html !== 'string') {
        return '';
    }

    let text = html;

    // Remove scripts, styles, noscripts, and svgs
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
    text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');

    // Extract title if present
    const titleMatch = text.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Headings
    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n');
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n');
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n');
    text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n');
    text = text.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n');
    text = text.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n');

    // Code blocks first (before inline code or formatting)
    text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
    text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');

    // Bold / Italic / Inline Code
    text = text.replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**');
    text = text.replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*');
    text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

    // Links: [text](href)
    text = text.replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, (match, href, linkText) => {
        const cleanLinkText = linkText.replace(/<[^>]+>/g, '').trim();
        if (!cleanLinkText) return '';
        if (href.startsWith('javascript:') || href.startsWith('#')) return cleanLinkText;
        return `[${cleanLinkText}](${href})`;
    });

    // Lists
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '\n* $1');
    text = text.replace(/<\/(ul|ol)>/gi, '\n');

    // Paragraphs and breaks
    text = text.replace(/<br\s*[\/]?>/gi, '\n');
    text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n');
    text = text.replace(/<hr\s*[\/]?>/gi, '\n---\n');
    text = text.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '\n> $1\n');

    // Strip any remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode standard HTML entities
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–');

    // Normalize spacing and consecutive newlines
    text = text
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return { title, text };
}

export function createMcpTools({ config = {} } = {}) {
    const braveApiKey = config.braveApiKey || process.env.BRAVE_API_KEY;

    return {
        braveWebSearch: async ({ query, count = 10, country, searchLang } = {}) => {
            if (!query || typeof query !== 'string') {
                return {
                    status: 'Error',
                    message: 'A search query string is required.'
                };
            }

            const apiKey = config.braveApiKey || process.env.BRAVE_API_KEY;
            if (!apiKey) {
                return {
                    status: 'Error',
                    message: 'BRAVE_API_KEY is not set. Please obtain a free API key at https://brave.com/search/api/ and set BRAVE_API_KEY in your .env file.'
                };
            }

            const safeCount = Math.max(1, Math.min(Number(count) || 10, 20));
            const params = new URLSearchParams({
                q: query.trim(),
                count: String(safeCount)
            });

            if (country) params.append('country', country);
            if (searchLang) params.append('search_lang', searchLang);

            try {
                const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Encoding': 'gzip',
                        'X-Subscription-Token': apiKey
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    return {
                        status: 'Error',
                        statusCode: response.status,
                        message: `Brave Search API error (${response.status}): ${errorText}`
                    };
                }

                const data = await response.json();
                const rawResults = data.web?.results || [];

                const results = rawResults.map(item => ({
                    title: item.title,
                    url: item.url,
                    description: item.description,
                    published: item.page_age || item.age || null,
                    extraSnippets: item.extra_snippets || []
                }));

                return {
                    status: 'Success',
                    query,
                    totalResults: results.length,
                    results,
                    infobox: data.infobox?.results || null
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to execute Brave search: ${error.message}`
                };
            }
        },

        braveLocalSearch: async ({ query, count = 5 } = {}) => {
            if (!query || typeof query !== 'string') {
                return {
                    status: 'Error',
                    message: 'A search query string is required for local search.'
                };
            }

            const apiKey = config.braveApiKey || process.env.BRAVE_API_KEY;
            if (!apiKey) {
                return {
                    status: 'Error',
                    message: 'BRAVE_API_KEY is not set. Please obtain a free API key at https://brave.com/search/api/ and set BRAVE_API_KEY in your .env file.'
                };
            }

            const safeCount = Math.max(1, Math.min(Number(count) || 5, 20));
            const params = new URLSearchParams({
                q: query.trim(),
                count: String(safeCount)
            });

            try {
                const response = await fetch(`https://api.search.brave.com/res/v1/local/search?${params.toString()}`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Encoding': 'gzip',
                        'X-Subscription-Token': apiKey
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    return {
                        status: 'Error',
                        statusCode: response.status,
                        message: `Brave Local Search API error (${response.status}): ${errorText}`
                    };
                }

                const data = await response.json();
                const results = data.results || [];

                return {
                    status: 'Success',
                    query,
                    totalResults: results.length,
                    results
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to execute Brave local search: ${error.message}`
                };
            }
        },

        fetchUrl: async ({ url, maxLength = 8000, startIndex = 0, raw = false } = {}) => {
            if (!url || typeof url !== 'string') {
                return {
                    status: 'Error',
                    message: 'A valid URL string is required.'
                };
            }

            let normalizedUrl = url.trim();
            if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
                normalizedUrl = `https://${normalizedUrl}`;
            }

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 20000);

                const response = await fetch(normalizedUrl, {
                    method: 'GET',
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7'
                    }
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    return {
                        status: 'Error',
                        statusCode: response.status,
                        message: `Failed to fetch URL (${response.status}): ${response.statusText}`
                    };
                }

                const contentType = response.headers.get('content-type') || '';
                const rawBody = await response.text();

                let content = '';
                let title = '';

                if (raw || contentType.includes('application/json') || contentType.includes('text/plain')) {
                    content = rawBody;
                } else {
                    const parsed = htmlToMarkdown(rawBody);
                    title = parsed.title;
                    content = parsed.text;
                }

                const start = Math.max(0, Number(startIndex) || 0);
                const limit = Math.max(100, Math.min(Number(maxLength) || 8000, 50000));
                const totalLength = content.length;
                const slicedContent = content.slice(start, start + limit);
                const hasMore = start + limit < totalLength;

                return {
                    status: 'Success',
                    url: normalizedUrl,
                    title: title || undefined,
                    contentType,
                    content: slicedContent,
                    startIndex: start,
                    length: slicedContent.length,
                    totalLength,
                    hasMore,
                    nextStartIndex: hasMore ? start + limit : null
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to fetch '${url}': ${error.message}`
                };
            }
        }
    };
}
