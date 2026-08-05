import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DEFAULT_SCHEDULED_TASKS_FILE = path.resolve(process.cwd(), '.data/scheduled-tasks.json');
const ACTIVE_STATUSES = new Set(['pending', 'failed']);
const VALID_TYPES = new Set(['reminder', 'agent_task']);
const VALID_STATUSES = new Set(['pending', 'cancelled', 'completed', 'failed']);
const VALID_RECURRENCE_FREQUENCIES = new Set(['daily', 'weekly', 'interval']);

function createEmptyStore() {
    return { tasks: {} };
}

function normalizeChatId(chatId) {
    return String(chatId);
}

function toIsoDate(value, fieldName) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`${fieldName} must be a valid date.`);
    }

    return date.toISOString();
}

function normalizeRecurrence(recurrence) {
    if (!recurrence) {
        return null;
    }

    const frequency = String(recurrence.frequency || '').toLowerCase();
    if (!VALID_RECURRENCE_FREQUENCIES.has(frequency)) {
        throw new Error('recurrence.frequency must be daily, weekly, or interval.');
    }

    const normalized = { frequency };

    if (frequency === 'interval') {
        const intervalMinutes = Number(recurrence.intervalMinutes);
        if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
            throw new Error('recurrence.intervalMinutes must be a positive number for interval tasks.');
        }
        normalized.intervalMinutes = intervalMinutes;
    }

    return normalized;
}

function sortByNextRunAt(tasks) {
    return [...tasks].sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime());
}

function normalizeTaskInput(input, { now, idFactory }) {
    const type = input.type || 'reminder';
    if (!VALID_TYPES.has(type)) {
        throw new Error('type must be either reminder or agent_task.');
    }

    if (!input.chatId && input.chatId !== 0) {
        throw new Error('chatId is required.');
    }

    const nextRunAt = toIsoDate(input.nextRunAt, 'nextRunAt');
    const recurrence = normalizeRecurrence(input.recurrence);
    const status = input.status || 'pending';

    if (!VALID_STATUSES.has(status)) {
        throw new Error('status must be pending, cancelled, completed, or failed.');
    }

    if (type === 'reminder' && !input.message) {
        throw new Error('message is required for reminder tasks.');
    }

    if (type === 'agent_task' && !input.prompt) {
        throw new Error('prompt is required for agent_task tasks.');
    }

    const timestamp = now().toISOString();

    return {
        id: input.id || idFactory(),
        chatId: normalizeChatId(input.chatId),
        type,
        title: String(input.title || input.message || input.prompt || 'Scheduled task').trim(),
        message: input.message ? String(input.message) : null,
        prompt: input.prompt ? String(input.prompt) : null,
        nextRunAt,
        recurrence,
        status,
        createdAt: input.createdAt || timestamp,
        updatedAt: timestamp,
        lastRunAt: input.lastRunAt || null,
        lastError: input.lastError || null
    };
}

function createTaskId() {
    return `task_${crypto.randomUUID()}`;
}

export function createReminderStore({
    filePath = DEFAULT_SCHEDULED_TASKS_FILE,
    now = () => new Date(),
    idFactory = createTaskId
} = {}) {
    function readStore() {
        if (!fs.existsSync(filePath)) {
            return createEmptyStore();
        }

        try {
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (!parsed || typeof parsed !== 'object' || !parsed.tasks || typeof parsed.tasks !== 'object') {
                return createEmptyStore();
            }

            return parsed;
        } catch (error) {
            console.warn(`[ReminderStore] Failed to read scheduled tasks file. Starting fresh: ${error.message}`);
            return createEmptyStore();
        }
    }

    function writeStore(store) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const tmpPath = `${filePath}.${process.pid}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
        fs.renameSync(tmpPath, filePath);
    }

    function updateTask(taskId, updater) {
        const store = readStore();
        const existing = store.tasks[taskId];
        if (!existing) {
            return null;
        }

        const updates = typeof updater === 'function' ? updater(existing) : updater;
        const nextTask = {
            ...existing,
            ...updates,
            updatedAt: now().toISOString()
        };

        if (updates?.nextRunAt) {
            nextTask.nextRunAt = toIsoDate(updates.nextRunAt, 'nextRunAt');
        }
        if (Object.prototype.hasOwnProperty.call(updates || {}, 'recurrence')) {
            nextTask.recurrence = normalizeRecurrence(updates.recurrence);
        }
        if (!VALID_STATUSES.has(nextTask.status)) {
            throw new Error('status must be pending, cancelled, completed, or failed.');
        }

        store.tasks[taskId] = nextTask;
        writeStore(store);
        return nextTask;
    }

    return {
        createTask(input) {
            const store = readStore();
            const task = normalizeTaskInput(input, { now, idFactory });
            store.tasks[task.id] = task;
            writeStore(store);
            return task;
        },

        getTask(taskId) {
            return readStore().tasks[taskId] || null;
        },

        listTasks(chatId, { includeInactive = false } = {}) {
            const normalizedChatId = normalizeChatId(chatId);
            const tasks = Object.values(readStore().tasks)
                .filter(task => task.chatId === normalizedChatId)
                .filter(task => includeInactive || ACTIVE_STATUSES.has(task.status));

            return sortByNextRunAt(tasks);
        },

        getPendingTasks({ now: currentDate = now() } = {}) {
            const cutoff = currentDate.getTime();
            return sortByNextRunAt(
                Object.values(readStore().tasks)
                    .filter(task => task.status === 'pending')
                    .filter(task => !Number.isNaN(new Date(task.nextRunAt).getTime()))
                    .filter(task => new Date(task.nextRunAt).getTime() <= cutoff)
            );
        },

        getNextPendingTask() {
            const pending = Object.values(readStore().tasks)
                .filter(task => task.status === 'pending')
                .filter(task => !Number.isNaN(new Date(task.nextRunAt).getTime()));

            return sortByNextRunAt(pending)[0] || null;
        },

        updateTask,

        cancelTask(chatId, taskId) {
            const task = readStore().tasks[taskId];
            if (!task || task.chatId !== normalizeChatId(chatId)) {
                return null;
            }

            return updateTask(taskId, {
                status: 'cancelled',
                lastError: null
            });
        },

        markRunResult(taskId, { status, nextRunAt = null, lastError = null }) {
            const updates = {
                status,
                lastRunAt: now().toISOString(),
                lastError
            };

            if (nextRunAt) {
                updates.nextRunAt = nextRunAt;
            }

            return updateTask(taskId, updates);
        }
    };
}
