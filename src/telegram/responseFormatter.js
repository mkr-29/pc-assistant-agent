export function formatTaskCompleteMarkdown(finalOutcome) {
    return `🤖 **Task Complete:**\n\n${finalOutcome}`;
}

export function formatTaskCompletePlain(finalOutcome) {
    return `Task Complete (Plain Text Fallback):\n\n${finalOutcome}`;
}

export function formatErrorMessage(error) {
    return `❌ **Error Encountered:** ${error?.message || String(error)}`;
}

export function splitTextIntoChunks(text, maxLength = 3800) {
    if (!text || typeof text !== 'string') return [''];
    if (text.length <= maxLength) return [text];

    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
            chunks.push(remaining);
            break;
        }

        // Try splitting at a paragraph or newline before maxLength
        let splitIdx = remaining.lastIndexOf('\n\n', maxLength);
        if (splitIdx < maxLength * 0.4) {
            splitIdx = remaining.lastIndexOf('\n', maxLength);
        }
        if (splitIdx < maxLength * 0.3) {
            splitIdx = remaining.lastIndexOf(' ', maxLength);
        }
        if (splitIdx < maxLength * 0.2) {
            splitIdx = maxLength;
        }

        chunks.push(remaining.slice(0, splitIdx).trimEnd());
        remaining = remaining.slice(splitIdx).trimStart();
    }

    return chunks;
}

export async function sendTelegramChunkedMessage(bot, chatId, text, { parseMode = null, isMarkdown = false } = {}) {
    if (!bot || typeof bot.sendMessage !== 'function' || !chatId) return;

    const chunks = splitTextIntoChunks(text, 3800);
    for (const chunk of chunks) {
        if (!chunk || chunk.trim().length === 0) continue;

        if (isMarkdown || parseMode === 'Markdown') {
            try {
                await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
                continue;
            } catch (err) {
                console.warn('[Telegram] Markdown chunk send failed, falling back to plain text:', err.message);
            }
        }

        await bot.sendMessage(chatId, chunk);
    }
}
