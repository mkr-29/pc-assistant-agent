import { callAzureOpenAIChat } from './azureOpenAIClient.js';
import { callGeminiChat } from './geminiClient.js';
import { callGroqChat } from './groqClient.js';
import { callInceptionChat } from './inceptionClient.js';
import { callSarvamChat } from './sarvamClient.js';
import { callArceeChat } from './arceeClient.js';
import { callLongcatChat } from './longcatClient.js';
import { callThinkingMachineChat } from './thinkingMachineClient.js';
import { ROUTER_SYSTEM_INSTRUCTION } from '../agent/prompts.js';

export function isGeminiModel(modelName) {
    return typeof modelName === 'string' && modelName.startsWith('gemini');
}

export function getProviderList(config, ai, requestedModel = null) {
    const providers = [];

    // Helper to add if configured
    const addProvider = (id, name, model, isConfigured, caller) => {
        if (isConfigured) {
            providers.push({ id, name, model, caller });
        }
    };

    const hasGemini = Boolean(ai || config.geminiApiKey);
    const geminiModel = isGeminiModel(requestedModel) ? requestedModel : 'gemini-2.5-flash';
    addProvider('gemini', 'Gemini', geminiModel, hasGemini, ({ messages }) =>
        callGeminiChat({ ai, modelName: geminiModel, messages })
    );

    const hasGroq = Boolean(config.groq?.apiKey);
    const groqModel = config.groq?.model || 'llama-3.3-70b-versatile';
    addProvider('groq', 'Groq', groqModel, hasGroq, ({ messages }) =>
        callGroqChat({ config, messages, modelName: groqModel })
    );

    const hasInception = Boolean(config.inception?.apiKey);
    const inceptionModel = config.inception?.model || 'mercury-2';
    addProvider('inception', 'Inception', inceptionModel, hasInception, ({ messages }) =>
        callInceptionChat({ config, messages, modelName: inceptionModel })
    );

    const hasSarvam = Boolean(config.sarvam?.apiKey);
    const sarvamModel = config.sarvam?.model || 'sarvam-105b';
    addProvider('sarvam', 'Sarvam', sarvamModel, hasSarvam, ({ messages }) =>
        callSarvamChat({ config, messages, modelName: sarvamModel })
    );

    const hasArcee = Boolean(config.arcee?.apiKey);
    const arceeModel = config.arcee?.model || 'zai-org/glm-5.2';
    addProvider('arcee', 'Arcee', arceeModel, hasArcee, ({ messages }) =>
        callArceeChat({ config, messages, modelName: arceeModel })
    );

    const hasLongcat = Boolean(config.longcat?.apiKey);
    const longcatModel = config.longcat?.model || 'LongCat-2.0';
    addProvider('longcat', 'LongCat', longcatModel, hasLongcat, ({ messages }) =>
        callLongcatChat({ config, messages, modelName: longcatModel })
    );

    const hasThinkingMachine = Boolean(config.thinkingMachine?.apiKey);
    const thinkingMachineModel = config.thinkingMachine?.model || 'inkling';
    addProvider('thinkingMachine', 'Thinking Machine', thinkingMachineModel, hasThinkingMachine, ({ messages }) =>
        callThinkingMachineChat({ config, messages, modelName: thinkingMachineModel })
    );

    const hasAzure = Boolean(config.azureOpenAI?.apiKey && config.azureOpenAI?.endpoint);
    const azureDeployment = config.azureOpenAI?.deployment || 'gpt-5.5';
    addProvider('azure', 'Azure OpenAI', azureDeployment, hasAzure, ({ messages, reasoningEffort }) =>
        callAzureOpenAIChat({ config, deploymentName: azureDeployment, messages, reasoningEffort })
    );

    return providers;
}

export async function callModelChat({ ai, config, modelName, messages, reasoningEffort = null }) {
    const providers = getProviderList(config, ai, modelName);

    if (providers.length === 0) {
        throw new Error('No LLM providers are configured. Set at least one LLM API key in .env.');
    }

    // Reorder providers if a specific model was requested that matches a provider other than the first
    let orderedProviders = [...providers];
    if (modelName) {
        const matchIdx = orderedProviders.findIndex(
            p => p.model === modelName || (p.id === 'azure' && !isGeminiModel(modelName))
        );
        if (matchIdx > 0) {
            const [matched] = orderedProviders.splice(matchIdx, 1);
            orderedProviders.unshift(matched);
        }
    }

    const errors = [];

    for (let i = 0; i < orderedProviders.length; i++) {
        const current = orderedProviders[i];
        const next = orderedProviders[i + 1];

        try {
            return await current.caller({ messages, reasoningEffort });
        } catch (err) {
            errors.push(`${current.name} (${current.model}): ${err.message}`);

            if (next) {
                console.warn(
                    `[Model Router] ${current.name} model ${current.model} failed (${err.message}). Falling back to ${next.name} model ${next.model}.`
                );
            } else {
                console.warn(
                    `[Model Router] ${current.name} model ${current.model} failed (${err.message}). No further fallback providers available.`
                );
            }
        }
    }

    throw new Error(`All LLM fallback providers failed:\n${errors.map(e => `- ${e}`).join('\n')}`);
}

export async function runDeciderAgent({ ai, config, userPrompt }) {
    const messages = [
        { role: 'system', content: ROUTER_SYSTEM_INSTRUCTION },
        { role: 'user', content: userPrompt }
    ];

    const content = await callModelChat({
        ai,
        config,
        modelName: config.azureOpenAI?.deployment || 'gemini-2.5-flash',
        messages,
        reasoningEffort: 'low'
    });

    console.log(`[Decider Agent] Raw Response: ${content}`);

    try {
        return JSON.parse(content);
    } catch {
        const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    }
}
