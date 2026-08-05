const MAX_TIMER_DELAY_MS = 24 * 60 * 60 * 1000;

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

export function calculateNextRunAt(task, fromDate = new Date()) {
    if (!task.recurrence) {
        return null;
    }

    const previousRun = new Date(task.nextRunAt);
    const base = Number.isNaN(previousRun.getTime()) ? fromDate : previousRun;
    let nextRunAt;

    if (task.recurrence.frequency === 'daily') {
        nextRunAt = addDays(base, 1);
    } else if (task.recurrence.frequency === 'weekly') {
        nextRunAt = addDays(base, 7);
    } else if (task.recurrence.frequency === 'interval') {
        nextRunAt = new Date(base.getTime() + task.recurrence.intervalMinutes * 60 * 1000);
    } else {
        return null;
    }

    while (nextRunAt.getTime() <= fromDate.getTime()) {
        if (task.recurrence.frequency === 'daily') {
            nextRunAt = addDays(nextRunAt, 1);
        } else if (task.recurrence.frequency === 'weekly') {
            nextRunAt = addDays(nextRunAt, 7);
        } else {
            nextRunAt = new Date(nextRunAt.getTime() + task.recurrence.intervalMinutes * 60 * 1000);
        }
    }

    return nextRunAt.toISOString();
}

function formatScheduledTaskResult(task, result) {
    return [
        `Scheduled task completed: ${task.title}`,
        '',
        result || 'No response was returned.'
    ].join('\n');
}

export function createReminderScheduler({
    store,
    bot,
    runScheduledAgentTask,
    now = () => new Date(),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    maxTimerDelayMs = MAX_TIMER_DELAY_MS
}) {
    let timer = null;
    let running = false;

    function clearActiveTimer() {
        if (timer) {
            clearTimeoutFn(timer);
            timer = null;
        }
    }

    function scheduleNextTimer() {
        clearActiveTimer();

        if (!running) {
            return;
        }

        const nextTask = store.getNextPendingTask();
        if (!nextTask) {
            return;
        }

        const delayMs = Math.max(0, new Date(nextTask.nextRunAt).getTime() - now().getTime());
        const safeDelayMs = Math.min(delayMs, maxTimerDelayMs);
        timer = setTimeoutFn(async () => {
            await runDueTasks();
        }, safeDelayMs);
    }

    async function executeTask(task) {
        const runStartedAt = now();

        try {
            if (task.type === 'reminder') {
                await bot.sendMessage(task.chatId, task.message);
            } else if (task.type === 'agent_task') {
                const result = await runScheduledAgentTask({
                    chatId: task.chatId,
                    prompt: task.prompt,
                    task
                });
                await bot.sendMessage(task.chatId, formatScheduledTaskResult(task, result));
            } else {
                throw new Error(`Unsupported scheduled task type: ${task.type}`);
            }

            const nextRunAt = calculateNextRunAt(task, runStartedAt);
            store.markRunResult(task.id, {
                status: nextRunAt ? 'pending' : 'completed',
                nextRunAt,
                lastError: null
            });
        } catch (error) {
            const nextRunAt = calculateNextRunAt(task, runStartedAt);
            store.markRunResult(task.id, {
                status: nextRunAt ? 'pending' : 'failed',
                nextRunAt,
                lastError: error.message
            });
            console.error(`[ReminderScheduler] Failed to run scheduled task ${task.id}:`, error.message);
        }
    }

    async function runDueTasks() {
        clearActiveTimer();
        const dueTasks = store.getPendingTasks({ now: now() });

        for (const task of dueTasks) {
            await executeTask(task);
        }

        scheduleNextTimer();
    }

    return {
        start() {
            if (running) {
                return;
            }

            running = true;
            scheduleNextTimer();
        },

        stop() {
            running = false;
            clearActiveTimer();
        },

        scheduleTask(input) {
            const task = store.createTask(input);
            scheduleNextTimer();
            return task;
        },

        listTasks(chatId, options) {
            return store.listTasks(chatId, options);
        },

        cancelTask(chatId, taskId) {
            const task = store.cancelTask(chatId, taskId);
            scheduleNextTimer();
            return task;
        },

        runDueTasks
    };
}
