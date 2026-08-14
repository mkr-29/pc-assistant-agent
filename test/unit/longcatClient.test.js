import assert from 'node:assert/strict';
import test from 'node:test';
import { callLongcatChat, runAgentLoopLongcat } from '../../src/llm/longcatClient.js';

function createLongcatConfig() {
    return {
        longcat: {
            apiKey: 'longcat-key-789',
            model: 'LongCat-2.0',
            baseUrl: 'https://api.longcat.chat/openai/v1'
        }
    };
}

test('callLongcatChat sends request with Bearer authorization and returns message content', async () => {
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
                            content: 'Hello from LongCat'
                        }
                    }
                ]
            })
        };
    };

    const result = await callLongcatChat({
        config: createLongcatConfig(),
        messages: [{ role: 'user', content: 'Hello' }],
        fetchFn
    });

    assert.equal(result, 'Hello from LongCat');
    assert.equal(capturedUrl, 'https://api.longcat.chat/openai/v1/chat/completions');
    assert.equal(capturedHeaders.Authorization, 'Bearer longcat-key-789');
    assert.equal(capturedBody.model, 'LongCat-2.0');
});

test('runAgentLoopLongcat executes tool calls and returns final answer', async () => {
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
                                        id: 'call_longcat_1',
                                        type: 'function',
                                        function: {
                                            name: 'listDirectory',
                                            arguments: JSON.stringify({ dirPath: '/src' })
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
                            content: 'Directory listed'
                        }
                    }
                ]
            })
        };
    };

    const result = await runAgentLoopLongcat({
        config: createLongcatConfig(),
        userPrompt: 'List /src',
        systemInstruction: 'You are an assistant',
        toolImplementations: {
            listDirectory: async args => {
                executedTools.push(args.dirPath);
                return { files: ['index.js'] };
            }
        },
        longcatTools: [{ type: 'function', function: { name: 'listDirectory', parameters: { type: 'object' } } }],
        fetchFn
    });

    assert.equal(result, 'Directory listed');
    assert.deepEqual(executedTools, ['/src']);
    assert.equal(callCount, 2);
});

test('callLongcatChat throws error if LONGCAT_API_KEY is missing', async () => {
    await assert.rejects(
        () => callLongcatChat({ config: { longcat: {} }, messages: [] }),
        /LongCat is not configured/
    );
});
