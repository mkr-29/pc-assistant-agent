# PC Assistant Agent - Python/LangGraph Demo

This demo shows how to use the Python/LangGraph reimplementation of the PC Assistant Agent.

## Setup

1. Install dependencies:
   ```bash
   # Create virtual environment (if not already done)
   python3 -m venv venv
   source venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env to add your API keys
   ```

## Usage

### Running the Agent

```bash
python src_py/main.py
```

### Using the Agent Programmatically

You can also use the agent directly in your Python code:

```python
import asyncio
from src_py.agent.graph import agent_graph

async def demo():
    # Prepare initial state
    initial_state = {
        "user_prompt": "List the files in the current directory",
        "chat_id": "demo123",
        "conversation_history": [],
        "knowledge_memory": [],
        "user_profile": {},
        "current_plan": "",
        "plan_step": 0,
        "execution_results": [],
        "tools_used": [],
        "needs_more_steps": True,
        "is_complete": False,
        "error": None,
        "reflection": "",
        "model_used": "",
        "timestamp": ""
    }
    
    # Run the agent
    result = await agent_graph.ainvoke(initial_state)
    print("Agent result:", result)

# Run the demo
asyncio.run(demo())
```

## What's Implemented

### Core Components
- **Configuration System**: Loads and validates environment variables
- **Memory Systems**: Conversation history, knowledge memory, and user profile
- **LLM Provider Factory**: With fallback mechanism (Gemini → Groq → Inception → etc.)
- **Tool System**: Plugin-based architecture with registration and discovery
- **LangGraph Agent**: Planner-agent-reflect workflow with error handling
- **Telegram Integration**: Full bot integration (in progress)

### Working Components
✅ Configuration loading and validation
✅ Memory stores (conversation history, knowledge memory, user profile)
✅ Tool registry and filesystem tools (read, write, list, glob, etc.)
✅ Terminal tools (command execution, directory changing)
✅ Agent state definition and LangGraph graph construction
✅ Basic agent nodes (planner, agent, fallback, reflect)
✅ Import and basic functionality tests

### Next Steps
To complete the implementation, you would need to:

1. **Implement LLM Providers**:
   - Complete the Gemini provider in `src_py/llm/gemini.py`
   - Implement other providers (Groq, Inception, etc.) following the same pattern

2. **Implement Remaining Tools**:
   - Web interaction tools (browser automation, AI web agent, etc.)
   - macOS system integration tools (AppleScript, hardware info, etc.)
   - Media processing tools (image, video, audio)
   - Content generation tools (charts, QR codes, etc.)
   - Utility tools (project tools, reminders, etc.)

3. **Enhance the Agent Logic**:
   - Improve the planner to create more detailed, executable plans
   - Enhance the agent node to actually execute tool calls from the plan
   - Add more sophisticated reflection and error handling

4. **Complete Telegram Integration**:
   - Implement actual message handling with python-telegram-bot
   - Add multimedia processing (voice transcription, image analysis)
   - Implement command handling for all special commands

## Architecture Overview

```
main.py
├── config/
│   └── env.py              # Configuration loading
├── memory/
│   └── stores.py           # Memory storage implementations
├── llm/
│   ├── base.py             # LLM provider base class
│   ├── gemini.py           # Gemini provider (template)
│   └── factory.py          # LLM factory with fallback
├── tools/
│   ├── registry.py         # Tool registration system
│   ├── filesystem.py       # File system tools
│   ├── terminal.py         # Terminal tools
│   └── memory.py           # Memory interaction tools
├── agent/
│   ├── state.py            # Agent state definition
│   ├── nodes.py            # LangGraph nodes
│   └── graph.py            # Agent graph construction
└── telegram/
    └── bot.py              # Telegram bot integration
```

## Design Principles

1. **Modularity**: Each component is loosely coupled and can be developed/tested independently
2. **Fallback Resilience**: LLM providers have automatic fallback for robustness
3. **Extensibility**: New tools can be added simply by registering them with the tool registry
4. **State Management**: LangGraph provides explicit state transitions and persistence capabilities
5. **Telegram-First**: Designed primarily for Telegram interaction with webhook/polling support

## Testing

Run the tests to verify functionality:
```bash
# Basic functionality tests
.venv/bin/python src_py/test_basic.py

# Structure tests
.venv/bin/python src_py/test_structure.py

# Agent tests
.venv/bin/python src_py/test_agent.py
```

## Dependencies

See `requirements.txt` for the complete list. Key dependencies include:
- python-telegram-bot
- langchain-core
- langgraph
- google-generativeai
- python-dotenv
- And various libraries for file processing, media handling, etc.

## Future Enhancements

1. Add more sophisticated planning and execution capabilities
2. Implement persistent checkpoints for long-running agent sessions
3. Add streaming responses for better user experience
4. Implement tool usage tracking and analytics
5. Add support for multiple concurrent chats
6. Enhance error recovery and retry mechanisms