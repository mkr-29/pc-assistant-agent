import { callAzureOpenAIChat } from './azureOpenAIClient.js';
import { callGeminiChat } from './geminiClient.js';
import { callGroqChat } from './groqClient.js';
import { callInceptionChat } from './inceptionClient.js';
import { ROUTER_SYSTEM_INSTRUCTION } from '../agent/prompts.js';

export function isGeminiModel(modelName) {
    return modelName.startsWith('gemini');
}

export async function callModelChat({ ai, config, modelName, messages, reasoningEffort = null }) {
    if (isGeminiModel(modelName)) {
        try {
            return await callGeminiChat({ ai, modelName, messages });
        } catch (err) {
            console.warn(
                `[Model Router] Gemini model ${modelName} failed (${err.message}). Falling back to Groq model ${config.groq?.model}.`
            );
            try {
                return await callGroqChat({ config, messages });
            } catch (groqErr) {
                console.warn(
                    `[Model Router] Groq model ${config.groq?.model} failed (${groqErr.message}). Falling back to Inception model ${config.inception?.model}.`
                );
                return callInceptionChat({ config, messages });
            }
        }
    }

    return callAzureOpenAIChat({
        config,
        deploymentName: modelName,
        messages,
        reasoningEffort
    });
}

export async function runDeciderAgent({ ai, config, userPrompt }) {
    const messages = [
        { role: 'system', content: ROUTER_SYSTEM_INSTRUCTION },
        { role: 'user', content: userPrompt }
    ];

    const content = await callModelChat({
        ai,
        config,
        modelName: config.azureOpenAI.deployment,
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
