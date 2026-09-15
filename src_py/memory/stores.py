import json
import os
from typing import Dict, List, Any, Optional
from datetime import datetime

# Ensure .data directory exists
os.makedirs('.data', exist_ok=True)

class ConversationHistoryStore:
    """Store for conversation history per chat ID"""

    def __init__(self, data_dir: str = '.data'):
        self.data_dir = data_dir
        self.history_file = os.path.join(data_dir, 'conversation_history.json')
        self._ensure_file_exists()

    def _ensure_file_exists(self):
        """Ensure the history file exists"""
        if not os.path.exists(self.history_file):
            with open(self.history_file, 'w') as f:
                json.dump({}, f)

    def _load_history(self) -> Dict[str, List[Dict]]:
        """Load conversation history from file"""
        try:
            with open(self.history_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {}

    def _save_history(self, history: Dict[str, List[Dict]]):
        """Save conversation history to file"""
        with open(self.history_file, 'w') as f:
            json.dump(history, f, indent=2)

    def getHistory(self, chatId: str) -> List[Dict]:
        """Get conversation history for a chat ID"""
        history = self._load_history()
        return history.get(str(chatId), [])

    def appendTurn(self, chatId: str, prompt: str, outcome: str):
        """Append a turn to the conversation history"""
        history = self._load_history()
        chat_id_str = str(chatId)

        if chat_id_str not in history:
            history[chat_id_str] = []

        # Add user message and agent response
        history[chat_id_str].append({
            'role': 'user',
            'content': prompt,
            'timestamp': datetime.now().isoformat()
        })

        history[chat_id_str].append({
            'role': 'assistant',
            'content': outcome,
            'timestamp': datetime.now().isoformat()
        })

        # Keep only last 50 turns (25 user + 25 assistant) to prevent file from growing too large
        if len(history[chat_id_str]) > 50:
            history[chat_id_str] = history[chat_id_str][-50:]

        self._save_history(history)

    def clearHistory(self, chatId: str):
        """Clear conversation history for a chat ID"""
        history = self._load_history()
        chat_id_str = str(chatId)

        if chat_id_str in history:
            del history[chat_id_str]
            self._save_history(history)


class KnowledgeMemoryStore:
    """Store for global persistent facts (knowledge memory)"""

    def __init__(self, data_dir: str = '.data'):
        self.data_dir = data_dir
        self.memory_file = os.path.join(data_dir, 'knowledge_memory.json')
        self._ensure_file_exists()

    def _ensure_file_exists(self):
        """Ensure the memory file exists"""
        if not os.path.exists(self.memory_file):
            with open(self.memory_file, 'w') as f:
                json.dump([], f)

    def _load_memories(self) -> List[Dict]:
        """Load memories from file"""
        try:
            with open(self.memory_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save_memories(self, memories: List[Dict]):
        """Save memories to file"""
        with open(self.memory_file, 'w') as f:
            json.dump(memories, f, indent=2)

    def listMemories(self) -> List[Dict]:
        """List all memories"""
        return self._load_memories()

    def addMemory(self, fact: str):
        """Add a new fact to memory"""
        memories = self._load_memories()

        # Check if fact already exists (avoid duplicates)
        for memory in memories:
            if memory.get('fact') == fact:
                return  # Already exists

        memories.append({
            'fact': fact,
            'timestamp': datetime.now().isoformat(),
            'id': len(memories) + 1  # Simple ID generation
        })

        self._save_memories(memories)

    def deleteMemory(self, memory_id: int):
        """Delete a memory by ID"""
        memories = self._load_memories()
        memories = [m for m in memories if m.get('id') != memory_id]
        self._save_memories(memories)


class UserProfileStore:
    """Store for user profile information"""

    def __init__(self, data_dir: str = '.data'):
        self.data_dir = data_dir
        self.profile_file = os.path.join(data_dir, 'user_profile.json')
        self._ensure_file_exists()

    def _ensure_file_exists(self):
        """Ensure the profile file exists"""
        if not os.path.exists(self.profile_file):
            with open(self.profile_file, 'w') as f:
                json.dump({}, f)

    def _load_profile(self) -> Dict:
        """Load user profile from file"""
        try:
            with open(self.profile_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {}

    def _save_profile(self, profile: Dict):
        """Save user profile to file"""
        with open(self.profile_file, 'w') as f:
            json.dump(profile, f, indent=2)

    def getUserProfile(self) -> Dict:
        """Get the user profile"""
        return self._load_profile()

    def updateUserProfile(self, updates: Dict):
        """Update the user profile with new values"""
        profile = self._load_profile()
        profile.update(updates)
        self._save_profile(profile)

    def searchUserMemories(self, query: str) -> List[Dict]:
        """Search for memories matching a query (simple implementation)"""
        # In a more advanced implementation, this would use vector search or similar
        profile = self._load_profile()
        # For now, just return the profile if query matches any key or value
        results = []
        query_lower = query.lower()

        for key, value in profile.items():
            if query_lower in key.lower() or (isinstance(value, str) and query_lower in value.lower()):
                results.append({
                    'key': key,
                    'value': value,
                    'match_type': 'profile_field'
                })

        return results