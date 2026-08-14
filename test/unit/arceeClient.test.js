import assert from 'node:assert/strict';
import test from 'node:test';
import { callArceeChat, runAgentLoopArcee } from '../../src/llm/arceeClient.js';

function createArceeConfig() {
    return {
        arcee: {
            apiKey: 'arcee-key-456',
            model: 'zai-org/glm-5.2',
            baseUrl: 'https://api.arcee.ai/api/v1'
        }
    };
}

test('callArceeChat sends request with Bearer authorization and returns message content', async () => {
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
                            content: 'Hello from Arcee'
                        }
                    }
                ]
            })
        };
    };

    const result = await callArceeChat({
        config: createArceeConfig(),
        messages: [{ role: 'user', content: 'Hello' }],
        fetchFn
    });

    assert.equal(result, 'Hello from Arcee');
    assert.equal(capturedUrl, 'https://api.arcee.ai/api/v1/chat/completions');
    assert.equal(capturedHeaders.Authorization, 'Bearer arcee-key-456');
    assert.equal(capturedBody.model, 'zai-org/glm-5.2');
});

test('runAgentLoopArcee executes tool calls and returns final answer', async () => {
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
                                        id: 'call_arcee_1',
                                        type: 'function',
                                        function: {
                                            name: 'readFile',
                                            arguments: JSON.stringify({ path: 'test.txt' })
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
                            content: 'File content read'
                        }
                    }
                ]
            })
        };
    };

    const result = await runAgentLoopArcee({
        config: createArceeConfig(),
        userPrompt: 'Read test.txt',
        systemInstruction: 'You are an assistant',
        toolImplementations: {
            readFile: async args => {
                executedTools.push(args.path);
                return { content: 'hello world' };
            }
        },
        arceeTools: [{ type: 'function', function: { name: 'readFile', parameters: { type: 'object' } } }],
        fetchFn
    });

    assert.equal(result, 'File content read');
    assert.deepEqual(executedTools, ['test.txt']);
    assert.equal(callCount, 2);
});

test('callArceeChat throws error if ARCEE_API_KEY is missing', async () => {
    await assert.rejects(
        () => callArceeChat({ config: { arcee: {} }, messages: [] }),
        /Arcee is not configured/
    );
});
