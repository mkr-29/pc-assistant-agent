"""
Integration tests for Agent State Graph, planner, agent execution, reflection, and fallback.
"""
import pytest
import sys
import os
import tempfile
import shutil
from unittest.mock import AsyncMock, patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from agent.graph import agent_graph
from agent.nodes import planner_node, agent_node, reflect_node, fallback_node, _parse_plan_steps
from tools.registry import tool_registry

def test_parse_plan_steps():
    """Test parsing numbered and bulleted plans"""
    plan_1 = """
    Here is the plan:
    1. List directory contents
    2. Read configuration file
    3. Run test suite
    """
    steps = _parse_plan_steps(plan_1)
    assert len(steps) == 3
    assert steps[0] == "List directory contents"
    assert steps[1] == "Read configuration file"
    assert steps[2] == "Run test suite"

    plan_2 = """
    * Fetch documentation
    * Extract URLs
    """
    steps_2 = _parse_plan_steps(plan_2)
    assert len(steps_2) == 2
    assert steps_2[0] == "Fetch documentation"

@pytest.mark.asyncio
async def test_planner_node_execution():
    """Test planner node with mocked LLM response"""
    initial_state = {
        "user_prompt": "Check memory stores and write a report",
        "chat_id": "test_1",
        "knowledge_memory": [],
        "user_profile": {}
    }

    mock_plan = "1. Inspect current directory\n2. Write report to report.txt"

    with patch("agent.nodes.LLMFallbackFactory.generate_text_with_fallback", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_plan

        updated_state = await planner_node(initial_state)

        assert updated_state["current_plan"] == mock_plan
        assert len(updated_state["plan_steps"]) == 2
        assert updated_state["plan_steps"][0] == "Inspect current directory"
        assert updated_state["needs_more_steps"] is True
        assert updated_state["is_complete"] is False

@pytest.mark.asyncio
async def test_agent_node_real_tool_execution():
    """Test agent node executing a real tool call on step 0"""
    test_dir = tempfile.mkdtemp()
    try:
        sample_file = os.path.join(test_dir, "sample.txt")
        with open(sample_file, "w") as f:
            f.write("Test content line 1\nTest content line 2")

        state = {
            "user_prompt": "Read the sample file",
            "plan_steps": [f"Read file at {sample_file}"],
            "plan_step": 0,
            "max_steps": 5,
            "execution_results": [],
            "tools_used": []
        }

        # Mock LLM returning tool call for 'read_file'
        mock_tool_response = {
            "text": "Reading file",
            "tool_calls": [
                {
                    "id": "call_1",
                    "name": "read_file",
                    "arguments": {"file_path": sample_file}
                }
            ]
        }

        with patch("agent.nodes.LLMFallbackFactory.generate_text_with_tools_fallback", new_callable=AsyncMock) as mock_tool_call:
            mock_tool_call.return_value = mock_tool_response

            updated = await agent_node(state)

            assert updated["plan_step"] == 1
            assert len(updated["execution_results"]) == 1
            assert updated["execution_results"][0]["action"] == "read_file"
            assert "read_file" in updated["tools_used"]

            tool_result = updated["execution_results"][0]["result"]
            assert "Test content line 1" in tool_result["content"]
            assert updated["needs_more_steps"] is False

    finally:
        shutil.rmtree(test_dir)

@pytest.mark.asyncio
async def test_reflect_node_synthesis():
    """Test reflect node synthesizes final response from execution results"""
    state = {
        "user_prompt": "What is in file.txt?",
        "current_plan": "1. Read file.txt",
        "execution_results": [
            {
                "step": 1,
                "action": "read_file",
                "result": {"content": "Secret API Port = 8080"}
            }
        ],
        "tools_used": ["read_file"]
    }

    with patch("agent.nodes.LLMFallbackFactory.generate_text_with_fallback", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = "File file.txt contains: Secret API Port = 8080."

        updated = await reflect_node(state)
        assert updated["is_complete"] is True
        assert "Secret API Port = 8080" in updated["reflection"]
        assert updated["final_response"] == updated["reflection"]

@pytest.mark.asyncio
async def test_fallback_node():
    """Test fallback node produces user-friendly error explanation"""
    state = {
        "user_prompt": "Run invalid command",
        "error": "Permission denied accessing /root/secret",
        "execution_results": []
    }

    updated = await fallback_node(state)
    assert updated["is_complete"] is True
    assert "Permission denied" in updated["reflection"]
    assert updated["fallback_applied"] is True

@pytest.mark.asyncio
async def test_end_to_end_agent_graph():
    """Test complete agent workflow from entry to reflect through agent_graph"""
    initial_state = {
        "user_prompt": "Check system info and report",
        "chat_id": "test_e2e",
        "conversation_history": [],
        "knowledge_memory": [],
        "user_profile": {},
        "current_plan": "",
        "plan_step": 0,
        "max_steps": 5,
        "execution_results": [],
        "tools_used": [],
        "needs_more_steps": True,
        "is_complete": False,
        "error": None,
        "reflection": "",
        "model_used": "",
        "timestamp": ""
    }

    # Step 1: Planner returns 1 step
    # Step 2: Agent executes get_system_info
    # Step 3: Reflect synthesizes final message
    with patch("agent.nodes.LLMFallbackFactory.generate_text_with_fallback", new_callable=AsyncMock) as mock_gen, \
         patch("agent.nodes.LLMFallbackFactory.generate_text_with_tools_fallback", new_callable=AsyncMock) as mock_tool_call:

        mock_gen.side_effect = [
            "1. Retrieve system hardware information",  # Planner
            "The system is running on macOS with healthy CPU and RAM usage."  # Reflect
        ]

        mock_tool_call.return_value = {
            "text": "Retrieving hardware statistics",
            "tool_calls": [
                {
                    "id": "call_sys",
                    "name": "get_system_info",
                    "arguments": {}
                }
            ]
        }

        final_state = await agent_graph.ainvoke(initial_state)

        assert final_state["is_complete"] is True
        assert "get_system_info" in final_state["tools_used"]
        assert len(final_state["execution_results"]) >= 1
        assert "healthy CPU" in final_state["reflection"]
