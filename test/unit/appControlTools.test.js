import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createAppControlTools } from '../../src/tools/implementations/appControlTools.js';

const ROOT_PATH = '/Users/example/project';

function resolveToolPath(inputPath) {
    if (!inputPath) {
        return ROOT_PATH;
    }

    if (path.isAbsolute(inputPath)) {
        return inputPath;
    }

    return path.join(ROOT_PATH, inputPath);
}

function createSuccessfulExecFile() {
    const calls = [];

    return {
        calls,
        execFileImpl(command, args, options, callback) {
            calls.push({ command, args, options });
            callback(null, '', '');
        }
    };
}

test('openLocalTarget launches a macOS app by alias', async () => {
    const fakeExecFile = createSuccessfulExecFile();
    const tools = createAppControlTools({
        platform: 'darwin',
        resolveToolPath,
        execFileImpl: fakeExecFile.execFileImpl
    });

    const result = await tools.openLocalTarget({ appName: 'Chrome' });

    assert.equal(result.status, 'Success');
    assert.equal(result.appName, 'Google Chrome');
    assert.equal(result.targetPath, null);
    assert.deepEqual(fakeExecFile.calls, [
        {
            command: '/usr/bin/open',
            args: ['-a', 'Google Chrome'],
            options: {
                timeout: 10000,
                maxBuffer: 64 * 1024
            }
        }
    ]);
});

test('openLocalTarget opens a local path with the default app', async () => {
    const fakeExecFile = createSuccessfulExecFile();
    const tools = createAppControlTools({
        platform: 'darwin',
        resolveToolPath,
        execFileImpl: fakeExecFile.execFileImpl,
        pathExists: filePath => filePath === path.join(ROOT_PATH, 'README.md')
    });

    const result = await tools.openLocalTarget({ targetPath: 'README.md' });

    assert.equal(result.status, 'Success');
    assert.equal(result.appName, null);
    assert.equal(result.targetPath, path.join(ROOT_PATH, 'README.md'));
    assert.deepEqual(fakeExecFile.calls[0].args, [path.join(ROOT_PATH, 'README.md')]);
});

test('openLocalTarget opens web URLs directly without local path checks', async () => {
    const fakeExecFile = createSuccessfulExecFile();
    const tools = createAppControlTools({
        platform: 'darwin',
        resolveToolPath,
        execFileImpl: fakeExecFile.execFileImpl,
        pathExists: () => false
    });

    const result = await tools.openLocalTarget({ targetPath: 'https://claude.ai' });

    assert.equal(result.status, 'Success');
    assert.equal(result.targetPath, 'https://claude.ai');
    assert.deepEqual(fakeExecFile.calls[0].args, ['https://claude.ai']);
});

test('openLocalTarget opens a folder with VS Code alias', async () => {
    const fakeExecFile = createSuccessfulExecFile();
    const tools = createAppControlTools({
        platform: 'darwin',
        resolveToolPath,
        execFileImpl: fakeExecFile.execFileImpl,
        pathExists: filePath => filePath === ROOT_PATH
    });

    const result = await tools.openLocalTarget({ appName: 'code', targetPath: '.' });

    assert.equal(result.status, 'Success');
    assert.equal(result.appName, 'Visual Studio Code');
    assert.equal(result.targetPath, ROOT_PATH);
    assert.deepEqual(fakeExecFile.calls[0].args, ['-a', 'Visual Studio Code', ROOT_PATH]);
});

test('openLocalTarget reveals a local path in Finder', async () => {
    const fakeExecFile = createSuccessfulExecFile();
    const targetPath = path.join(ROOT_PATH, 'src/main.js');
    const tools = createAppControlTools({
        platform: 'darwin',
        resolveToolPath,
        execFileImpl: fakeExecFile.execFileImpl,
        pathExists: filePath => filePath === targetPath
    });

    const result = await tools.openLocalTarget({ targetPath: 'src/main.js', revealInFinder: true });

    assert.equal(result.status, 'Success');
    assert.equal(result.revealInFinder, true);
    assert.equal(result.targetPath, targetPath);
    assert.deepEqual(fakeExecFile.calls[0].args, ['-R', targetPath]);
});

