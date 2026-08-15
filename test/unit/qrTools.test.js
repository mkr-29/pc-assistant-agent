import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createQrTools } from '../../src/tools/implementations/qrTools.js';

describe('qrTools', () => {
    it('returns error when text is missing', async () => {
        const tools = createQrTools();
        const res = await tools.generateQrCode({});
        assert.equal(res.status, 'Error');
        assert.match(res.message, /text or URL string is required/i);
    });

    it('generates a valid PNG QR code file', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-test-'));
        const tools = createQrTools({ qrDirectory: tempDir });

        const res = await tools.generateQrCode({
            text: 'https://github.com/mkr-27',
            width: 300
        });

        assert.equal(res.status, 'Success');
        assert.ok(res.filePath.endsWith('.png'));
        assert.ok(fs.existsSync(res.filePath));
        assert.ok(res.fileSizeBytes > 100);

        fs.rmSync(tempDir, { recursive: true, force: true });
    });
});
