import assert from 'node:assert/strict';
import test from 'node:test';
import { createTelegramMessageHandler } from '../../src/telegram/messageHandler.js';

test('/new_convo resets history and does not invoke the agent', async () => {
    const sentMessages = [];
    let resetChatId = null;
    let runAgentCalled = false;
    let memoryTouched = false;

    const handler = createTelegramMessageHandler({
        bot: {
            sendMessage: async (chatId, message) => {
                sentMessages.push({ chatId, message });
            }
        },
        config: { allowedChatId: 123 },
        conversationHistoryStore: {
            resetHistory: chatId => {
                resetChatId = chatId;
            },
            getHistory: () => {
                throw new Error('getHistory should not be called for /new_convo');
            },
            appendTurn: () => {
                throw new Error('appendTurn should not be called for /new_convo');
            }
        },
        knowledgeMemoryStore: {
            listMemories: () => {
                memoryTouched = true;
                return [];
            },
            addMemory: () => {
                memoryTouched = true;
            },
            forgetMemory: () => {
                memoryTouched = true;
            }
        },
        runAgent: async () => {
            runAgentCalled = true;
        }
    });

    await handler(123, '/new_convo', 'mkr');

    assert.equal(resetChatId, 123);
    assert.equal(runAgentCalled, false);
    assert.equal(memoryTouched, false);
    assert.deepEqual(sentMessages, [
        {
            chatId: 123,
            message: 'Started a new conversation. Previous chat context has been cleared.'
        }
    ]);
});

test('normal Telegram messages load history before the agent and append successful turns', async () => {
    const previousHistory = [
        {
            userPrompt: 'Remember MKR.',
            assistantResponse: 'I will remember MKR.'
        }
    ];
    const sentMessages = [];
    let runAgentArgs = null;
    let appendedTurn = null;
    const knowledgeMemory = [
        {
            id: 'mem_1',
            fact: 'Preferred folder is /Users/example/project.'
        }
    ];

    const handler = createTelegramMessageHandler({
        bot: {
            sendMessage: async (chatId, message) => {
                sentMessages.push({ chatId, message });
            }
        },
        config: { allowedChatId: 123 },
        conversationHistoryStore: {
            getHistory: chatId => {
                assert.equal(chatId, 123);
                return previousHistory;
            },
            appendTurn: (chatId, userPrompt, assistantResponse) => {
                appendedTurn = { chatId, userPrompt, assistantResponse };
            },
            resetHistory: () => {
                throw new Error('resetHistory should not be called for normal messages');
            }
        },
        knowledgeMemoryStore: {
            listMemories: () => knowledgeMemory
        },
        runAgent: async args => {
            runAgentArgs = args;
            return 'Final answer';
        }
    });

    await handler(123, 'What did I ask you to remember?', 'mkr');

    assert.deepEqual(runAgentArgs, {
        userPrompt: 'What did I ask you to remember?',
        chatId: 123,
        conversationHistory: previousHistory,
        knowledgeMemory
    });
    assert.deepEqual(appendedTurn, {
        chatId: 123,
        userPrompt: 'What did I ask you to remember?',
        assistantResponse: 'Final answer'
    });
    assert.equal(sentMessages.length, 2);
    assert.equal(sentMessages[0].message, 'Engineering Agent activated. Processing your instructions...');
});

test('voice messages are transcribed and passed to the agent as voice-note prompts', async () => {
    const sentMessages = [];
    const previousHistory = [{ userPrompt: 'Earlier request', assistantResponse: 'Earlier answer' }];
    const knowledgeMemory = [{ id: 'mem_1', fact: 'Always run tests before final updates.' }];
    const voiceMessage = { voice: { file_id: 'voice-file' } };
    let transcribedMessage = null;
    let runAgentArgs = null;
    let appendedTurn = null;

    const handler = createTelegramMessageHandler({
        bot: {
            sendMessage: async (chatId, message, options) => {
                sentMessages.push({ chatId, message, options });
            }
        },
        config: { allowedChatId: 123 },
        conversationHistoryStore: {
            getHistory: chatId => {
                assert.equal(chatId, 123);
                return previousHistory;
            },
            appendTurn: (chatId, userPrompt, assistantResponse) => {
                appendedTurn = { chatId, userPrompt, assistantResponse };
            },
            resetHistory: () => {
                throw new Error('resetHistory should not be called for voice messages');
            }
        },
        knowledgeMemoryStore: {
            listMemories: () => knowledgeMemory
        },
        voiceNoteTranscriber: {
            transcribe: async message => {
                transcribedMessage = message;
                return 'Run npm test and summarize the result.';
            }
        },
        approvalManager: {
            handleApprovalMessage: () => {
                throw new Error('approval replies should be text-only');
            }
        },
        runAgent: async args => {
            runAgentArgs = args;
            return 'Tests passed.';
        }
    });

    await handler(123, undefined, 'mkr', voiceMessage);

    assert.equal(transcribedMessage, voiceMessage);
    assert.equal(runAgentArgs.chatId, 123);
    assert.equal(runAgentArgs.conversationHistory, previousHistory);
    assert.equal(runAgentArgs.knowledgeMemory, knowledgeMemory);
    assert.match(runAgentArgs.userPrompt, /The user sent a Telegram voice note/);
    assert.match(runAgentArgs.userPrompt, /Run npm test and summarize the result\./);
    assert.match(runAgentArgs.userPrompt, /If it is only notes, thoughts, or a status update/);
    assert.deepEqual(appendedTurn, {
        chatId: 123,
        userPrompt: 'Voice note transcript:\nRun npm test and summarize the result.',
        assistantResponse: 'Tests passed.'
    });
    assert.equal(sentMessages[0].message, 'Voice note received. Transcribing your instruction...');
    assert.equal(sentMessages[1].message, 'Engineering Agent activated. Processing your instructions...');
    assert.match(sentMessages[2].message, /Tests passed\./);
});

