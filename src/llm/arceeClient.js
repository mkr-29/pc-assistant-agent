import { callOpenAICompatibleChat, runAgentLoopOpenAICompatible } from './openAICompatibleClient.js';

function getArceeConfig(config, modelName) {
    const apiKey = config.arcee?.apiKey;
    const baseUrl = config.arcee?.baseUrl || 'https://api.arcee.ai/api/v1';
    const model = modelName || config.arcee?.model || 'zai-org/glm-5.2';

    if (!apiKey) {
        throw new Error('Arcee is not configured. Set ARCEE_API_KEY to use Arcee models.');
    }

    return { apiKey, baseUrl, model };
}

export async function callArceeChat({ config, messages, modelName, fetchFn }) {
    const { apiKey, baseUrl, model } = getArceeConfig(config, modelName);

    return callOpenAICompatibleChat({
        providerName: 'Arcee',
        baseUrl,
        apiKey,
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        messages,
        modelName: model,
        fetchFn
    });
}

export async function runAgentLoopArcee({
    config,
    userPrompt,
    systemInstruction,
    toolImplementations,
    arceeTools,
    modelName,
    fetchFn
}) {
    const { apiKey, baseUrl, model } = getArceeConfig(config, modelName);

    return runAgentLoopOpenAICompatible({
        providerName: 'Arcee',
        baseUrl,
        apiKey,
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        userPrompt,
        systemInstruction,
        toolImplementations,
        tools: arceeTools,
        modelName: model,
        fallbackModels: ['zai-org/glm-5.2', 'trinity-mini'],
        fetchFn
    });
}
