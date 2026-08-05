import fs from 'fs';
import path from 'path';

const DEFAULT_HISTORY_FILE = path.resolve(process.cwd(), '.data/conversation-history.json');
const DEFAULT_MAX_TURNS = 20;
const DEFAULT_MAX_CHARACTERS = 24000;

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

function normalizeTurn({ userPrompt, assistantResponse, timestamp }, maxCharacters) {
    const fieldLimit = Math.max(20, Math.floor(maxCharacters / 3));

    return {
        timestamp: timestamp || new Date().toISOString(),
        userPrompt: truncateText(userPrompt, fieldLimit),
        assistantResponse: truncateText(assistantResponse, fieldLimit)
    };
}

function trimTurns(turns, maxTurns, maxCharacters) {
    let trimmed = turns.slice(-maxTurns);

    while (trimmed.length > 1 && JSON.stringify(trimmed).length > maxCharacters) {
        trimmed = trimmed.slice(1);
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
            const nextTurns = [
                ...existingTurns,
                normalizeTurn({ userPrompt, assistantResponse }, maxCharacters)
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
