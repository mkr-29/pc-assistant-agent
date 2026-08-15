import fs from 'fs';
import path from 'path';
import { createDistilledTurn } from './turnDistiller.js';

const DEFAULT_HISTORY_FILE = path.resolve(process.cwd(), '.data/conversation-history.json');
const DEFAULT_MAX_TURNS = 30;
const DEFAULT_MAX_CHARACTERS = 28000;

function createEmptyStore() {
    return { chats: {} };
}

function normalizeChatId(chatId) {
    return String(chatId);
}

function truncateText(value, maxLength) {
    const text = String(value || '');
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, Math.max(0, maxLength - 15))}\n[truncated]`;
}

function normalizeTurn(turnInput, maxCharacters) {
    const distilled = createDistilledTurn(turnInput);
    const fieldLimit = Math.max(20, Math.floor(maxCharacters / 3));

    return {
        timestamp: distilled.timestamp,
        userPrompt: truncateText(distilled.userPrompt, fieldLimit),
        assistantResponse: truncateText(distilled.assistantResponse, fieldLimit),
        importance: distilled.importance,
        entities: distilled.entities
    };
}

function trimTurns(turns, maxTurns, maxCharacters) {
    // 1. Filter out pure ephemeral filler when history has more than 2 turns
    let candidateTurns = turns;
    if (candidateTurns.length > 2) {
        candidateTurns = candidateTurns.filter((t, idx) => {
            if (idx === candidateTurns.length - 1) return true;
            return t.importance !== 'ephemeral';
        });
    }

    let trimmed = candidateTurns.slice(-maxTurns);

    // 2. Trim older turns if exceeding max characters, preserving high-importance turns
    while (trimmed.length > 1 && JSON.stringify(trimmed).length > maxCharacters) {
        const lowIndex = trimmed.findIndex((t, idx) => idx < trimmed.length - 1 && t.importance === 'low');
        if (lowIndex !== -1) {
            trimmed.splice(lowIndex, 1);
        } else {
            trimmed = trimmed.slice(1);
        }
    }

    if (trimmed.length === 1 && JSON.stringify(trimmed).length > maxCharacters) {
        trimmed = [normalizeTurn(trimmed[0], maxCharacters)];
    }

    return trimmed;
}

export function createConversationHistoryStore({
    filePath = DEFAULT_HISTORY_FILE,
    maxTurns = DEFAULT_MAX_TURNS,
    maxCharacters = DEFAULT_MAX_CHARACTERS
} = {}) {
    function readStore() {
        if (!fs.existsSync(filePath)) {
            return createEmptyStore();
        }

        try {
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (!parsed || typeof parsed !== 'object' || !parsed.chats || typeof parsed.chats !== 'object') {
                return createEmptyStore();
            }

            return parsed;
        } catch (error) {
            console.warn(`[ConversationHistory] Failed to read history file. Starting fresh: ${error.message}`);
            return createEmptyStore();
        }
    }

    function writeStore(store) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const tmpPath = `${filePath}.${process.pid}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
        fs.renameSync(tmpPath, filePath);
    }

    return {
        getHistory(chatId) {
            const store = readStore();
            const chat = store.chats[normalizeChatId(chatId)];
            return Array.isArray(chat?.turns) ? chat.turns : [];
        },

        appendTurn(chatId, userPrompt, assistantResponse) {
            const store = readStore();
            const key = normalizeChatId(chatId);
            const existingTurns = Array.isArray(store.chats[key]?.turns) ? store.chats[key].turns : [];
            const nextTurn = normalizeTurn({ userPrompt, assistantResponse }, maxCharacters);

            const nextTurns = [
                ...existingTurns,
                nextTurn
            ];

            store.chats[key] = {
                updatedAt: new Date().toISOString(),
                turns: trimTurns(nextTurns, maxTurns, maxCharacters)
            };

            writeStore(store);
            return store.chats[key].turns;
        },

        resetHistory(chatId) {
            const store = readStore();
            delete store.chats[normalizeChatId(chatId)];
            writeStore(store);
        }
    };
}
