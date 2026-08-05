import { isRateLimitError } from '../llm/errorUtils.js';

const DEFAULT_VOICE_MIME_TYPE = 'audio/ogg';
const DEFAULT_VOICE_NOTE_MAX_BYTES = 18000000;
const DEFAULT_VOICE_TRANSCRIPTION_MODEL = 'gemini-2.5-flash';
const FALLBACK_TRANSCRIPTION_MODELS = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite'
];
const TRANSCRIPTION_PROMPT = [
    'Transcribe this Telegram voice note exactly.',
    'Return only the spoken transcript as plain text.',
    'If the speech is unintelligible, return an empty string.'
].join(' ');

function getVoiceFileSize(voice) {
    const fileSize = Number(voice?.file_size);
    return Number.isFinite(fileSize) && fileSize > 0 ? fileSize : null;
}

function formatBytes(bytes) {
    if (bytes >= 1000000) {
        return `${(bytes / 1000000).toFixed(1)} MB`;
    }

    if (bytes >= 1000) {
        return `${(bytes / 1000).toFixed(1)} KB`;
    }

    return `${bytes} bytes`;
}

function assertWithinSizeLimit(size, maxBytes) {
    if (size && size > maxBytes) {
        throw new Error(
            `Voice note is ${formatBytes(size)}, which exceeds the configured ${formatBytes(maxBytes)} limit.`
        );
    }
}

async function downloadTelegramFile({ bot, fileId, fetchImpl, maxBytes }) {
    if (!bot?.getFileLink) {
        throw new Error('Telegram file download is unavailable for voice-note transcription.');
    }

    if (!fetchImpl) {
        throw new Error('Voice-note transcription requires fetch support in this Node runtime.');
    }

    const fileLink = await bot.getFileLink(fileId);
    const response = await fetchImpl(fileLink);

    if (!response?.ok) {
        const status = response?.status ? ` HTTP ${response.status}.` : '';
        throw new Error(`Failed to download Telegram voice note.${status}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    assertWithinSizeLimit(audioBuffer.length, maxBytes);

    return audioBuffer;
}

async function transcribeAudio({ ai, audioBuffer, mimeType, modelName }) {
    const primaryModel = modelName || DEFAULT_VOICE_TRANSCRIPTION_MODEL;
    const candidates = Array.from(new Set([primaryModel, ...FALLBACK_TRANSCRIPTION_MODELS]));
    let lastError = null;

    for (const candidateModel of candidates) {
        try {
            const response = await ai.models.generateContent({
                model: candidateModel,
                contents: [
                    { text: TRANSCRIPTION_PROMPT },
                    {
                        inlineData: {
                            mimeType,
                            data: audioBuffer.toString('base64')
                        }
                    }
                ]
            });

            const transcript = String(response?.text || '').trim();
            if (transcript) {
                return transcript;
            }
        } catch (error) {
            lastError = error;
            console.warn(
                `[Voice Transcriber Warning] Gemini model ${candidateModel} failed (${error.message}). Trying fallback transcription model...`
            );
        }
    }

    if (lastError) {
        if (isRateLimitError(lastError)) {
            throw new Error(`Voice note transcription rate limited on Gemini: ${lastError.message}`);
        }
        throw lastError;
    }

    throw new Error('Voice note could not be transcribed because the transcript was empty.');
}

function assertGeminiConfigured(ai) {
    if (!ai?.models?.generateContent) {
        throw new Error('Voice-note transcription requires Gemini. Set GEMINI_API_KEY to enable it.');
    }
}

export function isVoiceMessage(message) {
    return Boolean(message?.voice);
}

export function createTelegramVoiceNoteTranscriber({
    bot,
    ai,
    config = {},
    fetchImpl = globalThis.fetch
} = {}) {
    const maxBytes = config.voiceNotes?.maxBytes || DEFAULT_VOICE_NOTE_MAX_BYTES;
    const modelName = config.voiceNotes?.transcriptionModel || DEFAULT_VOICE_TRANSCRIPTION_MODEL;

    return {
        async transcribe(message) {
            const voice = message?.voice;
            const fileId = voice?.file_id;

            if (!fileId) {
                throw new Error('Telegram voice note did not include a file ID.');
            }

            assertGeminiConfigured(ai);
            assertWithinSizeLimit(getVoiceFileSize(voice), maxBytes);

            const audioBuffer = await downloadTelegramFile({
                bot,
                fileId,
                fetchImpl,
                maxBytes
            });

            return transcribeAudio({
                ai,
                audioBuffer,
                mimeType: voice?.mime_type || DEFAULT_VOICE_MIME_TYPE,
                modelName
            });
        }
    };
}
