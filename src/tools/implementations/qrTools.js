import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';

const DEFAULT_QR_DIR = path.resolve(process.cwd(), '.data/qr-codes');

function formatTimestamp(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}

export function createQrTools({ resolveToolPath = p => p, qrDirectory = DEFAULT_QR_DIR } = {}) {
    return {
        generateQrCode: async ({
            text,
            width = 400,
            margin = 2,
            color = '#000000',
            backgroundColor = '#ffffff',
            outputPath = null
        } = {}) => {
            if (!text || typeof text !== 'string') {
                return { status: 'Error', message: 'A text or URL string is required to generate a QR code.' };
            }

            try {
                fs.mkdirSync(qrDirectory, { recursive: true });

                const savePath = outputPath
                    ? resolveToolPath(outputPath)
                    : path.join(qrDirectory, `qr-${formatTimestamp()}.png`);

                fs.mkdirSync(path.dirname(savePath), { recursive: true });

                await QRCode.toFile(savePath, text.trim(), {
                    width: Math.max(100, Math.min(Number(width) || 400, 2000)),
                    margin: Math.max(0, Math.min(Number(margin) || 2, 10)),
                    color: {
                        dark: color.startsWith('#') ? color : `#${color}`,
                        light: backgroundColor.startsWith('#') ? backgroundColor : `#${backgroundColor}`
                    }
                });

                const stats = fs.statSync(savePath);

                return {
                    status: 'Success',
                    filePath: savePath,
                    text: text.trim(),
                    fileSizeBytes: stats.size,
                    message: `QR code generated and saved to ${savePath}. Deliver it to Telegram using sendTelegramFile.`
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to generate QR code: ${error.message}`
                };
            }
        }
    };
}
