import assert from 'node:assert/strict';
import test from 'node:test';
import { callThinkingMachineChat, runAgentLoopThinkingMachine } from '../../src/llm/thinkingMachineClient.js';

function createThinkingMachineConfig() {
    return {
        thinkingMachine: {
            apiKey: 'tml-key-999',
            model: 'inkling',
            baseUrl: 'https://api.thinkingmachines.ai/v1'
        }
    };
}

test('callThinkingMachineChat sends request with Bearer authorization and returns message content', async () => {
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
                            content: 'Hello from Thinking Machine'
                        }
                    }
                ]
            })
        };
    };

    const result = await callThinkingMachineChat({
        config: createThinkingMachineConfig(),
        messages: [{ role: 'user', content: 'Hello' }],
        fetchFn
    });

    assert.equal(result, 'Hello from Thinking Machine');
    assert.equal(capturedUrl, 'https://api.thinkingmachines.ai/v1/chat/completions');
    assert.equal(capturedHeaders.Authorization, 'Bearer tml-key-999');
    assert.equal(capturedBody.model, 'inkling');
});

test('runAgentLoopThinkingMachine executes tool calls and returns final answer', async () => {
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
                                        id: 'call_tm_1',
                                        type: 'function',
                                        function: {
                                            name: 'getDateTime',
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
                            content: 'Date is 2026-08-15'
                        }
                    }
                ]
            })
        };
    };

    const result = await runAgentLoopThinkingMachine({
        config: createThinkingMachineConfig(),
        userPrompt: 'Get date',
        systemInstruction: 'You are an assistant',
        toolImplementations: {
            getDateTime: async () => {
                executedTools.push('getDateTime');
                return { date: '2026-08-15' };
            }
        },
        thinkingMachineTools: [{ type: 'function', function: { name: 'getDateTime', parameters: { type: 'object' } } }],
        fetchFn
    });

    assert.equal(result, 'Date is 2026-08-15');
    assert.deepEqual(executedTools, ['getDateTime']);
    assert.equal(callCount, 2);
});

test('callThinkingMachineChat throws error if THINKING_MACHINE_API_KEY is missing', async () => {
    await assert.rejects(
        () => callThinkingMachineChat({ config: { thinkingMachine: {} }, messages: [] }),
        /Thinking Machine is not configured/
    );
});
