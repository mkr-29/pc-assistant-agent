import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { customTools } from '../../src/tools/definitions.js';
import { createToolRegistry } from '../../src/tools/registry.js';

function createTempDirectory() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'pc-assistant-registry-'));
}

test('custom tool declarations expose the expected tool names', () => {
    assert.deepEqual(
        customTools.map(tool => tool.name),
        [
            'readFile',
            'writeFile',
            'listDirectory',
            'searchFiles',
            'searchText',
            'findRecentFiles',
            'executeCommand',
            'openTerminal',
            'openLocalTarget',
            'controlDesktopBrowser',
            'controlMediaPlayback',
            'extensionListTabs',
            'extensionActivateTab',
            'extensionMediaControl',
            'extensionDomSnapshot',
            'extensionExtractPageSemantics',
            'extensionClick',
            'extensionType',
            'extensionExecuteJs',
            'extensionTakeScreenshot',
            'inspectProject',
            'runProjectTests',
            'runProjectLint',
            'getGitStatus',
            'summarizeGitDiff',
            'createGitCommit',
            'sendTelegramFile',
            'readClipboard',
            'writeClipboard',
            'takeScreenshot',
            'describeScreen',
            'browserNavigate',
            'browserSnapshot',
            'browserExtractPageSemantics',
            'browserClick',
            'browserType',
            'browserPressKey',
            'browserScreenshot',
            'browserClose',
            'scheduleReminder',
            'scheduleAgentTask',
            'listScheduledTasks',
            'cancelScheduledTask',
            'generateImage',
            'getImageInfo',
            'removeImageBackground',
            'cropImage',
            'resizeImage',
            'rotateImage',
            'adjustImage',
            'convertImage',
            'compositeImages',
            'manipulateImage'
        ]
    );
});

test('tool registry contains an implementation for each declared tool', () => {
    const registry = createToolRegistry({
        bot: {},
        chatId: 123,
        resolveToolPath: inputPath => inputPath || '/tmp'
    });

    for (const tool of customTools) {
        assert.equal(typeof registry[tool.name], 'function');
    }
});

test('tool registry skips openTerminal when approval is denied', async () => {
    const rootPath = createTempDirectory();
    const approvalRequests = [];

    try {
        const registry = createToolRegistry({
            bot: {},
            chatId: 123,
            config: {
                targetProjectPath: rootPath,
                saferCommandApprovals: {
                    enabled: true,
                    timeoutMs: 1000
                }
            },
            resolveToolPath: inputPath => (inputPath ? path.resolve(rootPath, inputPath) : rootPath),
            approvalManager: {
                requestApproval: async request => {
                    approvalRequests.push(request);
                    return {
                        approved: false,
                        status: 'denied',
                        message: 'Denied for test.'
                    };
                }
            }
        });

        const result = await registry.openTerminal({ command: 'echo test', cwd: rootPath });

        assert.equal(result.status, 'Denied');
        assert.equal(result.approvalStatus, 'denied');
        assert.equal(approvalRequests.length, 1);
        assert.equal(approvalRequests[0].toolName, 'openTerminal');
        assert.equal(approvalRequests[0].risk.category, 'terminal_execution');
    } finally {
        fs.rmSync(rootPath, { recursive: true, force: true });
    }
});

test('tool registry skips dangerous terminal commands when approval is denied', async () => {
    const rootPath = createTempDirectory();
    const markerPath = path.join(rootPath, 'marker.txt');
    const approvalRequests = [];

    try {
        fs.writeFileSync(markerPath, 'keep me', 'utf-8');

        const registry = createToolRegistry({
            bot: {},
            chatId: 123,
            config: {
                targetProjectPath: rootPath,
                saferCommandApprovals: {
                    enabled: true,
                    timeoutMs: 1000,
                    manyFileWriteThreshold: 5
                }
            },
            resolveToolPath: inputPath => (inputPath ? path.resolve(rootPath, inputPath) : rootPath),
            approvalManager: {
                requestApproval: async request => {
                    approvalRequests.push(request);
                    return {
                        approved: false,
                        status: 'denied',
                        message: 'Denied for test.'
                    };
                }
            }
        });

        const result = await registry.executeCommand({
            command: `rm -rf "${markerPath}"`,
            cwd: rootPath
        });

        assert.equal(result.status, 'Denied');
        assert.equal(result.approvalStatus, 'denied');
        assert.equal(fs.existsSync(markerPath), true);
        assert.equal(approvalRequests.length, 1);
        assert.equal(approvalRequests[0].risk.category, 'deletion');
    } finally {
        fs.rmSync(rootPath, { recursive: true, force: true });
    }
});

test('tool registry requires one approval before bulk file writes continue', async () => {
    const rootPath = createTempDirectory();
    const approvalRequests = [];

    try {
        const registry = createToolRegistry({
            bot: {},
            chatId: 123,
            config: {
                targetProjectPath: rootPath,
                saferCommandApprovals: {
                    enabled: true,
                    timeoutMs: 1000,
                    manyFileWriteThreshold: 1
                }
            },
            resolveToolPath: inputPath => (inputPath ? path.resolve(rootPath, inputPath) : rootPath),
            approvalManager: {
                requestApproval: async request => {
                    approvalRequests.push(request);
                    return {
                        approved: true,
                        status: 'approved',
                        message: 'Approved for test.'
                    };
                }
            }
        });

        assert.equal((await registry.writeFile({ filePath: 'one.txt', content: 'one' })).status, 'Success');
        assert.equal((await registry.writeFile({ filePath: 'two.txt', content: 'two' })).status, 'Success');
        assert.equal((await registry.writeFile({ filePath: 'three.txt', content: 'three' })).status, 'Success');

        assert.equal(approvalRequests.length, 1);
        assert.equal(approvalRequests[0].risk.category, 'bulk_file_write');
        assert.equal(fs.readFileSync(path.join(rootPath, 'three.txt'), 'utf-8'), 'three');
    } finally {
        fs.rmSync(rootPath, { recursive: true, force: true });
    }
});

test('tool registry skips sensitive file writes when approval is denied', async () => {
    const rootPath = createTempDirectory();
    const approvalRequests = [];

    try {
        const registry = createToolRegistry({
            bot: {},
            chatId: 123,
            config: {
                targetProjectPath: rootPath,
                saferCommandApprovals: {
                    enabled: true,
                    timeoutMs: 1000,
                    manyFileWriteThreshold: 5
                }
            },
            resolveToolPath: inputPath => (inputPath ? path.resolve(rootPath, inputPath) : rootPath),
            approvalManager: {
                requestApproval: async request => {
                    approvalRequests.push(request);
                    return {
                        approved: false,
                        status: 'denied',
                        message: 'Denied for test.'
                    };
                }
            }
        });

        const result = await registry.writeFile({ filePath: '.env', content: 'SECRET=value' });

        assert.equal(result.status, 'Denied');
        assert.equal(approvalRequests.length, 1);
        assert.equal(approvalRequests[0].risk.category, 'sensitive_file');
        assert.equal(fs.existsSync(path.join(rootPath, '.env')), false);
    } finally {
        fs.rmSync(rootPath, { recursive: true, force: true });
    }
});
