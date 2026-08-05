import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createReminderStore } from '../../src/reminders/reminderStore.js';

function createTempStoreFile() {
    const directoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-assistant-reminders-'));
    return {
        directoryPath,
        filePath: path.join(directoryPath, 'scheduled-tasks.json')
    };
}

test('reminder store creates, lists, and cancels scheduled tasks', () => {
    const { directoryPath, filePath } = createTempStoreFile();
    let id = 0;

    try {
        const store = createReminderStore({
            filePath,
            now: () => new Date('2026-07-22T00:00:00.000Z'),
            idFactory: () => `task_${id += 1}`
        });

        const task = store.createTask({
            chatId: 123,
            type: 'reminder',
            message: 'Drink water',
            nextRunAt: '2026-07-22T00:30:00.000Z'
        });

        assert.equal(task.id, 'task_1');
        assert.equal(task.chatId, '123');
        assert.equal(task.status, 'pending');
        assert.equal(store.listTasks(123).length, 1);

        const cancelled = store.cancelTask(123, task.id);

        assert.equal(cancelled.status, 'cancelled');
        assert.deepEqual(store.listTasks(123), []);
        assert.equal(store.listTasks(123, { includeInactive: true }).length, 1);
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});

test('reminder store returns pending tasks that are due', () => {
    const { directoryPath, filePath } = createTempStoreFile();

    try {
        const store = createReminderStore({
            filePath,
            now: () => new Date('2026-07-22T00:00:00.000Z'),
            idFactory: () => 'task_due'
        });

        store.createTask({
            chatId: 'chat-a',
            type: 'agent_task',
            prompt: 'Run status check',
            nextRunAt: '2026-07-21T23:59:00.000Z'
        });

        assert.equal(store.getPendingTasks({ now: new Date('2026-07-22T00:00:00.000Z') }).length, 1);
        assert.equal(store.getNextPendingTask().id, 'task_due');
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});

test('reminder store falls back to empty tasks for invalid JSON', () => {
    const { directoryPath, filePath } = createTempStoreFile();

    try {
        fs.writeFileSync(filePath, 'not-json', 'utf-8');

        const store = createReminderStore({ filePath });

        assert.deepEqual(store.listTasks(123), []);
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});
