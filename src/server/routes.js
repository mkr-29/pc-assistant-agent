export function registerTelegramRoutes(app, { handleTelegramMessage }) {
    app.post('/telegram-webhook', async (req, res) => {
        res.sendStatus(200);

        const { message } = req.body;
        if (!message || (!message.text && !message.voice)) return;

        const chatId = message.chat.id;
        const text = message.text;
        const username = message.from?.username || message.from?.first_name || 'User';

        handleTelegramMessage(chatId, text, username, message);
    });

    return app;
}
