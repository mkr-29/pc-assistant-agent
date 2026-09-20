"""
Structure test for the PC Assistant Agent Python implementation.
"""
import sys
import os
import tempfile
import shutil
import pytest

# Add the src_py directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

def test_imports():
    """Test that we can import all main modules"""
    from config.env import load_config, validate_config, get_masked_config
    from memory.stores import ConversationHistoryStore, KnowledgeMemoryStore, UserProfileStore
    from agent.state import AgentState
    from agent.graph import agent_graph
    from tools.registry import tool_registry
    from tools.filesystem import read_file, write_file
    from tools.web import fetch_web_page, search_web
    from tools.system import get_system_info
    from telegram_integration.bot import TelegramBot
    from llm.base import LLMProvider
    from llm.factory import LLMFallbackFactory
    from llm.groq import GroqProvider
    from llm.inception import InceptionProvider
    from llm.azure import AzureOpenAIProvider

    assert load_config is not None
    assert agent_graph is not None
    assert tool_registry is not None
    assert TelegramBot is not None
    assert LLMFallbackFactory is not None

def test_basic_functionality():
    """Test basic memory stores and tool registry functionality"""
    test_dir = tempfile.mkdtemp()
    try:
        from memory.stores import ConversationHistoryStore, KnowledgeMemoryStore, UserProfileStore

        # 1. Test conversation history
        conv_store = ConversationHistoryStore(test_dir)
        conv_store.appendTurn("test123", "Hello", "Hi there!")
        history = conv_store.getHistory("test123")
        assert len(history) == 2
        assert history[0]["content"] == "Hello"
        assert history[1]["content"] == "Hi there!"

        # 2. Test knowledge memory
        knowledge_store = KnowledgeMemoryStore(test_dir)
        knowledge_store.addMemory("Test fact")
        memories = knowledge_store.listMemories()
        assert len(memories) == 1
        assert memories[0]["fact"] == "Test fact"

        # 3. Test user profile
        profile_store = UserProfileStore(test_dir)
        profile_store.updateUserProfile({"test_key": "test_value"})
        profile = profile_store.getUserProfile()
        assert profile.get("test_key") == "test_value"

    finally:
        shutil.rmtree(test_dir)

    # 4. Test tool registry
    from tools.registry import tool_registry, register_tool

    @register_tool("sample_struct_tool", "test")
    def sample_struct_tool(x: int) -> dict:
        """Sample tool for testing"""
        return {"result": x * 2}

    tools = tool_registry.list_tools()
    assert "sample_struct_tool" in tools
    func = tool_registry.get_tool("sample_struct_tool")
    assert func is not None
    result = func(5)
    assert result.get("result") == 10

def main():
    """Run all structure tests directly"""
    print("Running structure tests for PC Assistant Agent Python implementation...\n")
    try:
        test_imports()
        print("✓ All imports successful!")
        test_basic_functionality()
        print("✓ Basic functionality tests passed!")
        print("\n🎉 All structure tests passed!")
        return 0
    except Exception as e:
        print(f"\n❌ Structure test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())