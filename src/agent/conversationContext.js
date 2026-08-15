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

export function extractKeywords(text) {
    if (!text || typeof text !== 'string') return [];
    const stopWords = new Set([
        'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'with', 'from',
        'what', 'how', 'when', 'where', 'who', 'why', 'can', 'you', 'please', 'tell', 'me', 'about',
        'this', 'that', 'these', 'those', 'are', 'was', 'were', 'been', 'will', 'would', 'should'
    ]);

    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 3 && !stopWords.has(word));
}

export function scoreTurnRelevance(turn, queryKeywords) {
    if (!turn) return 0;
    let score = 0;

    // High importance turns receive baseline boost
    if (turn.importance === 'high') {
        score += 5;
    } else if (turn.importance === 'ephemeral') {
        return 0;
    }

    if (!queryKeywords || queryKeywords.length === 0) return score;

    const content = `${turn.userPrompt || ''} ${turn.assistantResponse || ''}`.toLowerCase();
    for (const word of queryKeywords) {
        if (word.length < 3) continue;
        if (content.includes(word)) {
            score += word.length > 5 ? 3 : 2;
        }
    }

    // Entity matching boost
    if (Array.isArray(turn.entities)) {
        for (const entity of turn.entities) {
            const lowerEntity = entity.toLowerCase();
            if (queryKeywords.some(k => lowerEntity.includes(k))) {
                score += 4;
            }
        }
    }

    return score;
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
    { maxCharacters = DEFAULT_HISTORY_CHARACTER_BUDGET, userPrompt = '' } = {}
) {
    if (!Array.isArray(conversationHistory) || conversationHistory.length === 0) {
        return 'No previous conversation in this Telegram chat.';
    }

    const keywords = extractKeywords(userPrompt);
    const totalTurns = conversationHistory.length;

    const turnsToInclude = new Map();
    let usedChars = 0;

    const maxRecent = Math.min(4, totalTurns);
    for (let i = totalTurns - 1; i >= totalTurns - maxRecent; i--) {
        const turn = conversationHistory[i];
        // Skip ephemeral filler unless it is the very latest turn
        if (turn.importance === 'ephemeral' && i !== totalTurns - 1) {
            continue;
        }

        const turnText = `[Turn ${i + 1}${turn.timestamp ? ` (${turn.timestamp})` : ''}]\nUser: ${turn.userPrompt || ''}\nAssistant: ${turn.assistantResponse || ''}`;
        const nextLen = usedChars + turnText.length + 4;
        if (turnsToInclude.size > 0 && nextLen > maxCharacters) {
            break;
        }
        turnsToInclude.set(i, nextLen > maxCharacters ? truncateText(turnText, maxCharacters) : turnText);
        usedChars += turnsToInclude.get(i).length + 4;
    }

    if (keywords.length > 0) {
        const relevantOlderTurns = [];
        for (let i = 0; i < totalTurns - maxRecent; i++) {
            const turn = conversationHistory[i];
            const score = scoreTurnRelevance(turn, keywords);
            if (score > 0) {
                relevantOlderTurns.push({ index: i, turn, score });
            }
        }
        relevantOlderTurns.sort((a, b) => b.score - a.score);

        for (const item of relevantOlderTurns) {
            const turnText = `[Turn ${item.index + 1} (Relevant Past Context)${item.turn.timestamp ? ` (${item.turn.timestamp})` : ''}]\nUser: ${item.turn.userPrompt || ''}\nAssistant: ${item.turn.assistantResponse || ''}`;
            if (usedChars + turnText.length + 4 > maxCharacters) {
                break;
            }
            turnsToInclude.set(item.index, turnText);
            usedChars += turnText.length + 4;
        }
    }

    const sortedIndices = Array.from(turnsToInclude.keys()).sort((a, b) => a - b);
    const formattedTurns = sortedIndices.map(idx => turnsToInclude.get(idx));

    return formattedTurns.join('\n\n');
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
    userProfile,
    config,
    currentDate = new Date(),
    maxHistoryCharacters = DEFAULT_HISTORY_CHARACTER_BUDGET,
    maxMemoryCharacters = DEFAULT_MEMORY_CHARACTER_BUDGET
}) {
    let formattedProfile = 'No user profile information recorded yet.';
    if (userProfile) {
        if (typeof userProfile.formatForPrompt === 'function') {
            formattedProfile = userProfile.formatForPrompt();
        } else if (typeof userProfile === 'string') {
            formattedProfile = userProfile;
        }
    }

    return [
        'Use the following User Profile, long-term learned knowledge, Telegram conversation history, and local laptop context to provide highly personalized, persistent assistance.',
        'Always remember and apply the user\'s preferences, workflows, personal facts, and habits.',
        'If previous conversation conflicts with the current user request, follow the current user request.',
        '',
        '## User Profile & Learned Facts (What you know about the user)',
        formattedProfile,
        '',
        '## Local laptop context',
        ...buildLocalLaptopContext(config, { currentDate }).map(item => `- ${item}`),
        '',
        '## Long-term knowledge memory',
        formatKnowledgeMemory(knowledgeMemory, { maxCharacters: maxMemoryCharacters }),
        '',
        '## Relevant Conversation History',
        formatConversationHistory(conversationHistory, { maxCharacters: maxHistoryCharacters, userPrompt }),
        '',
        '## Current user request',
        userPrompt
    ].join('\n');
}
