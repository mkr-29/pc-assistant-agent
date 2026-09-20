"""
Basic test for the PC Assistant Agent Python implementation.
"""
import asyncio
import os
import tempfile
import shutil
import sys
import pytest

# Add current directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

@pytest.mark.asyncio
async def test_config_loading():
    """Test that configuration loads correctly and validates"""
    from config.env import load_config, validate_config, get_masked_config

    config = load_config()
    assert config is not None
    # Test masked configuration
    masked = get_masked_config(config)
    assert masked is not None

@pytest.mark.asyncio
async def test_memory_stores():
    """Test that memory stores work correctly"""
    from memory.stores import ConversationHistoryStore, KnowledgeMemoryStore, UserProfileStore

    test_dir = tempfile.mkdtemp()
    try:
        conv_store = ConversationHistoryStore(test_dir)
        conv_store.appendTurn("test_chat", "Hello", "Hi there!")
        history = conv_store.getHistory("test_chat")
        assert len(history) == 2
        assert history[0]["content"] == "Hello"
        assert history[1]["content"] == "Hi there!"

        knowledge_store = KnowledgeMemoryStore(test_dir)
        knowledge_store.addMemory("Test fact")
        memories = knowledge_store.listMemories()
        assert len(memories) == 1
        assert memories[0]["fact"] == "Test fact"

        profile_store = UserProfileStore(test_dir)
        profile_store.updateUserProfile({"test_key": "test_value"})
        profile = profile_store.getUserProfile()
        assert profile["test_key"] == "test_value"

    finally:
        shutil.rmtree(test_dir)

@pytest.mark.asyncio
async def test_tool_registry():
    """Test that the tool registry works"""
    from tools.registry import tool_registry, register_tool

    @register_tool("test_basic_tool", "test")
    def test_basic_tool(param: str) -> dict:
        """Sample docstring for basic tool"""
        return {"result": f"Processed: {param}"}

    tools = tool_registry.list_tools()
    assert "test_basic_tool" in tools

    func = tool_registry.get_tool("test_basic_tool")
    assert func is not None
    result = func("test")
    assert result["result"] == "Processed: test"

@pytest.mark.asyncio
async def test_filesystem_tools():
    """Test basic filesystem tools with path resolution"""
    from tools.filesystem import read_file, write_file, list_directory

    test_dir = tempfile.mkdtemp()
    try:
        test_file = os.path.join(test_dir, "test.txt")
        write_result = write_file(test_file, "Hello, World!")
        assert write_result["success"] is True

        read_result = read_file(test_file)
        assert read_result["content"] == "Hello, World!"

        list_result = list_directory(test_dir)
        assert "test.txt" in list_result["files"]

    finally:
        shutil.rmtree(test_dir)

@pytest.mark.asyncio
async def test_agent_state():
    """Test that agent state structure works"""
    from agent.state import AgentState

    assert AgentState is not None

if __name__ == "__main__":
    async def main():
        print("Running basic tests for PC Assistant Agent Python implementation...\n")
        await test_config_loading()
        print("✓ Config loading test passed")
        await test_memory_stores()
        print("✓ Memory stores test passed")
        await test_tool_registry()
        print("✓ Tool registry test passed")
        await test_filesystem_tools()
        print("✓ Filesystem tools test passed")
        await test_agent_state()
        print("✓ Agent state test passed")
        print("\n🎉 All basic tests passed!")

    asyncio.run(main())