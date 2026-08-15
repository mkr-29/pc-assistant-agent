import fs from 'fs';
import path from 'path';
import {
    formatErrorMessage,
    formatTaskCompleteMarkdown,
    formatTaskCompletePlain,
    sendTelegramChunkedMessage
} from './responseFormatter.js';
import { isVoiceMessage } from './voiceNotes.js';

const NEW_CONVERSATION_COMMAND = '/new_convo';
const REMEMBER_COMMAND = '/remember';
const LIST_MEMORIES_COMMAND = '/memories';
const FORGET_MEMORY_COMMAND = '/forget_memory';
const TELEGRAM_MESSAGE_CHARACTER_LIMIT = 3500;

function hasText(text) {
    return typeof text === 'string' && text.trim().length > 0;
}

function getCommand(text) {
    if (!hasText(text)) {
        return '';
    }

    return text.trim().split(/\s+/)[0];
}

function isNewConversationCommand(text) {
    return getCommand(text) === NEW_CONVERSATION_COMMAND;
}

function getCommandPayload(text) {
    if (!hasText(text)) {
        return '';
    }

    return text.trim().split(/\s+/).slice(1).join(' ').trim();
}

export function isImageMessage(message) {
    if (Array.isArray(message?.photo) && message.photo.length > 0) {
        return true;
    }
    if (message?.document) {
        const mime = message.document.mime_type || '';
        const fileName = message.document.file_name || '';
        const ext = path.extname(fileName).toLowerCase();
        return mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.gif'].includes(ext);
    }
    return false;
}

export function createImagePrompt(imagePath, caption) {
    const captionText = caption && caption.trim().length > 0 ? caption.trim() : 'Please inspect or process this image.';
    return [
        `The user sent an image in Telegram: "${imagePath}".`,
        `User instruction / caption: "${captionText}"`,
        '',
        'Use image manipulation tools (getImageInfo, cropImage, resizeImage, removeImageBackground, adjustImage, convertImage, manipulateImage) or file tools as needed.',
        'If the user requested the processed image or an image result back, use sendTelegramFile to upload the output image back to them in Telegram.'
    ].join('\n');
}

function formatMemoryList(memories) {
    if (!Array.isArray(memories) || memories.length === 0) {
        return 'No long-term knowledge memories have been saved.';
    }

    const lines = ['Saved long-term knowledge memories:'];
    let hiddenCount = 0;

    for (const memory of memories) {
        const line = `- ${memory.id}: ${memory.fact}`;
        const nextText = [...lines, line].join('\n');

        if (nextText.length > TELEGRAM_MESSAGE_CHARACTER_LIMIT) {
            hiddenCount += 1;
            continue;
        }

        lines.push(line);
    }

    if (hiddenCount > 0) {
        lines.push(`... ${hiddenCount} more not shown.`);
    }

    return lines.join('\n');
}

export function createVoiceNotePrompt(transcript) {
    return [
        'The user sent a Telegram voice note. Transcript:',
        '"""',
        transcript,
        '"""',
        '',
        'If the transcript contains a clear instruction, execute it using the available tools.',
        'If it is only notes, thoughts, or a status update without a clear task, reply with a concise summary.',
        'If the transcript is unclear or risky, ask for clarification before taking action.'
    ].join('\n');
}

