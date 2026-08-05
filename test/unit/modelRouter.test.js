import assert from 'node:assert/strict';
import test from 'node:test';
import { callModelChat, isGeminiModel } from '../../src/llm/modelRouter.js';

function createFallbackConfig() {
    return {
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

test('isGeminiModel identifies Gemini model names', () => {
    assert.equal(isGeminiModel('gemini-2.5-flash'), true);
    assert.equal(isGeminiModel('gemini-2.5-pro'), true);
});

test('isGeminiModel rejects Azure deployment names', () => {
    assert.equal(isGeminiModel('gpt-5.5'), false);
});

test('isGeminiModel rejects Groq model names', () => {
    assert.equal(isGeminiModel('llama-3.3-70b-versatile'), false);
    assert.equal(isGeminiModel('openai/gpt-oss-120b'), false);
});

test('callModelChat falls back to Groq when Gemini fails', async () => {
    const originalFetch = global.fetch;
    let groqBody;
    global.fetch = async (url, options) => {
        groqBody = JSON.parse(options.body);
        assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
        return {
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'Groq plan' } }]
            })
        };
    };

    try {
        const result = await callModelChat({
            ai: {
                models: {
                    generateContent: async () => {
                        const err = new Error('429 RESOURCE_EXHAUSTED quota exceeded');
                        err.status = 429;
                        throw err;
                    }
                }
            },
            config: createFallbackConfig(),
            modelName: 'gemini-2.5-flash',
            messages: [{ role: 'user', content: 'Draft a plan.' }]
        });

        assert.equal(result, 'Groq plan');
        assert.equal(groqBody.model, 'llama-3.3-70b-versatile');
        assert.deepEqual(groqBody.messages, [{ role: 'user', content: 'Draft a plan.' }]);
    } finally {
        global.fetch = originalFetch;
    }
});

test('callModelChat falls back to Groq for non-rate-limit Gemini errors', async () => {
    const originalFetch = global.fetch;
    let groqCalled = false;
    global.fetch = async () => {
        groqCalled = true;
        return {
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'Groq response' } }]
            })
        };
    };

    try {
        const result = await callModelChat({
            ai: {
                models: {
                    generateContent: async () => {
                        const err = new Error('Invalid Gemini API key');
                        err.status = 401;
                        throw err;
                    }
                }
            },
            config: createFallbackConfig(),
            modelName: 'gemini-2.5-flash',
            messages: [{ role: 'user', content: 'Draft a plan.' }]
        });

        assert.equal(result, 'Groq response');
    } finally {
        global.fetch = originalFetch;
    }

    assert.equal(groqCalled, true);
});

test('callModelChat falls back to Inception when Gemini and Groq fail', async () => {
    const originalFetch = global.fetch;
    const requests = [];
    global.fetch = async (url, options) => {
        requests.push({ url, body: JSON.parse(options.body) });

        if (url === 'https://api.groq.com/openai/v1/chat/completions') {
            return {
                ok: false,
                status: 503,
                text: async () => 'Groq unavailable'
            };
        }

        assert.equal(url, 'https://api.inceptionlabs.ai/v1/chat/completions');
        return {
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'Inception plan' } }]
            })
        };
    };

    try {
        const result = await callModelChat({
            ai: {
                models: {
                    generateContent: async () => {
                        throw new Error('Gemini unavailable');
                    }
                }
            },
            config: createFallbackConfig(),
            modelName: 'gemini-2.5-flash',
            messages: [{ role: 'user', content: 'Draft a plan.' }]
        });

        assert.equal(result, 'Inception plan');
        assert.equal(requests[0].body.model, 'llama-3.3-70b-versatile');
        assert.equal(requests[1].body.model, 'mercury-2');
    } finally {
        global.fetch = originalFetch;
    }
});
