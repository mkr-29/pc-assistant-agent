import { createApp } from './app.js';
import { createConversationHistoryStore } from './agent/conversationHistoryStore.js';
import { createKnowledgeMemoryStore } from './agent/knowledgeMemoryStore.js';
import { createTelegramApprovalManager } from './approvals/telegramApprovalManager.js';
import { runAgent } from './agent/runAgent.js';
import { loadConfig, validateConfig } from './config/env.js';
import { createGeminiClient } from './llm/geminiClient.js';
import { createReminderScheduler } from './reminders/reminderScheduler.js';
import { createReminderStore } from './reminders/reminderStore.js';
import { startHttpServer } from './server/httpServer.js';
import { createBotClient, shouldUsePolling, startPolling } from './telegram/botClient.js';
import { createTelegramMessageHandler } from './telegram/messageHandler.js';
import { createTelegramVoiceNoteTranscriber } from './telegram/voiceNotes.js';

const config = loadConfig();
validateConfig(config);

const bot = createBotClient(config);
const ai = createGeminiClient(config);
const conversationHistoryStore = createConversationHistoryStore();
const knowledgeMemoryStore = createKnowledgeMemoryStore();
const approvalManager = createTelegramApprovalManager({
    bot,
    timeoutMs: config.saferCommandApprovals.timeoutMs
});
const voiceNoteTranscriber = createTelegramVoiceNoteTranscriber({ bot, ai, config });
const reminderStore = createReminderStore();
let reminderScheduler;

async function runScheduledAgentTask({ chatId, prompt, task }) {
    const scheduledPrompt = [
        `Scheduled task: ${task.title}`,
        '',
        prompt
    ].join('\n');
    const conversationHistory = conversationHistoryStore.getHistory(chatId);
    const knowledgeMemory = knowledgeMemoryStore.listMemories();
    const finalOutcome = await runAgent({
        userPrompt: scheduledPrompt,
        chatId,
        conversationHistory,
        knowledgeMemory,
        bot,
        config,
        ai,
        reminderScheduler,
        approvalManager
    });

    conversationHistoryStore.appendTurn(chatId, scheduledPrompt, finalOutcome);
    return finalOutcome;
}

reminderScheduler = createReminderScheduler({
    store: reminderStore,
    bot,
    runScheduledAgentTask
});

const handleTelegramMessage = createTelegramMessageHandler({
    bot,
    config,
    conversationHistoryStore,
    knowledgeMemoryStore,
    approvalManager,
    voiceNoteTranscriber,
    runAgent: ({ userPrompt, chatId, conversationHistory, knowledgeMemory }) => runAgent({
        userPrompt,
        chatId,
        conversationHistory,
        knowledgeMemory,
        bot,
        config,
        ai,
        reminderScheduler,
        approvalManager
    })
});

const app = createApp({ handleTelegramMessage });

if (shouldUsePolling(config)) {
    startPolling({ bot, handleTelegramMessage });
}

reminderScheduler.start();

startHttpServer(app, config.port);
