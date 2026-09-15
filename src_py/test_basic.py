"""
Basic test for the PC Assistant Agent Python implementation
"""
import asyncio
import os
import tempfile
import shutil

# Add the current directory to the path so we can import src_py modules
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

async def test_config_loading():
    """Test that configuration loads correctly"""
    print("Testing configuration loading...")
    from config.env import load_config, validate_config

    config = load_config()
    validate_config(config)
    print("✓ Configuration loaded and validated")
    return True

async def test_memory_stores():
    """Test that memory stores work correctly"""
    print("Testing memory stores...")
    from memory.stores import ConversationHistoryStore, KnowledgeMemoryStore, UserProfileStore

    # Create temporary directory for test data
    test_dir = tempfile.mkdtemp()
    try:
        # Test conversation history store
        conv_store = ConversationHistoryStore(test_dir)
        conv_store.appendTurn("test_chat", "Hello", "Hi there!")
        history = conv_store.getHistory("test_chat")
        assert len(history) == 2
        assert history[0]["content"] == "Hello"
        assert history[1]["content"] == "Hi there!"
        print("✓ Conversation history store works")

        # Test knowledge memory store
        knowledge_store = KnowledgeMemoryStore(test_dir)
        knowledge_store.addMemory("Test fact")
        memories = knowledge_store.listMemories()
        assert len(memories) == 1
        assert memories[0]["fact"] == "Test fact"
        print("✓ Knowledge memory store works")

        # Test user profile store
        profile_store = UserProfileStore(test_dir)
        profile_store.updateUserProfile({"test_key": "test_value"})
        profile = profile_store.getUserProfile()
        assert profile["test_key"] == "test_value"
        print("✓ User profile store works")

    finally:
        # Clean up
        shutil.rmtree(test_dir)

    return True

async def test_tool_registry():
    """Test that the tool registry works"""
    print("Testing tool registry...")
    from tools.registry import tool_registry, register_tool

    # Register a test tool
    @register_tool("test_tool", "test")
    def test_tool(param: str) -> dict:
        return {"result": f"Processed: {param}"}

    # Check that tool is registered
    tools = tool_registry.list_tools()
    assert "test_tool" in tools
    print("✓ Tool registry works")

    # Test getting the tool
    func = tool_registry.get_tool("test_tool")
    assert func is not None
    result = func("test")
    assert result["result"] == "Processed: test"
    print("✓ Tool execution works")

    return True

async def test_filesystem_tools():
    """Test basic filesystem tools"""
    print("Testing filesystem tools...")
    from tools.filesystem import read_file, write_file, list_directory

    # Create temporary directory for test
    test_dir = tempfile.mkdtemp()
    original_dir = os.getcwd()
    try:
        os.chdir(test_dir)

        # Test writing a file
        write_result = write_file("test.txt", "Hello, World!")
        assert write_result["success"] == True
        print("✓ File writing works")

        # Test reading the file
        read_result = read_file("test.txt")
        assert read_result["content"] == "Hello, World!"
        print("✓ File reading works")

        # Test listing directory
        list_result = list_directory(".")
        assert "test.txt" in list_result["files"]
        print("✓ Directory listing works")

    finally:
        os.chdir(original_dir)
        shutil.rmtree(test_dir)

    return True

async def test_agent_state():
    """Test that agent state structure works"""
    print("Testing agent state...")
    from agent.state import AgentState

    # This is more of a structural test - just importing and checking it exists
    assert AgentState is not None
    print("✓ Agent state structure works")

    return True

async def main():
    """Run all tests"""
    print("Running basic tests for PC Assistant Agent Python implementation...\n")

    tests = [
        test_config_loading,
        test_memory_stores,
        test_tool_registry,
        test_filesystem_tools,
        test_agent_state
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            result = await test()
            if result:
                passed += 1
            else:
                failed += 1
                print(f"✗ {test.__name__} returned False")
        except Exception as e:
            failed += 1
            print(f"✗ {test.__name__} failed with error: {e}")

    print(f"\nTest results: {passed} passed, {failed} failed")

    if failed == 0:
        print("🎉 All tests passed!")
        return True
    else:
        print("❌ Some tests failed.")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)