"""
Groq LLM provider implementation.
"""
from typing import Optional, List
from .openai_compatible import OpenAICompatibleProvider

class GroqProvider(OpenAICompatibleProvider):
    """Groq Cloud API provider"""

    DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"
    DEFAULT_MODEL = "llama-3.3-70b-versatile"
    FALLBACK_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]

    def __init__(
        self,
        api_key: str,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        fallback_models: Optional[List[str]] = None,
        **kwargs
    ):
        super().__init__(
            api_key=api_key,
            model=model or self.DEFAULT_MODEL,
            base_url=base_url or self.DEFAULT_BASE_URL,
            fallback_models=fallback_models or self.FALLBACK_MODELS,
            **kwargs
        )
