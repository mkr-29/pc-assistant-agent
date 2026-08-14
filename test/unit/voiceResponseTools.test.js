import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createVoiceResponseTools } from '../../src/tools/implementations/voiceResponseTools.js';

describe('voiceResponseTools', () => {
    describe('speakText', () => {
        it('returns error when text is missing', async () => {
            const tools = createVoiceResponseTools();
            const res = await tools.speakText({});
            assert.equal(res.status, 'Error');
            assert.match(res.message, /text is required/i);
        });

        it('executes say command with voice and rate', async () => {
            const calls = [];
            const mockExec = (cmd, args, opts, cb) => {
                const callback = typeof opts === 'function' ? opts : cb;
                calls.push({ cmd, args });
                callback(null, '', '');
            };

            const tools = createVoiceResponseTools({ execFileImpl: mockExec });
            const res = await tools.speakText({ text: 'Hello developer', voice: 'Daniel', rate: 200 });

            assert.equal(res.status, 'Success');
            assert.equal(calls[0].cmd, 'say');
            assert.deepEqual(calls[0].args, ['-v', 'Daniel', '-r', '200', 'Hello developer']);
        });
    });

    describe('sendVoiceNoteResponse', () => {
        it('returns error when text is missing', async () => {
            const tools = createVoiceResponseTools();
            const res = await tools.sendVoiceNoteResponse({});
            assert.equal(res.status, 'Error');
        });

        it('generates voice file and calls bot.sendVoice', async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-test-'));
            let botSendVoiceCalled = false;

            const mockBot = {
                sendVoice: async (chatId, filePath) => {
                    botSendVoiceCalled = true;
                    assert.equal(chatId, '12345');
                    assert.ok(filePath.endsWith('.m4a'));
                }
            };

            const mockExec = (cmd, args, opts, cb) => {
                const callback = typeof opts === 'function' ? opts : cb;
                // Create mock file for conversion
                if (cmd === 'afconvert' || cmd === 'ffmpeg') {
                    const outPath = args[args.length - 1];
                    fs.writeFileSync(outPath, Buffer.from('fake-m4a-audio'));
                }
                callback(null, '', '');
            };

            const tools = createVoiceResponseTools({
                bot: mockBot,
                chatId: '12345',
                voiceDirectory: tempDir,
                execFileImpl: mockExec
            });

            const res = await tools.sendVoiceNoteResponse({ text: 'Here is your voice update' });

            assert.equal(res.status, 'Success');
            assert.equal(res.telegramSent, true);
            assert.equal(botSendVoiceCalled, true);

            fs.rmSync(tempDir, { recursive: true, force: true });
        });
    });

    describe('transcribeAudioFile', () => {
        it('returns error when audio file does not exist', async () => {
            const tools = createVoiceResponseTools({ ai: { models: {} } });
            const res = await tools.transcribeAudioFile({ audioPath: '/nonexistent/audio.mp3' });
            assert.equal(res.status, 'Error');
            assert.match(res.message, /not found/i);
        });

        it('transcribes local audio using Gemini multimodal', async () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcribe-test-'));
            const audioPath = path.join(tempDir, 'sample.m4a');
            fs.writeFileSync(audioPath, Buffer.from('fake-audio-bytes'));

            const mockAi = {
                models: {
                    generateContent: async ({ model, contents }) => {
                        assert.ok(contents[0].parts[0].inlineData.data);
                        return { text: 'Welcome to the podcast. Today we talk about AI agents.' };
                    }
                }
            };

            const tools = createVoiceResponseTools({
                ai: mockAi,
                resolveToolPath: p => p
            });

            const res = await tools.transcribeAudioFile({ audioPath });

            assert.equal(res.status, 'Success');
            assert.equal(res.transcript, 'Welcome to the podcast. Today we talk about AI agents.');

            fs.rmSync(tempDir, { recursive: true, force: true });
        });
    });
});
