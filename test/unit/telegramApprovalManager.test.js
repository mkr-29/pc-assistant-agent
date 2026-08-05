import assert from 'node:assert/strict';
import test from 'node:test';
import { createTelegramApprovalManager } from '../../src/approvals/telegramApprovalManager.js';

function createManager({ id = 'abc123', timeoutMs = 1000 } = {}) {
    const sentMessages = [];
    const timeouts = [];
    const clearedTimeouts = [];
    const manager = createTelegramApprovalManager({
        bot: {
            sendMessage: async (chatId, message) => {
                sentMessages.push({ chatId, message });
            }
        },
        timeoutMs,
        idFactory: () => id,
        setTimeoutFn: callback => {
            const handle = { callback };
            timeouts.push(handle);
            return handle;
        },
        clearTimeoutFn: handle => {
            clearedTimeouts.push(handle);
        }
    });

    return { manager, sentMessages, timeouts, clearedTimeouts };
}

function approvalRequest(manager, chatId = 123) {
    return manager.requestApproval({
        chatId,
        toolName: 'executeCommand',
        risk: {
            category: 'deletion',
            reason: 'Deletion command detected.',
            summary: 'rm -rf tmp'
        },
        details: {
            cwd: '/tmp/project',
            preview: 'rm -rf tmp'
        }
    });
}

test('approval manager resolves approved replies with ALLOW or APPROVE', async () => {
    const { manager, sentMessages, clearedTimeouts } = createManager();
    const pending = approvalRequest(manager);

    assert.equal(sentMessages.length, 1);
    assert.match(sentMessages[0].message, /`ALLOW abc123`/);
    assert.match(sentMessages[0].message, /`ALLOW ALL`/);

    const reply = manager.handleApprovalMessage(123, 'ALLOW abc123');
    const result = await pending;

    assert.deepEqual(reply, {
        handled: true,
        status: 'approved',
        message: 'Approved abc123. Continuing the action.'
    });
    assert.equal(result.approved, true);
    assert.equal(result.status, 'approved');
    assert.equal(clearedTimeouts.length, 1);
});

test('approval manager resolves approved replies without explicit ID', async () => {
    const { manager } = createManager();
    const pending = approvalRequest(manager);

    const reply = manager.handleApprovalMessage(123, 'ALLOW');
    const result = await pending;

    assert.equal(reply.status, 'approved');
    assert.equal(result.approved, true);
});

test('approval manager resolves ALLOW ALL and auto-approves subsequent actions', async () => {
    const { manager } = createManager();
    const firstPending = approvalRequest(manager);

    const reply = manager.handleApprovalMessage(123, 'ALLOW ALL');
    const firstResult = await firstPending;

    assert.equal(reply.status, 'approved_all');
    assert.equal(firstResult.approved, true);
    assert.equal(firstResult.status, 'approved_all');
    assert.equal(manager.isAllowAll(123), true);

    // Subsequent request should auto-approve without sending Telegram message or pending
    const secondResult = await approvalRequest(manager);
    assert.equal(secondResult.approved, true);
    assert.equal(secondResult.status, 'approved_all');

    // Clearing allowAll restores normal request flow
    manager.clearAllowAll(123);
    assert.equal(manager.isAllowAll(123), false);

    const thirdPending = approvalRequest(manager);
    assert.equal(manager.hasPendingApproval(123), true);
    manager.handleApprovalMessage(123, 'DENY abc123');
    assert.equal((await thirdPending).status, 'denied');
});

test('approval manager resolves denied replies', async () => {
    const { manager } = createManager();
    const pending = approvalRequest(manager);
    const reply = manager.handleApprovalMessage(123, 'DENY abc123');
    const result = await pending;

    assert.equal(reply.status, 'denied');
    assert.equal(result.approved, false);
    assert.equal(result.status, 'denied');
});

test('approval manager ignores wrong chats and reminds on unrelated text', async () => {
    const { manager } = createManager();
    const pending = approvalRequest(manager);

    assert.deepEqual(manager.handleApprovalMessage(999, 'ALLOW abc123'), { handled: false });

    const reminder = manager.handleApprovalMessage(123, 'What is this?');
    assert.equal(reminder.handled, true);
    assert.equal(reminder.status, 'pending');
    assert.match(reminder.message, /`ALLOW abc123`/);

    manager.handleApprovalMessage(123, 'DENY abc123');
    assert.equal((await pending).status, 'denied');
});

test('approval manager fails closed on malformed approval replies', async () => {
    const { manager } = createManager();
    const pending = approvalRequest(manager);
    const reply = manager.handleApprovalMessage(123, 'ALLOW wrong-id');
    const result = await pending;

    assert.equal(reply.status, 'malformed_response');
    assert.equal(result.approved, false);
    assert.equal(result.status, 'malformed_response');
});

test('approval manager fails closed when another approval is pending', async () => {
    const { manager } = createManager();
    const pending = approvalRequest(manager);
    const duplicate = await approvalRequest(manager);

    assert.equal(duplicate.approved, false);
    assert.equal(duplicate.status, 'pending_exists');

    manager.handleApprovalMessage(123, 'DENY abc123');
    assert.equal((await pending).status, 'denied');
});

test('approval manager fails closed on timeout', async () => {
    const { manager, timeouts } = createManager();
    const pending = approvalRequest(manager);

    assert.equal(timeouts.length, 1);
    timeouts[0].callback();

    const result = await pending;
    assert.equal(result.approved, false);
    assert.equal(result.status, 'timeout');
    assert.equal(manager.hasPendingApproval(123), false);
});

test('approval manager falls back to plain text when markdown send fails', async () => {
    const sent = [];
    const manager = createTelegramApprovalManager({
        bot: {
            sendMessage: async (chatId, text, options) => {
                if (options?.parse_mode === 'Markdown') {
                    throw new Error('Markdown parse error');
                }
                sent.push({ chatId, text, options });
            }
        },
        idFactory: () => 'abc123',
        setTimeoutFn: () => ({})
    });

    const pending = approvalRequest(manager);
    manager.handleApprovalMessage(123, 'ALLOW abc123');
    const result = await pending;

    assert.equal(result.approved, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].options, undefined);
});

test('approval manager fails closed when Telegram send fails completely', async () => {
    const manager = createTelegramApprovalManager({
        bot: {
            sendMessage: () => {
                throw new Error('telegram unavailable');
            }
        },
        idFactory: () => 'abc123',
        setTimeoutFn: () => ({})
    });

    const result = await approvalRequest(manager);

    assert.equal(result.approved, false);
    assert.equal(result.status, 'send_failed');
    assert.match(result.message, /telegram unavailable/);
    assert.equal(manager.hasPendingApproval(123), false);
});
