import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_PORT = 3000;
const DEFAULT_AZURE_API_VERSION = '2024-08-01-preview';
const DEFAULT_AZURE_DEPLOYMENT = 'gpt-5.5';
const DEFAULT_SCREEN_ANALYSIS_MODEL = 'gemini-2.5-flash';
const DEFAULT_BROWSER_TIMEOUT_MS = 30000;
const DEFAULT_BROWSER_SCREENSHOT_DIRECTORY = '.data/browser-screenshots';
const DEFAULT_APPROVAL_TIMEOUT_MS = 300000;
const DEFAULT_MANY_FILE_WRITE_APPROVAL_THRESHOLD = 5;
const DEFAULT_VOICE_TRANSCRIPTION_MODEL = 'gemini-2.5-flash';
const DEFAULT_VOICE_NOTE_MAX_BYTES = 18000000;
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_INCEPTION_MODEL = 'mercury-2';
const DEFAULT_INCEPTION_BASE_URL = 'https://api.inceptionlabs.ai/v1';
const DEFAULT_SARVAM_MODEL = 'sarvam-105b';
const DEFAULT_SARVAM_BASE_URL = 'https://api.sarvam.ai/v1';
const DEFAULT_ARCEE_MODEL = 'zai-org/glm-5.2';
const DEFAULT_ARCEE_BASE_URL = 'https://api.arcee.ai/api/v1';
const DEFAULT_LONGCAT_MODEL = 'LongCat-2.0';
const DEFAULT_LONGCAT_BASE_URL = 'https://api.longcat.chat/openai/v1';
const DEFAULT_THINKING_MACHINE_MODEL = 'inkling';
const DEFAULT_THINKING_MACHINE_BASE_URL = 'https://api.thinkingmachines.ai/v1';

function parseBooleanEnv(value, defaultValue) {
    if (value === undefined || value === '') {
        return defaultValue;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
        return false;
    }

    return value;
}

export function loadConfig(env = process.env) {
    const port = Number(env.PORT || DEFAULT_PORT);
    const browserTimeoutMs = Number(env.BROWSER_TIMEOUT_MS || DEFAULT_BROWSER_TIMEOUT_MS);
    const approvalTimeoutMs = Number(env.APPROVAL_TIMEOUT_MS || DEFAULT_APPROVAL_TIMEOUT_MS);
    const manyFileWriteThreshold = Number(
        env.MANY_FILE_WRITE_APPROVAL_THRESHOLD || DEFAULT_MANY_FILE_WRITE_APPROVAL_THRESHOLD
    );
    const voiceNoteMaxBytes = Number(env.VOICE_NOTE_MAX_BYTES || DEFAULT_VOICE_NOTE_MAX_BYTES);

    return {
        port,
        telegramBotToken: env.TELEGRAM_BOT_TOKEN,
        allowedChatId: env.MY_TELEGRAM_CHAT_ID,
        telegramMode: env.TELEGRAM_MODE,
        webhookUrl: env.WEBHOOK_URL,
        llmProvider: 'gemini',
        geminiApiKey: env.GEMINI_API_KEY,
        groq: {
            apiKey: env.GROQ_API_KEY,
            model: env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
            baseUrl: env.GROQ_BASE_URL || DEFAULT_GROQ_BASE_URL
        },
        inception: {
            apiKey: env.INCEPTION_API_KEY,
            model: env.INCEPTION_MODEL || DEFAULT_INCEPTION_MODEL,
            baseUrl: env.INCEPTION_BASE_URL || DEFAULT_INCEPTION_BASE_URL
        },
        sarvam: {
            apiKey: env.SARVAM_API_KEY,
            model: env.SARVAM_MODEL || DEFAULT_SARVAM_MODEL,
            baseUrl: env.SARVAM_BASE_URL || DEFAULT_SARVAM_BASE_URL
        },
        arcee: {
            apiKey: env.ARCEE_API_KEY,
            model: env.ARCEE_MODEL || DEFAULT_ARCEE_MODEL,
            baseUrl: env.ARCEE_BASE_URL || DEFAULT_ARCEE_BASE_URL
        },
        longcat: {
            apiKey: env.LONGCAT_API_KEY,
            model: env.LONGCAT_MODEL || DEFAULT_LONGCAT_MODEL,
            baseUrl: env.LONGCAT_BASE_URL || DEFAULT_LONGCAT_BASE_URL
        },
        thinkingMachine: {
            apiKey: env.THINKING_MACHINE_API_KEY,
            model: env.THINKING_MACHINE_MODEL || DEFAULT_THINKING_MACHINE_MODEL,
            baseUrl: env.THINKING_MACHINE_BASE_URL || DEFAULT_THINKING_MACHINE_BASE_URL
        },
        targetProjectPath: env.TARGET_PROJECT_PATH || '~',
        braveApiKey: env.BRAVE_API_KEY,
        screenAnalysisModel: env.SCREEN_ANALYSIS_MODEL || DEFAULT_SCREEN_ANALYSIS_MODEL,
        browser: {
            headless: parseBooleanEnv(env.BROWSER_HEADLESS, true),
            timeoutMs: browserTimeoutMs,
            screenshotDirectory: env.BROWSER_SCREENSHOT_DIR || DEFAULT_BROWSER_SCREENSHOT_DIRECTORY
        },
        saferCommandApprovals: {
            enabled: parseBooleanEnv(env.SAFER_COMMAND_APPROVALS_ENABLED, true),
            timeoutMs: approvalTimeoutMs,
            manyFileWriteThreshold
        },
        voiceNotes: {
            transcriptionModel: env.VOICE_TRANSCRIPTION_MODEL || DEFAULT_VOICE_TRANSCRIPTION_MODEL,
            maxBytes: voiceNoteMaxBytes
        },
        azureOpenAI: {
            endpoint: env.AZURE_OPENAI_ENDPOINT,
            apiKey: env.AZURE_OPENAI_API_KEY,
            deployment: env.AZURE_OPENAI_DEPLOYMENT || DEFAULT_AZURE_DEPLOYMENT,
            apiVersion: env.AZURE_OPENAI_API_VERSION || DEFAULT_AZURE_API_VERSION
        }
    };
}

