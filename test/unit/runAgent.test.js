import assert from 'node:assert/strict';
import test from 'node:test';
import { runAgent } from '../../src/agent/runAgent.js';

function createAzureConfig() {
    return {
        llmProvider: 'azure',
        targetProjectPath: '/tmp/project',
        azureOpenAI: {
            deployment: 'gpt-5.5'
        }
    };
}

function createGeminiConfig() {
    return {
        llmProvider: 'gemini',
        targetProjectPath: '/tmp/project',
        groq: {
            apiKey: 'groq-key',
            model: 'llama-3.3-70b-versatile',
            baseUrl: 'https://api.groq.com/openai/v1'
        },
        inception: {
            apiKey: 'inception-key',
            model: 'mercury-2',
            baseUrl: 'https://api.inceptionlabs.ai/v1'
        }
    };
}

test('runAgent always uses Gemini 2.5 Flash even when config contains Azure provider', async () => {
    const sentMessages = [];
    const callOrder = [];
    let executionPrompt = '';

    const result = await runAgent({
        userPrompt: 'Do a task.',
        chatId: 123,
        conversationHistory: [],
        knowledgeMemory: [
            {
                id: 'mem_1',
                fact: 'Preferred test command is npm test.'
            }
        ],
        bot: {
            sendMessage: async (chatId, message) => {
                sentMessages.push({ chatId, message });
            }
        },
        config: createAzureConfig(),
        ai: {},
        agentDependencies: {
            runAgentLoopGemini: async ({ userPrompt, modelName }) => {
                callOrder.push(`gemini:${modelName}`);
                executionPrompt = userPrompt;
                return 'Final answer';
            },
            runAgentLoopGroq: async () => {
                throw new Error('Groq fallback should not be used');
            }
        }
    });

    assert.equal(result, 'Final answer');
    assert.deepEqual(callOrder, ['gemini:gemini-2.5-flash']);
    assert.deepEqual(sentMessages, []);
    assert.match(executionPrompt, /## Long-term knowledge memory/);
    assert.match(executionPrompt, /mem_1: Preferred test command is npm test\./);
});

test('runAgent falls back to Groq when Gemini 2.5 Flash execution fails', async () => {
    const callOrder = [];

    const result = await runAgent({
        userPrompt: 'Do the task.',
        chatId: 123,
        conversationHistory: [],
        knowledgeMemory: [],
        bot: {},
        config: createGeminiConfig(),
        ai: {},
        agentDependencies: {
            runAgentLoopGemini: async ({ modelName }) => {
                callOrder.push(`gemini:${modelName}`);
                throw new Error('Gemini request failed');
            },
            runAgentLoopGroq: async ({ config, userPrompt, groqTools, modelName }) => {
                callOrder.push(`groq:${modelName}`);
                assert.equal(config.groq.apiKey, 'groq-key');
                assert.match(userPrompt, /## Current user request/);
                assert.ok(Array.isArray(groqTools));
                return 'Groq fallback answer';
            }
        }
    });

    assert.equal(result, 'Groq fallback answer');
    assert.deepEqual(callOrder, ['gemini:gemini-2.5-flash', 'groq:llama-3.3-70b-versatile']);
});

test('runAgent falls back to Inception when Gemini and Groq both fail', async () => {
    const callOrder = [];

    const result = await runAgent({
        userPrompt: 'Do the task.',
        chatId: 123,
        conversationHistory: [],
        knowledgeMemory: [],
        bot: {},
        config: createGeminiConfig(),
        ai: {},
        agentDependencies: {
            runAgentLoopGemini: async ({ modelName }) => {
                callOrder.push(`gemini:${modelName}`);
                throw new Error('Gemini request failed');
            },
            runAgentLoopGroq: async ({ modelName }) => {
                callOrder.push(`groq:${modelName}`);
                throw new Error('Groq request failed');
            },
            runAgentLoopInception: async ({ config, userPrompt, inceptionTools, modelName }) => {
                callOrder.push(`inception:${modelName}`);
                assert.equal(config.inception.apiKey, 'inception-key');
                assert.match(userPrompt, /## Current user request/);
                assert.ok(Array.isArray(inceptionTools));
                return 'Inception fallback answer';
            }
        }
    });

    assert.equal(result, 'Inception fallback answer');
    assert.deepEqual(callOrder, [
        'gemini:gemini-2.5-flash',
        'groq:llama-3.3-70b-versatile',
        'inception:mercury-2'
    ]);
});

test('runAgent falls back to Groq for non-rate-limit Gemini errors', async () => {
    const callOrder = [];

    const result = await runAgent({
        userPrompt: 'Do the task.',
        chatId: 123,
        conversationHistory: [],
        knowledgeMemory: [],
        bot: {},
        config: createGeminiConfig(),
        ai: {},
        agentDependencies: {
            runAgentLoopGemini: async () => {
                callOrder.push('gemini');
                const err = new Error('Invalid Gemini API key');
                err.status = 401;
                throw err;
            },
            runAgentLoopGroq: async () => {
                callOrder.push('groq');
                return 'Groq answer';
            }
        }
    });

    assert.equal(result, 'Groq answer');
    assert.deepEqual(callOrder, ['gemini', 'groq']);
});

test('runAgent cascades across all providers (Gemini -> Groq -> Inception -> Sarvam -> Arcee -> LongCat -> TM -> Azure)', async () => {
    const callOrder = [];
    const fullConfig = {
        geminiApiKey: 'gemini-key',
        groq: { apiKey: 'groq-key', model: 'llama-3.3-70b-versatile' },
        inception: { apiKey: 'inception-key', model: 'mercury-2' },
        sarvam: { apiKey: 'sarvam-key', model: 'sarvam-105b' },
        arcee: { apiKey: 'arcee-key', model: 'zai-org/glm-5.2' },
        longcat: { apiKey: 'longcat-key', model: 'LongCat-2.0' },
        thinkingMachine: { apiKey: 'tm-key', model: 'inkling' },
        azureOpenAI: { apiKey: 'azure-key', endpoint: 'https://azure.openai.com', deployment: 'gpt-5.5' }
    };

    const result = await runAgent({
        userPrompt: 'Test all fallbacks',
        chatId: 123,
        conversationHistory: [],
        knowledgeMemory: [],
        bot: {},
        config: fullConfig,
        ai: {},
        agentDependencies: {
            runAgentLoopGemini: async () => { callOrder.push('gemini'); throw new Error('429'); },
            runAgentLoopGroq: async () => { callOrder.push('groq'); throw new Error('429'); },
            runAgentLoopInception: async () => { callOrder.push('inception'); throw new Error('500'); },
            runAgentLoopSarvam: async () => { callOrder.push('sarvam'); throw new Error('503'); },
            runAgentLoopArcee: async () => { callOrder.push('arcee'); throw new Error('402'); },
            runAgentLoopLongcat: async () => { callOrder.push('longcat'); throw new Error('429'); },
            runAgentLoopThinkingMachine: async () => { callOrder.push('thinkingMachine'); throw new Error('500'); },
            runAgentLoopAzure: async () => {
                callOrder.push('azure');
                return 'Azure fallback succeeded!';
            }
        }
    });

    assert.equal(result, 'Azure fallback succeeded!');
    assert.deepEqual(callOrder, [
        'gemini',
        'groq',
        'inception',
        'sarvam',
        'arcee',
        'longcat',
        'thinkingMachine',
        'azure'
    ]);
});