export function createTelegramMessageHandler({
    bot,
    config,
    conversationHistoryStore,
    knowledgeMemoryStore,
    runAgent,
    approvalManager,
    voiceNoteTranscriber,
    uploadDir = path.join(process.cwd(), '.data', 'uploads')
}) {
    return async function handleTelegramMessage(chatId, text, username = 'User', message = {}) {
        const isVoice = isVoiceMessage(message);
        const isImage = isImageMessage(message);

        console.log('\n--- [Telegram Input Log] ---');
        console.log(`Timestamp: ${new Date().toISOString()}`);
        console.log(`From User: ${username}`);
        console.log(`Chat ID: ${chatId}`);
        console.log(isVoice ? 'Message Type: voice' : isImage ? 'Message Type: image' : `Message Text: "${text}"`);
        console.log('-----------------------------\n');

        if (String(chatId) !== String(config.allowedChatId)) {
            console.warn(`[Telegram] Unauthorized access attempt from Chat ID: ${chatId}`);
            return;
        }

        try {
            if (isNewConversationCommand(text)) {
                approvalManager?.cancelPending?.(chatId, 'Approval cancelled because a new conversation was started.');
                approvalManager?.clearAllowAll?.(chatId);
                conversationHistoryStore.resetHistory(chatId);
                await bot.sendMessage(chatId, 'Started a new conversation. Previous chat context has been cleared.');
                return;
            }

            if (getCommand(text) === REMEMBER_COMMAND) {
                const fact = getCommandPayload(text);
                if (!fact) {
                    await bot.sendMessage(chatId, 'Usage: /remember <fact to save>');
                    return;
                }

                const memory = knowledgeMemoryStore.addMemory(fact);
                await bot.sendMessage(chatId, `Saved long-term memory ${memory.id}.`);
                return;
            }

            if (getCommand(text) === LIST_MEMORIES_COMMAND) {
                await bot.sendMessage(chatId, formatMemoryList(knowledgeMemoryStore.listMemories()));
                return;
            }

            if (getCommand(text) === FORGET_MEMORY_COMMAND) {
                const memoryId = getCommandPayload(text);
                if (!memoryId) {
                    await bot.sendMessage(chatId, 'Usage: /forget_memory <memory_id>');
                    return;
                }

                const forgottenMemory = knowledgeMemoryStore.forgetMemory(memoryId);
                const message = forgottenMemory
                    ? `Forgot long-term memory ${forgottenMemory.id}.`
                    : `No long-term memory found for ${memoryId}.`;
                await bot.sendMessage(chatId, message);
                return;
            }

            if (hasText(text)) {
                const approvalReply = approvalManager?.handleApprovalMessage?.(chatId, text);
                if (approvalReply?.handled) {
                    await bot.sendMessage(chatId, approvalReply.message);
                    return;
                }
            }

            let userPrompt = text;
            let historyPrompt = text;

            if (isVoice) {
                if (!voiceNoteTranscriber?.transcribe) {
                    throw new Error('Voice-note transcription is not configured.');
                }

                await bot.sendMessage(chatId, 'Voice note received. Transcribing your instruction...');
                const transcript = await voiceNoteTranscriber.transcribe(message);
                userPrompt = createVoiceNotePrompt(transcript);
                historyPrompt = `Voice note transcript:\n${transcript}`;
            } else if (isImage) {
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                const fileId = Array.isArray(message.photo) && message.photo.length > 0
                    ? message.photo[message.photo.length - 1].file_id
                    : message.document.file_id;

                let downloadedPath = null;
                if (typeof bot.downloadFile === 'function') {
                    downloadedPath = await bot.downloadFile(fileId, uploadDir);
                } else {
                    downloadedPath = path.join(uploadDir, `photo_${fileId}.jpg`);
                }

                const caption = message.caption || text || '';
                userPrompt = createImagePrompt(downloadedPath, caption);
                historyPrompt = `User sent image: ${downloadedPath}${caption ? ` with caption: "${caption}"` : ''}`;
            } else if (!hasText(text)) {
                return;
            }

            console.log('[Telegram] Sending confirmation back to user...');
            await bot.sendMessage(chatId, 'Engineering Agent activated. Processing your instructions...');

            try {
                console.log('[Agent] Starting runAgent with prompt...');
                const conversationHistory = conversationHistoryStore.getHistory(chatId);
                const knowledgeMemory = knowledgeMemoryStore?.listMemories?.() || [];
                const finalOutcome = await runAgent({ userPrompt, chatId, conversationHistory, knowledgeMemory });
                conversationHistoryStore.appendTurn(chatId, historyPrompt, finalOutcome);

                console.log('\n--- [Telegram Output Log] ---');
                console.log(`Timestamp: ${new Date().toISOString()}`);
                console.log(`To Chat ID: ${chatId}`);
                console.log(`Final Outcome Response:\n${finalOutcome}`);
                console.log('------------------------------\n');

                await sendTelegramChunkedMessage(bot, chatId, formatTaskCompleteMarkdown(finalOutcome), { isMarkdown: true });
                console.log('[Telegram] Outcome successfully sent to Telegram.');
            } finally {
                approvalManager?.clearAllowAll?.(chatId);
            }
        } catch (error) {
            console.error('\n--- [Telegram Error Log] ---');
            console.error(`Timestamp: ${new Date().toISOString()}`);
            console.error(`Chat ID: ${chatId}`);
            console.error('Error details:', error);
            console.error('----------------------------\n');

            try {
                await sendTelegramChunkedMessage(bot, chatId, formatErrorMessage(error), { isMarkdown: true });
            } catch (sendErr) {
                console.error('[Telegram] Failed to send error notification back to Telegram:', sendErr.message);
            }
        }
    };
}

