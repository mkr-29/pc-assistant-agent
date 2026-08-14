import { callOpenAICompatibleChat, runAgentLoopOpenAICompatible } from './openAICompatibleClient.js';

function getThinkingMachineConfig(config, modelName) {
    const apiKey = config.thinkingMachine?.apiKey;
    const baseUrl = config.thinkingMachine?.baseUrl || 'https://api.thinkingmachines.ai/v1';
    const model = modelName || config.thinkingMachine?.model || 'inkling';

    if (!apiKey) {
        throw new Error('Thinking Machine is not configured. Set THINKING_MACHINE_API_KEY to use Thinking Machine models.');
    }

    return { apiKey, baseUrl, model };
}

export async function callThinkingMachineChat({ config, messages, modelName, fetchFn }) {
    const { apiKey, baseUrl, model } = getThinkingMachineConfig(config, modelName);

    return callOpenAICompatibleChat({
        providerName: 'Thinking Machine',
        baseUrl,
        apiKey,
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        messages,
        modelName: model,
        fetchFn
    });
}

export async function runAgentLoopThinkingMachine({
    config,
    userPrompt,
    systemInstruction,
    toolImplementations,
    thinkingMachineTools,
    modelName,
    fetchFn
}) {
    const { apiKey, baseUrl, model } = getThinkingMachineConfig(config, modelName);

    return runAgentLoopOpenAICompatible({
        providerName: 'Thinking Machine',
        baseUrl,
        apiKey,
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        userPrompt,
        systemInstruction,
        toolImplementations,
        tools: thinkingMachineTools,
        modelName: model,
        fallbackModels: ['inkling'],
        fetchFn
    });
}
