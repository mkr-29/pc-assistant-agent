export function parseFailedToolCall(error, tools = []) {
    const failedGeneration = error?.providerError?.failed_generation || error?.groqError?.failed_generation;
    if (!failedGeneration) {
        return null;
    }

    // Pattern 1: <function=name(...)> or <function=name(...)<\/function>
    let match = failedGeneration.match(/<function=([a-zA-Z0-9_]+)\(([\s\S]*?)\)(?:<\/function>|>)?/);
    if (!match) {
        // Pattern 2: <function=name>...<\/function>
        match = failedGeneration.match(/<function=([a-zA-Z0-9_]+)>([\s\S]*?)<\/function>/);
    }
    if (!match) {
        // Pattern 3: <function=name\s*({[\s\S]*?})
        match = failedGeneration.match(/<function=([a-zA-Z0-9_]+)\s*(\{[\s\S]*?\})/);
    }

    if (!match) {
        return null;
    }

    const [, name, rawArgs] = match;
    const tool = tools.find(candidate => (candidate.function?.name || candidate.name) === name);
    if (!tool) {
        return null;
    }

    let parsedArgs = {};
    const trimmedArgs = (rawArgs || '').trim();
    if (!trimmedArgs || trimmedArgs === '{}' || trimmedArgs === '{' || trimmedArgs === '()') {
        parsedArgs = {};
    } else {
        try {
            parsedArgs = JSON.parse(trimmedArgs);
        } catch {
            const jsonMatch = trimmedArgs.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsedArgs = JSON.parse(jsonMatch[0]);
                } catch {
                    return null;
                }
            } else {
                return null;
            }
        }
    }

    const requiredParams = tool?.function?.parameters?.required || [];
    const hasMissingRequired = requiredParams.some(param => !(param in parsedArgs));
    if (hasMissingRequired) {
        return null;
    }

    return { name, args: parsedArgs };
}

export async function runToolCall({ toolCall, toolImplementations, providerName }) {
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
        if (!toolImplementations[name]) {
            throw new Error(`Tool "${name}" is not implemented.`);
        }
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

export async function postOpenAICompatibleChat({
    providerName,
    baseUrl,
    apiKey,
    authHeader = 'Authorization',
    authPrefix = 'Bearer ',
    customHeaders = {},
    body,
    fetchFn = fetch
}) {
    if (!apiKey) {
        throw new Error(`${providerName} is not configured. Missing API key.`);
    }

    if (!baseUrl) {
        throw new Error(`${providerName} is not configured. Missing base URL.`);
    }

    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const url = cleanBaseUrl.endsWith('/chat/completions')
        ? cleanBaseUrl
        : `${cleanBaseUrl}/chat/completions`;

    const headers = {
        'Content-Type': 'application/json',
        ...customHeaders
    };

    if (authHeader) {
        headers[authHeader] = `${authPrefix}${apiKey}`.trim();
    }

    const response = await fetchFn(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        const error = new Error(`${providerName} chat call failed with status ${response.status}: ${errText}`);
        error.status = response.status;

        try {
            const parsed = JSON.parse(errText);
            error.providerError = parsed?.error || parsed;
            if (providerName.toLowerCase() === 'groq') {
                error.groqError = parsed?.error || parsed;
            }
        } catch {
            error.providerError = null;
        }

        throw error;
    }

    return response.json();
}

export async function callOpenAICompatibleChat({
    providerName,
    baseUrl,
    apiKey,
    authHeader,
    authPrefix,
    customHeaders,
    messages,
    modelName,
    fetchFn
}) {
    console.log(`[${providerName}] Sending chat request to model ${modelName}...`);

    const data = await postOpenAICompatibleChat({
        providerName,
        baseUrl,
        apiKey,
        authHeader,
        authPrefix,
        customHeaders,
        fetchFn,
        body: {
            model: modelName,
            messages
        }
    });

    return data.choices?.[0]?.message?.content || '';
}

export async function runAgentLoopOpenAICompatible({
    providerName,
    baseUrl,
    apiKey,
    authHeader,
    authPrefix,
    customHeaders,
    userPrompt,
    systemInstruction,
    toolImplementations,
    tools,
    modelName,
    fallbackModels = [],
    fetchFn
}) {
    const messages = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
    ];

    let currentModel = modelName;
    const attemptedModels = new Set();
    const candidateModels = [modelName, ...fallbackModels.filter(m => m !== modelName)];

    while (true) {
        attemptedModels.add(currentModel);
        console.log(`[${providerName}] Sending request to model ${currentModel}...`);

        let data;
        try {
            data = await postOpenAICompatibleChat({
                providerName,
                baseUrl,
                apiKey,
                authHeader,
                authPrefix,
                customHeaders,
                fetchFn,
                body: {
                    model: currentModel,
                    messages,
                    tools
                }
            });
        } catch (err) {
            const isTpmOrRateLimit = err?.status === 413 || err?.status === 429 || err?.providerError?.code === 'rate_limit_exceeded';
            if (isTpmOrRateLimit) {
                const nextModel = candidateModels.find(m => !attemptedModels.has(m));
                if (nextModel) {
                    console.warn(`[${providerName}] Model ${currentModel} rate/token limit reached. Switching to ${nextModel}...`);
                    currentModel = nextModel;
                    continue;
                }
            }

            const failedToolCall = parseFailedToolCall(err, tools);
            if (!failedToolCall) {
                throw err;
            }

            const toolCall = {
                id: `${providerName.toLowerCase()}_recovered_${messages.length}`,
                type: 'function',
                function: {
                    name: failedToolCall.name,
                    arguments: JSON.stringify(failedToolCall.args)
                }
            };

            console.warn(
                `[${providerName}] Recovered malformed tool call for ${failedToolCall.name} with empty optional arguments.`
            );

            messages.push({
                role: 'assistant',
                content: null,
                tool_calls: [toolCall]
            });
            messages.push(await runToolCall({ toolCall, toolImplementations, providerName }));
            continue;
        }

        const choice = data.choices?.[0];
        const assistantMessage = choice?.message;

        if (!assistantMessage) {
            throw new Error(`Invalid response format received from ${providerName}.`);
        }

        messages.push(assistantMessage);

        const toolCalls = assistantMessage.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
                messages.push(await runToolCall({ toolCall, toolImplementations, providerName }));
            }

            continue;
        }

        return assistantMessage.content || '';
    }
}