test('openLocalTarget returns structured errors on unsupported platforms', async () => {
    const fakeExecFile = createSuccessfulExecFile();
    const tools = createAppControlTools({
        platform: 'linux',
        resolveToolPath,
        execFileImpl: fakeExecFile.execFileImpl
    });

    const result = await tools.openLocalTarget({ appName: 'Chrome' });

    assert.equal(result.status, 'Error');
    assert.match(result.message, /supported only on macOS/);
    assert.match(result.message, /linux/);
    assert.equal(fakeExecFile.calls.length, 0);
});

test('openLocalTarget rejects missing local paths before running open', async () => {
    const fakeExecFile = createSuccessfulExecFile();
    const missingPath = path.join(ROOT_PATH, 'missing.txt');
    const tools = createAppControlTools({
        platform: 'darwin',
        resolveToolPath,
        execFileImpl: fakeExecFile.execFileImpl,
        pathExists: () => false
    });

    const result = await tools.openLocalTarget({ targetPath: 'missing.txt' });

    assert.equal(result.status, 'Error');
    assert.equal(result.targetPath, missingPath);
    assert.match(result.message, /Path does not exist/);
    assert.equal(fakeExecFile.calls.length, 0);
});

test('openLocalTarget returns structured command failures', async () => {
    const tools = createAppControlTools({
        platform: 'darwin',
        resolveToolPath,
        execFileImpl: (_command, _args, _options, callback) => {
            callback(new Error('open failed'), '', 'application not found');
        }
    });

    const result = await tools.openLocalTarget({ appName: 'Missing App' });

    assert.equal(result.status, 'Error');
    assert.match(result.message, /\/usr\/bin\/open failed: application not found/);
});

test('controlDesktopBrowser generates AppleScript for Brave Browser and target tab', async () => {
    const fakeExecFile = createSuccessfulExecFile();
    const tools = createAppControlTools({
        platform: 'darwin',
        resolveToolPath,
        execFileImpl: fakeExecFile.execFileImpl
    });

    const result = await tools.controlDesktopBrowser({
        browserName: 'Brave',
        tabQuery: 'YouTube Music',
        action: 'playpause'
    });

    assert.equal(result.status, 'Success');
    assert.equal(result.browserName, 'Brave Browser');
    assert.equal(result.tabQuery, 'YouTube Music');
    assert.equal(fakeExecFile.calls.length, 1);
    assert.equal(fakeExecFile.calls[0].command, '/usr/bin/osascript');
    assert.match(fakeExecFile.calls[0].args[1], /tell application "Brave Browser"/);
    assert.match(fakeExecFile.calls[0].args[1], /YouTube Music/);
});

test('controlMediaPlayback triggers media key AppleScript on macOS', async () => {
    const fakeExecFile = createSuccessfulExecFile();
    const tools = createAppControlTools({
        platform: 'darwin',
        resolveToolPath,
        execFileImpl: fakeExecFile.execFileImpl
    });

    const result = await tools.controlMediaPlayback({
        action: 'playpause',
        appName: 'Brave Browser'
    });

    assert.equal(result.status, 'Success');
    assert.equal(result.action, 'playpause');
    assert.equal(result.appName, 'Brave Browser');
    assert.equal(fakeExecFile.calls.length, 1);
    assert.match(fakeExecFile.calls[0].args[1], /tell application "Brave Browser" to activate/);
    assert.match(fakeExecFile.calls[0].args[1], /key code 16/);
});

test('controlMediaPlayback sets macOS system output volume', async () => {
    const fakeExecFile = createSuccessfulExecFile();
    const tools = createAppControlTools({
        platform: 'darwin',
        resolveToolPath,
        execFileImpl: fakeExecFile.execFileImpl
    });

    const result = await tools.controlMediaPlayback({
        action: 'setvolume',
        volume: 30
    });

    assert.equal(result.status, 'Success');
    assert.equal(result.volume, 30);
    assert.equal(fakeExecFile.calls.length, 1);
    assert.equal(fakeExecFile.calls[0].command, '/usr/bin/osascript');
    assert.equal(fakeExecFile.calls[0].args[1], 'set volume output volume 30');
});
