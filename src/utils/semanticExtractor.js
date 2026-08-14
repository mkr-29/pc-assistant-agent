/**
 * semanticExtractor.js
 * High-density semantic page extraction utility for web pages.
 * Compatible with standard DOM contexts (browser window, extension content scripts, Playwright evaluate).
 */

function escapeAttribute(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function selectorFor(element) {
    if (!element || element.nodeType !== 1) return '';
    const tagName = element.tagName.toLowerCase();

    if (element.id) {
        const escaped = globalThis.CSS?.escape ? globalThis.CSS.escape(element.id) : String(element.id).replace(/([^\w-])/g, '\\$1');
        return `#${escaped}`;
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
    if (element.className && typeof element.className === 'string') {
        const classes = element.className.trim().split(/\s+/).filter(c => c && !c.includes(':') && !c.includes('/'));
        if (classes.length > 0) {
            const classSelector = `${tagName}.${classes.slice(0, 2).map(c => globalThis.CSS?.escape ? globalThis.CSS.escape(c) : c).join('.')}`;
            if (element.ownerDocument?.querySelectorAll(classSelector).length === 1) {
                return classSelector;
            }
        }
    }

    return tagName;
}

export function isVisible(element) {
    if (!element || element.nodeType !== 1) return false;
    if (element.offsetParent === null && element.tagName.toLowerCase() !== 'body') {
        // May be position: fixed or hidden
        const style = globalThis.getComputedStyle ? globalThis.getComputedStyle(element) : null;
        if (style && (style.display === 'none' || style.visibility === 'hidden')) {
            return false;
        }
    }
    const style = globalThis.getComputedStyle ? globalThis.getComputedStyle(element) : null;
    if (style) {
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }
    }
    if (typeof element.getBoundingClientRect === 'function') {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }
    return true;
}

export function labelFor(element) {
    if (!element) return '';
    const doc = element.ownerDocument || globalThis.document;

    // 1. Associated <label> if id exists
    if (element.id && doc) {
        const labelEl = doc.querySelector(`label[for="${escapeAttribute(element.id)}"]`);
        if (labelEl && labelEl.innerText) {
            return labelEl.innerText.trim().replace(/\s+/g, ' ');
        }
    }

    // 2. Parent <label>
    const parentLabel = element.closest ? element.closest('label') : null;
    if (parentLabel && parentLabel.innerText) {
        return parentLabel.innerText.trim().replace(/\s+/g, ' ');
    }

    // 3. Direct attributes & text
    return (
        element.innerText
        || element.value
        || element.getAttribute('aria-label')
        || element.getAttribute('placeholder')
        || element.getAttribute('title')
        || element.getAttribute('alt')
        || element.getAttribute('name')
        || ''
    ).trim().replace(/\s+/g, ' ').slice(0, 120);
}

function extractMetadata(doc) {
    const getMeta = (query) => {
        const el = doc.querySelector(query);
        return el ? (el.getAttribute('content') || el.getAttribute('href') || '').trim() : null;
    };

    const title = doc.title || getMeta('meta[property="og:title"]') || getMeta('meta[name="twitter:title"]') || '';
    const description = getMeta('meta[name="description"]') || getMeta('meta[property="og:description"]') || getMeta('meta[name="twitter:description"]') || '';
    const canonicalUrl = getMeta('link[rel="canonical"]') || doc.location?.href || '';
    const language = doc.documentElement?.getAttribute('lang') || getMeta('meta[http-equiv="content-language"]') || '';
    const author = getMeta('meta[name="author"]') || getMeta('meta[property="article:author"]') || '';
    const publishedDate = getMeta('meta[property="article:published_time"]') || getMeta('meta[name="pubdate"]') || getMeta('meta[name="date"]') || '';
    const siteName = getMeta('meta[property="og:site_name"]') || '';

    const openGraph = {
        title: getMeta('meta[property="og:title"]'),
        description: getMeta('meta[property="og:description"]'),
        image: getMeta('meta[property="og:image"]'),
        type: getMeta('meta[property="og:type"]'),
        siteName: getMeta('meta[property="og:site_name"]')
    };

    const twitterCard = {
        card: getMeta('meta[name="twitter:card"]'),
        title: getMeta('meta[name="twitter:title"]'),
        description: getMeta('meta[name="twitter:description"]'),
        image: getMeta('meta[name="twitter:image"]')
    };

    // JSON-LD structured data parsing
    const jsonLd = [];
    const jsonLdScripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
    for (const script of jsonLdScripts) {
        try {
            const parsed = JSON.parse(script.textContent || '{}');
            const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
            for (const item of items) {
                if (item && typeof item === 'object' && item['@type']) {
                    jsonLd.push({
                        type: item['@type'],
                        name: item.name || item.headline || null,
                        description: item.description || null,
                        url: item.url || null,
                        raw: item
                    });
                }
            }
        } catch {
            // Ignore malformed JSON-LD
        }
    }

    return {
        title,
        description,
        canonicalUrl,
        language,
        author,
        publishedDate,
        siteName,
        openGraph,
        twitterCard,
        jsonLd
    };
}

function extractHeadingOutline(doc) {
    const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    return headings
        .filter(h => isVisible(h) && (h.innerText || '').trim().length > 0)
        .map(h => {
            const level = parseInt(h.tagName.substring(1), 10);
            return {
                level,
                text: (h.innerText || '').trim().replace(/\s+/g, ' '),
                id: h.id || null,
                selector: selectorFor(h)
            };
        });
}

function extractLandmarks(doc) {
    const selectors = 'main, nav, header, footer, aside, article, form, [role="main"], [role="navigation"], [role="search"], [role="banner"], [role="contentinfo"]';
    const elements = Array.from(doc.querySelectorAll(selectors));
    const landmarks = [];

    for (const el of elements) {
        if (!isVisible(el)) continue;
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute('role') || tag;
        const text = (el.innerText || '').trim().replace(/\s+/g, ' ');
        const summary = text.length > 120 ? `${text.slice(0, 120)}...` : text;

        landmarks.push({
            type: role,
            tag,
            selector: selectorFor(el),
            textSummary: summary
        });
    }

    return landmarks;
}

function extractMainContent(doc, maxContentLength = 5000) {
    // Readability-inspired candidate container scoring algorithm
    const candidateSelectors = 'article, main, [role="main"], .post-content, .article-content, .entry-content, #content, .content, section, body';
    const candidates = Array.from(doc.querySelectorAll(candidateSelectors));

    let bestCandidate = doc.body || doc.documentElement;
    let maxScore = -1;

    for (const el of candidates) {
        if (!isVisible(el)) continue;

        let score = 0;
        const tag = el.tagName.toLowerCase();
        if (tag === 'article') score += 30;
        if (tag === 'main' || el.getAttribute('role') === 'main') score += 25;

        const classAndId = `${el.className || ''} ${el.id || ''}`.toLowerCase();
        if (/content|article|post|body|entry|main/i.test(classAndId)) score += 15;
        if (/sidebar|comment|nav|footer|header|menu|ad-/i.test(classAndId)) score -= 25;

        const paragraphs = Array.from(el.querySelectorAll('p'));
        score += paragraphs.length * 5;

        const rawText = (el.innerText || '').trim();
        score += Math.min(Math.floor(rawText.length / 100), 50);

        // Link density penalty
        const links = Array.from(el.querySelectorAll('a'));
        const linkTextLength = links.reduce((acc, a) => acc + (a.innerText || '').length, 0);
        const linkDensity = rawText.length > 0 ? linkTextLength / rawText.length : 1;
        if (linkDensity > 0.4) score -= 40;

        if (score > maxScore) {
            maxScore = score;
            bestCandidate = el;
        }
    }

    // Clone & clean candidate clone to strip unneeded sub-elements
    let extractedText = '';
    if (bestCandidate) {
        // Clean boilerplate children text: nav, footer, header, script, style, comments, ads
        const clone = bestCandidate.cloneNode(true);
        const noiseEls = clone.querySelectorAll ? clone.querySelectorAll('script, style, noscript, svg, nav, footer, header, aside, .ad, .ads, #cookie-banner, .cookie-banner, [aria-hidden="true"]') : [];
        noiseEls.forEach(n => n.remove());
        extractedText = (clone.innerText || clone.textContent || '').replace(/\n\s*\n+/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
    }

    if (!extractedText && doc.body) {
        extractedText = (doc.body.innerText || '').replace(/\s+/g, ' ').trim();
    }

    const truncated = extractedText.length > maxContentLength;
    const finalContent = extractedText.slice(0, maxContentLength);
    const words = finalContent.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

    return {
        text: finalContent,
        truncated,
        wordCount,
        readingTimeMinutes
    };
}

function extractForms(doc) {
    const forms = Array.from(doc.querySelectorAll('form'));
    const results = [];

    const processForm = (formEl, index) => {
        const formId = formEl.id || `form_${index + 1}`;
        const action = formEl.getAttribute('action') || formEl.action || '';
        const method = (formEl.getAttribute('method') || 'GET').toUpperCase();
        const inputs = Array.from(formEl.querySelectorAll('input, select, textarea'));

        const fields = inputs.map(input => {
            const type = input.getAttribute('type') || input.tagName.toLowerCase();
            const name = input.getAttribute('name') || input.id || '';
            const value = input.value || input.getAttribute('value') || '';
            const placeholder = input.getAttribute('placeholder') || '';
            const label = labelFor(input);

            let options = [];
            if (input.tagName.toLowerCase() === 'select') {
                options = Array.from(input.querySelectorAll('option')).map(opt => ({
                    label: (opt.innerText || opt.text || '').trim(),
                    value: opt.value
                }));
            }

            return {
                label,
                name,
                type,
                value,
                placeholder,
                options: options.length > 0 ? options : undefined,
                selector: selectorFor(input)
            };
        });

        const submitButtons = Array.from(formEl.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type="button"]):not([type="reset"])'))
            .map(btn => ({
                text: labelFor(btn) || 'Submit',
                selector: selectorFor(btn)
            }));

        return {
            id: formId,
            action,
            method,
            selector: selectorFor(formEl),
            fields,
            submitButtons
        };
    };

    forms.forEach((f, idx) => {
        if (isVisible(f)) {
            results.push(processForm(f, idx));
        }
    });

    // Handle standalone input fields outside forms
    const orphanInputs = Array.from(doc.querySelectorAll('input:not(form input), select:not(form select), textarea:not(form textarea)'))
        .filter(isVisible);

    if (orphanInputs.length > 0 && forms.length === 0) {
        const orphanFields = orphanInputs.map(input => ({
            label: labelFor(input),
            name: input.getAttribute('name') || input.id || '',
            type: input.getAttribute('type') || input.tagName.toLowerCase(),
            value: input.value || '',
            placeholder: input.getAttribute('placeholder') || '',
            selector: selectorFor(input)
        }));

        results.push({
            id: 'unbound_inputs',
            action: '',
            method: '',
            selector: 'body',
            fields: orphanFields,
            submitButtons: []
        });
    }

    return results;
}

function extractTables(doc) {
    const tables = Array.from(doc.querySelectorAll('table')).filter(isVisible);
    const results = [];

    tables.forEach((tableEl, idx) => {
        const caption = tableEl.querySelector('caption')?.innerText?.trim() || '';
        const headerEls = Array.from(tableEl.querySelectorAll('th'));
        const headers = headerEls.map(th => th.innerText.trim().replace(/\s+/g, ' '));

        const rows = [];
        const trEls = Array.from(tableEl.querySelectorAll('tbody tr, tr')).filter(tr => tr.querySelector('td'));
        for (const tr of trEls) {
            const cells = Array.from(tr.querySelectorAll('td, th')).map(td => td.innerText.trim().replace(/\s+/g, ' '));
            if (cells.length > 0) {
                rows.push(cells);
            }
        }

        // Build Markdown table representation
        let markdown = '';
        if (headers.length > 0 || rows.length > 0) {
            const colCount = Math.max(headers.length, ...rows.map(r => r.length));
            const paddedHeaders = Array.from({ length: colCount }, (_, i) => headers[i] || `Column ${i + 1}`);
            markdown += `| ${paddedHeaders.join(' | ')} |\n`;
            markdown += `| ${paddedHeaders.map(() => '---').join(' | ')} |\n`;

            for (const row of rows) {
                const paddedRow = Array.from({ length: colCount }, (_, i) => row[i] || '');
                markdown += `| ${paddedRow.join(' | ')} |\n`;
            }
        }

        results.push({
            id: tableEl.id || `table_${idx + 1}`,
            caption,
            headers,
            rows,
            markdown: markdown.trim(),
            selector: selectorFor(tableEl)
        });
    });

    return results;
}

function extractInteractiveElements(doc, maxElements = 30) {
    const elementSelectors = 'a, button, input, textarea, select, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"]';
    const elements = Array.from(doc.querySelectorAll(elementSelectors))
        .filter(isVisible)
        .slice(0, maxElements)
        .map(el => ({
            tag: el.tagName.toLowerCase(),
            text: labelFor(el),
            selector: selectorFor(el),
            role: el.getAttribute('role') || null,
            type: el.getAttribute('type') || null,
            href: el.href || el.getAttribute('href') || null
        }));

    return elements;
}

/**
 * Main Semantic Page Extractor function.
 * @param {Document} doc - DOM Document instance
 * @param {Object} options - Extraction configuration options
 * @returns {Object} Structured Semantic Page Payload
 */
export function extractPageSemantics(doc = globalThis.document, {
    maxContentLength = 5000,
    includeTables = true,
    includeForms = true,
    includeOutline = true,
    includeLandmarks = true,
    includeJsonLd = true,
    maxElements = 30
} = {}) {
    if (!doc) {
        throw new Error('Document object is required for extractPageSemantics.');
    }

    const metadata = extractMetadata(doc);
    if (!includeJsonLd) {
        delete metadata.jsonLd;
    }

    const mainContent = extractMainContent(doc, maxContentLength);
    const headingOutline = includeOutline ? extractHeadingOutline(doc) : [];
    const landmarks = includeLandmarks ? extractLandmarks(doc) : [];
    const forms = includeForms ? extractForms(doc) : [];
    const tables = includeTables ? extractTables(doc) : [];
    const interactiveElements = extractInteractiveElements(doc, maxElements);

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
}
