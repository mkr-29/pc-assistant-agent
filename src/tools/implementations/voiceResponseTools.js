import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const DEFAULT_VOICE_DIR = path.resolve(process.cwd(), '.data/voice-notes');

function formatTimestamp(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}

function getAudioMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.mp3': return 'audio/mp3';
        case '.wav': return 'audio/wav';
        case '.m4a': return 'audio/m4a';
        case '.ogg': return 'audio/ogg';
        case '.flac': return 'audio/flac';
        case '.aac': return 'audio/aac';
        case '.opus': return 'audio/opus';
        default: return 'audio/mpeg';
    }
}

export function createVoiceResponseTools({
    bot = null,
    chatId = null,
    resolveToolPath = p => p,
    ai = null,
    config = {},
    voiceDirectory = DEFAULT_VOICE_DIR,
    execFileImpl = execFile
} = {}) {
    const runExec = promisify(execFileImpl);

    return {
        sendVoiceNoteResponse: async ({ text, voice = 'Samantha', rate = 180 } = {}) => {
            if (!text || typeof text !== 'string') {
                return { status: 'Error', message: 'text is required to generate a voice note.' };
            }

            if (process.platform !== 'darwin') {
                return { status: 'Error', message: 'sendVoiceNoteResponse TTS is currently supported on macOS.' };
            }

            const cleanText = text.trim();
            const timestamp = formatTimestamp();
            const tempAiffPath = path.join(os.tmpdir(), `tts-${timestamp}.aiff`);
            const outAudioPath = path.join(voiceDirectory, `voice-response-${timestamp}.m4a`);

            try {
                fs.mkdirSync(voiceDirectory, { recursive: true });

                const sayArgs = ['-o', tempAiffPath, '-v', voice, '-r', String(rate), cleanText];
                await runExec('say', sayArgs);

                // Convert AIFF to M4A/AAC for Telegram voice playback using ffmpeg (or afconvert native macOS)
                try {
                    await runExec('afconvert', ['-f', 'm4af', '-d', 'aac', tempAiffPath, outAudioPath]);
                } catch {
                    // Fallback to ffmpeg
                    await runExec('ffmpeg', ['-y', '-i', tempAiffPath, '-c:a', 'aac', outAudioPath]);
                }

                if (fs.existsSync(tempAiffPath)) {
                    fs.unlinkSync(tempAiffPath);
                }

                // Send over Telegram if bot & chatId are provided
                let telegramSent = false;
                if (bot && chatId && typeof bot.sendVoice === 'function') {
                    try {
                        await bot.sendVoice(chatId, outAudioPath);
                        telegramSent = true;
                    } catch (tgErr) {
                        try {
                            await bot.sendAudio(chatId, outAudioPath);
                            telegramSent = true;
                        } catch (audErr) {
                            console.warn(`[Voice TTS] Failed to send Telegram voice: ${audErr.message}`);
                        }
                    }
                }

                return {
                    status: 'Success',
                    audioPath: outAudioPath,
                    telegramSent,
                    textLength: cleanText.length,
                    message: telegramSent
                        ? 'Voice note generated and sent to your Telegram.'
                        : `Voice note generated and saved to ${outAudioPath}.`
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to generate voice note: ${error.message}`
                };
            }
        },

        speakText: async ({ text, voice = 'Samantha', rate = 180 } = {}) => {
            if (!text || typeof text !== 'string') {
                return { status: 'Error', message: 'text is required for speakText.' };
            }

            if (process.platform !== 'darwin') {
                return { status: 'Error', message: 'speakText is currently supported on macOS.' };
            }

            try {
                const sayArgs = ['-v', voice, '-r', String(rate), text.trim()];
                await runExec('say', sayArgs);

                return {
                    status: 'Success',
                    voice,
                    message: `Spoke: "${text.trim()}"`
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to speak text: ${error.message}`
                };
            }
        },

        transcribeAudioFile: async ({ audioPath, model = null } = {}) => {
            if (!audioPath || typeof audioPath !== 'string') {
                return { status: 'Error', message: 'audioPath is required for audio transcription.' };
            }

            const targetPath = resolveToolPath(audioPath);
            if (!fs.existsSync(targetPath)) {
                return { status: 'Error', message: `Audio file not found at path: ${audioPath}` };
            }

            if (!ai || typeof ai.models?.generateContent !== 'function') {
                return {
                    status: 'Error',
                    message: 'Audio transcription requires GEMINI_API_KEY for multimodal audio processing.'
                };
            }

            try {
                const audioBuffer = fs.readFileSync(targetPath);
                const base64Data = audioBuffer.toString('base64');
                const mimeType = getAudioMimeType(targetPath);

                const transcriptionModel = model || config.voiceNotes?.transcriptionModel || 'gemini-2.5-flash';

                const response = await ai.models.generateContent({
                    model: transcriptionModel,
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                {
                                    inlineData: {
                                        mimeType,
                                        data: base64Data
                                    }
                                },
                                {
                                    text: 'Transcribe this audio recording verbatim with accurate punctuation. If there are distinct speakers or section transitions, format them cleanly with timestamps.'
                                }
                            ]
                        }
                    ]
                });

                const transcript = response.text ? response.text.trim() : '';

                return {
                    status: 'Success',
                    audioPath: targetPath,
                    fileSizeBytes: audioBuffer.length,
                    mimeType,
                    model: transcriptionModel,
                    transcript
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to transcribe audio: ${error.message}`
                };
            }
        }
    };
}
