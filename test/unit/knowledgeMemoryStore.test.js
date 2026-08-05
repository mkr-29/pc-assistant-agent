import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createKnowledgeMemoryStore } from '../../src/agent/knowledgeMemoryStore.js';

function createTempMemoryFile() {
    const directoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-assistant-memory-'));
    return {
        directoryPath,
        filePath: path.join(directoryPath, 'memory.json')
    };
}

test('knowledge memory store adds and lists global memories', () => {
    const { directoryPath, filePath } = createTempMemoryFile();

    try {
        const store = createKnowledgeMemoryStore({
            filePath,
            now: () => new Date('2026-07-22T00:00:00.000Z'),
            idFactory: () => 'mem_test'
        });

        const memory = store.addMemory('Preferred folder is /Users/example/project.');

        assert.deepEqual(memory, {
            id: 'mem_test',
            fact: 'Preferred folder is /Users/example/project.',
            createdAt: '2026-07-22T00:00:00.000Z',
            updatedAt: '2026-07-22T00:00:00.000Z'
        });
        assert.deepEqual(store.listMemories(), [memory]);
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});

test('knowledge memory store forgets a memory by id', () => {
    const { directoryPath, filePath } = createTempMemoryFile();
    let counter = 0;

    try {
        const store = createKnowledgeMemoryStore({
            filePath,
            idFactory: () => `mem_${counter += 1}`
        });

        const first = store.addMemory('Use npm test.');
        const second = store.addMemory('Use tabs never.');

        assert.deepEqual(store.forgetMemory(first.id), first);
        assert.deepEqual(store.listMemories(), [second]);
        assert.equal(store.forgetMemory('missing'), null);
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});

test('knowledge memory store falls back to empty memory for invalid JSON', () => {
    const { directoryPath, filePath } = createTempMemoryFile();

    try {
        fs.writeFileSync(filePath, 'not-json', 'utf-8');

        const store = createKnowledgeMemoryStore({ filePath });

        assert.deepEqual(store.listMemories(), []);
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});

test('knowledge memory store trims old memories by max item count', () => {
    const { directoryPath, filePath } = createTempMemoryFile();
    let counter = 0;

    try {
        const store = createKnowledgeMemoryStore({
            filePath,
            maxItems: 2,
            idFactory: () => `mem_${counter += 1}`
        });

        store.addMemory('First memory.');
        store.addMemory('Second memory.');
        store.addMemory('Third memory.');

        assert.deepEqual(
            store.listMemories().map(memory => memory.fact),
            ['Second memory.', 'Third memory.']
        );
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});
