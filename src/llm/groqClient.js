function getGroqRequestUrl(config) {
    const baseUrl = config.groq?.baseUrl?.replace(/\/+$/, '');

    if (!baseUrl) {
        throw new Error('Groq fallback is not configured. Set GROQ_BASE_URL or use the default configuration.');
    }

    return `${baseUrl}/chat/completions`;
}

function getGroqModel(config, modelName) {
    const resolvedModel = modelName || config.groq?.model;

    if (!resolvedModel) {
        throw new Error('Groq fallback is not configured. Set GROQ_MODEL or use the default configuration.');
    }

    return resolvedModel;
}

async function postGroqChat({ config, body, fetchFn = fetch }) {
    const apiKey = config.groq?.apiKey;

    if (!apiKey) {
        throw new Error('Groq fallback is not configured. Set GROQ_API_KEY to use Groq after Gemini rate limits.');
    }

    const response = await fetchFn(getGroqRequestUrl(config), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        const error = new Error(`Groq chat call failed with status ${response.status}: ${errText}`);
        error.status = response.status;

        try {
            error.groqError = JSON.parse(errText)?.error;
        } catch {
            error.groqError = null;
        }

        throw error;
    }

    return response.json();
}

function parseFailedToolCall(error, groqTools = []) {
    const failedGeneration = error?.groqError?.failed_generation;
    if (error?.status !== 400 || error?.groqError?.code !== 'tool_use_failed' || !failedGeneration) {
        return null;
    }

    const match = failedGeneration.match(/<function=([a-zA-Z0-9_]+)>([\s\S]*?)<\/function>/);
    if (!match) {
        return null;
    }

    const [, name, rawArgs] = match;
    const tool = groqTools.find(candidate => candidate.function?.name === name);
    const requiredParams = tool?.function?.parameters?.required || [];
    if (!tool || requiredParams.length > 0) {
        return null;
    }

    const trimmedArgs = rawArgs.trim();
    if (!trimmedArgs || trimmedArgs === '{') {
        return { name, args: {} };
    }

    try {
        return { name, args: JSON.parse(trimmedArgs) };
    } catch {
        return null;
    }
}

async function runToolCall({ toolCall, toolImplementations, providerName }) {
    const { id, function: fn } = toolCall;
    const { name, arguments: argsString } = fn;

    let parsedArgs = {};
    try {
        parsedArgs = JSON.parse(argsString || '{}');
    } catch {
        console.error(`[${providerName}] Failed to parse tool arguments:`, argsString);
    }

    console.log(`[Agent Action] Calling tool (${providerName}): ${name} with args:`, parsedArgs);

    let result;
    try {
        result = await toolImplementations[name](parsedArgs);
    } catch (err) {
        console.error(`[Agent Action Error] Tool ${name} failed:`, err.message);
        result = { error: err.message };
    }

    return {
        role: 'tool',
        tool_call_id: id,
        name,
        content: JSON.stringify(result)
    };
}

export async function callGroqChat({ config, messages, modelName, fetchFn }) {
    const resolvedModel = getGroqModel(config, modelName);

    console.log(`[Groq] Sending chat request to model ${resolvedModel}...`);

    const data = await postGroqChat({
        config,
        fetchFn,
        body: {
            model: resolvedModel,
            messages
        }
    });

    return data.choices?.[0]?.message?.content || '';
}

export async function runAgentLoopGroq({
    config,
    userPrompt,
    systemInstruction,
    toolImplementations,
    groqTools,
    modelName,
    fetchFn
}) {
    const resolvedModel = getGroqModel(config, modelName);
    const messages = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
    ];

    while (true) {
        console.log(`[Groq] Sending request to model ${resolvedModel}...`);

        let data;
        try {
            data = await postGroqChat({
                config,
                fetchFn,
                body: {
                    model: resolvedModel,
                    messages,
                    tools: groqTools
                }
            });
        } catch (err) {
            const failedToolCall = parseFailedToolCall(err, groqTools);
            if (!failedToolCall) {
                throw err;
            }

            const toolCall = {
                id: `groq_recovered_${messages.length}`,
                type: 'function',
                function: {
                    name: failedToolCall.name,
                    arguments: JSON.stringify(failedToolCall.args)
                }
            };

            console.warn(
                `[Groq] Recovered malformed tool call for ${failedToolCall.name} with empty optional arguments.`
            );

            messages.push({
                role: 'assistant',
                content: null,
                tool_calls: [toolCall]
            });
            messages.push(await runToolCall({ toolCall, toolImplementations, providerName: 'Groq' }));
            continue;
        }

        const choice = data.choices?.[0];
        const assistantMessage = choice?.message;

        if (!assistantMessage) {
            throw new Error('Invalid response format received from Groq.');
        }

        messages.push(assistantMessage);

        const toolCalls = assistantMessage.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
                messages.push(await runToolCall({ toolCall, toolImplementations, providerName: 'Groq' }));
            }

            continue;
        }

        return assistantMessage.content || '';
    }
}
