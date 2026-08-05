import { resolveBasePath } from '../utils/paths.js';

const DEFAULT_HISTORY_CHARACTER_BUDGET = 16000;
const DEFAULT_MEMORY_CHARACTER_BUDGET = 4000;

function truncateText(value, maxLength) {
    const text = String(value || '');
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, Math.max(0, maxLength - 15))}\n[truncated]`;
}

function getLocalTimeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local system timezone';
}

export function buildLocalLaptopContext(config, { currentDate = new Date() } = {}) {
    const configuredTargetPath = config?.targetProjectPath || '~';
    const resolvedTargetPath = resolveBasePath(configuredTargetPath);

    return [
        `Configured target project path: ${configuredTargetPath}`,
        `Resolved target project path: ${resolvedTargetPath}`,
        `Process working directory: ${process.cwd()}`,
        `Current local time: ${currentDate.toString()}`,
        `Current ISO time: ${currentDate.toISOString()}`,
        `Local timezone: ${getLocalTimeZone()}`,
        'Available capabilities: read files, write files, list directories, execute terminal commands, schedule Telegram reminders, run scheduled agent tasks, and send local files through Telegram'
    ];
}

export function formatConversationHistory(
    conversationHistory = [],
    { maxCharacters = DEFAULT_HISTORY_CHARACTER_BUDGET } = {}
) {
    if (!Array.isArray(conversationHistory) || conversationHistory.length === 0) {
        return 'No previous conversation in this Telegram chat.';
    }

    const selectedTurns = [];
    let usedCharacters = 0;

    for (let index = conversationHistory.length - 1; index >= 0; index -= 1) {
        const turn = conversationHistory[index];
        const turnText = [
            `Turn ${index + 1}${turn.timestamp ? ` (${turn.timestamp})` : ''}`,
            `User: ${turn.userPrompt || ''}`,
            `Assistant: ${turn.assistantResponse || ''}`
        ].join('\n');

        const nextLength = usedCharacters + turnText.length + 2;
        if (selectedTurns.length > 0 && nextLength > maxCharacters) {
            break;
        }

        selectedTurns.unshift(nextLength > maxCharacters ? truncateText(turnText, maxCharacters) : turnText);
        usedCharacters += selectedTurns[0].length + 2;
    }

    return selectedTurns.join('\n\n');
}

export function formatKnowledgeMemory(
    knowledgeMemory = [],
    { maxCharacters = DEFAULT_MEMORY_CHARACTER_BUDGET } = {}
) {
    if (!Array.isArray(knowledgeMemory) || knowledgeMemory.length === 0) {
        return 'No long-term knowledge memory has been saved.';
    }

    const selectedMemories = [];
    let usedCharacters = 0;

    for (let index = knowledgeMemory.length - 1; index >= 0; index -= 1) {
        const memory = knowledgeMemory[index];
        const memoryText = `- ${memory.id || `memory-${index + 1}`}: ${memory.fact || ''}`;
        const nextLength = usedCharacters + memoryText.length + 1;

        if (selectedMemories.length > 0 && nextLength > maxCharacters) {
            break;
        }

        selectedMemories.unshift(nextLength > maxCharacters ? truncateText(memoryText, maxCharacters) : memoryText);
        usedCharacters += selectedMemories[0].length + 1;
    }

    return selectedMemories.join('\n');
}

export function createContextualPrompt({
    userPrompt,
    conversationHistory = [],
    knowledgeMemory = [],
    config,
    currentDate = new Date(),
    maxHistoryCharacters = DEFAULT_HISTORY_CHARACTER_BUDGET,
    maxMemoryCharacters = DEFAULT_MEMORY_CHARACTER_BUDGET
}) {
    return [
        'Use the following Telegram conversation history, long-term knowledge memory, and local laptop context when it is relevant.',
        'If previous conversation conflicts with the current user request, follow the current user request.',
        '',
        '## Local laptop context',
        ...buildLocalLaptopContext(config, { currentDate }).map(item => `- ${item}`),
        '',
        '## Long-term knowledge memory',
        formatKnowledgeMemory(knowledgeMemory, { maxCharacters: maxMemoryCharacters }),
        '',
        '## Previous conversation',
        formatConversationHistory(conversationHistory, { maxCharacters: maxHistoryCharacters }),
        '',
        '## Current user request',
        userPrompt
    ].join('\n');
}
