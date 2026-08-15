import { createContextualPrompt } from './conversationContext.js';
import { createPlanPrompt } from './planner.js';
import { SYSTEM_INSTRUCTION } from './prompts.js';
import { runAgentLoopAzure } from '../llm/azureOpenAIClient.js';
import { runAgentLoopGemini } from '../llm/geminiClient.js';
import { runAgentLoopGroq } from '../llm/groqClient.js';
import { runAgentLoopInception } from '../llm/inceptionClient.js';
import { runAgentLoopSarvam } from '../llm/sarvamClient.js';
import { runAgentLoopArcee } from '../llm/arceeClient.js';
import { runAgentLoopLongcat } from '../llm/longcatClient.js';
import { runAgentLoopThinkingMachine } from '../llm/thinkingMachineClient.js';
import { callModelChat, isGeminiModel, runDeciderAgent } from '../llm/modelRouter.js';
import { azureTools, openAICompatibleTools, selectRelevantOpenAITools } from '../tools/adapters/azureTools.js';
import { geminiTools } from '../tools/adapters/geminiTools.js';
import { createToolRegistry } from '../tools/registry.js';
import { resolvePath } from '../utils/paths.js';

const defaultAgentDependencies = {
    callModelChat,
    runAgentLoopAzure,
    runAgentLoopGemini,
    runAgentLoopGroq,
    runAgentLoopInception,
    runAgentLoopSarvam,
    runAgentLoopArcee,
    runAgentLoopLongcat,
    runAgentLoopThinkingMachine,
    runDeciderAgent
};

function logAgentStatus(message) {
    console.log(`[Agent Status] ${message}`);
}

function logAgentWarning(message) {
    console.warn(`[Agent Warning] ${message}`);
}

function summarizePlan(plan) {
    const previewLimit = 500;
    const preview = plan.length > previewLimit
        ? `${plan.slice(0, previewLimit)}\n[truncated]`
        : plan;

    return `Plan drafted (${plan.length} chars):\n${preview}`;
}

export async function runAgent({
    userPrompt,
    chatId,
    conversationHistory = [],
    knowledgeMemory = [],
    userProfileStore,
    conversationHistoryStore,
    knowledgeMemoryStore,
    bot,
    config,
    ai,
    reminderScheduler,
    approvalManager,
    agentDependencies = defaultAgentDependencies
}) {
    const resolveToolPath = inputPath => resolvePath(inputPath, config?.targetProjectPath);
    const toolImplementations = createToolRegistry({
        bot,
        chatId,
        resolveToolPath,
        ai,
        config,
        reminderScheduler,
        approvalManager,
        userProfileStore,
        knowledgeMemoryStore,
        conversationHistoryStore
    });
    const contextualPrompt = createContextualPrompt({
        userPrompt,
        conversationHistory,
        knowledgeMemory,
        userProfile: userProfileStore,
        config
    });

    console.log('[Agent] Starting loop using primary model: gemini-2.5-flash');

    return runAgentWithFallback({
        ai,
        config,
        userPrompt: contextualPrompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        toolImplementations,
        agentDependencies
    });
}

