import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createDocumentTools } from '../../src/tools/implementations/documentTools.js';

describe('documentTools', () => {
    describe('extractPdfText', () => {
        it('returns error when filePath is missing', async () => {
            const tools = createDocumentTools();
            const res = await tools.extractPdfText({});
            assert.equal(res.status, 'Error');
            assert.match(res.message, /filePath is required/i);
        });

        it('returns error when PDF file does not exist', async () => {
            const tools = createDocumentTools();
            const res = await tools.extractPdfText({ filePath: '/nonexistent/file.pdf' });
            assert.equal(res.status, 'Error');
            assert.match(res.message, /not found/i);
        });
    });

    describe('extractPdfMetadata', () => {
        it('returns error when filePath is missing', async () => {
            const tools = createDocumentTools();
            const res = await tools.extractPdfMetadata({});
            assert.equal(res.status, 'Error');
            assert.match(res.message, /filePath is required/i);
        });
    });

    describe('convertDocumentWithPandoc', () => {
        it('returns error when inputPath or toFormat is missing', async () => {
            const tools = createDocumentTools();
            const res1 = await tools.convertDocumentWithPandoc({});
            assert.equal(res1.status, 'Error');

            const res2 = await tools.convertDocumentWithPandoc({ inputPath: 'file.md' });
            assert.equal(res2.status, 'Error');
        });

        it('converts markdown to html using builtin fallback converter', async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pandoc-test-'));
            const mdPath = path.join(tempDir, 'test.md');
            fs.writeFileSync(mdPath, '# Hello World\n\nThis is **bold** text.', 'utf8');

            const tools = createDocumentTools({ resolveToolPath: p => p });
            const res = await tools.convertDocumentWithPandoc({
                inputPath: mdPath,
                toFormat: 'html'
            });

            assert.equal(res.status, 'Success');
            assert.ok(fs.existsSync(res.outputPath));
            const htmlContent = fs.readFileSync(res.outputPath, 'utf8');
            assert.ok(htmlContent.includes('<h1>Hello World</h1>'));
            assert.ok(htmlContent.includes('<b>bold</b>'));

            fs.rmSync(tempDir, { recursive: true, force: true });
        });
    });
});
