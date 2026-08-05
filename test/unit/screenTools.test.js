import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
    createScreenTools,
    createScreenshotPath
} from '../../src/tools/implementations/screenTools.js';

function createTempDirectory() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'pc-assistant-screen-'));
}

test('createScreenshotPath creates safe png paths inside the screenshot directory', () => {
    const screenshotDirectory = '/tmp/screenshots';
    const filePath = createScreenshotPath({
        fileName: '../My Screen Shot?.jpg',
        screenshotDirectory
    });

    assert.equal(filePath, path.join(screenshotDirectory, 'My-Screen-Shot.png'));
});

test('takeScreenshot uses injected capture function and returns the saved file path', async () => {
    const screenshotDirectory = createTempDirectory();
    let capturedPath = null;

    try {
        const tools = createScreenTools({
            screenshotDirectory,
            captureScreenshot: async filePath => {
                capturedPath = filePath;
                fs.writeFileSync(filePath, 'fake png data');
            },
            now: () => new Date('2026-07-21T18:00:00.000Z')
        });

        const result = await tools.takeScreenshot();

        assert.equal(result.status, 'Success');
        assert.equal(result.filePath, path.join(screenshotDirectory, 'screenshot-2026-07-21T18-00-00-000Z.png'));
        assert.equal(capturedPath, result.filePath);
        assert.equal(fs.existsSync(result.filePath), true);
    } finally {
        fs.rmSync(screenshotDirectory, { recursive: true, force: true });
    }
});

test('describeScreen returns a clear error when Gemini is not configured', async () => {
    const tools = createScreenTools();

    const result = await tools.describeScreen({ question: 'What is visible?' });

    assert.equal(result.status, 'Error');
    assert.match(result.message, /GEMINI_API_KEY/);
});

test('describeScreen captures and analyzes a screenshot with injected functions', async () => {
    const screenshotDirectory = createTempDirectory();
    const ai = { models: {} };
    let analysisArgs = null;

    try {
        const tools = createScreenTools({
            ai,
            config: { screenAnalysisModel: 'gemini-test-vision' },
            screenshotDirectory,
            captureScreenshot: async filePath => {
                fs.writeFileSync(filePath, 'fake png data');
            },
            analyzeScreenshot: async args => {
                analysisArgs = args;
                return 'A browser window with an error message is visible.';
            }
        });

        const result = await tools.describeScreen({
            question: 'Read the error.',
            fileName: 'current screen'
        });

        assert.equal(result.status, 'Success');
        assert.equal(result.filePath, path.join(screenshotDirectory, 'current-screen.png'));
        assert.equal(result.description, 'A browser window with an error message is visible.');
        assert.equal(analysisArgs.ai, ai);
        assert.equal(analysisArgs.modelName, 'gemini-test-vision');
        assert.equal(analysisArgs.filePath, result.filePath);
        assert.equal(analysisArgs.question, 'Read the error.');
    } finally {
        fs.rmSync(screenshotDirectory, { recursive: true, force: true });
    }
});
