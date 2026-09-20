"""
Inception Labs LLM provider implementation.
"""
from typing import Optional, List
from .openai_compatible import OpenAICompatibleProvider

class InceptionProvider(OpenAICompatibleProvider):
    """Inception Labs API provider"""

    DEFAULT_BASE_URL = "https://api.inceptionlabs.ai/v1"
    DEFAULT_MODEL = "mercury-2"

    def __init__(
        self,
        api_key: str,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        **kwargs
    ):
        super().__init__(
            api_key=api_key,
            model=model or self.DEFAULT_MODEL,
            base_url=base_url or self.DEFAULT_BASE_URL,
            **kwargs
        )
