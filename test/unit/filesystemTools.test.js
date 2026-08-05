import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createFilesystemTools } from '../../src/tools/implementations/filesystemTools.js';

function createTempDirectory() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'pc-assistant-filesystem-'));
}

function createTools(rootPath) {
    return createFilesystemTools({
        resolveToolPath: inputPath => (inputPath ? path.resolve(rootPath, inputPath) : rootPath)
    });
}

function writeFixture(rootPath, relativePath, content) {
    const filePath = path.join(rootPath, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
}

test('searchFiles finds nested files by name and relative path', () => {
    const rootPath = createTempDirectory();

    try {
        writeFixture(rootPath, 'src/agent/runAgent.js', 'export function runAgent() {}\n');
        writeFixture(rootPath, 'src/main.js', 'import "./agent/runAgent.js";\n');
        writeFixture(rootPath, 'docs/runbook.md', '# Runbook\n');

        const tools = createTools(rootPath);
        const nameResult = tools.searchFiles({ query: 'runAgent', maxResults: 10 });
        const pathResult = tools.searchFiles({ query: 'agent/run', maxResults: 10 });

        assert.deepEqual(
            nameResult.results.map(result => result.relativePath),
            ['src/agent/runAgent.js']
        );
        assert.deepEqual(
            pathResult.results.map(result => result.relativePath),
            ['src/agent/runAgent.js']
        );
        assert.equal(nameResult.rootPath, rootPath);
        assert.equal(nameResult.truncated, false);
    } finally {
        fs.rmSync(rootPath, { recursive: true, force: true });
    }
});

test('searchText returns line previews and skips ignored directories', () => {
    const rootPath = createTempDirectory();

    try {
        writeFixture(rootPath, 'src/agent/runAgent.js', [
            'export function runAgent() {',
            '    return "Smart Needle";',
            '}'
        ].join('\n'));
        writeFixture(rootPath, 'docs/notes.md', 'Smart Needle in docs\n');
        writeFixture(rootPath, 'node_modules/pkg/index.js', 'Smart Needle should be ignored\n');

        const tools = createTools(rootPath);
        const result = tools.searchText({
            query: 'smart needle',
            extensions: ['.js'],
            maxResults: 10
        });

        assert.equal(result.totalMatches, 1);
        assert.deepEqual(result.results, [
            {
                relativePath: 'src/agent/runAgent.js',
                filePath: path.join(rootPath, 'src/agent/runAgent.js'),
                lineNumber: 2,
                preview: 'return "Smart Needle";'
            }
        ]);
        assert.equal(result.truncated, false);
    } finally {
        fs.rmSync(rootPath, { recursive: true, force: true });
    }
});

test('findRecentFiles sorts newest first and applies filters', () => {
    const rootPath = createTempDirectory();

    try {
        const oldFile = writeFixture(rootPath, 'src/old.js', 'old\n');
        const recentFile = writeFixture(rootPath, 'src/recent.js', 'recent\n');
        const newestFile = writeFixture(rootPath, 'docs/newest.md', 'newest\n');
        const ignoredFile = writeFixture(rootPath, 'dist/generated.js', 'generated\n');
        const now = Date.now();

        fs.utimesSync(oldFile, new Date(now - 5 * 60 * 60 * 1000), new Date(now - 5 * 60 * 60 * 1000));
        fs.utimesSync(recentFile, new Date(now - 60 * 60 * 1000), new Date(now - 60 * 60 * 1000));
        fs.utimesSync(newestFile, new Date(now - 30 * 60 * 1000), new Date(now - 30 * 60 * 1000));
        fs.utimesSync(ignoredFile, new Date(now), new Date(now));

        const tools = createTools(rootPath);
        const recentJs = tools.findRecentFiles({
            extensions: ['js'],
            sinceHours: 2,
            maxResults: 5
        });
        const limited = tools.findRecentFiles({ maxResults: 1 });

        assert.deepEqual(
            recentJs.results.map(result => result.relativePath),
            ['src/recent.js']
        );
        assert.deepEqual(
            limited.results.map(result => result.relativePath),
            ['docs/newest.md']
        );
        assert.equal(limited.truncated, true);
    } finally {
        fs.rmSync(rootPath, { recursive: true, force: true });
    }
});

test('search tools default to target root when directoryPath is omitted', () => {
    const rootPath = createTempDirectory();
    const resolvedInputs = [];

    try {
        writeFixture(rootPath, 'src/defaultRoot.js', 'default root marker\n');

        const tools = createFilesystemTools({
            resolveToolPath: inputPath => {
                resolvedInputs.push(inputPath);
                return inputPath ? path.resolve(rootPath, inputPath) : rootPath;
            }
        });
        const result = tools.searchText({ query: 'default root marker' });

        assert.deepEqual(resolvedInputs, [undefined]);
        assert.equal(result.results[0].relativePath, 'src/defaultRoot.js');
    } finally {
        fs.rmSync(rootPath, { recursive: true, force: true });
    }
});
