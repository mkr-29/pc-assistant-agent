# Configuration

Configuration is loaded from `.env` through `src/config/env.js`.

## Required

- `TELEGRAM_BOT_TOKEN`: Telegram bot token.
- `MY_TELEGRAM_CHAT_ID`: The only Telegram chat ID allowed to use the assistant.
- `LLM_PROVIDER`: `gemini` or `azure`.

## Gemini

- `GEMINI_API_KEY`: Required when `LLM_PROVIDER=gemini`. Also used if Azure routing selects a Gemini model or falls back to Gemini.

## Azure OpenAI

- `AZURE_OPENAI_API_KEY`: Azure OpenAI key.
- `AZURE_OPENAI_ENDPOINT`: Azure OpenAI resource endpoint.
- `AZURE_OPENAI_DEPLOYMENT`: Deployment name used for Azure calls. Defaults to `gpt-5.5`.
- `AZURE_OPENAI_API_VERSION`: API version. Defaults to `2024-08-01-preview`.

## Runtime

- `PORT`: Express server port. Defaults to `3000`.
- `TELEGRAM_MODE`: Set to `polling` for local polling.
- `WEBHOOK_URL`: If set and `TELEGRAM_MODE` is not `polling`, the app skips polling and relies on `POST /telegram-webhook`.
- `TARGET_PROJECT_PATH`: Default workspace root for relative file paths and command working directories. Absolute paths and `~` paths bypass this root.

## Browser Automation

- `BROWSER_HEADLESS`: Whether the managed Playwright browser runs headless. Defaults to `true`.
- `BROWSER_TIMEOUT_MS`: Navigation and interaction timeout in milliseconds. Defaults to `30000`.
- `BROWSER_SCREENSHOT_DIR`: Directory for browser screenshots. Defaults to `.data/browser-screenshots`.

The browser tools use a managed Chromium session owned by this app. If Playwright reports that Chromium is missing, run `npx playwright install chromium` from the project directory.
