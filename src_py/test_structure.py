"""
Structure test for the PC Assistant Agent Python implementation
"""
import sys
import os
import tempfile
import shutil

def test_imports():
    """Test that we can import the main modules"""
    print("Testing imports...")

    try:
        # Add the src_py directory to the path
        sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

        # Test config import
        from config.env import load_config, validate_config
        print("✓ config.env imported successfully")

        # Test memory stores import
        from memory.stores import ConversationHistoryStore, KnowledgeMemoryStore, UserProfileStore
        print("✓ memory.stores imported successfully")

        # Test agent imports
        from agent.state import AgentState
        from agent.graph import agent_graph
        print("✓ agent modules imported successfully")

        # Test tools imports
        from tools.registry import tool_registry
        from tools.filesystem import read_file, write_file
        print("✓ tools modules imported successfully")

        # Test telegram import
        from telegram.bot import TelegramBot
        print("✓ telegram.bot imported successfully")

        # Test llm imports
        from llm.base import LLMProvider
        from llm.factory import LLMFallbackFactory
        print("✓ llm modules imported successfully")

        print("\n🎉 All imports successful!")
        return True

    except Exception as e:
        print(f"✗ Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_basic_functionality():
    """Test basic functionality without external dependencies"""
    print("\nTesting basic functionality...")

    try:
        # Add the src_py directory to the path
        sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

        # Test memory stores with fresh instances
        from memory.stores import ConversationHistoryStore, KnowledgeMemoryStore, UserProfileStore

        # Create temporary directory for test data to avoid cross-test contamination
        test_dir = tempfile.mkdtemp()
        try:
            # Create fresh store instances
            conv_store = ConversationHistoryStore(test_dir)
            knowledge_store = KnowledgeMemoryStore(test_dir)
            profile_store = UserProfileStore(test_dir)

            # Test conversation history
            conv_store.appendTurn("test123", "Hello", "Hi there!")
            history = conv_store.getHistory("test123")
            # Fix the assertion - we expect 2 items (user and assistant)
            if len(history) != 2:
                print(f"Expected 2 items in history, got {len(history)}: {history}")
                return False
            assert history[0]["content"] == "Hello"
            assert history[1]["content"] == "Hi there!"
            print("✓ Conversation history store working")

            # Test knowledge memory
            knowledge_store.addMemory("Test fact")
            memories = knowledge_store.listMemories()
            if len(memories) != 1:
                print(f"Expected 1 memory, got {len(memories)}: {memories}")
                return False
            assert memories[0]["fact"] == "Test fact"
            print("✓ Knowledge memory store working")

            # Test user profile
            profile_store.updateUserProfile({"test_key": "test_value"})
            profile = profile_store.getUserProfile()
            if profile.get("test_key") != "test_value":
                print(f"Expected test_key=test_value, got {profile}")
                return False
            print("✓ User profile store working")

        finally:
            # Clean up
            shutil.rmtree(test_dir)

        # Test tool registry
        from tools.registry import tool_registry, register_tool

        @register_tool("test_tool", "test")
        def test_tool(x: int) -> dict:
            return {"result": x * 2}

        tools = tool_registry.list_tools()
        if "test_tool" not in tools:
            print(f"test_tool not found in tools: {tools}")
            return False
        func = tool_registry.get_tool("test_tool")
        result = func(5)
        if result.get("result") != 10:
            print(f"Expected result=10, got {result}")
            return False
        print("✓ Tool registry working")

        print("\n🎉 Basic functionality tests passed!")
        return True

    except Exception as e:
        print(f"✗ Basic functionality test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("Running structure tests for PC Assistant Agent Python implementation...\n")

    test1_passed = test_imports()
    test2_passed = test_basic_functionality()

    if test1_passed and test2_passed:
        print("\n🎉 All structure tests passed! The implementation is ready for further development.")
        return True
    else:
        print("\n❌ Some structure tests failed.")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)