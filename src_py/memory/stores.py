"""
Scalable persistent memory stores with relevance ranking, collision-proof UUIDs,
pagination, pruning, and metadata tracking.
"""
import json
import os
import re
import uuid
from typing import Dict, List, Any, Optional, Union
from datetime import datetime

# Ensure .data directory exists
os.makedirs('.data', exist_ok=True)

def _tokenize(text: str) -> List[str]:
    """Tokenize a string into lowercased alphanumeric words"""
    return re.findall(r'\b\w+\b', str(text).lower())

def _calculate_relevance_score(query_tokens: List[str], target_text: str, tags: Optional[List[str]] = None) -> float:
    """
    Calculate keyword relevance score based on token overlap, exact phrase match, and tag matching.
    """
    if not query_tokens:
        return 0.0

    target_lower = str(target_text).lower()
    target_tokens = _tokenize(target_lower)
    if not target_tokens:
        return 0.0

    query_str = " ".join(query_tokens)
    score = 0.0

    # 1. Exact phrase match bonus
    if query_str in target_lower:
        score += 3.0

    # 2. Token overlap score
    matched_tokens = 0
    for q_tok in query_tokens:
        if q_tok in target_tokens:
            matched_tokens += 1
            # Term frequency contribution
            score += 1.0 + (target_tokens.count(q_tok) * 0.2)

    if matched_tokens == 0:
        return 0.0

    # 3. Ratio of matched query tokens
    coverage = matched_tokens / len(query_tokens)
    score *= coverage

    # 4. Tag match bonus
    if tags:
        for tag in tags:
            tag_tokens = _tokenize(tag)
            for q_tok in query_tokens:
                if q_tok in tag_tokens:
                    score += 1.5

    # 5. Length normalization
    norm_score = score / (1.0 + (len(target_tokens) * 0.01))
    return round(norm_score, 4)


