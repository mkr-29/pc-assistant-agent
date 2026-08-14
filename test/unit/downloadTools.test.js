import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDownloadTools } from '../../src/tools/implementations/downloadTools.js';

function createTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'download-tools-test-'));
}

test('downloadFile saves file from fetch response with stream/buffer', async () => {
    const tempDir = createTempDir();
    try {
        const outPath = path.join(tempDir, 'test_file.txt');
        const content = 'Hello world download test';

        const mockFetch = async (url) => {
            return {
                ok: true,
                status: 200,
                headers: new Map([
                    ['content-type', 'text/plain'],
                    ['content-disposition', 'attachment; filename="test_file.txt"']
                ]),
                arrayBuffer: async () => Buffer.from(content)
            };
        };

        const tools = createDownloadTools({
            resolveToolPath: p => p,
            fetchFn: mockFetch
        });

        const result = await tools.downloadFile({
            url: 'https://example.com/data.txt',
            outputPath: outPath
        });

        assert.equal(result.status, 'Success');
        assert.equal(result.filePath, outPath);
        assert.ok(fs.existsSync(outPath));
        assert.equal(fs.readFileSync(outPath, 'utf8'), content);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('downloadFile derives filename from URL if outputPath is not provided', async () => {
    const tempDir = createTempDir();
    try {
        const mockFetch = async () => ({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            arrayBuffer: async () => Buffer.from('{"key":"value"}')
        });

        const tools = createDownloadTools({
            resolveToolPath: (p = '') => path.join(tempDir, p),
            fetchFn: mockFetch
        });

        const result = await tools.downloadFile({
            url: 'https://example.com/assets/report.json'
        });

        assert.equal(result.status, 'Success');
        assert.ok(result.filePath.endsWith('report.json'));
        assert.ok(fs.existsSync(result.filePath));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('downloadFile rejects non-http URLs', async () => {
    const tools = createDownloadTools({ resolveToolPath: p => p });
    await assert.rejects(
        () => tools.downloadFile({ url: 'ftp://invalid.com/file' }),
        /A valid HTTP\/HTTPS url is required/
    );
});

test('downloadMedia invokes yt-dlp with appropriate arguments', async () => {
    const tempDir = createTempDir();
    try {
        const dummyMedia = path.join(tempDir, 'song.mp3');
        fs.writeFileSync(dummyMedia, 'dummy audio data');

        let executedArgs = null;
        const mockExecFile = async (command, args) => {
            assert.equal(command, 'yt-dlp');
            executedArgs = args;
            return {
                stdout: `${dummyMedia}\nAwesome Song\n180\n`
            };
        };

        const tools = createDownloadTools({
            resolveToolPath: p => p,
            execFileFn: mockExecFile
        });

        const result = await tools.downloadMedia({
            url: 'https://youtube.com/watch?v=12345',
            extractAudio: true,
            audioFormat: 'mp3'
        });

        assert.equal(result.status, 'Success');
        assert.equal(result.filePath, dummyMedia);
        assert.equal(result.title, 'Awesome Song');
        assert.equal(result.durationSeconds, 180);
        assert.ok(executedArgs.includes('-x'));
        assert.ok(executedArgs.includes('--audio-format'));
        assert.ok(executedArgs.includes('mp3'));
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