export function validateConfig(config) {
    const errors = [];

    if (!Number.isInteger(config.port) || config.port <= 0) {
        errors.push('PORT must be a positive integer.');
    }

    if (!config.telegramBotToken) {
        errors.push('TELEGRAM_BOT_TOKEN is required.');
    }

    if (!config.allowedChatId) {
        errors.push('MY_TELEGRAM_CHAT_ID is required.');
    }

    if (typeof config.browser?.headless !== 'boolean') {
        errors.push('BROWSER_HEADLESS must be true or false when provided.');
    }

    if (!Number.isInteger(config.browser?.timeoutMs) || config.browser.timeoutMs <= 0) {
        errors.push('BROWSER_TIMEOUT_MS must be a positive integer when provided.');
    }

    if (!config.browser?.screenshotDirectory) {
        errors.push('BROWSER_SCREENSHOT_DIR must not be empty when provided.');
    }

    if (typeof config.saferCommandApprovals?.enabled !== 'boolean') {
        errors.push('SAFER_COMMAND_APPROVALS_ENABLED must be true or false when provided.');
    }

    if (!Number.isInteger(config.saferCommandApprovals?.timeoutMs) || config.saferCommandApprovals.timeoutMs <= 0) {
        errors.push('APPROVAL_TIMEOUT_MS must be a positive integer when provided.');
    }

    if (
        !Number.isInteger(config.saferCommandApprovals?.manyFileWriteThreshold)
        || config.saferCommandApprovals.manyFileWriteThreshold <= 0
    ) {
        errors.push('MANY_FILE_WRITE_APPROVAL_THRESHOLD must be a positive integer when provided.');
    }

    if (!config.voiceNotes?.transcriptionModel) {
        errors.push('VOICE_TRANSCRIPTION_MODEL must not be empty when provided.');
    }

    if (!Number.isInteger(config.voiceNotes?.maxBytes) || config.voiceNotes.maxBytes <= 0) {
        errors.push('VOICE_NOTE_MAX_BYTES must be a positive integer when provided.');
    }

    if (config.llmProvider === 'gemini' && !config.geminiApiKey) {
        errors.push('GEMINI_API_KEY is required when LLM_PROVIDER=gemini.');
    }

    if (errors.length > 0) {
        throw new Error(`Configuration error:\n${errors.map(error => `- ${error}`).join('\n')}`);
    }
}
