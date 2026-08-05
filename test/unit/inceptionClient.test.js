import assert from 'node:assert/strict';
import test from 'node:test';
import { callInceptionChat, runAgentLoopInception } from '../../src/llm/inceptionClient.js';

function createConfig() {
    return {
        inception: {
            apiKey: 'inception-key',
            model: 'mercury-2',
            baseUrl: 'https://api.inceptionlabs.ai/v1/'
        }
    };
}

test('callInceptionChat sends an OpenAI-compatible chat completion request', async () => {
    let request;
    const fetchFn = async (url, options) => {
        request = { url, options };
        return {
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'Inception response' } }]
            })
        };
    };

    const result = await callInceptionChat({
        config: createConfig(),
        messages: [{ role: 'user', content: 'Hello' }],
        fetchFn
    });

    assert.equal(result, 'Inception response');
    assert.equal(request.url, 'https://api.inceptionlabs.ai/v1/chat/completions');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers.Authorization, 'Bearer inception-key');

    const body = JSON.parse(request.options.body);
    assert.equal(body.model, 'mercury-2');
    assert.deepEqual(body.messages, [{ role: 'user', content: 'Hello' }]);
});

test('callInceptionChat throws a useful error for non-OK responses', async () => {
    const fetchFn = async () => ({
        ok: false,
        status: 503,
        text: async () => 'unavailable'
    });

    await assert.rejects(
        () => callInceptionChat({
            config: createConfig(),
            messages: [{ role: 'user', content: 'Hello' }],
            fetchFn
        }),
        /Inception chat call failed with status 503: unavailable/
    );
});

test('runAgentLoopInception supports OpenAI-compatible tool calls', async () => {
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

    const result = await runAgentLoopInception({
        config: createConfig(),
        userPrompt: 'Inspect this project.',
        systemInstruction: 'Use tools when needed.',
        inceptionTools: [{ type: 'function', function: { name: 'inspectProject' } }],
        toolImplementations: {
            inspectProject: async args => ({ inspected: args.path })
        },
        fetchFn
    });

    assert.equal(result, 'Done');
    assert.equal(requests.length, 2);
    assert.equal(requests[0].body.model, 'mercury-2');
    assert.deepEqual(requests[0].body.tools, [{ type: 'function', function: { name: 'inspectProject' } }]);

    const toolMessage = requests[1].body.messages.find(message => message.role === 'tool');
    assert.equal(toolMessage.tool_call_id, 'call_1');
    assert.equal(toolMessage.name, 'inspectProject');
    assert.deepEqual(JSON.parse(toolMessage.content), { inspected: '.' });
});
