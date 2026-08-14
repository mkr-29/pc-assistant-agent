import fs from 'fs';
import path from 'path';

const PHOTO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.aac', '.flac', '.ogg', '.opus'];
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.mov', '.webm', '.avi'];

export function createTelegramFileTools({ bot, chatId, resolveToolPath }) {
    return {
        sendTelegramFile: async ({ filePath, caption }) => {
            let resolvedPath = resolveToolPath(filePath);

            if (!fs.existsSync(resolvedPath)) {
                const downloadsDir = resolveToolPath('.data/downloads');
                if (fs.existsSync(downloadsDir)) {
                    const files = fs.readdirSync(downloadsDir)
                        .map(f => path.join(downloadsDir, f))
                        .filter(f => {
                            try { return fs.statSync(f).isFile(); } catch { return false; }
                        });
                    files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

                    const baseName = path.basename(filePath).toLowerCase();
                    const matching = files.find(f => path.basename(f).toLowerCase().includes(baseName)) || files[0];
                    if (matching && fs.existsSync(matching)) {
                        resolvedPath = matching;
                    }
                }
            }

            if (!fs.existsSync(resolvedPath)) {
                throw new Error(`File does not exist: ${filePath}`);
            }

            const ext = path.extname(resolvedPath).toLowerCase();
            const isPhoto = PHOTO_EXTENSIONS.includes(ext);
            const isAudio = AUDIO_EXTENSIONS.includes(ext);
            const isVideo = VIDEO_EXTENSIONS.includes(ext);
            const stream = fs.createReadStream(resolvedPath);

            if (isAudio && typeof bot.sendAudio === 'function') {
                await bot.sendAudio(chatId, stream, { caption, title: path.parse(resolvedPath).name });
            } else if (isPhoto && typeof bot.sendPhoto === 'function') {
                await bot.sendPhoto(chatId, stream, { caption });
            } else if (isVideo && typeof bot.sendVideo === 'function') {
                await bot.sendVideo(chatId, stream, { caption });
            } else {
                await bot.sendDocument(chatId, stream, { caption });
            }

            return { status: 'Success', message: `Successfully sent ${path.basename(resolvedPath)} to Telegram chat.` };
        }
    };
}

