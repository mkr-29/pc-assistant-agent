"""
Comprehensive tests for advanced memory capabilities:
- UUID collision prevention
- Metadata, tagging, categories
- Token relevance / semantic-like search
- Conversation history pagination and auto-pruning
- User profile nested key management and export/import
"""
import pytest
import os
import sys
import tempfile
import shutil

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from memory.stores import (
    ConversationHistoryStore,
    KnowledgeMemoryStore,
    UserProfileStore
)

def test_knowledge_memory_metadata_and_uuids():
    """Test UUID creation, categories, and tags"""
    test_dir = tempfile.mkdtemp()
    try:
        store = KnowledgeMemoryStore(test_dir, max_memories=10)

        entry1 = store.addMemory(
            "User prefers Python 3.14 and dark mode",
            tags=["python", "preferences"],
            category="user_preference"
        )
        assert "id" in entry1
        assert "uuid" in entry1
        assert len(entry1["tags"]) == 2
        assert entry1["category"] == "user_preference"

        entry2 = store.addMemory(
            "Working on PC Assistant Agent project",
            tags=["project", "pc-assistant"],
            category="project"
        )
        assert entry1["id"] != entry2["id"]
        assert entry1["uuid"] != entry2["uuid"]

        # Category filtering
        pref_memories = store.listMemories(category="user_preference")
        assert len(pref_memories) == 1
        assert pref_memories[0]["fact"] == "User prefers Python 3.14 and dark mode"

        # Update memory
        updated = store.updateMemory(entry1["id"], "User prefers Python 3.14 and OLED dark mode")
        assert updated is True
        memories = store.listMemories()
        assert "OLED" in memories[0]["fact"]

        # Delete memory
        deleted = store.deleteMemory(entry1["id"])
        assert deleted is True
        assert len(store.listMemories()) == 1
    finally:
        shutil.rmtree(test_dir)

def test_knowledge_memory_relevance_search():
    """Test keyword relevance ranking in knowledge memories"""
    test_dir = tempfile.mkdtemp()
    try:
        store = KnowledgeMemoryStore(test_dir)
        store.addMemory("The user's favorite coffee is Ethiopian Yirgacheffe", tags=["coffee", "food"])
        store.addMemory("The user drinks green tea in the evening", tags=["tea", "drink"])
        store.addMemory("Deploying applications on Google Cloud Platform with Cloud Run", tags=["gcp", "cloud"])

        # Search for coffee
        coffee_results = store.searchMemories("Ethiopian coffee")
        assert len(coffee_results) >= 1
        assert "Ethiopian Yirgacheffe" in coffee_results[0]["fact"]
        assert coffee_results[0]["relevance_score"] > 0

        # Search with no match
        empty_results = store.searchMemories("quantum teleportation")
        assert len(empty_results) == 0
    finally:
        shutil.rmtree(test_dir)

def test_conversation_history_pagination_and_pruning():
    """Test pagination, pruning, and search in conversation history"""
    test_dir = tempfile.mkdtemp()
    try:
        # Create store with max_turns = 4
        store = ConversationHistoryStore(test_dir, max_turns=4)

        store.appendTurn("chat_1", "Turn 1 question", "Turn 1 answer")
        store.appendTurn("chat_1", "Turn 2 question", "Turn 2 answer")
        store.appendTurn("chat_1", "Turn 3 question", "Turn 3 answer")

        history = store.getHistory("chat_1")
        # With max_turns=4, after 3 turns (6 items), it should be pruned to 4 items
        assert len(history) == 4
        # Pruning kept the latest items
        assert "Turn 3" in history[-1]["content"]

        # Test pagination: limit and offset
        page1 = store.getHistory("chat_1", limit=2, offset=0)
        assert len(page1) == 2

        page2 = store.getHistory("chat_1", limit=2, offset=2)
        assert len(page2) == 2
        assert page1[0]["id"] != page2[0]["id"]

        # Search conversation history
        search_res = store.searchHistory("chat_1", "Turn 3")
        assert len(search_res) >= 1
        assert "Turn 3" in search_res[0]["content"]
    finally:
        shutil.rmtree(test_dir)

def test_user_profile_nested_keys_and_export():
    """Test user profile nested dot-notation access, search, and export/import"""
    test_dir = tempfile.mkdtemp()
    try:
        store = UserProfileStore(test_dir)

        # Update nested dot-notation
        store.updateUserProfile({
            "name": "Mayank",
            "developer.editor": "VSCode",
            "developer.languages": ["Python", "Rust"],
            "settings.notifications.email": False
        })

        assert store.getProfileValue("name") == "Mayank"
        assert store.getProfileValue("developer.editor") == "VSCode"
        assert store.getProfileValue("developer.languages") == ["Python", "Rust"]
        assert store.getProfileValue("settings.notifications.email") is False
        assert store.getProfileValue("nonexistent.field", "default") == "default"

        # Search user profile
        search_res = store.searchUserMemories("VSCode")
        assert len(search_res) >= 1
        assert search_res[0]["key"] == "developer.editor"
        assert search_res[0]["value"] == "VSCode"

        # Export and Import
        exported = store.exportProfile()
        assert "Mayank" in exported
        assert "VSCode" in exported

        store2 = UserProfileStore(tempfile.mkdtemp())
        success = store2.importProfile(exported)
        assert success is True
        assert store2.getProfileValue("developer.editor") == "VSCode"
    finally:
        shutil.rmtree(test_dir)
