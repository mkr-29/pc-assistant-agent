import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveBasePath, resolvePath } from '../../src/utils/paths.js';

test('resolveBasePath expands tilde paths', () => {
    assert.equal(resolveBasePath('~/Desktop'), path.join(os.homedir(), 'Desktop'));
});

test('resolvePath returns the target root when no path is provided', () => {
    assert.equal(resolvePath(undefined, '/tmp/project'), '/tmp/project');
});

test('resolvePath resolves relative paths from the target root', () => {
    assert.equal(resolvePath('src/main.js', '/tmp/project'), '/tmp/project/src/main.js');
});

test('resolvePath leaves absolute paths unchanged', () => {
    assert.equal(resolvePath('/var/tmp/file.txt', '/tmp/project'), '/var/tmp/file.txt');
});
