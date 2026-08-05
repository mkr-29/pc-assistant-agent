import fs from 'fs';
import path from 'path';

const PHOTO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

export function createTelegramFileTools({ bot, chatId, resolveToolPath }) {
    return {
        sendTelegramFile: async ({ filePath, caption }) => {
            const resolvedPath = resolveToolPath(filePath);

            if (!fs.existsSync(resolvedPath)) {
                throw new Error(`File does not exist: ${filePath}`);
            }

            const ext = path.extname(resolvedPath).toLowerCase();
            const isPhoto = PHOTO_EXTENSIONS.includes(ext);
            const stream = fs.createReadStream(resolvedPath);

            if (isPhoto) {
                await bot.sendPhoto(chatId, stream, { caption });
            } else {
                await bot.sendDocument(chatId, stream, { caption });
            }

            return { status: 'Success', message: `Successfully sent ${filePath} to Telegram chat.` };
        }
    };
}
