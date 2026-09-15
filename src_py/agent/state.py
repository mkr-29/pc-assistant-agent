"""
Agent state definition for the PC Assistant Agent
"""
from typing import Dict, Any, List, Optional
from typing_extensions import TypedDict

class AgentState(TypedDict, total=False):
    """Dictionary representation of agent"""

    # Conversation context
    user_prompt: str
    chat_id: str
    conversation_history: List[Dict[str, Any]]
    knowledge_memory: List[Dict[str, Any]]
    user_profile: Dict[str, Any]

    # Agent state
    current_plan: str
    plan_step: int
    execution_results: List[Dict[str, Any]]
    tools_used: List[str]

    # Control flow
    needs_more_steps: bool
    is_complete: bool
    error: Optional[str]

    # Metadata
    model_used: str
    timestamp: str