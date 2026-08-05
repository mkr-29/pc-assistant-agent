import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createClipboardTools } from '../../src/tools/implementations/clipboardTools.js';

function createSuccessfulSpawn() {
    const calls = [];

    return {
        calls,
        spawnImpl(command, args, options) {
            const child = new EventEmitter();
            const stderr = new EventEmitter();
            const stdin = new EventEmitter();

            stderr.setEncoding = () => {};
            stdin.end = (content, encoding) => {
                calls.push({ command, args, options, content, encoding });
                process.nextTick(() => child.emit('close', 0));
            };

            child.stderr = stderr;
            child.stdin = stdin;
            return child;
        }
    };
}

test('readClipboard returns current macOS clipboard text', async () => {
    const execFileCalls = [];
    const tools = createClipboardTools({
        platform: 'darwin',
        execFileImpl: (command, options, callback) => {
            execFileCalls.push({ command, options });
            callback(null, 'copied text', '');
        }
    });

    const result = await tools.readClipboard();

    assert.equal(result.status, 'Success');
    assert.equal(result.content, 'copied text');
    assert.equal(result.length, 'copied text'.length);
    assert.equal(execFileCalls.length, 1);
    assert.equal(execFileCalls[0].command, 'pbpaste');
    assert.equal(execFileCalls[0].options.encoding, 'utf8');
});

test('writeClipboard writes generated text to pbcopy stdin', async () => {
    const fakeSpawn = createSuccessfulSpawn();
    const tools = createClipboardTools({
        platform: 'darwin',
        spawnImpl: fakeSpawn.spawnImpl
    });

    const result = await tools.writeClipboard({ content: 'npm test\n' });

    assert.equal(result.status, 'Success');
    assert.equal(result.length, 'npm test\n'.length);
    assert.equal(result.message, 'Clipboard updated.');
    assert.deepEqual(fakeSpawn.calls, [
        {
            command: 'pbcopy',
            args: [],
            options: { stdio: ['pipe', 'ignore', 'pipe'] },
            content: 'npm test\n',
            encoding: 'utf8'
        }
    ]);
});

test('clipboard tools return structured errors on unsupported platforms', async () => {
    const tools = createClipboardTools({ platform: 'linux' });

    const readResult = await tools.readClipboard();
    const writeResult = await tools.writeClipboard({ content: 'hello' });

    assert.equal(readResult.status, 'Error');
    assert.match(readResult.message, /supported only on macOS/);
    assert.match(readResult.message, /linux/);
    assert.equal(writeResult.status, 'Error');
    assert.match(writeResult.message, /supported only on macOS/);
});

test('readClipboard returns structured command failures', async () => {
    const tools = createClipboardTools({
        platform: 'darwin',
        execFileImpl: (_command, _options, callback) => {
            callback(new Error('command failed'), '', 'clipboard denied');
        }
    });

    const result = await tools.readClipboard();

    assert.equal(result.status, 'Error');
    assert.match(result.message, /pbpaste failed: clipboard denied/);
});
