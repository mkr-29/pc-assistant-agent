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

test('conversation history store preserves high importance turns over ephemeral filler', () => {
    const { directoryPath, filePath } = createTempHistoryFile();

    try {
        const store = createConversationHistoryStore({ filePath, maxTurns: 3 });

        store.appendTurn('chat-1', 'My main project directory is /Users/mkr/code', 'Configured workspace.');
        store.appendTurn('chat-1', 'hi', 'Hello! How can I help you?');
        store.appendTurn('chat-1', 'thanks', 'You are welcome!');
        store.appendTurn('chat-1', 'Run tests on backend', 'Tests passed successfully.');

        const history = store.getHistory('chat-1');
        // The first high-importance turn and the last turn should be kept; ephemeral filler should be pruned
        const prompts = history.map(t => t.userPrompt);
        assert.ok(prompts.includes('My main project directory is /Users/mkr/code'));
        assert.ok(prompts.includes('Run tests on backend'));
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});

