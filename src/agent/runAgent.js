import { createContextualPrompt } from './conversationContext.js';
import { createPlanPrompt } from './planner.js';
import { SYSTEM_INSTRUCTION } from './prompts.js';
import { runAgentLoopAzure } from '../llm/azureOpenAIClient.js';
import { runAgentLoopGemini } from '../llm/geminiClient.js';
import { runAgentLoopGroq } from '../llm/groqClient.js';
import { runAgentLoopInception } from '../llm/inceptionClient.js';
import { isRateLimitError } from '../llm/errorUtils.js';
import { callModelChat, isGeminiModel, runDeciderAgent } from '../llm/modelRouter.js';
import { azureTools, openAICompatibleTools } from '../tools/adapters/azureTools.js';
import { geminiTools } from '../tools/adapters/geminiTools.js';
import { createToolRegistry } from '../tools/registry.js';
import { resolvePath } from '../utils/paths.js';

const defaultAgentDependencies = {
    callModelChat,
    runAgentLoopAzure,
    runAgentLoopGemini,
    runAgentLoopGroq,
    runAgentLoopInception,
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
    bot,
    config,
    ai,
    reminderScheduler,
    approvalManager,
    agentDependencies = defaultAgentDependencies
}) {
    const resolveToolPath = inputPath => resolvePath(inputPath, config.targetProjectPath);
    const toolImplementations = createToolRegistry({
        bot,
        chatId,
        resolveToolPath,
        ai,
        config,
        reminderScheduler,
        approvalManager
    });
    const contextualPrompt = createContextualPrompt({ userPrompt, conversationHistory, knowledgeMemory, config });

    console.log('[Agent] Starting loop using primary model: gemini-2.5-flash');

    return runAgentLoopGeminiWithGroqFallback({
        ai,
        config,
        userPrompt: contextualPrompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        toolImplementations,
        agentDependencies
    });
}

async function runAgentWithAzureRouting({
    contextualPrompt,
    config,
    ai,
    toolImplementations,
    agentDependencies
}) {
    let selectedModel = config.azureOpenAI.deployment;
    let reasoningEffort = 'low';
    let rationale = 'Default fallback';
    let needsPlanning = true;

    try {
        logAgentStatus('Routing agent is selecting the best model.');
        const decision = await agentDependencies.runDeciderAgent({ ai, config, userPrompt: contextualPrompt });
        selectedModel = decision.selectedModel || config.azureOpenAI.deployment;
        reasoningEffort = decision.reasoningEffort || 'low';
        rationale = decision.rationale || '';
        needsPlanning = decision.needsPlanning !== undefined ? decision.needsPlanning : true;

        if (decision.directAnswer) {
            console.log(`[Decider Agent] Direct answer provided: ${decision.directAnswer}`);
            return decision.directAnswer;
        }

        logAgentStatus(
            `Model selected: ${selectedModel}; reasoningEffort=${reasoningEffort}; needsPlanning=${needsPlanning}; rationale=${rationale}`
        );
    } catch (deciderErr) {
        console.error('[Decider Agent Error] Failed to decide model:', deciderErr.message);
        logAgentWarning(
            `Decider failed (${deciderErr.message}). Defaulting to ${config.azureOpenAI.deployment} with low reasoning and planning enabled.`
        );
    }

    const plan = needsPlanning
        ? await draftExecutionPlan({
            userPrompt: contextualPrompt,
            config,
            ai,
            selectedModel,
            reasoningEffort,
            agentDependencies
        })
        : '';

    const executionPrompt = needsPlanning
        ? `Here is the full context and current user task:\n\n${contextualPrompt}\n\nHere is your approved implementation plan to execute:\n${plan}\n\nExecute the plan step-by-step using your tools.`
        : contextualPrompt;

    try {
        logAgentStatus(`Execution starting using ${selectedModel}.`);

        if (isGeminiModel(selectedModel)) {
            return runAgentLoopGeminiWithGroqFallback({
                ai,
                config,
                userPrompt: executionPrompt,
                systemInstruction: SYSTEM_INSTRUCTION,
                toolImplementations,
                agentDependencies,
                modelName: selectedModel
            });
        }

        return agentDependencies.runAgentLoopAzure({
            config,
            userPrompt: executionPrompt,
            systemInstruction: SYSTEM_INSTRUCTION,
            toolImplementations,
            azureTools,
            deploymentName: selectedModel,
            reasoningEffort
        });
    } catch (execErr) {
        if (isGeminiModel(selectedModel) && !isRateLimitError(execErr)) {
            throw execErr;
        }

        console.error('[Execution Error] Failed with selected model:', execErr.message);
        logAgentWarning(
            `Execution failed with ${selectedModel} (${execErr.message}). Retrying with fallback model gemini-2.5-flash.`
        );

        return runAgentLoopGeminiWithGroqFallback({
            ai,
            config,
            userPrompt: executionPrompt,
            systemInstruction: SYSTEM_INSTRUCTION,
            toolImplementations,
            agentDependencies,
            modelName: 'gemini-2.5-flash'
        });
    }
}

async function runAgentLoopGeminiWithGroqFallback({
    ai,
    config,
    userPrompt,
    systemInstruction,
    toolImplementations,
    agentDependencies,
    modelName = 'gemini-2.5-flash'
}) {
    try {
        return await agentDependencies.runAgentLoopGemini({
            ai,
            userPrompt,
            systemInstruction,
            toolImplementations,
            geminiTools,
            modelName
        });
    } catch (err) {
        logAgentWarning(
            `Gemini model ${modelName} failed (${err.message}). Falling back to Groq model ${config.groq?.model}.`
        );

        try {
            return await agentDependencies.runAgentLoopGroq({
                config,
                userPrompt,
                systemInstruction,
                toolImplementations,
                groqTools: openAICompatibleTools,
                modelName: config.groq?.model
            });
        } catch (groqErr) {
            logAgentWarning(
                `Groq model ${config.groq?.model} failed (${groqErr.message}). Falling back to Inception model ${config.inception?.model}.`
            );

            return agentDependencies.runAgentLoopInception({
                config,
                userPrompt,
                systemInstruction,
                toolImplementations,
                inceptionTools: openAICompatibleTools,
                modelName: config.inception?.model
            });
        }
    }
}

async function draftExecutionPlan({ userPrompt, config, ai, selectedModel, reasoningEffort, agentDependencies }) {
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
