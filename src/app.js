import express from 'express';
import { registerTelegramRoutes } from './server/routes.js';

export function createApp({ handleTelegramMessage }) {
    const app = express();
    app.use(express.json());

    registerTelegramRoutes(app, { handleTelegramMessage });

    return app;
}
