function assertScheduler(reminderScheduler) {
    if (!reminderScheduler) {
        throw new Error('Reminder scheduler is not configured.');
    }
}

function assertFutureDate(nextRunAt, now) {
    const date = new Date(nextRunAt);
    if (Number.isNaN(date.getTime())) {
        throw new Error('nextRunAt must be a valid ISO date/time string.');
    }

    if (date.getTime() <= now().getTime()) {
        throw new Error('nextRunAt must be in the future.');
    }

    return date;
}

function normalizeRecurrence(recurrence) {
    if (!recurrence) {
        return null;
    }

    const frequency = String(recurrence.frequency || '').toLowerCase();
    if (!['daily', 'weekly', 'interval'].includes(frequency)) {
        throw new Error('recurrence.frequency must be daily, weekly, or interval.');
    }

    if (frequency === 'interval') {
        const intervalMinutes = Number(recurrence.intervalMinutes);
        if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
            throw new Error('recurrence.intervalMinutes must be a positive number for interval tasks.');
        }

        return { frequency, intervalMinutes };
    }

    return { frequency };
}

function formatTaskForResponse(task) {
    return {
        id: task.id,
        type: task.type,
        title: task.title,
        status: task.status,
        nextRunAt: task.nextRunAt,
        recurrence: task.recurrence,
        lastRunAt: task.lastRunAt,
        lastError: task.lastError
    };
}

export function createReminderTools({ chatId, reminderScheduler, now = () => new Date() }) {
    return {
        scheduleReminder: ({ message, nextRunAt, title } = {}) => {
            assertScheduler(reminderScheduler);
            if (!message) {
                throw new Error('message is required.');
            }

            const scheduledDate = assertFutureDate(nextRunAt, now);
            const task = reminderScheduler.scheduleTask({
                chatId,
                type: 'reminder',
                title: title || message,
                message,
                nextRunAt: scheduledDate.toISOString()
            });

            return {
                status: 'Success',
                message: `Reminder scheduled for ${scheduledDate.toLocaleString()}.`,
                task: formatTaskForResponse(task)
            };
        },

        scheduleAgentTask: ({ prompt, nextRunAt, title, recurrence } = {}) => {
            assertScheduler(reminderScheduler);
            if (!prompt) {
                throw new Error('prompt is required.');
            }

            const scheduledDate = assertFutureDate(nextRunAt, now);
            const task = reminderScheduler.scheduleTask({
                chatId,
                type: 'agent_task',
                title: title || prompt,
                prompt,
                nextRunAt: scheduledDate.toISOString(),
                recurrence: normalizeRecurrence(recurrence)
            });

            return {
                status: 'Success',
                message: `Scheduled agent task created for ${scheduledDate.toLocaleString()}.`,
                task: formatTaskForResponse(task)
            };
        },

        listScheduledTasks: ({ includeInactive = false } = {}) => {
            assertScheduler(reminderScheduler);
            const tasks = reminderScheduler
                .listTasks(chatId, { includeInactive: includeInactive === true })
                .map(formatTaskForResponse);

            return {
                status: 'Success',
                count: tasks.length,
                tasks
            };
        },

        cancelScheduledTask: ({ taskId } = {}) => {
            assertScheduler(reminderScheduler);
            if (!taskId) {
                throw new Error('taskId is required.');
            }

            const task = reminderScheduler.cancelTask(chatId, taskId);
            if (!task) {
                return {
                    status: 'NotFound',
                    message: `No scheduled task found for id ${taskId}.`
                };
            }

            return {
                status: 'Success',
                message: `Cancelled scheduled task ${task.id}.`,
                task: formatTaskForResponse(task)
            };
        }
    };
}
