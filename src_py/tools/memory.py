"""
Memory tools for the PC Assistant Agent with standardized responses,
semantic/relevance searching, and metadata support.
"""
from typing import Dict, Any, List, Optional, Union

try:
    from memory.stores import ConversationHistoryStore, KnowledgeMemoryStore, UserProfileStore
    from tools.registry import register_tool
    from utils.response import success_response, error_response
except ImportError:
    from src_py.memory.stores import ConversationHistoryStore, KnowledgeMemoryStore, UserProfileStore
    from src_py.tools.registry import register_tool
    from src_py.utils.response import success_response, error_response

# Initialize memory stores
_conversation_history_store = ConversationHistoryStore()
_knowledge_memory_store = KnowledgeMemoryStore()
_user_profile_store = UserProfileStore()

@register_tool("get_conversation_history", "memory")
def get_conversation_history(
    chat_id: str,
    limit: Optional[int] = None,
    offset: int = 0
) -> Dict[str, Any]:
    """
    Get conversation history for a chat ID with pagination.

    Args:
        chat_id: Telegram chat ID
        limit: Optional maximum number of messages to return
        offset: Number of items to skip from beginning

    Returns:
        Standardized dictionary with conversation history
    """
    try:
        history = _conversation_history_store.getHistory(chat_id, limit=limit, offset=offset)
        return success_response(data={
            "chat_id": chat_id,
            "history": history,
            "count": len(history)
        })
    except Exception as e:
        return error_response(f"Error getting conversation history: {str(e)}", code="GET_HISTORY_FAILED", chat_id=chat_id, history=[])

@register_tool("append_conversation_turn", "memory")
def append_conversation_turn(chat_id: str, prompt: str, outcome: str) -> Dict[str, Any]:
    """
    Append a turn to the conversation history.

    Args:
        chat_id: Telegram chat ID
        prompt: User's prompt/message
        outcome: Agent's response/outcome

    Returns:
        Standardized dictionary with success status
    """
    try:
        _conversation_history_store.appendTurn(chat_id, prompt, outcome)
        return success_response(
            message="Conversation turn appended",
            data={"chat_id": chat_id}
        )
    except Exception as e:
        return error_response(f"Error appending conversation turn: {str(e)}", code="APPEND_TURN_FAILED", chat_id=chat_id)

@register_tool("search_conversation_history", "memory")
def search_conversation_history(chat_id: str, query: str, limit: int = 10) -> Dict[str, Any]:
    """
    Search conversation history for a specific chat with relevance scoring.

    Args:
        chat_id: Telegram chat ID
        query: Search query
        limit: Max results to return

    Returns:
        Standardized dictionary with matching conversation turns
    """
    try:
        results = _conversation_history_store.searchHistory(chat_id, query, limit=limit)
        return success_response(data={
            "chat_id": chat_id,
            "query": query,
            "results": results,
            "count": len(results)
        })
    except Exception as e:
        return error_response(f"Error searching conversation history: {str(e)}", code="SEARCH_HISTORY_FAILED", results=[])

@register_tool("clear_conversation_history", "memory")
def clear_conversation_history(chat_id: str) -> Dict[str, Any]:
    """
    Clear conversation history for a chat ID.

    Args:
        chat_id: Telegram chat ID

    Returns:
        Standardized dictionary with success status
    """
    try:
        _conversation_history_store.clearHistory(chat_id)
        return success_response(message="Conversation history cleared", data={"chat_id": chat_id})
    except Exception as e:
        return error_response(f"Error clearing conversation history: {str(e)}", code="CLEAR_HISTORY_FAILED", chat_id=chat_id)

@register_tool("list_knowledge_memories", "memory")
def list_knowledge_memories(category: Optional[str] = None) -> Dict[str, Any]:
    """
    List all knowledge memories (persistent facts), optionally filtered by category.

    Args:
        category: Optional category filter (e.g. 'preference', 'project', 'general')

    Returns:
        Standardized dictionary with list of memories
    """
    try:
        memories = _knowledge_memory_store.listMemories(category=category)
        return success_response(data={
            "memories": memories,
            "count": len(memories),
            "category": category
        })
    except Exception as e:
        return error_response(f"Error listing knowledge memories: {str(e)}", code="LIST_MEMORIES_FAILED", memories=[])

@register_tool("add_knowledge_memory", "memory")
def add_knowledge_memory(
    fact: str,
    tags: Optional[List[str]] = None,
    category: str = "general"
) -> Dict[str, Any]:
    """
    Add a new fact to knowledge memory.

    Args:
        fact: The fact to remember
        tags: Optional list of tag keywords
        category: Category label (default: 'general')

    Returns:
        Standardized dictionary with created memory
    """
    try:
        if not fact or not str(fact).strip():
            return error_response("Fact cannot be empty", code="EMPTY_FACT")

        entry = _knowledge_memory_store.addMemory(fact.strip(), tags=tags, category=category)
        return success_response(
            message="Fact added to knowledge memory",
            data={
                "fact": entry.get("fact"),
                "id": entry.get("id"),
                "entry": entry
            }
        )
    except Exception as e:
        return error_response(f"Error adding knowledge memory: {str(e)}", code="ADD_MEMORY_FAILED", fact=fact)

