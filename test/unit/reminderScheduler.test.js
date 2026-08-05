import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createReminderScheduler } from '../../src/reminders/reminderScheduler.js';
import { createReminderStore } from '../../src/reminders/reminderStore.js';

function createTempStoreFile() {
    const directoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-assistant-scheduler-'));
    return {
        directoryPath,
        filePath: path.join(directoryPath, 'scheduled-tasks.json')
    };
}

function createStore(filePath, currentDate) {
    let id = 0;
    return createReminderStore({
        filePath,
        now: () => currentDate,
        idFactory: () => `task_${id += 1}`
    });
}

test('scheduler sends due reminders and completes one-time tasks', async () => {
    const { directoryPath, filePath } = createTempStoreFile();
    const sentMessages = [];

    try {
        const store = createStore(filePath, new Date('2026-07-22T00:00:00.000Z'));
        const task = store.createTask({
            chatId: 123,
            type: 'reminder',
            message: 'Stretch',
            nextRunAt: '2026-07-22T00:00:00.000Z'
        });
        const scheduler = createReminderScheduler({
            store,
            bot: {
                sendMessage: async (chatId, message) => {
                    sentMessages.push({ chatId, message });
                }
            },
            runScheduledAgentTask: async () => 'unused',
            now: () => new Date('2026-07-22T00:00:00.000Z')
        });

        await scheduler.runDueTasks();

        assert.deepEqual(sentMessages, [{ chatId: '123', message: 'Stretch' }]);
        assert.equal(store.getTask(task.id).status, 'completed');
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});

test('scheduler runs agent tasks and advances recurring tasks', async () => {
    const { directoryPath, filePath } = createTempStoreFile();
    const sentMessages = [];
    let agentArgs = null;

    try {
        const store = createStore(filePath, new Date('2026-07-22T09:00:00.000Z'));
        const task = store.createTask({
            chatId: 123,
            type: 'agent_task',
            title: 'Morning check',
            prompt: 'Run the morning check',
            nextRunAt: '2026-07-22T09:00:00.000Z',
            recurrence: { frequency: 'daily' }
        });
        const scheduler = createReminderScheduler({
            store,
            bot: {
                sendMessage: async (chatId, message) => {
                    sentMessages.push({ chatId, message });
                }
            },
            runScheduledAgentTask: async args => {
                agentArgs = args;
                return 'All clear';
            },
            now: () => new Date('2026-07-22T09:00:00.000Z')
        });

        await scheduler.runDueTasks();

        const updatedTask = store.getTask(task.id);
        assert.equal(agentArgs.prompt, 'Run the morning check');
        assert.equal(updatedTask.status, 'pending');
        assert.equal(updatedTask.nextRunAt, '2026-07-23T09:00:00.000Z');
        assert.match(sentMessages[0].message, /Scheduled task completed: Morning check/);
        assert.match(sentMessages[0].message, /All clear/);
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});

test('scheduler does not run cancelled tasks', async () => {
    const { directoryPath, filePath } = createTempStoreFile();
    const sentMessages = [];

    try {
        const store = createStore(filePath, new Date('2026-07-22T00:00:00.000Z'));
        const task = store.createTask({
            chatId: 123,
            type: 'reminder',
            message: 'Do not send',
            nextRunAt: '2026-07-22T00:00:00.000Z'
        });
        store.cancelTask(123, task.id);
        const scheduler = createReminderScheduler({
            store,
            bot: {
                sendMessage: async (chatId, message) => {
                    sentMessages.push({ chatId, message });
                }
            },
            runScheduledAgentTask: async () => 'unused',
            now: () => new Date('2026-07-22T00:00:00.000Z')
        });

        await scheduler.runDueTasks();

        assert.deepEqual(sentMessages, []);
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});

test('scheduler records failed one-time reminder sends', async () => {
    const { directoryPath, filePath } = createTempStoreFile();

    try {
        const store = createStore(filePath, new Date('2026-07-22T00:00:00.000Z'));
        const task = store.createTask({
            chatId: 123,
            type: 'reminder',
            message: 'Will fail',
            nextRunAt: '2026-07-22T00:00:00.000Z'
        });
        const scheduler = createReminderScheduler({
            store,
            bot: {
                sendMessage: async () => {
                    throw new Error('Telegram unavailable');
                }
            },
            runScheduledAgentTask: async () => 'unused',
            now: () => new Date('2026-07-22T00:00:00.000Z')
        });

        await scheduler.runDueTasks();

        const updatedTask = store.getTask(task.id);
        assert.equal(updatedTask.status, 'failed');
        assert.equal(updatedTask.lastError, 'Telegram unavailable');
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});
