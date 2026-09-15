# PC Assistant Agent - Python/LangGraph Implementation

This is a Python reimplementation of the PC Assistant Agent using the LangGraph framework. The original Node.js implementation can be found in the main repository.

## Features

- Telegram-controlled local PC assistant
- Extensive tooling for file system, browser automation, media processing, and more
- LLM fallback system (Gemini, Groq, Inception Labs, etc.)
- Persistent memory for conversation history, knowledge, and user profile
- Plugin-based tool architecture
- Special command handling (/remember, /memories, etc.)

## Architecture

### Core Components

1. **main.py** - Entry point that initializes the agent and handles Telegram integration
2. **agent/** - Contains the LangGraph agent definition
   - `state.py` - Defines the agent state structure
   - `nodes.py` - Contains the agent nodes (planner, agent, fallback, reflect)
   - `graph.py` - Constructs the LangGraph state graph
3. **tools/** - Python implementations of the original JavaScript tools
   - `filesystem.py` - File system operations
   - `terminal.py` - Terminal command execution
   - `telegram.py` - Telegram messaging
   - `memory.py` - Memory store interactions
   - And more organized by category
4. **llm/** - LLM provider wrappers with fallback mechanism
   - `base.py` - Abstract base class for LLM providers
   - `gemini.py` - Gemini provider implementation
   - `factory.py` - Factory for creating providers with fallback
5. **memory/** - Persistent storage implementations
   - `stores.py` - Conversation history, knowledge memory, and user profile stores
6. **config/** - Configuration management
   - `env.py` - Loads and validates environment variables

## Installation

1. Clone the repository and switch to the `langgraph-python-port` branch:
   ```bash
   git checkout langgraph-python-port
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Copy the environment template and fill in the required values:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` to add your API keys:
   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   MY_TELEGRAM_CHAT_ID=your_telegram_chat_id
   GEMINI_API_KEY=your_gemini_api_key
   # Add other API keys as needed
   ```

## Usage

Start the agent:
```bash
python src_py/main.py
```

The agent will start and be ready to process Telegram messages.

## Available Tools

The agent includes rewritten versions of the original JavaScript tools, organized by category:

### Web Interaction & Automation
- aiWebAgentTools (conceptual)
- browserTools (using Playwright)
- cdpTools (Chrome DevTools Protocol)
- mcpTools (Model Context Protocol)
- youtubeTranscriptTools

### AI-Powered Agents
- screenTools (screenshot + analysis)

### macOS System Integration
- appControlTools (launching/controlling apps)
- appleTools (AppleScript execution)
- hardwareTools (system information)
- terminalTools (command execution)
- windowTools (window management)
- clipboardTools (clipboard access)
- ocrTools (optical character recognition)
- voiceTools (text-to-speech)
- voiceResponseTools (voice recording)

### File & Data Management
- filesystemTools (file operations)
- downloadTools (HTTP downloads)
- documentTools (document processing)
- imageTools (image manipulation)
- mediaTools (audio/video processing)
- qrTools (QR code generation)

### Content Generation & Processing
- chartTools (chart generation)
- (Other tools as listed above)

### Memory & Knowledge
- memoryTools (persistent storage)

### Utilities & Helpers
- projectTools (git, npm, etc.)
- reminderTools (scheduling)
- telegramFileTools (sending files via Telegram)
- financeTools (financial data)
- firecrawlTools (web scraping)

## Configuration

The agent uses the same environment variables as the original Node.js implementation. See `.env.example` for a complete list.

## Implementation Notes

This is a simplified implementation focusing on the core architecture. Some advanced features from the original implementation (like Chrome Extension tools, Stagehand/AI Web Agent, etc.) are noted as "coming soon" or would require additional implementation work.

The LangGraph implementation provides:
- Stateful agent execution
- Planner-agent-reflect workflow
- Error handling with fallback nodes
- Easy extensibility for new tools and capabilities

## Future Work

- Complete implementation of all tool categories
- Full Telegram bot integration with python-telegram-bot
- Advanced LLM provider implementations (Groq, Inception, etc.)
- Chrome extension communication alternatives
- Stagehand/AI Web Agent equivalents
- Comprehensive testing suite
- Performance optimization