@register_tool("search_knowledge_memories", "memory")
def search_knowledge_memories(
    query: str,
    category: Optional[str] = None,
    limit: int = 10
) -> Dict[str, Any]:
    """
    Search knowledge memories with keyword relevance scoring.

    Args:
        query: Search query
        category: Optional category filter
        limit: Max results

    Returns:
        Standardized dictionary with ranked matching memories
    """
    try:
        results = _knowledge_memory_store.searchMemories(query, category=category, limit=limit)
        return success_response(data={
            "query": query,
            "category": category,
            "results": results,
            "count": len(results)
        })
    except Exception as e:
        return error_response(f"Error searching knowledge memories: {str(e)}", code="SEARCH_MEMORIES_FAILED", results=[])

@register_tool("update_knowledge_memory", "memory")
def update_knowledge_memory(
    memory_id: Union[int, str],
    new_fact: str,
    tags: Optional[List[str]] = None,
    category: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update an existing knowledge memory by ID.

    Args:
        memory_id: ID of the memory to update
        new_fact: New fact statement
        tags: Optional updated tags list
        category: Optional updated category

    Returns:
        Standardized dictionary with update status
    """
    try:
        success = _knowledge_memory_store.updateMemory(memory_id, new_fact, tags=tags, category=category)
        if not success:
            return error_response(f"Memory with ID '{memory_id}' not found.", code="MEMORY_NOT_FOUND")

        return success_response(
            message=f"Memory {memory_id} updated successfully",
            data={"memory_id": str(memory_id), "new_fact": new_fact}
        )
    except Exception as e:
        return error_response(f"Error updating knowledge memory: {str(e)}", code="UPDATE_MEMORY_FAILED")

@register_tool("delete_knowledge_memory", "memory")
def delete_knowledge_memory(memory_id: Union[int, str]) -> Dict[str, Any]:
    """
    Delete a knowledge memory by ID.

    Args:
        memory_id: ID of the memory to delete

    Returns:
        Standardized dictionary with success status
    """
    try:
        deleted = _knowledge_memory_store.deleteMemory(memory_id)
        if not deleted:
            return error_response(f"Memory with ID '{memory_id}' not found.", code="MEMORY_NOT_FOUND")

        return success_response(
            message=f"Knowledge memory {memory_id} deleted",
            data={"memory_id": str(memory_id)}
        )
    except Exception as e:
        return error_response(f"Error deleting knowledge memory: {str(e)}", code="DELETE_MEMORY_FAILED", memory_id=str(memory_id))

@register_tool("get_user_profile", "memory")
def get_user_profile(key: Optional[str] = None) -> Dict[str, Any]:
    """
    Get the user profile or a specific nested key.

    Args:
        key: Optional dot-notation key (e.g. 'preferences.theme')

    Returns:
        Standardized dictionary with user profile information
    """
    try:
        if key:
            val = _user_profile_store.getProfileValue(key)
            return success_response(data={"key": key, "value": val})

        profile = _user_profile_store.getUserProfile()
        return success_response(data={"profile": profile})
    except Exception as e:
        return error_response(f"Error getting user profile: {str(e)}", code="GET_PROFILE_FAILED", profile={})

@register_tool("update_user_profile", "memory")
def update_user_profile(updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update the user profile with new values (supports nested dot-notation keys).

    Args:
        updates: Dictionary of key-value pairs to update

    Returns:
        Standardized dictionary with success status
    """
    try:
        if not updates:
            return error_response("No updates provided", code="EMPTY_UPDATES")

        _user_profile_store.updateUserProfile(updates)
        return success_response(
            message="User profile updated",
            data={"updates": updates}
        )
    except Exception as e:
        return error_response(f"Error updating user profile: {str(e)}", code="UPDATE_PROFILE_FAILED", updates=updates)

@register_tool("search_user_memories", "memory")
def search_user_memories(query: str) -> Dict[str, Any]:
    """
    Search for user profile memories matching a query with relevance scoring.

    Args:
        query: Search query string

    Returns:
        Standardized dictionary with ranked search results
    """
    try:
        if not query or not str(query).strip():
            return error_response("Search query cannot be empty", code="EMPTY_QUERY", results=[])

        results = _user_profile_store.searchUserMemories(query)
        return success_response(data={
            "query": query,
            "results": results,
            "count": len(results)
        })
    except Exception as e:
        return error_response(f"Error searching user memories: {str(e)}", code="SEARCH_PROFILE_FAILED", query=query, results=[])