import crypto from 'crypto';

const DEFAULT_APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;
const ALLOW_ALL_PATTERN = /^(?:allow|approve)\s+all(?:\s+([a-z0-9_-]+))?$/i;
const APPROVE_PATTERN = /^(?:allow|approve)(?:\s+([a-z0-9_-]+))?$/i;
const DENY_PATTERN = /^(?:deny|reject)(?:\s+([a-z0-9_-]+))?$/i;

function createApprovalId() {
    return crypto.randomBytes(3).toString('hex');
}

function formatTimeout(timeoutMs) {
    const seconds = Math.max(1, Math.round(timeoutMs / 1000));

    if (seconds < 60) {
        return `${seconds} seconds`;
    }

    const minutes = Math.round(seconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function truncatePreview(value, maxLength = 700) {
    const text = String(value || '').trim();

    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength - 20)}\n[truncated]`;
}

function formatApprovalMessage({ id, toolName, risk, details, timeoutMs }) {
    const lines = [
        'Telegram approval required before running a risky action.',
        '',
        `Approval ID: ${id}`,
        `Tool: ${toolName}`,
        `Risk: ${risk.category}`,
        `Reason: ${risk.reason}`
    ];

    if (details?.cwd) {
        lines.push(`Working directory: ${details.cwd}`);
    }

    if (details?.targetPath) {
        lines.push(`Target path: ${details.targetPath}`);
    }

    lines.push('', 'Preview:', truncatePreview(details?.preview || risk.summary || ''));
    lines.push('', 'Quick actions (tap to copy):');
    lines.push(`• Single action: \`ALLOW ${id}\``);
    lines.push(`• All actions for this task: \`ALLOW ALL\``);
    lines.push(`• Deny: \`DENY ${id}\``);
    lines.push('', `Reply within ${formatTimeout(timeoutMs)}.`);

    return lines.join('\n');
}

function pendingInstruction(pending) {
    return `Approval is still pending for ${pending.toolName}. Reply with \`ALLOW ${pending.id}\`, \`ALLOW ALL\`, or \`DENY ${pending.id}\`.`;
}

function createResult({ approved, status, id, message }) {
    return {
        approved,
        status,
        id,
        message
    };
}

