import { callOpenAICompatibleChat, runAgentLoopOpenAICompatible } from './openAICompatibleClient.js';

function getLongcatConfig(config, modelName) {
    const apiKey = config.longcat?.apiKey;
    const baseUrl = config.longcat?.baseUrl || 'https://api.longcat.chat/openai/v1';
    const model = modelName || config.longcat?.model || 'LongCat-2.0';

    if (!apiKey) {
        throw new Error('LongCat is not configured. Set LONGCAT_API_KEY to use LongCat models.');
    }

    return { apiKey, baseUrl, model };
}

export async function callLongcatChat({ config, messages, modelName, fetchFn }) {
    const { apiKey, baseUrl, model } = getLongcatConfig(config, modelName);

    return callOpenAICompatibleChat({
        providerName: 'LongCat',
        baseUrl,
        apiKey,
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        messages,
        modelName: model,
        fetchFn
    });
}

export async function runAgentLoopLongcat({
    config,
    userPrompt,
    systemInstruction,
    toolImplementations,
    longcatTools,
    modelName,
    fetchFn
}) {
    const { apiKey, baseUrl, model } = getLongcatConfig(config, modelName);

    return runAgentLoopOpenAICompatible({
        providerName: 'LongCat',
        baseUrl,
        apiKey,
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        userPrompt,
        systemInstruction,
        toolImplementations,
        tools: longcatTools,
        modelName: model,
        fallbackModels: ['LongCat-2.0', 'LongCat-Flash-Chat'],
        fetchFn
    });
}