test('voice transcription failures are reported without running the agent', async () => {
    const sentMessages = [];
    let runAgentCalled = false;
    let historyLoaded = false;

    const handler = createTelegramMessageHandler({
        bot: {
            sendMessage: async (chatId, message) => {
                sentMessages.push({ chatId, message });
            }
        },
        config: { allowedChatId: 123 },
        conversationHistoryStore: {
            getHistory: () => {
                historyLoaded = true;
                return [];
            },
            appendTurn: () => {
                throw new Error('appendTurn should not be called when transcription fails');
            },
            resetHistory: () => {
                throw new Error('resetHistory should not be called for voice messages');
            }
        },
        knowledgeMemoryStore: {
            listMemories: () => []
        },
        voiceNoteTranscriber: {
            transcribe: async () => {
                throw new Error('Voice note could not be transcribed.');
            }
        },
        runAgent: async () => {
            runAgentCalled = true;
        }
    });

    await handler(123, undefined, 'mkr', { voice: { file_id: 'voice-file' } });

    assert.equal(runAgentCalled, false);
    assert.equal(historyLoaded, false);
    assert.equal(sentMessages[0].message, 'Voice note received. Transcribing your instruction...');
    assert.match(sentMessages[1].message, /Voice note could not be transcribed\./);
});

test('unauthorized voice messages are ignored before transcription', async () => {
    const sentMessages = [];
    let transcriptionAttempted = false;

    const handler = createTelegramMessageHandler({
        bot: {
            sendMessage: async (chatId, message) => {
                sentMessages.push({ chatId, message });
            }
        },
        config: { allowedChatId: 123 },
        conversationHistoryStore: {
            getHistory: () => {
                throw new Error('getHistory should not be called for unauthorized messages');
            },
            appendTurn: () => {
                throw new Error('appendTurn should not be called for unauthorized messages');
            },
            resetHistory: () => {
                throw new Error('resetHistory should not be called for unauthorized messages');
            }
        },
        voiceNoteTranscriber: {
            transcribe: async () => {
                transcriptionAttempted = true;
            }
        },
        runAgent: async () => {
            throw new Error('runAgent should not be called for unauthorized messages');
        }
    });

    await handler(999, undefined, 'intruder', { voice: { file_id: 'voice-file' } });

    assert.equal(transcriptionAttempted, false);
    assert.deepEqual(sentMessages, []);
});

test('/remember stores global knowledge memory and does not invoke the agent', async () => {
    const sentMessages = [];
    let storedFact = null;
    let runAgentCalled = false;

    const handler = createTelegramMessageHandler({
        bot: {
            sendMessage: async (chatId, message) => {
                sentMessages.push({ chatId, message });
            }
        },
        config: { allowedChatId: 123 },
        conversationHistoryStore: {
            getHistory: () => {
                throw new Error('getHistory should not be called for /remember');
            },
            appendTurn: () => {
                throw new Error('appendTurn should not be called for /remember');
            },
            resetHistory: () => {
                throw new Error('resetHistory should not be called for /remember');
            }
        },
        knowledgeMemoryStore: {
            addMemory: fact => {
                storedFact = fact;
                return { id: 'mem_1', fact };
            }
        },
        runAgent: async () => {
            runAgentCalled = true;
        }
    });

    await handler(123, '/remember Preferred folder is /Users/example/project.', 'mkr');

    assert.equal(storedFact, 'Preferred folder is /Users/example/project.');
    assert.equal(runAgentCalled, false);
    assert.deepEqual(sentMessages, [
        {
            chatId: 123,
            message: 'Saved long-term memory mem_1.'
        }
    ]);
});

test('/memories lists global knowledge memory and does not invoke the agent', async () => {
    const sentMessages = [];
    let runAgentCalled = false;

    const handler = createTelegramMessageHandler({
        bot: {
            sendMessage: async (chatId, message) => {
                sentMessages.push({ chatId, message });
            }
        },
        config: { allowedChatId: 123 },
        conversationHistoryStore: {
            getHistory: () => {
                throw new Error('getHistory should not be called for /memories');
            },
            appendTurn: () => {
                throw new Error('appendTurn should not be called for /memories');
            },
            resetHistory: () => {
                throw new Error('resetHistory should not be called for /memories');
            }
        },
        knowledgeMemoryStore: {
            listMemories: () => [
                {
                    id: 'mem_1',
                    fact: 'Use npm test before reporting completion.'
                }
            ]
        },
        runAgent: async () => {
            runAgentCalled = true;
        }
    });

    await handler(123, '/memories', 'mkr');

    assert.equal(runAgentCalled, false);
    assert.deepEqual(sentMessages, [
        {
            chatId: 123,
            message: [
                'Saved long-term knowledge memories:',
                '- mem_1: Use npm test before reporting completion.'
            ].join('\n')
        }
    ]);
});

