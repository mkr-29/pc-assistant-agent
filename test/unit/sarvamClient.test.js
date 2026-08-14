import assert from 'node:assert/strict';
import test from 'node:test';
import { callSarvamChat, runAgentLoopSarvam } from '../../src/llm/sarvamClient.js';

function createSarvamConfig() {
    return {
        sarvam: {
            apiKey: 'sarvam-key-123',
            model: 'sarvam-105b',
            baseUrl: 'https://api.sarvam.ai/v1'
        }
    };
}

test('callSarvamChat sends request with api-subscription-key and returns message content', async () => {
    let capturedUrl;
    let capturedHeaders;
    let capturedBody;

    const fetchFn = async (url, options) => {
        capturedUrl = url;
        capturedHeaders = options.headers;
        capturedBody = JSON.parse(options.body);

        return {
            ok: true,
            status: 200,
            json: async () => ({
                choices: [
                    {
                        message: {
                            content: 'Hello from Sarvam'
                        }
                    }
                ]
            })
        };
    };

    const result = await callSarvamChat({
        config: createSarvamConfig(),
        messages: [{ role: 'user', content: 'Hello' }],
        fetchFn
    });

    assert.equal(result, 'Hello from Sarvam');
    assert.equal(capturedUrl, 'https://api.sarvam.ai/v1/chat/completions');
    assert.equal(capturedHeaders['api-subscription-key'], 'sarvam-key-123');
    assert.equal(capturedBody.model, 'sarvam-105b');
});

test('runAgentLoopSarvam executes tool calls and returns final answer', async () => {
    let callCount = 0;
    const executedTools = [];

    const fetchFn = async () => {
        callCount += 1;

        if (callCount === 1) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    choices: [
                        {
                            message: {
                                role: 'assistant',
                                content: null,
                                tool_calls: [
                                    {
                                        id: 'call_1',
                                        type: 'function',
                                        function: {
                                            name: 'getSystemInfo',
                                            arguments: '{}'
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                })
            };
        }

        return {
            ok: true,
            status: 200,
            json: async () => ({
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: 'System info received'
                        }
                    }
                ]
            })
        };
    };

    const result = await runAgentLoopSarvam({
        config: createSarvamConfig(),
        userPrompt: 'Check system info',
        systemInstruction: 'You are an assistant',
        toolImplementations: {
            getSystemInfo: async () => {
                executedTools.push('getSystemInfo');
                return { os: 'mac' };
            }
        },
        sarvamTools: [{ type: 'function', function: { name: 'getSystemInfo', parameters: { type: 'object' } } }],
        fetchFn
    });

    assert.equal(result, 'System info received');
    assert.deepEqual(executedTools, ['getSystemInfo']);
    assert.equal(callCount, 2);
});

test('callSarvamChat throws error if SARVAM_API_KEY is missing', async () => {
    await assert.rejects(
        () => callSarvamChat({ config: { sarvam: {} }, messages: [] }),
        /Sarvam is not configured/
    );
});
