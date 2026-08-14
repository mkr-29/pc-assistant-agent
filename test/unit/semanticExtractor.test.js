import assert from 'node:assert/strict';
import test from 'node:test';
import { extractPageSemantics, isVisible, labelFor, selectorFor } from '../../src/utils/semanticExtractor.js';

function createMockElement({
    tagName = 'div',
    id = '',
    className = '',
    attributes = {},
    innerText = '',
    children = [],
    rect = { width: 100, height: 20 },
    style = { display: 'block', visibility: 'visible', opacity: '1' },
    value = ''
} = {}) {
    const attrMap = new Map(Object.entries(attributes));
    if (id) attrMap.set('id', id);
    if (className) attrMap.set('class', className);

    let explicitText = innerText;
    const el = {
        nodeType: 1,
        tagName: tagName.toUpperCase(),
        id,
        className,
        value,
        get innerText() {
            if (explicitText) return explicitText;
            if (children && children.length > 0) {
                return children.map(c => c.innerText || c.textContent || '').join('\n').trim();
            }
            return '';
        },
        set innerText(val) {
            explicitText = val;
        },
        get textContent() {
            return this.innerText;
        },
        children,
        offsetParent: {},
        ownerDocument: null,

        getAttribute(name) {
            return attrMap.get(name) || null;
        },

        getBoundingClientRect() {
            return rect;
        },

        querySelector(sel) {
            return querySelectorMock(el, sel);
        },

        querySelectorAll(sel) {
            return querySelectorAllMock(el, sel);
        },

        closest(sel) {
            if (sel === 'label' && tagName.toLowerCase() === 'label') return el;
            return null;
        },

        cloneNode(deep) {
            return createMockElement({
                tagName,
                id,
                className,
                attributes: Object.fromEntries(attrMap),
                innerText,
                children: deep ? children.map(c => c.cloneNode?.(true) || c) : [],
                rect,
                style,
                value
            });
        },

        remove() {
            // No-op for mock node deletion
        }
    };

    children.forEach(c => {
        if (c && typeof c === 'object') {
            c.parentElement = el;
        }
    });

    return el;
}

function querySelectorMock(root, selector) {
    const results = querySelectorAllMock(root, selector);
    return results[0] || null;
}

function querySelectorAllMock(root, selector) {
    const list = [];

    function search(node) {
        if (!node || !node.children) return;
        for (const child of node.children) {
            if (matchesMock(child, selector)) {
                list.push(child);
            }
            search(child);
        }
    }

    search(root);
    return list;
}

function matchesMock(node, selector) {
    if (!node || node.nodeType !== 1) return false;
    const selectors = selector.split(',').map(s => s.trim());
    const tag = node.tagName.toLowerCase();

    for (const sel of selectors) {
        if (sel === tag) return true;
        if (sel.startsWith('#') && node.id === sel.slice(1)) return true;
        if (sel.startsWith('.') && node.className.includes(sel.slice(1))) return true;
        if (sel.startsWith('meta[')) {
            const attrMatch = sel.match(/meta\[(name|property)="([^"]+)"\]/);
            if (attrMatch && tag === 'meta') {
                const [, attr, val] = attrMatch;
                if (node.getAttribute(attr) === val) return true;
            }
        }
        if (sel.startsWith('script[')) {
            if (tag === 'script' && node.getAttribute('type') === 'application/ld+json') return true;
        }
        if (sel.startsWith('link[')) {
            if (tag === 'link' && node.getAttribute('rel') === 'canonical') return true;
        }
        if (sel === 'h1, h2, h3, h4, h5, h6' || ['h1','h2','h3','h4','h5','h6'].includes(sel)) {
            if (['h1','h2','h3','h4','h5','h6'].includes(tag)) return true;
        }
        if (['article', 'main', 'nav', 'header', 'footer', 'aside', 'form', 'table'].includes(sel)) {
            if (tag === sel) return true;
        }
        if (['a', 'button', 'input', 'select', 'textarea'].includes(sel)) {
            if (tag === sel) return true;
        }
        if (sel.includes('[role="main"]') && node.getAttribute('role') === 'main') return true;
    }

    return false;
}