test('/forget_memory deletes global knowledge memory and does not invoke the agent', async () => {
    const sentMessages = [];
    let forgottenId = null;
    let runAgentCalled = false;

    const handler = createTelegramMessageHandler({
        bot: {
            sendMessage: async (chatId, message) => {
                sentMessages.push({ chatId, message });
            }
        },
        config: { allowedChatId: 123 },
        conversationHistoryStore: {
            getHistory: () => {
                throw new Error('getHistory should not be called for /forget_memory');
            },
            appendTurn: () => {
                throw new Error('appendTurn should not be called for /forget_memory');
            },
            resetHistory: () => {
                throw new Error('resetHistory should not be called for /forget_memory');
            }
        },
        knowledgeMemoryStore: {
            forgetMemory: id => {
                forgottenId = id;
                return { id, fact: 'Use npm test.' };
            }
        },
        runAgent: async () => {
            runAgentCalled = true;
        }
    });

    await handler(123, '/forget_memory mem_1', 'mkr');

    assert.equal(forgottenId, 'mem_1');
    assert.equal(runAgentCalled, false);
    assert.deepEqual(sentMessages, [
        {
            chatId: 123,
            message: 'Forgot long-term memory mem_1.'
        }
    ]);
});

test('approval replies are consumed before normal agent execution', async () => {
    const sentMessages = [];
    let runAgentCalled = false;
    let historyLoaded = false;
    let handledApproval = null;

    const handler = createTelegramMessageHandler({
        bot: {
            sendMessage: async (chatId, message) => {
                sentMessages.push({ chatId, message });
            }
        },
        config: { allowedChatId: 123 },
        approvalManager: {
            handleApprovalMessage: (chatId, text) => {
                handledApproval = { chatId, text };
                return {
                    handled: true,
                    status: 'approved',
                    message: 'Approved abc123. Continuing the action.'
                };
            }
        },
        conversationHistoryStore: {
            getHistory: () => {
                historyLoaded = true;
                return [];
            },
            appendTurn: () => {
                throw new Error('appendTurn should not be called for approval replies');
            },
            resetHistory: () => {
                throw new Error('resetHistory should not be called for approval replies');
            }
        },
        runAgent: async () => {
            runAgentCalled = true;
        }
    });

    await handler(123, 'APPROVE abc123', 'mkr');

    assert.deepEqual(handledApproval, { chatId: 123, text: 'APPROVE abc123' });
    assert.equal(runAgentCalled, false);
    assert.equal(historyLoaded, false);
    assert.deepEqual(sentMessages, [
        {
            chatId: 123,
            message: 'Approved abc123. Continuing the action.'
        }
    ]);
});

test('/new_convo cancels pending approval when approval manager is present', async () => {
    const sentMessages = [];
    let cancelledChatId = null;
    let clearedAllowAllChatId = null;

    const handler = createTelegramMessageHandler({
        bot: {
            sendMessage: async (chatId, message) => {
                sentMessages.push({ chatId, message });
            }
        },
        config: { allowedChatId: 123 },
        approvalManager: {
            cancelPending: chatId => {
                cancelledChatId = chatId;
                return true;
            },
            clearAllowAll: chatId => {
                clearedAllowAllChatId = chatId;
            }
        },
        conversationHistoryStore: {
            resetHistory: () => {},
            getHistory: () => {
                throw new Error('getHistory should not be called for /new_convo');
            },
            appendTurn: () => {
                throw new Error('appendTurn should not be called for /new_convo');
            }
        },
        runAgent: async () => {
            throw new Error('runAgent should not be called for /new_convo');
        }
    });

    await handler(123, '/new_convo', 'mkr');

    assert.equal(cancelledChatId, 123);
    assert.equal(clearedAllowAllChatId, 123);
    assert.equal(sentMessages[0].message, 'Started a new conversation. Previous chat context has been cleared.');
});

test('message handler clears allowAll when agent execution finishes', async () => {
    let clearedAllowAllChatId = null;

    const handler = createTelegramMessageHandler({
        bot: {
            sendMessage: async () => {}
        },
        config: { allowedChatId: 123 },
        approvalManager: {
            clearAllowAll: chatId => {
                clearedAllowAllChatId = chatId;
            }
        },
        conversationHistoryStore: {
            getHistory: () => [],
            appendTurn: () => {}
        },
        knowledgeMemoryStore: {
            listMemories: () => []
        },
        runAgent: async () => 'Task finished'
    });

    await handler(123, 'Execute task', 'mkr');

    assert.equal(clearedAllowAllChatId, 123);
});
