"""
Memory tools for the PC Assistant Agent
"""
from typing import Dict, Any, List, Optional
from src_py.memory.stores import ConversationHistoryStore, KnowledgeMemoryStore, UserProfileStore
from src_py.tools.registry import register_tool

# Initialize memory stores (singleton pattern)
_conversation_history_store = ConversationHistoryStore()
_knowledge_memory_store = KnowledgeMemoryStore()
_user_profile_store = UserProfileStore()

@register_tool("get_conversation_history", "memory")
def get_conversation_history(chat_id: str) -> Dict[str, Any]:
    """
    Get conversation history for a chat ID.

    Args:
        chat_id: Telegram chat ID

    Returns:
        Dictionary with conversation history
    """
    try:
        history = _conversation_history_store.getHistory(chat_id)
        return {
            "chat_id": chat_id,
            "history": history,
            "count": len(history)
        }
    except Exception as e:
        return {
            "error": f"Error getting conversation history: {str(e)}",
            "chat_id": chat_id,
            "history": []
        }

@register_tool("append_conversation_turn", "memory")
def append_conversation_turn(chat_id: str, prompt: str, outcome: str) -> Dict[str, Any]:
    """
    Append a turn to the conversation history.

    Args:
        chat_id: Telegram chat ID
        prompt: User's prompt/message
        outcome: Agent's response/outcome

    Returns:
        Dictionary with success status
    """
    try:
        _conversation_history_store.appendTurn(chat_id, prompt, outcome)
        return {
            "success": True,
            "chat_id": chat_id,
            "message": "Conversation turn appended"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error appending conversation turn: {str(e)}",
            "chat_id": chat_id
        }

@register_tool("clear_conversation_history", "memory")
def clear_conversation_history(chat_id: str) -> Dict[str, Any]:
    """
    Clear conversation history for a chat ID.

    Args:
        chat_id: Telegram chat ID

    Returns:
        Dictionary with success status
    """
    try:
        _conversation_history_store.clearHistory(chat_id)
        return {
            "success": True,
            "chat_id": chat_id,
            "message": "Conversation history cleared"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error clearing conversation history: {str(e)}",
            "chat_id": chat_id
        }

@register_tool("list_knowledge_memories", "memory")
def list_knowledge_memories() -> Dict[str, Any]:
    """
    List all knowledge memories (persistent facts).

    Returns:
        Dictionary with list of memories
    """
    try:
        memories = _knowledge_memory_store.listMemories()
        return {
            "memories": memories,
            "count": len(memories)
        }
    except Exception as e:
        return {
            "error": f"Error listing knowledge memories: {str(e)}",
            "memories": []
        }

@register_tool("add_knowledge_memory", "memory")
def add_knowledge_memory(fact: str) -> Dict[str, Any]:
    """
    Add a new fact to knowledge memory.

    Args:
        fact: The fact to remember

    Returns:
        Dictionary with success status
    """
    try:
        if not fact or not fact.strip():
            return {
                "success": False,
                "error": "Fact cannot be empty"
            }

        _knowledge_memory_store.addMemory(fact.strip())
        return {
            "success": True,
            "fact": fact.strip(),
            "message": "Fact added to knowledge memory"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error adding knowledge memory: {str(e)}",
            "fact": fact
        }

@register_tool("delete_knowledge_memory", "memory")
def delete_knowledge_memory(memory_id: int) -> Dict[str, Any]:
    """
    Delete a knowledge memory by ID.

    Args:
        memory_id: ID of the memory to delete

    Returns:
        Dictionary with success status
    """
    try:
        _knowledge_memory_store.deleteMemory(memory_id)
        return {
            "success": True,
            "memory_id": memory_id,
            "message": "Knowledge memory deleted"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error deleting knowledge memory: {str(e)}",
            "memory_id": memory_id
        }

@register_tool("get_user_profile", "memory")
def get_user_profile() -> Dict[str, Any]:
    """
    Get the user profile.

    Returns:
        Dictionary with user profile information
    """
    try:
        profile = _user_profile_store.getUserProfile()
        return {
            "profile": profile
        }
    except Exception as e:
        return {
            "error": f"Error getting user profile: {str(e)}",
            "profile": {}
        }

@register_tool("update_user_profile", "memory")
def update_user_profile(updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update the user profile with new values.

    Args:
        updates: Dictionary of key-value pairs to update

    Returns:
        Dictionary with success status
    """
    try:
        if not updates:
            return {
                "success": False,
                "error": "No updates provided"
            }

        _user_profile_store.updateUserProfile(updates)
        return {
            "success": True,
            "updates": updates,
            "message": "User profile updated"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error updating user profile: {str(e)}",
            "updates": updates
        }

@register_tool("search_user_memories", "memory")
def search_user_memories(query: str) -> Dict[str, Any]:
    """
    Search for memories matching a query.

    Args:
        query: Search query string

    Returns:
        Dictionary with search results
    """
    try:
        if not query:
            return {
                "success": False,
                "error": "Search query cannot be empty",
                "results": []
            }

        results = _user_profile_store.searchUserMemories(query)
        return {
            "query": query,
            "results": results,
            "count": len(results)
        }
    except Exception as e:
        return {
            "error": f"Error searching user memories: {str(e)}",
            "query": query,
            "results": []
        }