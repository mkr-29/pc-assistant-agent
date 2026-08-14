import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createOcrTools } from '../../src/tools/implementations/ocrTools.js';

describe('ocrTools', () => {
    it('returns error when imagePath is missing', async () => {
        const tools = createOcrTools();
        const res = await tools.performVisionOcr({});
        assert.equal(res.status, 'Error');
        assert.match(res.message, /imagePath is required/i);
    });

    it('returns error when image file does not exist', async () => {
        const tools = createOcrTools();
        const res = await tools.performVisionOcr({ imagePath: '/nonexistent/image.png' });
        assert.equal(res.status, 'Error');
        assert.match(res.message, /not found/i);
    });

    it('uses native macOS Vision mock when Swift succeeds', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-test-'));
        const imagePath = path.join(tempDir, 'dummy.png');
        fs.writeFileSync(imagePath, Buffer.from('fake-png-data'));

        const mockExecFile = (cmd, args, opts, cb) => {
            const callback = typeof opts === 'function' ? opts : cb;
            callback(null, 'Receipt #9876\nTotal: $45.00', '');
        };

        const tools = createOcrTools({
            resolveToolPath: p => p,
            execFileImpl: mockExecFile
        });

        const res = await tools.performVisionOcr({ imagePath });

        assert.equal(res.status, 'Success');
        assert.equal(res.engine, 'macOS-Vision');
        assert.equal(res.lineCount, 2);
        assert.ok(res.text.includes('Receipt #9876'));

        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('falls back to Gemini Multimodal when Swift fails', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-test-'));
        const imagePath = path.join(tempDir, 'dummy.png');
        fs.writeFileSync(imagePath, Buffer.from('fake-png-data'));

        const failingExecFile = (cmd, args, opts, cb) => {
            const callback = typeof opts === 'function' ? opts : cb;
            callback(new Error('Swift error'), '', 'Swift failed');
        };

        const mockAi = {
            models: {
                generateContent: async () => ({
                    text: 'Invoice #12345\nTotal: $150.00'
                })
            }
        };

        const tools = createOcrTools({
            ai: mockAi,
            resolveToolPath: p => p,
            execFileImpl: failingExecFile
        });

        const res = await tools.performVisionOcr({ imagePath });

        assert.equal(res.status, 'Success');
        assert.equal(res.engine, 'gemini-multimodal');
        assert.ok(res.text.includes('Invoice #12345'));

        fs.rmSync(tempDir, { recursive: true, force: true });
    });
});