export function createTelegramApprovalManager({
    bot,
    timeoutMs = DEFAULT_APPROVAL_TIMEOUT_MS,
    idFactory = createApprovalId,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout
} = {}) {
    const pendingByChatId = new Map();
    const allowAllByChatId = new Set();

    function getKey(chatId) {
        return String(chatId);
    }

    function isAllowAll(chatId) {
        return allowAllByChatId.has(getKey(chatId));
    }

    function setAllowAll(chatId) {
        allowAllByChatId.add(getKey(chatId));
    }

    function clearAllowAll(chatId) {
        allowAllByChatId.delete(getKey(chatId));
    }

    function clearPending(chatId) {
        const key = getKey(chatId);
        const pending = pendingByChatId.get(key);

        if (pending?.timeoutHandle) {
            clearTimeoutFn(pending.timeoutHandle);
        }

        pendingByChatId.delete(key);
        return pending;
    }

    function settle(chatId, result) {
        const pending = clearPending(chatId);

        if (pending) {
            pending.resolve(result);
        }

        return pending;
    }

    async function requestApproval({ chatId, toolName, risk, details = {} }) {
        const key = getKey(chatId);

        if (isAllowAll(chatId)) {
            return createResult({
                approved: true,
                status: 'approved_all',
                id: null,
                message: 'Action automatically approved because ALLOW ALL is active for this task.'
            });
        }

        if (!bot?.sendMessage) {
            return createResult({
                approved: false,
                status: 'unavailable',
                id: null,
                message: 'Telegram approval is unavailable, so the action was skipped.'
            });
        }

        if (pendingByChatId.has(key)) {
            return createResult({
                approved: false,
                status: 'pending_exists',
                id: pendingByChatId.get(key).id,
                message: 'Another approval is already pending for this chat, so the action was skipped.'
            });
        }

        const id = idFactory();
        const approvalMessage = formatApprovalMessage({ id, toolName, risk, details, timeoutMs });

        return new Promise(resolve => {
            const timeoutHandle = setTimeoutFn(() => {
                settle(chatId, createResult({
                    approved: false,
                    status: 'timeout',
                    id,
                    message: `Approval ${id} timed out. The action was skipped.`
                }));
            }, timeoutMs);

            pendingByChatId.set(key, {
                id,
                toolName,
                risk,
                details,
                timeoutHandle,
                resolve
            });

            function failSend(error) {
                settle(chatId, createResult({
                    approved: false,
                    status: 'send_failed',
                    id,
                    message: `Failed to request Telegram approval: ${error.message}`
                }));
            }

            async function sendMessageWithFallback() {
                try {
                    await bot.sendMessage(chatId, approvalMessage, { parse_mode: 'Markdown' });
                } catch (markdownErr) {
                    await bot.sendMessage(chatId, approvalMessage);
                }
            }

            sendMessageWithFallback().catch(failSend);
        });
    }

    function handleApprovalMessage(chatId, text) {
        const key = getKey(chatId);
        const pending = pendingByChatId.get(key);

        if (!pending) {
            return { handled: false };
        }

        const trimmedText = String(text || '').trim();
        const allowAllMatch = trimmedText.match(ALLOW_ALL_PATTERN);
        const approveMatch = !allowAllMatch && trimmedText.match(APPROVE_PATTERN);
        const denyMatch = !allowAllMatch && !approveMatch && trimmedText.match(DENY_PATTERN);

        if (!allowAllMatch && !approveMatch && !denyMatch) {
            return {
                handled: true,
                status: 'pending',
                message: pendingInstruction(pending)
            };
        }

        const responseId = allowAllMatch?.[1] || approveMatch?.[1] || denyMatch?.[1];

        if (responseId && responseId !== pending.id) {
            settle(chatId, createResult({
                approved: false,
                status: 'malformed_response',
                id: pending.id,
                message: `Approval ${pending.id} was denied because the response did not include the matching approval ID.`
            }));

            return {
                handled: true,
                status: 'malformed_response',
                message: 'Approval response did not match the pending approval ID. The action was skipped.'
            };
        }

        if (allowAllMatch) {
            setAllowAll(chatId);
            settle(chatId, createResult({
                approved: true,
                status: 'approved_all',
                id: pending.id,
                message: `Approval ${pending.id} granted and ALLOW ALL activated for this task.`
            }));

            return {
                handled: true,
                status: 'approved_all',
                message: 'Approved all actions for this task. Continuing.'
            };
        }

        if (approveMatch) {
            settle(chatId, createResult({
                approved: true,
                status: 'approved',
                id: pending.id,
                message: `Approval ${pending.id} granted.`
            }));

            return {
                handled: true,
                status: 'approved',
                message: `Approved ${pending.id}. Continuing the action.`
            };
        }

        settle(chatId, createResult({
            approved: false,
            status: 'denied',
            id: pending.id,
            message: `Approval ${pending.id} denied. The action was skipped.`
        }));

        return {
            handled: true,
            status: 'denied',
            message: `Denied ${pending.id}. The action was skipped.`
        };
    }

    function cancelPending(chatId, reason = 'Approval was cancelled.') {
        const pending = pendingByChatId.get(getKey(chatId));

        if (!pending) {
            return false;
        }

        settle(chatId, createResult({
            approved: false,
            status: 'cancelled',
            id: pending.id,
            message: reason
        }));

        return true;
    }

    return {
        requestApproval,
        handleApprovalMessage,
        cancelPending,
        hasPendingApproval: chatId => pendingByChatId.has(getKey(chatId)),
        getPendingInstruction: chatId => {
            const pending = pendingByChatId.get(getKey(chatId));
            return pending ? pendingInstruction(pending) : null;
        },
        isAllowAll: chatId => isAllowAll(chatId),
        clearAllowAll: chatId => clearAllowAll(chatId)
    };
}
