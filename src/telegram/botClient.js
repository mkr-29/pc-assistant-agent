import TelegramBot from 'node-telegram-bot-api';

export function createBotClient(config) {
    return new TelegramBot(config.telegramBotToken, { polling: false });
}

export function shouldUsePolling(config) {
    return config.telegramMode === 'polling' || !config.webhookUrl;
}

export function startPolling({ bot, handleTelegramMessage }) {
    bot.deleteWebHook()
        .then(() => {
            console.log('[Telegram] Existing webhook deleted.');
            return bot.startPolling();
        })
        .then(() => {
            console.log('[Telegram] Started polling for updates successfully.');
        })
        .catch(err => {
            console.error('[Telegram] Failed during polling startup sequence:', err.message);
        });

    bot.on('message', msg => {
        if (!msg.text && !msg.voice) return;

        const chatId = msg.chat.id;
        const text = msg.text;
        const username = msg.from?.username || msg.from?.first_name || 'User';

        handleTelegramMessage(chatId, text, username, msg);
    });
}