function createMockDocument() {
    const metaTitle = createMockElement({ tagName: 'meta', attributes: { property: 'og:title', content: 'Semantic News' } });
    const metaDesc = createMockElement({ tagName: 'meta', attributes: { name: 'description', content: 'Latest AI breakthrough news.' } });
    const jsonLdScript = createMockElement({
        tagName: 'script',
        attributes: { type: 'application/ld+json' },
        innerText: JSON.stringify({
            '@type': 'NewsArticle',
            headline: 'AI Agents Evolve',
            description: 'AI agents become semantic-aware.'
        })
    });

    const head = createMockElement({ tagName: 'head', children: [metaTitle, metaDesc, jsonLdScript] });

    const h1 = createMockElement({ tagName: 'h1', id: 'main-heading', innerText: 'Welcome to Semantic Web' });
    const h2 = createMockElement({ tagName: 'h2', id: 'features', innerText: 'Features Overview' });

    const p1 = createMockElement({ tagName: 'p', innerText: 'This is the first main paragraph about page extraction.' });
    const p2 = createMockElement({ tagName: 'p', innerText: 'Paragraph two explains how structured semantics help LLMs.' });

    const article = createMockElement({
        tagName: 'article',
        className: 'main-article',
        children: [h1, p1, h2, p2]
    });

    const textInput = createMockElement({ tagName: 'input', attributes: { type: 'text', name: 'search', placeholder: 'Search...' } });
    const submitBtn = createMockElement({ tagName: 'button', attributes: { type: 'submit' }, innerText: 'Search Now' });
    const form = createMockElement({ tagName: 'form', id: 'search-form', attributes: { action: '/search' }, children: [textInput, submitBtn] });

    const th1 = createMockElement({ tagName: 'th', innerText: 'Item' });
    const th2 = createMockElement({ tagName: 'th', innerText: 'Price' });
    const trHead = createMockElement({ tagName: 'tr', children: [th1, th2] });

    const td1 = createMockElement({ tagName: 'td', innerText: 'Widget A' });
    const td2 = createMockElement({ tagName: 'td', innerText: '$10' });
    const trBody = createMockElement({ tagName: 'tr', children: [td1, td2] });

    const table = createMockElement({ tagName: 'table', id: 'price-table', children: [trHead, trBody] });

    const navLink = createMockElement({ tagName: 'a', attributes: { href: '/home' }, innerText: 'Home' });
    const nav = createMockElement({ tagName: 'nav', children: [navLink] });

    const body = createMockElement({ tagName: 'body', children: [nav, article, form, table] });

    const html = createMockElement({ tagName: 'html', attributes: { lang: 'en' }, children: [head, body] });

    const doc = {
        nodeType: 9,
        title: 'Semantic News Test',
        location: { href: 'https://example.com/article' },
        documentElement: html,
        head,
        body,
        querySelector(sel) {
            return querySelectorMock(html, sel);
        },
        querySelectorAll(sel) {
            return querySelectorAllMock(html, sel);
        }
    };

    html.ownerDocument = doc;
    body.ownerDocument = doc;
    article.ownerDocument = doc;
    form.ownerDocument = doc;
    table.ownerDocument = doc;

    return doc;
}

test('isVisible correctly identifies visible elements', () => {
    const visibleEl = createMockElement({ rect: { width: 100, height: 50 } });
    assert.equal(isVisible(visibleEl), true);

    const hiddenEl = createMockElement({ rect: { width: 0, height: 0 } });
    assert.equal(isVisible(hiddenEl), false);
});

test('labelFor extracts placeholder, value, or innerText', () => {
    const inputWithPlaceholder = createMockElement({ tagName: 'input', attributes: { placeholder: 'Enter email...' } });
    assert.equal(labelFor(inputWithPlaceholder), 'Enter email...');

    const btnWithText = createMockElement({ tagName: 'button', innerText: ' Click Me ' });
    assert.equal(labelFor(btnWithText), 'Click Me');
});

test('selectorFor builds CSS selectors with IDs and test attributes', () => {
    const elWithId = createMockElement({ tagName: 'div', id: 'header-root' });
    assert.equal(selectorFor(elWithId), '#header-root');

    const elWithTestId = createMockElement({ tagName: 'button', attributes: { 'data-testid': 'submit-btn' } });
    assert.equal(selectorFor(elWithTestId), 'button[data-testid="submit-btn"]');
});

test('extractPageSemantics extracts metadata, article, heading outline, forms, and tables', () => {
    const doc = createMockDocument();
    const result = extractPageSemantics(doc, {
        maxContentLength: 1000,
        includeTables: true,
        includeForms: true,
        includeOutline: true
    });

    assert.equal(result.title, 'Semantic News Test');
    assert.equal(result.metadata.description, 'Latest AI breakthrough news.');
    assert.equal(result.metadata.language, 'en');
    assert.equal(result.metadata.jsonLd.length, 1);
    assert.equal(result.metadata.jsonLd[0].type, 'NewsArticle');

    assert.ok(result.mainContent.text.includes('Welcome to Semantic Web'));
    assert.ok(result.mainContent.text.includes('first main paragraph'));
    assert.equal(result.mainContent.truncated, false);

    assert.equal(result.headingOutline.length, 2);
    assert.equal(result.headingOutline[0].text, 'Welcome to Semantic Web');
    assert.equal(result.headingOutline[0].level, 1);
    assert.equal(result.headingOutline[1].text, 'Features Overview');

    assert.equal(result.forms.length, 1);
    assert.equal(result.forms[0].id, 'search-form');
    assert.equal(result.forms[0].action, '/search');
    assert.equal(result.forms[0].fields.length, 1);
    assert.equal(result.forms[0].fields[0].placeholder, 'Search...');

    assert.equal(result.tables.length, 1);
    assert.equal(result.tables[0].id, 'price-table');
    assert.ok(result.tables[0].markdown.includes('| Item | Price |'));
    assert.ok(result.tables[0].markdown.includes('| Widget A | $10 |'));
});
