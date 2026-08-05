import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createConversationHistoryStore } from '../../src/agent/conversationHistoryStore.js';

function createTempHistoryFile() {
    const directoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-assistant-history-'));
    return {
        directoryPath,
        filePath: path.join(directoryPath, 'history.json')
    };
}

test('conversation history store appends, loads, and resets chat history', () => {
    const { directoryPath, filePath } = createTempHistoryFile();

    try {
        const store = createConversationHistoryStore({ filePath });

        store.appendTurn(123, 'remember my laptop project', 'I will remember it.');

        assert.equal(store.getHistory(123).length, 1);
        assert.equal(store.getHistory(123)[0].userPrompt, 'remember my laptop project');

        store.resetHistory(123);

        assert.deepEqual(store.getHistory(123), []);
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});

test('conversation history store trims old turns by max turn count', () => {
    const { directoryPath, filePath } = createTempHistoryFile();

    try {
        const store = createConversationHistoryStore({ filePath, maxTurns: 2 });

        store.appendTurn('chat-a', 'first', 'one');
        store.appendTurn('chat-a', 'second', 'two');
        store.appendTurn('chat-a', 'third', 'three');

        assert.deepEqual(
            store.getHistory('chat-a').map(turn => turn.userPrompt),
            ['second', 'third']
        );
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});

test('conversation history store falls back to empty history for invalid JSON', () => {
    const { directoryPath, filePath } = createTempHistoryFile();

    try {
        fs.writeFileSync(filePath, 'not-json', 'utf-8');

        const store = createConversationHistoryStore({ filePath });

        assert.deepEqual(store.getHistory(123), []);
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});
