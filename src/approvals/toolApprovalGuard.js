import {
    classifyFileWrite,
    classifyOpenTerminal,
    classifyTerminalCommand
} from './dangerousActionDetector.js';

const DEFAULT_MANY_FILE_WRITE_THRESHOLD = 5;

function approvalDisabled(config) {
    return config?.saferCommandApprovals?.enabled === false;
}

function deniedResult(approvalResult) {
    return {
        status: 'Denied',
        approvalStatus: approvalResult?.status || 'denied',
        message: approvalResult?.message || 'Action skipped because Telegram approval was not granted.'
    };
}

async function requestApproval({ approvalManager, chatId, toolName, risk, details }) {
    if (!approvalManager?.requestApproval) {
        return {
            approved: false,
            status: 'unavailable',
            message: 'Telegram approval is unavailable, so the action was skipped.'
        };
    }

    return approvalManager.requestApproval({
        chatId,
        toolName,
        risk,
        details
    });
}

export function applyToolApprovalGuard({
    registry,
    chatId,
    config,
    resolveToolPath,
    approvalManager
}) {
    if (approvalDisabled(config)) {
        return registry;
    }

    const guardedRegistry = { ...registry };
    const writtenFilePaths = new Set();
    let bulkWriteApproved = false;
    const manyFileThreshold = config?.saferCommandApprovals?.manyFileWriteThreshold
        || DEFAULT_MANY_FILE_WRITE_THRESHOLD;
    const targetProjectPath = resolveToolPath();

    guardedRegistry.executeCommand = async args => {
        const risk = classifyTerminalCommand(args?.command);

        if (!risk.requiresApproval) {
            return registry.executeCommand(args);
        }

        const approvalResult = await requestApproval({
            approvalManager,
            chatId,
            toolName: 'executeCommand',
            risk,
            details: {
                cwd: args?.cwd ? resolveToolPath(args.cwd) : targetProjectPath,
                preview: args?.command || ''
            }
        });

        if (!approvalResult.approved) {
            return deniedResult(approvalResult);
        }

        return registry.executeCommand(args);
    };

    guardedRegistry.openTerminal = async args => {
        const risk = classifyOpenTerminal({ command: args?.command, cwd: args?.cwd });

        const approvalResult = await requestApproval({
            approvalManager,
            chatId,
            toolName: 'openTerminal',
            risk,
            details: {
                cwd: args?.cwd ? resolveToolPath(args.cwd) : targetProjectPath,
                preview: args?.command ? `Open Terminal and run: ${args.command}` : 'Open Terminal window'
            }
        });

        if (!approvalResult.approved) {
            return deniedResult(approvalResult);
        }

        return registry.openTerminal(args);
    };

    guardedRegistry.writeFile = async args => {
        const resolvedPath = resolveToolPath(args?.filePath);
        const risk = classifyFileWrite({
            filePath: args?.filePath,
            resolvedPath,
            targetProjectPath,
            writtenFilePaths,
            manyFileThreshold,
            bulkWriteApproved
        });

        if (risk.requiresApproval) {
            const approvalResult = await requestApproval({
                approvalManager,
                chatId,
                toolName: 'writeFile',
                risk,
                details: {
                    targetPath: resolvedPath,
                    preview: `Write ${String(args?.content || '').length} characters to ${resolvedPath}`
                }
            });

            if (!approvalResult.approved) {
                return deniedResult(approvalResult);
            }

            if (risk.category === 'bulk_file_write') {
                bulkWriteApproved = true;
            }
        }

        const result = await registry.writeFile(args);
        writtenFilePaths.add(resolvedPath);
        return result;
    };

    return guardedRegistry;
}
