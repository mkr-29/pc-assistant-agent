import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../../src/app.js';

test('telegram webhook acknowledges valid Telegram payloads', async () => {
    let receivedMessage = null;
    const app = createApp({
        handleTelegramMessage: (chatId, text, username, message) => {
            receivedMessage = { chatId, text, username, message };
        }
    });

    const server = app.listen(0);

    try {
        const { port } = server.address();
        const response = await fetch(`http://127.0.0.1:${port}/telegram-webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: {
                    chat: { id: 123 },
                    text: 'status',
                    from: { username: 'mkr' }
                }
            })
        });

        assert.equal(response.status, 200);
        assert.deepEqual(receivedMessage, {
            chatId: 123,
            text: 'status',
            username: 'mkr',
            message: {
                chat: { id: 123 },
                text: 'status',
                from: { username: 'mkr' }
            }
        });
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test('telegram webhook forwards voice payloads to the message handler', async () => {
    let receivedMessage = null;
    const app = createApp({
        handleTelegramMessage: (chatId, text, username, message) => {
            receivedMessage = { chatId, text, username, message };
        }
    });
    const voicePayload = {
        chat: { id: 123 },
        voice: {
            file_id: 'voice-file',
            mime_type: 'audio/ogg',
            file_size: 1234
        },
        from: { first_name: 'MKR' }
    };
    const server = app.listen(0);

    try {
        const { port } = server.address();
        const response = await fetch(`http://127.0.0.1:${port}/telegram-webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: voicePayload })
        });

        assert.equal(response.status, 200);
        assert.deepEqual(receivedMessage, {
            chatId: 123,
            text: undefined,
            username: 'MKR',
            message: voicePayload
        });
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