class ConversationHistoryStore:
    """Store for conversation history per chat ID with pagination, search, and pruning"""

    def __init__(self, data_dir: str = '.data', max_turns: int = 50):
        self.data_dir = data_dir
        self.max_turns = max_turns
        self.history_file = os.path.join(data_dir, 'conversation_history.json')
        self._ensure_file_exists()

    def _ensure_file_exists(self):
        """Ensure the history file exists"""
        if not os.path.exists(self.history_file):
            with open(self.history_file, 'w') as f:
                json.dump({}, f)

    def _load_history(self) -> Dict[str, List[Dict[str, Any]]]:
        """Load conversation history from file"""
        try:
            with open(self.history_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {}

    def _save_history(self, history: Dict[str, List[Dict[str, Any]]]):
        """Save conversation history to file atomically"""
        temp_file = f"{self.history_file}.tmp"
        with open(temp_file, 'w') as f:
            json.dump(history, f, indent=2)
        os.replace(temp_file, self.history_file)

    def getHistory(
        self,
        chatId: str,
        limit: Optional[int] = None,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get conversation history for a chat ID with optional pagination.

        Args:
            chatId: Telegram or session chat ID
            limit: Maximum number of message items to return
            offset: Number of items to skip from beginning

        Returns:
            List of conversation turns
        """
        history = self._load_history()
        chat_items = history.get(str(chatId), [])

        if offset < 0:
            offset = 0

        if limit is not None:
            return chat_items[offset:offset + limit]
        elif offset > 0:
            return chat_items[offset:]

        return chat_items

    def appendTurn(self, chatId: str, prompt: str, outcome: str):
        """Append a user/assistant turn to the conversation history with auto-pruning"""
        history = self._load_history()
        chat_id_str = str(chatId)

        if chat_id_str not in history:
            history[chat_id_str] = []

        now_str = datetime.now().isoformat()

        # Add user message and assistant response
        history[chat_id_str].append({
            'id': str(uuid.uuid4()),
            'role': 'user',
            'content': prompt,
            'timestamp': now_str
        })

        history[chat_id_str].append({
            'id': str(uuid.uuid4()),
            'role': 'assistant',
            'content': outcome,
            'timestamp': now_str
        })

        # Prune to max turns
        if len(history[chat_id_str]) > self.max_turns:
            history[chat_id_str] = history[chat_id_str][-self.max_turns:]

        self._save_history(history)

    def searchHistory(self, chatId: str, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search conversation history turns matching a query with relevance scoring.

        Args:
            chatId: Telegram chat ID
            query: Search query string
            limit: Max results

        Returns:
            List of matching turns with relevance score
        """
        chat_items = self.getHistory(chatId)
        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        results = []
        for item in chat_items:
            content = item.get("content", "")
            score = _calculate_relevance_score(query_tokens, content)
            if score > 0.0:
                results.append({
                    **item,
                    "relevance_score": score
                })

        results.sort(key=lambda x: x["relevance_score"], reverse=True)
        return results[:limit]

    def clearHistory(self, chatId: str):
        """Clear conversation history for a chat ID"""
        history = self._load_history()
        chat_id_str = str(chatId)

        if chat_id_str in history:
            del history[chat_id_str]
            self._save_history(history)


class KnowledgeMemoryStore:
    """Store for global persistent facts with UUIDs, metadata, search, and capacity management"""

    def __init__(self, data_dir: str = '.data', max_memories: int = 2000):
        self.data_dir = data_dir
        self.max_memories = max_memories
        self.memory_file = os.path.join(data_dir, 'knowledge_memory.json')
        self._ensure_file_exists()

    def _ensure_file_exists(self):
        """Ensure the memory file exists"""
        if not os.path.exists(self.memory_file):
            with open(self.memory_file, 'w') as f:
                json.dump([], f)

    def _load_memories(self) -> List[Dict[str, Any]]:
        """Load memories from file"""
        try:
            with open(self.memory_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save_memories(self, memories: List[Dict[str, Any]]):
        """Save memories to file atomically"""
        temp_file = f"{self.memory_file}.tmp"
        with open(temp_file, 'w') as f:
            json.dump(memories, f, indent=2)
        os.replace(temp_file, self.memory_file)

    def listMemories(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all memories, optionally filtered by category"""
        memories = self._load_memories()
        if category:
            return [m for m in memories if m.get("category", "").lower() == category.lower()]
        return memories

    def addMemory(
        self,
        fact: str,
        tags: Optional[List[str]] = None,
        category: str = "general",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Add a new fact to knowledge memory with UUID and metadata.

        Args:
            fact: The fact statement to record
            tags: Optional descriptive tags
            category: Classification category
            metadata: Additional custom metadata dictionary

        Returns:
            The created memory dictionary
        """
        clean_fact = str(fact).strip()
        if not clean_fact:
            raise ValueError("Memory fact cannot be empty.")

        memories = self._load_memories()

        # Check for duplicates
        for memory in memories:
            if memory.get('fact', '').strip().lower() == clean_fact.lower():
                return memory  # Return existing entry

        memory_entry = {
            'id': str(uuid.uuid4())[:8],
            'uuid': str(uuid.uuid4()),
            'fact': clean_fact,
            'tags': tags or [],
            'category': category,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
            'metadata': metadata or {}
        }

        memories.append(memory_entry)

        # Capacity management: prune oldest if exceeding max_memories
        if len(memories) > self.max_memories:
            memories = memories[-self.max_memories:]

        self._save_memories(memories)
        return memory_entry

    def updateMemory(
        self,
        memory_id: Union[int, str],
        new_fact: str,
        tags: Optional[List[str]] = None,
        category: Optional[str] = None
    ) -> bool:
        """
        Update an existing knowledge memory by ID.

        Args:
            memory_id: Memory ID (int or str)
            new_fact: Updated fact string
            tags: Updated tags list
            category: Updated category

        Returns:
            True if memory was found and updated, False otherwise
        """
        memories = self._load_memories()
        id_str = str(memory_id)

        found = False
        for m in memories:
            if str(m.get("id")) == id_str or m.get("uuid") == id_str:
                m["fact"] = new_fact.strip()
                if tags is not None:
                    m["tags"] = tags
                if category is not None:
                    m["category"] = category
                m["updated_at"] = datetime.now().isoformat()
                found = True
                break

        if found:
            self._save_memories(memories)
        return found

    def deleteMemory(self, memory_id: Union[int, str]) -> bool:
        """
        Delete a memory by ID (supports int or str ID or uuid).

        Returns:
            True if a memory was deleted
        """
        memories = self._load_memories()
        id_str = str(memory_id)

        initial_len = len(memories)
        memories = [m for m in memories if str(m.get('id')) != id_str and m.get('uuid') != id_str]

        deleted = len(memories) < initial_len
        if deleted:
            self._save_memories(memories)
        return deleted

    def searchMemories(
        self,
        query: str,
        category: Optional[str] = None,
        min_score: float = 0.1,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search knowledge memories with token-overlap relevance scoring.

        Args:
            query: Search query string
            category: Optional category filter
            min_score: Minimum relevance threshold
            limit: Maximum results

        Returns:
            Ranked list of matching memories with relevance_score
        """
        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        memories = self.listMemories(category)
        results = []

        for m in memories:
            fact = m.get("fact", "")
            tags = m.get("tags", [])
            score = _calculate_relevance_score(query_tokens, fact, tags)

            if score >= min_score:
                results.append({
                    **m,
                    "relevance_score": score
                })

        results.sort(key=lambda x: x["relevance_score"], reverse=True)
        return results[:limit]


class UserProfileStore:
    """Store for user profile information with nested key support and ranked search"""

    def __init__(self, data_dir: str = '.data'):
        self.data_dir = data_dir
        self.profile_file = os.path.join(data_dir, 'user_profile.json')
        self._ensure_file_exists()

    def _ensure_file_exists(self):
        """Ensure the profile file exists"""
        if not os.path.exists(self.profile_file):
            with open(self.profile_file, 'w') as f:
                json.dump({}, f)

    def _load_profile(self) -> Dict[str, Any]:
        """Load user profile from file"""
        try:
            with open(self.profile_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {}

    def _save_profile(self, profile: Dict[str, Any]):
        """Save user profile to file atomically"""
        temp_file = f"{self.profile_file}.tmp"
        with open(temp_file, 'w') as f:
            json.dump(profile, f, indent=2)
        os.replace(temp_file, self.profile_file)

    def _set_in_dict(self, d: Dict[str, Any], key: str, value: Any):
        keys = key.split('.')
        curr = d
        for k in keys[:-1]:
            if k not in curr or not isinstance(curr[k], dict):
                curr[k] = {}
            curr = curr[k]
        curr[keys[-1]] = value

    def _get_from_dict(self, d: Dict[str, Any], key: str, default: Any = None) -> Any:
        if key in d:
            return d[key]
        keys = key.split('.')
        curr = d
        for k in keys:
            if isinstance(curr, dict) and k in curr:
                curr = curr[k]
            else:
                return default
        return curr

    def getUserProfile(self) -> Dict[str, Any]:
        """Get the complete user profile"""
        return self._load_profile()

    def getProfileValue(self, key: str, default: Any = None) -> Any:
        """Get a profile value supporting dot-notation for nested keys"""
        profile = self._load_profile()
        return self._get_from_dict(profile, key, default)

    def setProfileValue(self, key: str, value: Any):
        """Set a profile value supporting dot-notation for nested keys"""
        profile = self._load_profile()
        self._set_in_dict(profile, key, value)
        self._save_profile(profile)

    def updateUserProfile(self, updates: Dict[str, Any]):
        """Update the user profile with a dictionary of values"""
        profile = self._load_profile()
        for k, v in updates.items():
            if '.' in k:
                self._set_in_dict(profile, k, v)
            else:
                profile[k] = v
        self._save_profile(profile)

    def searchUserMemories(self, query: str) -> List[Dict[str, Any]]:
        """
        Search for user profile items matching a query with relevance scoring.

        Args:
            query: Query string

        Returns:
            Ranked list of matching profile fields
        """
        profile = self._load_profile()
        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        results = []

        def _search_recursive(data: Any, prefix: str = ""):
            if isinstance(data, dict):
                for k, v in data.items():
                    full_key = f"{prefix}.{k}" if prefix else k
                    key_score = _calculate_relevance_score(query_tokens, k)
                    val_str = str(v)
                    val_score = _calculate_relevance_score(query_tokens, val_str)
                    combined_score = max(key_score * 0.8, val_score)

                    if combined_score > 0.0 and not isinstance(v, (dict, list)):
                        results.append({
                            'key': full_key,
                            'value': v,
                            'relevance_score': combined_score
                        })
                    if isinstance(v, (dict, list)):
                        _search_recursive(v, full_key)
            elif isinstance(data, list):
                for idx, item in enumerate(data):
                    full_key = f"{prefix}[{idx}]"
                    val_str = str(item)
                    val_score = _calculate_relevance_score(query_tokens, val_str)
                    if val_score > 0.0 and not isinstance(item, (dict, list)):
                        results.append({
                            'key': full_key,
                            'value': item,
                            'relevance_score': val_score
                        })
                    if isinstance(item, (dict, list)):
                        _search_recursive(item, full_key)

        _search_recursive(profile)
        results.sort(key=lambda x: x["relevance_score"], reverse=True)
        return results

    def exportProfile(self) -> str:
        """Export user profile as JSON string"""
        return json.dumps(self._load_profile(), indent=2)

    def importProfile(self, json_data: str) -> bool:
        """Import user profile from JSON string"""
        try:
            parsed = json.loads(json_data)
            if isinstance(parsed, dict):
                self._save_profile(parsed)
                return True
            return False
        except Exception:
            return False