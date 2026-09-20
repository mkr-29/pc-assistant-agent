"""
Test for the LangGraph agent graph compilation and execution.
"""
import pytest
import asyncio
import os
import sys
from unittest.mock import AsyncMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from agent.graph import agent_graph
from agent.state import AgentState

def test_agent_initialization():
    """Test that the agent graph compiles and exists"""
    assert agent_graph is not None

@pytest.mark.asyncio
async def test_agent_invoke_structure():
    """Test that the agent graph executes end-to-end through LangGraph ainvoke"""
    initial_state = {
        "user_prompt": "List files in the working directory",
        "chat_id": "test_agent_user",
        "conversation_history": [],
        "knowledge_memory": [],
        "user_profile": {},
        "current_plan": "",
        "plan_step": 0,
        "max_steps": 4,
        "execution_results": [],
        "tools_used": [],
        "needs_more_steps": True,
        "is_complete": False,
        "error": None,
        "reflection": "",
        "model_used": "",
        "timestamp": ""
    }

    with patch("agent.nodes.LLMFallbackFactory.generate_text_with_fallback", new_callable=AsyncMock) as mock_gen, \
         patch("agent.nodes.LLMFallbackFactory.generate_text_with_tools_fallback", new_callable=AsyncMock) as mock_tool_call:

        mock_gen.side_effect = [
            "1. List directory contents",
            "Found project files including README.md and src_py."
        ]

        mock_tool_call.return_value = {
            "text": "Listing files",
            "tool_calls": [
                {
                    "id": "c1",
                    "name": "list_directory",
                    "arguments": {"directory_path": "."}
                }
            ]
        }

        final_state = await agent_graph.ainvoke(initial_state)

        assert final_state["is_complete"] is True
        assert "list_directory" in final_state["tools_used"]
        assert len(final_state["execution_results"]) >= 1
        assert "Found project files" in final_state["reflection"]

if __name__ == "__main__":
    async def main():
        print("Running agent tests...\n")
        test_agent_initialization()
        print("✓ Agent graph initialized")
        await test_agent_invoke_structure()
        print("✓ Agent invocation verified")
        print("\n🎉 All agent tests passed!")

    asyncio.run(main())