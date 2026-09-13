import fs from 'fs';
import path from 'path';
import FirecrawlApp from '@mendable/firecrawl-js';

function getClient(config) {
    const apiKey = config?.firecrawl?.apiKey || process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return null;
    return new FirecrawlApp({ apiKey });
}

function missingKeyError() {
    return {
        status: 'Error',
        message: 'FIRECRAWL_API_KEY is not configured. Please set FIRECRAWL_API_KEY in your .env file or environment.'
    };
}

export function createFirecrawlTools({ config = {}, resolveToolPath = p => p } = {}) {
    return {
        firecrawlScrape: async ({
            url,
            formats = ['markdown'],
            onlyMainContent = true,
            waitFor,
            includeTags,
            excludeTags,
            actions,
            saveToFile
        } = {}) => {
            if (!url || typeof url !== 'string' || !url.trim()) {
                return { status: 'Error', message: 'A url is required to scrape with Firecrawl.' };
            }
            const client = getClient(config);
            if (!client) return missingKeyError();

            let normalizedUrl = url.trim();
            if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
                normalizedUrl = `https://${normalizedUrl}`;
            }

            try {
                const scrapeOptions = {
                    formats: Array.isArray(formats) ? formats : ['markdown'],
                    onlyMainContent: typeof onlyMainContent === 'boolean' ? onlyMainContent : true
                };
                if (typeof waitFor === 'number' && waitFor > 0) scrapeOptions.waitFor = waitFor;
                if (Array.isArray(includeTags) && includeTags.length > 0) scrapeOptions.includeTags = includeTags;
                if (Array.isArray(excludeTags) && excludeTags.length > 0) scrapeOptions.excludeTags = excludeTags;
                if (Array.isArray(actions) && actions.length > 0) scrapeOptions.actions = actions;

                const res = await client.scrape(normalizedUrl, scrapeOptions);
                if (!res) {
                    return { status: 'Error', message: `No data returned when scraping ${normalizedUrl}` };
                }

                const title = res.metadata?.title || res.data?.metadata?.title || '';
                const description = res.metadata?.description || res.data?.metadata?.description || '';
                const markdown = res.markdown || res.data?.markdown || '';

                let savedFilePath = null;
                if (saveToFile) {
                    const resolvedPath = resolveToolPath(saveToFile);
                    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
                    fs.writeFileSync(resolvedPath, markdown, 'utf8');
                    savedFilePath = resolvedPath;
                }

                return {
                    status: 'Success',
                    url: normalizedUrl,
                    title,
                    description,
                    characterCount: markdown.length,
                    markdown: markdown.length > 15000
                        ? markdown.slice(0, 15000) + '\n\n...[Content truncated for context window. Use saveToFile to persist complete document]...'
                        : markdown,
                    metadata: res.metadata || res.data?.metadata || {},
                    savedFilePath: savedFilePath || undefined
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Firecrawl scrape failed for '${url}': ${error.message}`
                };
            }
        },

        firecrawlSearch: async ({
            query,
            limit = 5,
            scrapeOptions = { formats: ['markdown'] },
            sources
        } = {}) => {
            if (!query || typeof query !== 'string' || !query.trim()) {
                return { status: 'Error', message: 'A search query is required.' };
            }
            const client = getClient(config);
            if (!client) return missingKeyError();

            const maxResults = Math.max(1, Math.min(Number(limit) || 5, 20));
            try {
                const options = {
                    limit: maxResults,
                    scrapeOptions: scrapeOptions || { formats: ['markdown'] }
                };
                if (Array.isArray(sources) && sources.length > 0) {
                    options.sources = sources;
                }

                const res = await client.search(query.trim(), options);
                const results = (res.web || res.data || []).map(item => ({
                    title: item.title,
                    url: item.url,
                    description: item.description,
                    markdown: item.markdown ? (item.markdown.length > 3000 ? item.markdown.slice(0, 3000) + '...' : item.markdown) : undefined,
                    position: item.position
                }));

                return {
                    status: 'Success',
                    query: query.trim(),
                    totalResults: results.length,
                    results
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Firecrawl search failed for '${query}': ${error.message}`
                };
            }
        },

        firecrawlCrawl: async ({
            url,
            limit = 10,
            maxDepth,
            allowBackwardLinks,
            allowExternalLinks,
            saveToDirectory
        } = {}) => {
            if (!url || typeof url !== 'string' || !url.trim()) {
                return { status: 'Error', message: 'A url is required to crawl.' };
            }
            const client = getClient(config);
            if (!client) return missingKeyError();

            let normalizedUrl = url.trim();
            if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
                normalizedUrl = `https://${normalizedUrl}`;
            }

            const crawlLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
            const saveDir = saveToDirectory ? resolveToolPath(saveToDirectory) : null;
            if (saveDir) {
                fs.mkdirSync(saveDir, { recursive: true });
            }

            try {
                const crawlOptions = {
                    limit: crawlLimit,
                    scrapeOptions: { formats: ['markdown'] }
                };
                if (typeof maxDepth === 'number' && maxDepth > 0) crawlOptions.maxDepth = maxDepth;
                if (typeof allowBackwardLinks === 'boolean') crawlOptions.allowBackwardLinks = allowBackwardLinks;
                if (typeof allowExternalLinks === 'boolean') crawlOptions.allowExternalLinks = allowExternalLinks;

                const res = await client.crawl(normalizedUrl, crawlOptions);
                const crawledItems = (res?.data || []).map((page, index) => {
                    const pageTitle = page.metadata?.title || `Page ${index + 1}`;
                    const pageUrl = page.metadata?.sourceURL || page.metadata?.url || normalizedUrl;
                    const md = page.markdown || '';

                    let savedFilePath = null;
                    if (saveDir) {
                        const safeName = `${index + 1}-${pageTitle.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'page'}.md`;
                        savedFilePath = path.join(saveDir, safeName);
                        fs.writeFileSync(savedFilePath, `# ${pageTitle}\n\nSource: ${pageUrl}\n\n${md}`, 'utf8');
                    }

                    return {
                        url: pageUrl,
                        title: pageTitle,
                        characterCount: md.length,
                        preview: md.slice(0, 300),
                        savedFilePath: savedFilePath || undefined
                    };
                });

                return {
                    status: 'Success',
                    url: normalizedUrl,
                    crawlId: res.id,
                    completed: res.completed || crawledItems.length,
                    total: res.total || crawledItems.length,
                    creditsUsed: res.creditsUsed,
                    pagesCrawled: crawledItems.length,
                    savedDirectory: saveDir || undefined,
                    pages: crawledItems
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Firecrawl crawl failed for '${url}': ${error.message}`
                };
            }
        },

        firecrawlMap: async ({
            url,
            search,
            limit = 50,
            ignoreSitemap = false
        } = {}) => {
            if (!url || typeof url !== 'string' || !url.trim()) {
                return { status: 'Error', message: 'A url is required to map.' };
            }
            const client = getClient(config);
            if (!client) return missingKeyError();

            let normalizedUrl = url.trim();
            if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
                normalizedUrl = `https://${normalizedUrl}`;
            }

            try {
                const mapOptions = {
                    limit: Math.max(1, Math.min(Number(limit) || 50, 500)),
                    ignoreSitemap: Boolean(ignoreSitemap)
                };
                if (search && typeof search === 'string' && search.trim()) {
                    mapOptions.search = search.trim();
                }

                const res = await client.map(normalizedUrl, mapOptions);
                const links = (res?.links || []).map(link => (typeof link === 'string' ? { url: link } : link));

                return {
                    status: 'Success',
                    url: normalizedUrl,
                    totalLinks: links.length,
                    links: links.slice(0, 200)
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Firecrawl map failed for '${url}': ${error.message}`
                };
            }
        },

        firecrawlParse: async ({
            filePath,
            saveToFile
        } = {}) => {
            if (!filePath || typeof filePath !== 'string' || !filePath.trim()) {
                return { status: 'Error', message: 'A filePath is required to parse a document.' };
            }
            const client = getClient(config);
            if (!client) return missingKeyError();

            const resolvedPath = resolveToolPath(filePath);
            if (!fs.existsSync(resolvedPath)) {
                return { status: 'Error', message: `File not found at '${resolvedPath}'` };
            }

            try {
                const buffer = fs.readFileSync(resolvedPath);
                const filename = path.basename(resolvedPath);
                const ext = path.extname(filename).toLowerCase();
                const mimeTypes = {
                    '.pdf': 'application/pdf',
                    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    '.doc': 'application/msword',
                    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    '.xls': 'application/vnd.ms-excel',
                    '.html': 'text/html',
                    '.htm': 'text/html',
                    '.rtf': 'application/rtf',
                    '.odt': 'application/vnd.oasis.opendocument.text'
                };
                const contentType = mimeTypes[ext] || 'application/octet-stream';

                const res = await client.parse({
                    filename,
                    data: buffer,
                    contentType
                });

                const markdown = res?.markdown || '';
                let savedFilePath = null;
                if (saveToFile) {
                    const outPath = resolveToolPath(saveToFile);
                    fs.mkdirSync(path.dirname(outPath), { recursive: true });
                    fs.writeFileSync(outPath, markdown, 'utf8');
                    savedFilePath = outPath;
                }

                return {
                    status: 'Success',
                    filePath: resolvedPath,
                    fileName: filename,
                    characterCount: markdown.length,
                    markdown: markdown.length > 15000
                        ? markdown.slice(0, 15000) + '\n\n...[Content truncated for context window]...'
                        : markdown,
                    metadata: res?.metadata || {},
                    savedFilePath: savedFilePath || undefined
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Firecrawl parse failed for '${filePath}': ${error.message}`
                };
            }
        },

        firecrawlResearch: async ({
            query,
            type = 'papers',
            paperId,
            limit = 5
        } = {}) => {
            const client = getClient(config);
            if (!client) return missingKeyError();

            const maxLimit = Math.max(1, Math.min(Number(limit) || 5, 25));

            try {
                if (type === 'similar_papers' && paperId) {
                    const res = await client.research.similarPapers(String(paperId), {
                        intent: query || 'similar research and citations',
                        k: maxLimit
                    });
                    const papers = res?.results || res?.data || (Array.isArray(res) ? res : []);
                    return {
                        status: 'Success',
                        type: 'similar_papers',
                        paperId,
                        totalResults: papers.length,
                        similarPapers: papers
                    };
                }

                if (!query || typeof query !== 'string' || !query.trim()) {
                    return { status: 'Error', message: 'A query is required for scientific paper research.' };
                }

                const res = await client.research.searchPapers(query.trim(), { limit: maxLimit });
                const paperList = res?.results || res?.data || (Array.isArray(res) ? res : []);
                const papers = paperList.map(p => ({
                    paperId: p.paperId,
                    primaryId: p.primaryId,
                    title: p.title,
                    abstract: p.abstract,
                    score: p.score
                }));

                return {
                    status: 'Success',
                    query: query.trim(),
                    type: 'papers',
                    totalResults: papers.length,
                    papers
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Firecrawl research failed for '${query || paperId}': ${error.message}`
                };
            }
        },

        firecrawlDeveloperSearch: async ({
            query,
            limit = 5
        } = {}) => {
            if (!query || typeof query !== 'string' || !query.trim()) {
                return { status: 'Error', message: 'A query is required to search developer documentation & GitHub.' };
            }
            const client = getClient(config);
            if (!client) return missingKeyError();

            const maxLimit = Math.max(1, Math.min(Number(limit) || 5, 20));
            try {
                const res = await client.developerSearch(query.trim(), { limit: maxLimit });
                const resultList = res?.results || res?.data || (Array.isArray(res) ? res : []);
                const items = resultList.map(item => ({
                    title: item.title || item.repo,
                    url: item.url,
                    passages: item.passages || item.snippet,
                    license: item.license
                }));

                return {
                    status: 'Success',
                    query: query.trim(),
                    totalResults: items.length,
                    results: items
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Firecrawl developer search failed for '${query}': ${error.message}`
                };
            }
        },

        firecrawlAgent: async ({
            prompt,
            urls,
            schema
        } = {}) => {
            if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
                return { status: 'Error', message: 'A prompt is required for the autonomous web extraction agent.' };
            }
            const client = getClient(config);
            if (!client) return missingKeyError();

            try {
                const agentArgs = { prompt: prompt.trim() };
                if (Array.isArray(urls) && urls.length > 0) agentArgs.urls = urls;
                if (schema && typeof schema === 'object') agentArgs.schema = schema;

                const res = await client.agent(agentArgs);
                return {
                    status: 'Success',
                    prompt: prompt.trim(),
                    data: res?.data || res
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Firecrawl agent failed: ${error.message}`
                };
            }
        },

        firecrawlMonitor: async ({
            action = 'list',
            url,
            cadence,
            goal,
            monitorId
        } = {}) => {
            const client = getClient(config);
            if (!client) return missingKeyError();

            try {
                switch (action) {
                    case 'create': {
                        if (!url) return { status: 'Error', message: 'A url is required to create a monitor.' };
                        let normalizedUrl = url.trim();
                        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
                            normalizedUrl = `https://${normalizedUrl}`;
                        }
                        const monitorReq = {
                            url: normalizedUrl,
                            cadence: cadence || 'every 1 hour'
                        };
                        if (goal) monitorReq.goal = goal;
                        const created = await client.createMonitor(monitorReq);
                        return {
                            status: 'Success',
                            action: 'create',
                            monitor: created
                        };
                    }
                    case 'delete': {
                        if (!monitorId) return { status: 'Error', message: 'monitorId is required to delete a monitor.' };
                        await client.deleteMonitor(monitorId);
                        return {
                            status: 'Success',
                            action: 'delete',
                            monitorId,
                            message: `Monitor ${monitorId} deleted successfully.`
                        };
                    }
                    case 'checks': {
                        if (!monitorId) return { status: 'Error', message: 'monitorId is required to list monitor checks.' };
                        const checks = await client.listMonitorChecks(monitorId);
                        return {
                            status: 'Success',
                            action: 'checks',
                            monitorId,
                            checks
                        };
                    }
                    case 'list':
                    default: {
                        const monitors = await client.listMonitors();
                        return {
                            status: 'Success',
                            action: 'list',
                            totalMonitors: (monitors || []).length,
                            monitors: monitors || []
                        };
                    }
                }
            } catch (error) {
                return {
                    status: 'Error',
                    action,
                    message: `Firecrawl monitor action '${action}' failed: ${error.message}`
                };
            }
        },

        firecrawlStatus: async () => {
            const client = getClient(config);
            if (!client) return missingKeyError();

            try {
                const credits = await client.getCreditUsage();
                return {
                    status: 'Success',
                    authenticated: true,
                    remainingCredits: credits?.remainingCredits,
                    planCredits: credits?.planCredits,
                    billingPeriodStart: credits?.billingPeriodStart,
                    billingPeriodEnd: credits?.billingPeriodEnd
                };
            } catch (error) {
                return {
                    status: 'Error',
                    authenticated: false,
                    message: `Failed to retrieve Firecrawl status: ${error.message}`
                };
            }
        }
    };
}
