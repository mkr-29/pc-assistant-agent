import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig, validateConfig } from '../../src/config/env.js';

const baseEnv = {
    PORT: '3000',
    TELEGRAM_BOT_TOKEN: 'telegram-token',
    MY_TELEGRAM_CHAT_ID: '123',
    LLM_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'gemini-key'
};

test('loadConfig applies browser automation defaults', () => {
    const config = loadConfig(baseEnv);

    assert.deepEqual(config.browser, {
        headless: true,
        timeoutMs: 30000,
        screenshotDirectory: '.data/browser-screenshots'
    });
    assert.deepEqual(config.saferCommandApprovals, {
        enabled: true,
        timeoutMs: 300000,
        manyFileWriteThreshold: 5
    });
    assert.deepEqual(config.voiceNotes, {
        transcriptionModel: 'gemini-2.5-flash',
        maxBytes: 18000000
    });
    assert.doesNotThrow(() => validateConfig(config));
});

test('loadConfig always uses Gemini as the primary agent provider', () => {
    const config = loadConfig({
        ...baseEnv,
        LLM_PROVIDER: 'azure'
    });

    assert.equal(config.llmProvider, 'gemini');
    assert.doesNotThrow(() => validateConfig(config));
});

test('loadConfig applies Groq fallback defaults', () => {
    const config = loadConfig(baseEnv);

    assert.deepEqual(config.groq, {
        apiKey: undefined,
        model: 'llama-3.3-70b-versatile',
        baseUrl: 'https://api.groq.com/openai/v1'
    });
    assert.deepEqual(config.inception, {
        apiKey: undefined,
        model: 'mercury-2',
        baseUrl: 'https://api.inceptionlabs.ai/v1'
    });
    assert.doesNotThrow(() => validateConfig(config));
});

test('loadConfig reads Groq fallback environment values', () => {
    const config = loadConfig({
        ...baseEnv,
        GROQ_API_KEY: 'groq-key',
        GROQ_MODEL: 'openai/gpt-oss-120b',
        GROQ_BASE_URL: 'https://example.test/openai/v1'
    });

    assert.deepEqual(config.groq, {
        apiKey: 'groq-key',
        model: 'openai/gpt-oss-120b',
        baseUrl: 'https://example.test/openai/v1'
    });
    assert.doesNotThrow(() => validateConfig(config));
});

test('loadConfig reads Inception fallback environment values', () => {
    const config = loadConfig({
        ...baseEnv,
        INCEPTION_API_KEY: 'inception-key',
        INCEPTION_MODEL: 'custom-mercury',
        INCEPTION_BASE_URL: 'https://example.test/v1'
    });

    assert.deepEqual(config.inception, {
        apiKey: 'inception-key',
        model: 'custom-mercury',
        baseUrl: 'https://example.test/v1'
    });
    assert.doesNotThrow(() => validateConfig(config));
});

test('loadConfig parses browser automation environment values', () => {
    const config = loadConfig({
        ...baseEnv,
        BROWSER_HEADLESS: 'false',
        BROWSER_TIMEOUT_MS: '1500',
        BROWSER_SCREENSHOT_DIR: 'screens/browser'
    });

    assert.deepEqual(config.browser, {
        headless: false,
        timeoutMs: 1500,
        screenshotDirectory: 'screens/browser'
    });
});

test('validateConfig rejects invalid browser automation values', () => {
    const config = loadConfig({
        ...baseEnv,
        BROWSER_HEADLESS: 'maybe',
        BROWSER_TIMEOUT_MS: '0'
    });

    assert.throws(
        () => validateConfig(config),
        /BROWSER_HEADLESS must be true or false[\s\S]*BROWSER_TIMEOUT_MS must be a positive integer/
    );
});

test('loadConfig parses safer command approval environment values', () => {
    const config = loadConfig({
        ...baseEnv,
        SAFER_COMMAND_APPROVALS_ENABLED: 'false',
        APPROVAL_TIMEOUT_MS: '15000',
        MANY_FILE_WRITE_APPROVAL_THRESHOLD: '10'
    });

    assert.deepEqual(config.saferCommandApprovals, {
        enabled: false,
        timeoutMs: 15000,
        manyFileWriteThreshold: 10
    });
});

test('validateConfig rejects invalid safer command approval values', () => {
    const config = loadConfig({
        ...baseEnv,
        SAFER_COMMAND_APPROVALS_ENABLED: 'maybe',
        APPROVAL_TIMEOUT_MS: '0',
        MANY_FILE_WRITE_APPROVAL_THRESHOLD: '-1'
    });

    assert.throws(
        () => validateConfig(config),
        /SAFER_COMMAND_APPROVALS_ENABLED must be true or false[\s\S]*APPROVAL_TIMEOUT_MS must be a positive integer[\s\S]*MANY_FILE_WRITE_APPROVAL_THRESHOLD must be a positive integer/
    );
});

test('loadConfig parses voice-note environment values', () => {
    const config = loadConfig({
        ...baseEnv,
        VOICE_TRANSCRIPTION_MODEL: 'gemini-2.5-pro',
        VOICE_NOTE_MAX_BYTES: '5000000'
    });

    assert.deepEqual(config.voiceNotes, {
        transcriptionModel: 'gemini-2.5-pro',
        maxBytes: 5000000
    });
});

test('validateConfig rejects invalid voice-note values', () => {
    const config = loadConfig({
        ...baseEnv,
        VOICE_NOTE_MAX_BYTES: '0'
    });

    assert.throws(
        () => validateConfig(config),
        /VOICE_NOTE_MAX_BYTES must be a positive integer/
    );
});
