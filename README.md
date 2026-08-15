# PC Assistant Agent

A Telegram-controlled local PC assistant that can read and write files, list directories, inspect codebases, run project checks, inspect git changes, run shell commands, open local macOS apps/files/folders, read and write clipboard text, automate a managed browser, schedule reminders and recurring checks, and send local files back through Telegram. The agent uses Gemini 2.5 Flash first, falls back to Groq Llama 3.3 70B when Gemini fails, and then falls back to Inception Labs Mercury 2 if Groq also fails.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env
```

3. Fill in the required values:

- `TELEGRAM_BOT_TOKEN`
- `MY_TELEGRAM_CHAT_ID`
- `GEMINI_API_KEY`
- `GROQ_API_KEY` for fallback execution
- `INCEPTION_API_KEY` for third-level fallback execution

Optional Groq fallback settings:

- `GROQ_API_KEY` enables Groq fallback when Gemini 2.5 Flash fails.
- `GROQ_MODEL` defaults to `llama-3.3-70b-versatile`.
- `GROQ_BASE_URL` defaults to `https://api.groq.com/openai/v1`.

Optional Inception Labs fallback settings:

- `INCEPTION_API_KEY` enables Inception Labs fallback when Groq also fails.
- `INCEPTION_MODEL` defaults to `mercury-2`.
- `INCEPTION_BASE_URL` defaults to `https://api.inceptionlabs.ai/v1`.

Optional browser automation settings:

- `BROWSER_HEADLESS` defaults to `true`.
- `BROWSER_TIMEOUT_MS` defaults to `30000`.
- `BROWSER_SCREENSHOT_DIR` defaults to `.data/browser-screenshots`.

Optional Telegram voice-note settings:

- `VOICE_TRANSCRIPTION_MODEL` defaults to `gemini-2.5-flash`.
- `VOICE_NOTE_MAX_BYTES` defaults to `18000000`.
- Voice notes require `GEMINI_API_KEY` for Gemini audio transcription.

Optional safer command approval settings:

- `SAFER_COMMAND_APPROVALS_ENABLED` defaults to `true`.
- `APPROVAL_TIMEOUT_MS` defaults to `300000` (5 minutes).
- `MANY_FILE_WRITE_APPROVAL_THRESHOLD` defaults to `5` distinct files per agent run.

If Chromium is not already installed for Playwright, run:

```bash
npx playwright install chromium
```

4. Start the assistant:

```bash
npm start
```

For local development with restart-on-change:

```bash
npm run dev
```

## Project Structure

- `src/main.js` starts the bot, Express app, and HTTP server.
- `src/config/` loads and validates environment configuration.
- `src/server/` contains Express routes and server startup.
- `src/telegram/` handles Telegram polling, webhook messages, auth checks, and responses.
- `src/agent/` owns the high-level planning and execution loop.
- `src/llm/` isolates Gemini, Azure OpenAI, and model routing logic.
- `src/reminders/` stores and runs local scheduled reminders and recurring agent tasks.
- `src/tools/` contains tool definitions, provider adapters, and side-effecting tool implementations.
- `src/utils/` contains shared helpers such as path resolution.
- `test/` contains focused unit and integration tests.

## Configuration Notes

`TARGET_PROJECT_PATH` controls the default root for project-relative file paths, smart file search, and terminal commands. Absolute paths and `~` paths are still supported.

When safer command approvals are enabled, risky terminal commands and sensitive or bulk file writes require a Telegram reply before execution. Reply with `APPROVE <id>` to continue or `DENY <id>` to skip the action. Approvals fail closed on timeout or malformed approval replies.

Clipboard access uses the native macOS `pbpaste` and `pbcopy` commands, so it does not require extra environment variables.

Local app and path opening is macOS-only and uses the native `open` command. It can launch apps such as Chrome, VS Code, Finder, and Terminal, open files or folders, and reveal paths in Finder.

When `TELEGRAM_MODE=polling`, or when `WEBHOOK_URL` is not set, the bot uses Telegram polling. The Express webhook route is always available at `POST /telegram-webhook`.

Telegram voice messages are supported in both polling and webhook modes. The bot transcribes a voice note, executes it when it contains a clear instruction, or replies with a concise summary when it is only notes or context.

## Task Reminders

The assistant can schedule local Telegram reminders and recurring agent checks from natural language prompts:

- `Remind me in 30 minutes to stretch.`
- `Every day at 9 AM, run a quick status check of my target project.`
- `List my scheduled tasks.`
- `Cancel scheduled task <task_id>.`

