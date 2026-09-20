from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class LLMProvider(ABC):
    """Base class for LLM providers"""

    def __init__(self, api_key: str, model: str, **kwargs):
        self.api_key = api_key
        self.model = model
        self.config = kwargs

    @abstractmethod
    async def generate_text(self, prompt: str, system_instruction: str = "",
                          temperature: float = 0.7, max_tokens: Optional[int] = None) -> str:
        """Generate text from the LLM"""
        pass

    @abstractmethod
    async def generate_text_with_tools(self, prompt: str, tools: List[Dict],
                                     system_instruction: str = "",
                                     temperature: float = 0.7, max_tokens: Optional[int] = None) -> Dict:
        """Generate text with tool usage capability"""
        pass

    def is_available(self) -> bool:
        """Check if the provider is available (has API key, etc.)"""
        return bool(self.api_key)

    @property
    def name(self) -> str:
        """Return provider name (class name)"""
        return self.__class__.__name__