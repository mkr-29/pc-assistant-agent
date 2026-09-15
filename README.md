# PC Assistant Agent

A Telegram-controlled local PC assistant with extensive tooling for file system, browser automation, media processing, and more.

## Versions

This repository contains two versions of the PC Assistant Agent:

1. **Original Node.js Implementation** (in the root directory)
2. **Python/LangGraph Reimplementation** (in the `src_py/` directory, on the `langgraph-python-port` branch)

## Python/LangGraph Reimplementation

See [src_py/README_PYTHON.md](src_py/README_PYTHON.md) for detailed information about the Python/LangGraph version.

### Quick Start for Python Version

1. Switch to the Python/LangGraph branch:
   ```bash
   git checkout langgraph-python-port
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env to add your API keys
   ```

4. Run the agent:
   ```bash
   python src_py/main.py
   ```

### Features Implemented in Python Version

- ✅ Configuration loading and validation
- ✅ Memory systems (conversation history, knowledge memory, user profile)
- ✅ Tool registry and discovery system
- ✅ File system tools (read, write, list, glob, etc.)
- ✅ Terminal tools (command execution, directory changing)
- ✅ Memory interaction tools
- ✅ Agent state definition
- ✅ LangGraph-based agent workflow (planner-agent-reflect)
- ✅ Basic Telegram bot integration framework
- ✅ Comprehensive test suite

### Components Needing Implementation

See [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md) for detailed progress tracking.

- LLM providers (Gemini, Groq, Inception Labs, etc.)
- Remaining tool categories (web interaction, macOS integration, media processing, etc.)
- Enhanced agent logic for complex task execution
- Complete Telegram bot integration

## Original Node.js Implementation

The original Node.js implementation is available in the main branch of this repository. See the root-level README.md for details.

## License

ISC License - see the [LICENSE](LICENSE) file for details.