import assert from 'node:assert/strict';
import test from 'node:test';
import { createTelegramVoiceNoteTranscriber, isVoiceMessage } from '../../src/telegram/voiceNotes.js';

function toArrayBuffer(buffer) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

test('isVoiceMessage detects Telegram voice payloads', () => {
    assert.equal(isVoiceMessage({ voice: { file_id: 'voice-file' } }), true);
    assert.equal(isVoiceMessage({ text: 'hello' }), false);
    assert.equal(isVoiceMessage(null), false);
});

test('voice transcriber downloads Telegram voice file and sends inline audio to Gemini', async () => {
    const audioBuffer = Buffer.from('fake audio bytes');
    let requestedFileId = null;
    let requestedUrl = null;
    let geminiRequest = null;

    const transcriber = createTelegramVoiceNoteTranscriber({
        bot: {
            getFileLink: async fileId => {
                requestedFileId = fileId;
                return 'https://telegram.example/voice.ogg';
            }
        },
        ai: {
            models: {
                generateContent: async request => {
                    geminiRequest = request;
                    return { text: 'Run npm test.' };
                }
            }
        },
        config: {
            voiceNotes: {
                transcriptionModel: 'gemini-2.5-flash',
                maxBytes: 1000
            }
        },
        fetchImpl: async url => {
            requestedUrl = url;
            return {
                ok: true,
                arrayBuffer: async () => toArrayBuffer(audioBuffer)
            };
        }
    });

    const transcript = await transcriber.transcribe({
        voice: {
            file_id: 'voice-file',
            mime_type: 'audio/ogg',
            file_size: audioBuffer.length
        }
    });

    assert.equal(transcript, 'Run npm test.');
    assert.equal(requestedFileId, 'voice-file');
    assert.equal(requestedUrl, 'https://telegram.example/voice.ogg');
    assert.equal(geminiRequest.model, 'gemini-2.5-flash');
    assert.equal(geminiRequest.contents[1].inlineData.mimeType, 'audio/ogg');
    assert.equal(geminiRequest.contents[1].inlineData.data, audioBuffer.toString('base64'));
});

test('voice transcriber rejects oversized Telegram metadata before download', async () => {
    let downloadAttempted = false;
    const transcriber = createTelegramVoiceNoteTranscriber({
        bot: {
            getFileLink: async () => {
                downloadAttempted = true;
                return 'https://telegram.example/large.ogg';
            }
        },
        ai: {
            models: {
                generateContent: async () => ({ text: 'never called' })
            }
        },
        config: {
            voiceNotes: {
                maxBytes: 5
            }
        },
        fetchImpl: async () => {
            downloadAttempted = true;
            return { ok: true, arrayBuffer: async () => toArrayBuffer(Buffer.from('large')) };
        }
    });

    await assert.rejects(
        () => transcriber.transcribe({ voice: { file_id: 'voice-file', file_size: 6 } }),
        /exceeds the configured/
    );
    assert.equal(downloadAttempted, false);
});

test('voice transcriber rejects missing Gemini configuration before download', async () => {
    let downloadAttempted = false;
    const transcriber = createTelegramVoiceNoteTranscriber({
        bot: {
            getFileLink: async () => {
                downloadAttempted = true;
                return 'https://telegram.example/voice.ogg';
            }
        },
        ai: null,
        fetchImpl: async () => {
            downloadAttempted = true;
            return { ok: true, arrayBuffer: async () => toArrayBuffer(Buffer.from('audio')) };
        }
    });

    await assert.rejects(
        () => transcriber.transcribe({ voice: { file_id: 'voice-file' } }),
        /requires Gemini/
    );
    assert.equal(downloadAttempted, false);
});

test('voice transcriber rejects empty transcripts', async () => {
    const transcriber = createTelegramVoiceNoteTranscriber({
        bot: {
            getFileLink: async () => 'https://telegram.example/voice.ogg'
        },
        ai: {
            models: {
                generateContent: async () => ({ text: '   ' })
            }
        },
        fetchImpl: async () => ({
            ok: true,
            arrayBuffer: async () => toArrayBuffer(Buffer.from('audio'))
        })
    });

    await assert.rejects(
        () => transcriber.transcribe({ voice: { file_id: 'voice-file' } }),
        /transcript was empty/
    );
});

test('voice transcriber falls back to next Gemini model on 429 rate limit error', async () => {
    const attemptedModels = [];
    const transcriber = createTelegramVoiceNoteTranscriber({
        bot: {
            getFileLink: async () => 'https://telegram.example/voice.ogg'
        },
        ai: {
            models: {
                generateContent: async ({ model }) => {
                    attemptedModels.push(model);
                    if (model === 'gemini-2.5-flash') {
                        const err = new Error('Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests');
                        err.status = 429;
                        throw err;
                    }
                    return { text: 'Fallback transcribed text.' };
                }
            }
        },
        fetchImpl: async () => ({
            ok: true,
            arrayBuffer: async () => toArrayBuffer(Buffer.from('audio'))
        })
    });

    const transcript = await transcriber.transcribe({ voice: { file_id: 'voice-file' } });

    assert.equal(transcript, 'Fallback transcribed text.');
    assert.deepEqual(attemptedModels, ['gemini-2.5-flash', 'gemini-3.6-flash']);
});