function buildProviderCascade({
    ai,
    config,
    userPrompt,
    systemInstruction,
    toolImplementations,
    agentDependencies,
    primaryModelName
}) {
    const providers = [];
    const relevantOpenAITools = selectRelevantOpenAITools(userPrompt, openAICompatibleTools);

    // 1. Gemini
    const geminiModel = (primaryModelName && isGeminiModel(primaryModelName)) ? primaryModelName : 'gemini-2.5-flash';
    const hasGemini = Boolean(ai || config.geminiApiKey);
    if (hasGemini && agentDependencies.runAgentLoopGemini) {
        providers.push({
            id: 'gemini',
            name: 'Gemini',
            model: geminiModel,
            runner: () => agentDependencies.runAgentLoopGemini({
                ai,
                userPrompt,
                systemInstruction,
                toolImplementations,
                geminiTools,
                modelName: geminiModel
            })
        });
    }

    // 2. Groq
    const groqModel = config.groq?.model || 'llama-3.3-70b-versatile';
    if (config.groq?.apiKey && agentDependencies.runAgentLoopGroq) {
        providers.push({
            id: 'groq',
            name: 'Groq',
            model: groqModel,
            runner: () => agentDependencies.runAgentLoopGroq({
                config,
                userPrompt,
                systemInstruction,
                toolImplementations,
                groqTools: relevantOpenAITools,
                modelName: groqModel
            })
        });
    }

    // 3. Inception
    const inceptionModel = config.inception?.model || 'mercury-2';
    if (config.inception?.apiKey && agentDependencies.runAgentLoopInception) {
        providers.push({
            id: 'inception',
            name: 'Inception',
            model: inceptionModel,
            runner: () => agentDependencies.runAgentLoopInception({
                config,
                userPrompt,
                systemInstruction,
                toolImplementations,
                inceptionTools: relevantOpenAITools,
                modelName: inceptionModel
            })
        });
    }

    // 4. Sarvam
    const sarvamModel = config.sarvam?.model || 'sarvam-105b';
    if (config.sarvam?.apiKey && agentDependencies.runAgentLoopSarvam) {
        providers.push({
            id: 'sarvam',
            name: 'Sarvam',
            model: sarvamModel,
            runner: () => agentDependencies.runAgentLoopSarvam({
                config,
                userPrompt,
                systemInstruction,
                toolImplementations,
                sarvamTools: relevantOpenAITools,
                modelName: sarvamModel
            })
        });
    }

    // 5. Arcee
    const arceeModel = config.arcee?.model || 'zai-org/glm-5.2';
    if (config.arcee?.apiKey && agentDependencies.runAgentLoopArcee) {
        providers.push({
            id: 'arcee',
            name: 'Arcee',
            model: arceeModel,
            runner: () => agentDependencies.runAgentLoopArcee({
                config,
                userPrompt,
                systemInstruction,
                toolImplementations,
                arceeTools: relevantOpenAITools,
                modelName: arceeModel
            })
        });
    }

    // 6. LongCat
    const longcatModel = config.longcat?.model || 'LongCat-2.0';
    if (config.longcat?.apiKey && agentDependencies.runAgentLoopLongcat) {
        providers.push({
            id: 'longcat',
            name: 'LongCat',
            model: longcatModel,
            runner: () => agentDependencies.runAgentLoopLongcat({
                config,
                userPrompt,
                systemInstruction,
                toolImplementations,
                longcatTools: relevantOpenAITools,
                modelName: longcatModel
            })
        });
    }

    // 7. Thinking Machine
    const thinkingMachineModel = config.thinkingMachine?.model || 'inkling';
    if (config.thinkingMachine?.apiKey && agentDependencies.runAgentLoopThinkingMachine) {
        providers.push({
            id: 'thinkingMachine',
            name: 'Thinking Machine',
            model: thinkingMachineModel,
            runner: () => agentDependencies.runAgentLoopThinkingMachine({
                config,
                userPrompt,
                systemInstruction,
                toolImplementations,
                thinkingMachineTools: relevantOpenAITools,
                modelName: thinkingMachineModel
            })
        });
    }

    // 8. Azure OpenAI
    const azureDeployment = config.azureOpenAI?.deployment || 'gpt-5.5';
    if (config.azureOpenAI?.apiKey && config.azureOpenAI?.endpoint && agentDependencies.runAgentLoopAzure) {
        providers.push({
            id: 'azure',
            name: 'Azure OpenAI',
            model: azureDeployment,
            runner: () => agentDependencies.runAgentLoopAzure({
                config,
                userPrompt,
                systemInstruction,
                toolImplementations,
                azureTools,
                deploymentName: azureDeployment,
                reasoningEffort: 'low'
            })
        });
    }

    return providers;
}

export async function runAgentWithFallback({
    ai,
    config,
    userPrompt,
    systemInstruction,
    toolImplementations,
    agentDependencies,
    modelName = 'gemini-2.5-flash'
}) {
    const providers = buildProviderCascade({
        ai,
        config,
        userPrompt,
        systemInstruction,
        toolImplementations,
        agentDependencies,
        primaryModelName: modelName
    });

    if (providers.length === 0) {
        throw new Error('No LLM providers are configured for agent loop execution.');
    }

    const errors = [];

    for (let i = 0; i < providers.length; i++) {
        const current = providers[i];
        const next = providers[i + 1];

        try {
            return await current.runner();
        } catch (err) {
            errors.push(`${current.name} (${current.model}): ${err.message}`);

            if (next) {
                logAgentWarning(
                    `${current.name} model ${current.model} failed (${err.message}). Falling back to ${next.name} model ${next.model}.`
                );
            } else {
                logAgentWarning(
                    `${current.name} model ${current.model} failed (${err.message}). No further fallback providers available.`
                );
            }
        }
    }

    throw new Error(`All LLM fallback providers failed in agent loop:\n${errors.map(e => `- ${e}`).join('\n')}`);
}

// Alias for backwards compatibility if needed
export const runAgentLoopGeminiWithGroqFallback = runAgentWithFallback;

export async function draftExecutionPlan({ userPrompt, config, ai, selectedModel, reasoningEffort, agentDependencies }) {
    try {
        logAgentStatus(`${selectedModel} is drafting the implementation plan.`);
        const plan = await agentDependencies.callModelChat({
            ai,
            config,
            modelName: selectedModel,
            messages: createPlanPrompt(userPrompt),
            reasoningEffort
        });

        logAgentStatus(summarizePlan(plan));
        return plan;
    } catch (planErr) {
        console.error('[Planning Error] Failed to generate plan:', planErr.message);
        logAgentWarning(`Planning failed with ${selectedModel} (${planErr.message}). Falling back to gemini-2.5-flash.`);

        try {
            const plan = await agentDependencies.callModelChat({
                ai,
                config,
                modelName: 'gemini-2.5-flash',
                messages: createPlanPrompt(userPrompt),
                reasoningEffort
            });
            logAgentStatus(`Fallback ${summarizePlan(plan)}`);
            return plan;
        } catch {
            return 'Proceeding without formal plan due to fallback error.';
        }
    }
}
