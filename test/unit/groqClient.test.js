import assert from 'node:assert/strict';
import test from 'node:test';
import { callGroqChat, runAgentLoopGroq } from '../../src/llm/groqClient.js';

function createConfig() {
    return {
        groq: {
            apiKey: 'groq-key',
            model: 'llama-3.3-70b-versatile',
            baseUrl: 'https://api.groq.com/openai/v1/'
        }
    };
}

test('callGroqChat sends an OpenAI-compatible chat completion request', async () => {
    let request;
    const fetchFn = async (url, options) => {
        request = { url, options };
        return {
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'Groq response' } }]
            })
        };
    };

    const result = await callGroqChat({
        config: createConfig(),
        messages: [{ role: 'user', content: 'Hello' }],
        fetchFn
    });

    assert.equal(result, 'Groq response');
    assert.equal(request.url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers.Authorization, 'Bearer groq-key');

    const body = JSON.parse(request.options.body);
    assert.equal(body.model, 'llama-3.3-70b-versatile');
    assert.deepEqual(body.messages, [{ role: 'user', content: 'Hello' }]);
});

test('callGroqChat throws a useful error for non-OK responses', async () => {
    const fetchFn = async () => ({
        ok: false,
        status: 500,
        text: async () => 'server error'
    });

    await assert.rejects(
        () => callGroqChat({
            config: createConfig(),
            messages: [{ role: 'user', content: 'Hello' }],
            fetchFn
        }),
        /Groq chat call failed with status 500: server error/
    );
});

test('runAgentLoopGroq supports OpenAI-compatible tool calls', async () => {
    const requests = [];
    const fetchFn = async (url, options) => {
        requests.push({ url, body: JSON.parse(options.body) });

        if (requests.length === 1) {
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            role: 'assistant',
                            content: null,
                            tool_calls: [{
                                id: 'call_1',
                                type: 'function',
                                function: {
                                    name: 'inspectProject',
                                    arguments: '{"path":"."}'
                                }
                            }]
                        }
                    }]
                })
            };
        }

        return {
            ok: true,
            json: async () => ({
                choices: [{ message: { role: 'assistant', content: 'Done' } }]
            })
        };
    };

    const result = await runAgentLoopGroq({
        config: createConfig(),
        userPrompt: 'Inspect this project.',
        systemInstruction: 'Use tools when needed.',
        groqTools: [{ type: 'function', function: { name: 'inspectProject' } }],
        toolImplementations: {
            inspectProject: async args => ({ inspected: args.path })
        },
        fetchFn
    });

    assert.equal(result, 'Done');
    assert.equal(requests.length, 2);
    assert.equal(requests[0].body.model, 'llama-3.3-70b-versatile');
    assert.deepEqual(requests[0].body.tools, [{ type: 'function', function: { name: 'inspectProject' } }]);

    const toolMessage = requests[1].body.messages.find(message => message.role === 'tool');
    assert.equal(toolMessage.tool_call_id, 'call_1');
    assert.equal(toolMessage.name, 'inspectProject');
    assert.deepEqual(JSON.parse(toolMessage.content), { inspected: '.' });
});

test('runAgentLoopGroq recovers malformed optional-argument tool calls from Groq', async () => {
    const requests = [];
    const fetchFn = async (url, options) => {
        requests.push({ url, body: JSON.parse(options.body) });

        if (requests.length === 1) {
            return {
                ok: false,
                status: 400,
                text: async () => JSON.stringify({
                    error: {
                        message: 'Failed to call a function. Please adjust your prompt.',
                        type: 'invalid_request_error',
                        code: 'tool_use_failed',
                        failed_generation: '<function=describeScreen>{</function>'
                    }
                })
            };
        }

        return {
            ok: true,
            json: async () => ({
                choices: [{ message: { role: 'assistant', content: 'Screen described' } }]
            })
        };
    };

    const result = await runAgentLoopGroq({
        config: createConfig(),
        userPrompt: 'What is on my screen?',
        systemInstruction: 'Use tools when needed.',
        groqTools: [{
            type: 'function',
            function: {
                name: 'describeScreen',
                parameters: {
                    type: 'object',
                    properties: {
                        question: { type: 'string' }
                    }
                }
            }
        }],
        toolImplementations: {
            describeScreen: async args => ({ status: 'Success', args })
        },
        fetchFn
    });

    assert.equal(result, 'Screen described');
    assert.equal(requests.length, 2);

    const recoveredAssistant = requests[1].body.messages.find(message => message.role === 'assistant');
    assert.equal(recoveredAssistant.tool_calls[0].function.name, 'describeScreen');
    assert.equal(recoveredAssistant.tool_calls[0].function.arguments, '{}');

    const toolMessage = requests[1].body.messages.find(message => message.role === 'tool');
    assert.deepEqual(JSON.parse(toolMessage.content), { status: 'Success', args: {} });
});

test('runAgentLoopGroq does not recover malformed required-argument tool calls', async () => {
    const fetchFn = async () => ({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
            error: {
                message: 'Failed to call a function. Please adjust your prompt.',
                type: 'invalid_request_error',
                code: 'tool_use_failed',
                failed_generation: '<function=writeFile>{</function>'
            }
        })
    });

    await assert.rejects(
        () => runAgentLoopGroq({
            config: createConfig(),
            userPrompt: 'Write a file.',
            systemInstruction: 'Use tools when needed.',
            groqTools: [{
                type: 'function',
                function: {
                    name: 'writeFile',
                    parameters: {
                        type: 'object',
                        properties: {
                            filePath: { type: 'string' },
                            content: { type: 'string' }
                        },
                        required: ['filePath', 'content']
                    }
                }
            }],
            toolImplementations: {
                writeFile: async () => ({ status: 'Success' })
            },
            fetchFn
        }),
        /Groq chat call failed with status 400/
    );
});
