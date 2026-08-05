import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const DEFAULT_SCREENSHOT_DIRECTORY = path.resolve(process.cwd(), '.data/screenshots');
const DEFAULT_SCREEN_ANALYSIS_MODEL = 'gemini-2.5-flash';
const DEFAULT_SCREEN_QUESTION = 'Describe what is visible on this screen. Include any readable errors, dialogs, active apps, and useful next steps.';

function sanitizeFileName(fileName) {
    const baseName = path.basename(String(fileName || '').trim());
    const withoutExtension = baseName.replace(/\.[^.]+$/, '');
    const safeName = withoutExtension
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '');

    return safeName || 'screenshot';
}

function formatTimestamp(date) {
    return date.toISOString().replace(/[:.]/g, '-');
}

export function createScreenshotPath({ fileName, screenshotDirectory = DEFAULT_SCREENSHOT_DIRECTORY, now = () => new Date() } = {}) {
    const safeBaseName = fileName
        ? sanitizeFileName(fileName)
        : `screenshot-${formatTimestamp(now())}`;

    return path.join(screenshotDirectory, `${safeBaseName}.png`);
}

function formatCaptureError(error) {
    const detail = error?.stderr || error?.message || '';
    const suffix = detail ? ` Details: ${detail}` : '';

    return `Failed to capture screenshot. On macOS, grant Screen Recording permission to the terminal or app running this bot, then retry.${suffix}`;
}

export async function defaultCaptureScreenshot(filePath) {
    if (process.platform !== 'darwin') {
        throw new Error('Screen capture is currently supported only on macOS.');
    }

    try {
        await execFileAsync('/usr/sbin/screencapture', ['-x', filePath]);
    } catch (error) {
        throw new Error(formatCaptureError(error));
    }
}

export async function defaultAnalyzeScreenshot({ ai, modelName, filePath, question }) {
    const imageData = fs.readFileSync(filePath, 'base64');
    const response = await ai.models.generateContent({
        model: modelName,
        contents: [
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: imageData
                }
            },
            {
                text: question || DEFAULT_SCREEN_QUESTION
            }
        ]
    });

    return response.text || '';
}

export function createScreenTools({
    ai,
    config = {},
    screenshotDirectory = DEFAULT_SCREENSHOT_DIRECTORY,
    captureScreenshot = defaultCaptureScreenshot,
    analyzeScreenshot = defaultAnalyzeScreenshot,
    now = () => new Date()
} = {}) {
    async function takeScreenshot({ fileName } = {}) {
        const filePath = createScreenshotPath({ fileName, screenshotDirectory, now });

        try {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            await captureScreenshot(filePath);

            return {
                status: 'Success',
                filePath,
                message: `Screenshot captured at ${filePath}`
            };
        } catch (error) {
            return {
                status: 'Error',
                filePath,
                message: error.message
            };
        }
    }

    return {
        takeScreenshot,

        describeScreen: async ({ question, fileName } = {}) => {
            if (!ai) {
                return {
                    status: 'Error',
                    message: 'Gemini client is not configured. Set GEMINI_API_KEY to use screen understanding.'
                };
            }

            const screenshot = await takeScreenshot({ fileName });
            if (screenshot.status !== 'Success') {
                return screenshot;
            }

            try {
                const description = await analyzeScreenshot({
                    ai,
                    modelName: config.screenAnalysisModel || DEFAULT_SCREEN_ANALYSIS_MODEL,
                    filePath: screenshot.filePath,
                    question
                });

                return {
                    status: 'Success',
                    filePath: screenshot.filePath,
                    description
                };
            } catch (error) {
                return {
                    status: 'Error',
                    filePath: screenshot.filePath,
                    message: `Failed to analyze screenshot: ${error.message}`
                };
            }
        }
    };
}