Scheduled state is stored locally at `.data/scheduled-tasks.json`, which is ignored by git. The Node app must be running for reminders and scheduled checks to fire; pending tasks are restored when the app starts again.

## Long-Term Knowledge Memory

The assistant can store global long-term facts separately from Telegram conversation history:

- `/remember <fact>` saves a durable fact, such as a preferred folder, project, coding style, or common command.
- `/memories` lists saved long-term facts.
- `/forget_memory <memory_id>` deletes one saved fact.

Knowledge memory is stored locally at `.data/knowledge-memory.json`, which is ignored by git. `/new_convo` clears only the current chat context; saved long-term memory remains available to future agent runs and scheduled agent tasks.

## Coding Workflow Helpers

The assistant has dedicated project helpers for coding tasks:

- `inspectProject` detects package scripts and git availability.
- `runProjectTests` runs the detected test script, such as `npm test` for Node projects.
- `runProjectLint` runs lint only when the target project already defines a lint script; otherwise it reports that lint is not configured.
- `getGitStatus` and `summarizeGitDiff` inspect local git state without changing it.
- `createGitCommit` creates a local commit only after explicit user confirmation and never pushes.

## MCP & Web Intelligence Tools

The assistant includes specialized Model Context Protocol (MCP) and web intelligence tools:

- **Brave Web & Local Search** (`braveWebSearch`, `braveLocalSearch`): Real-time web search and local place lookup.
- **Fetch MCP** (`fetchUrl`): Fast web page fetching with clean Markdown conversion without headless browser overhead.
- **PDF & Document Extractor** (`extractPdfText`, `extractPdfMetadata`): Extracts text, page counts, and document metadata from local PDF files.
- **Pandoc Document Converter** (`convertDocumentWithPandoc`): Converts documents between Markdown, HTML, PDF, DOCX, LaTeX, RTF, and text.
- **macOS Vision OCR** (`performVisionOcr`): Native Apple Vision framework OCR and multimodal OCR for images, receipts, and screenshots.
- **Chart & Visualization Generator** (`generateChartImage`): Generates bar, line, pie, doughnut, radar, and scatter chart images ready for Telegram delivery.
- **YouTube Transcript & Chapters** (`getYoutubeTranscript`): Fetches complete transcripts, timestamps, and chapters from YouTube video URLs.
- **Sitemap & Web Documentation Crawler** (`parseSitemap`, `crawlWebDocumentation`): Parses sitemaps and recursively crawls web documentation into local Markdown files.
- **Mac Clipboard History** (`getMacClipboardHistory`, `searchClipboardHistory`): Searches and retrieves past clipboard history entries (integrated with Maccy and local history store).
- **Apple Calendar & Reminders** (`getCalendarEvents`, `createCalendarEvent`, `createAppleReminder`): Queries today's schedule, creates calendar events, and adds tasks to Apple Reminders.
- **Apple Notes Manager** (`searchAppleNotes`, `readAppleNote`, `createAppleNote`, `appendAppleNote`): Searches, reads, creates, and appends to native Apple Notes.
- **Apple Shortcuts Runner** (`listAppleShortcuts`, `runAppleShortcut`): Inspects and executes configured macOS Shortcuts workflows.
- **Telegram Voice-Note Reply & Speech** (`sendVoiceNoteResponse`, `speakText`): Speaks text aloud on Mac speakers or delivers spoken voice note bubbles to Telegram.
- **Universal Local Audio Transcriber** (`transcribeAudioFile`): Transcribes local audio recordings (.mp3, .m4a, .wav) with Gemini multimodal AI.
- **Stock, Crypto & FX Currency** (`getStockPrice`, `getCryptoPrice`, `convertCurrency`): Real-time stock quotes, cryptocurrency prices, and foreign exchange currency conversions.
- **macOS Window & Workspace Manager** (`listOpenWindows`, `focusWindow`, `tileWindows`, `minimizeAllWindows`): Lists active application windows, focuses apps, tiles windows side-by-side (50/50 split), and minimizes windows.
- **QR Code & Barcode Generator** (`generateQrCode`): Generates high-resolution PNG QR codes (URLs, text, Wi-Fi credentials) ready for Telegram delivery.
- **Bluetooth Device Manager** (`connectBluetoothDevice`): Connects or disconnects paired Bluetooth headphones, AirPods, or peripherals.
- **Display Brightness Controller** (`setDisplayBrightness`): Sets MacBook and external display brightness (0-100%).

## Testing

```bash
npm test
```