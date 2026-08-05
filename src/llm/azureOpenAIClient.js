function getAzureRequestUrl(config, deploymentName) {
    const { endpoint, apiVersion } = config.azureOpenAI;
    const baseUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
    return `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
}

function applyReasoningEffort(body, deploymentName, reasoningEffort) {
    if (deploymentName.includes('gpt-5.5') && reasoningEffort) {
        body.reasoning_effort = reasoningEffort;
    }

    return body;
}

export async function callAzureOpenAIChat({ config, deploymentName, messages, reasoningEffort = null }) {
    const { endpoint, apiKey } = config.azureOpenAI;

    if (!endpoint || !apiKey) {
        throw new Error('Azure OpenAI environment variables are missing (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY).');
    }

    const url = getAzureRequestUrl(config, deploymentName);
    const body = applyReasoningEffort({ messages }, deploymentName, reasoningEffort);

    console.log(`[Azure OpenAI] Sending chat request to deployment ${deploymentName}...`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Azure OpenAI chat call failed for ${deploymentName}: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

export async function runAgentLoopAzure({
    config,
    userPrompt,
    systemInstruction,
    toolImplementations,
    azureTools,
    deploymentName,
    reasoningEffort
}) {
    const { endpoint, apiKey } = config.azureOpenAI;

    if (!endpoint || !apiKey) {
        throw new Error('Azure OpenAI environment variables are missing (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY).');
    }

    const url = getAzureRequestUrl(config, deploymentName);
    const messages = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
    ];

    while (true) {
        console.log(`[Azure OpenAI] Sending request to deployment ${deploymentName}...`);

        const body = applyReasoningEffort({
            messages,
            tools: azureTools
        }, deploymentName, reasoningEffort);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Azure OpenAI API request failed with status ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        const assistantMessage = choice?.message;

        if (!assistantMessage) {
            throw new Error('Invalid response format received from Azure OpenAI.');
        }

        messages.push(assistantMessage);

        const toolCalls = assistantMessage.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
                const { id, function: fn } = toolCall;
                const { name, arguments: argsString } = fn;

                let parsedArgs = {};
                try {
                    parsedArgs = JSON.parse(argsString);
                } catch {
                    console.error('[Azure OpenAI] Failed to parse tool arguments:', argsString);
                }

                console.log(`[Agent Action] Calling tool (Azure): ${name} with args:`, parsedArgs);

                let result;
                try {
                    result = await toolImplementations[name](parsedArgs);
                } catch (err) {
                    console.error(`[Agent Action Error] Tool ${name} failed:`, err.message);
                    result = { error: err.message };
                }

                messages.push({
                    role: 'tool',
                    tool_call_id: id,
                    name,
                    content: JSON.stringify(result)
                });
            }

            continue;
        }

        return assistantMessage.content || '';
    }
}
