function getInceptionRequestUrl(config) {
    const baseUrl = config.inception?.baseUrl?.replace(/\/+$/, '');

    if (!baseUrl) {
        throw new Error('Inception fallback is not configured. Set INCEPTION_BASE_URL or use the default configuration.');
    }

    return `${baseUrl}/chat/completions`;
}

function getInceptionModel(config, modelName) {
    const resolvedModel = modelName || config.inception?.model;

    if (!resolvedModel) {
        throw new Error('Inception fallback is not configured. Set INCEPTION_MODEL or use the default configuration.');
    }

    return resolvedModel;
}

async function postInceptionChat({ config, body, fetchFn = fetch }) {
    const apiKey = config.inception?.apiKey;

    if (!apiKey) {
        throw new Error('Inception fallback is not configured. Set INCEPTION_API_KEY to use Inception after Groq fails.');
    }

    const response = await fetchFn(getInceptionRequestUrl(config), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        const error = new Error(`Inception chat call failed with status ${response.status}: ${errText}`);
        error.status = response.status;
        throw error;
    }

    return response.json();
}

async function runToolCall({ toolCall, toolImplementations }) {
    const { id, function: fn } = toolCall;
    const { name, arguments: argsString } = fn;

    let parsedArgs = {};
    try {
        parsedArgs = JSON.parse(argsString || '{}');
    } catch {
        console.error('[Inception] Failed to parse tool arguments:', argsString);
    }

    console.log(`[Agent Action] Calling tool (Inception): ${name} with args:`, parsedArgs);

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

export async function callInceptionChat({ config, messages, modelName, fetchFn }) {
    const resolvedModel = getInceptionModel(config, modelName);

    console.log(`[Inception] Sending chat request to model ${resolvedModel}...`);

    const data = await postInceptionChat({
        config,
        fetchFn,
        body: {
            model: resolvedModel,
            messages
        }
    });

    return data.choices?.[0]?.message?.content || '';
}

export async function runAgentLoopInception({
    config,
    userPrompt,
    systemInstruction,
    toolImplementations,
    inceptionTools,
    modelName,
    fetchFn
}) {
    const resolvedModel = getInceptionModel(config, modelName);
    const messages = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
    ];

    while (true) {
        console.log(`[Inception] Sending request to model ${resolvedModel}...`);

        const data = await postInceptionChat({
            config,
            fetchFn,
            body: {
                model: resolvedModel,
                messages,
                tools: inceptionTools
            }
        });

        const choice = data.choices?.[0];
        const assistantMessage = choice?.message;

        if (!assistantMessage) {
            throw new Error('Invalid response format received from Inception.');
        }

        messages.push(assistantMessage);

        const toolCalls = assistantMessage.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
                messages.push(await runToolCall({ toolCall, toolImplementations }));
            }

            continue;
        }

        return assistantMessage.content || '';
    }
}
