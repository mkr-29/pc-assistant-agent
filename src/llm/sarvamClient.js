import { callOpenAICompatibleChat, runAgentLoopOpenAICompatible } from './openAICompatibleClient.js';

function getSarvamConfig(config, modelName) {
    const apiKey = config.sarvam?.apiKey;
    const baseUrl = config.sarvam?.baseUrl || 'https://api.sarvam.ai/v1';
    const model = modelName || config.sarvam?.model || 'sarvam-105b';

    if (!apiKey) {
        throw new Error('Sarvam is not configured. Set SARVAM_API_KEY to use Sarvam models.');
    }

    return { apiKey, baseUrl, model };
}

export async function callSarvamChat({ config, messages, modelName, fetchFn }) {
    const { apiKey, baseUrl, model } = getSarvamConfig(config, modelName);

    return callOpenAICompatibleChat({
        providerName: 'Sarvam',
        baseUrl,
        apiKey,
        authHeader: 'api-subscription-key',
        authPrefix: '',
        customHeaders: {
            Authorization: `Bearer ${apiKey}`
        },
        messages,
        modelName: model,
        fetchFn
    });
}

export async function runAgentLoopSarvam({
    config,
    userPrompt,
    systemInstruction,
    toolImplementations,
    sarvamTools,
    modelName,
    fetchFn
}) {
    const { apiKey, baseUrl, model } = getSarvamConfig(config, modelName);

    return runAgentLoopOpenAICompatible({
        providerName: 'Sarvam',
        baseUrl,
        apiKey,
        authHeader: 'api-subscription-key',
        authPrefix: '',
        customHeaders: {
            Authorization: `Bearer ${apiKey}`
        },
        userPrompt,
        systemInstruction,
        toolImplementations,
        tools: sarvamTools,
        modelName: model,
        fallbackModels: ['sarvam-105b', 'sarvam-105b-conversations'],
        fetchFn
    });
}
