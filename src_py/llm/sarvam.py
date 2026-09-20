"""
Sarvam AI LLM provider implementation.
"""
from typing import Optional, Dict
from .openai_compatible import OpenAICompatibleProvider

class SarvamProvider(OpenAICompatibleProvider):
    """Sarvam AI API provider"""

    DEFAULT_BASE_URL = "https://api.sarvam.ai/v1"
    DEFAULT_MODEL = "sarvam-105b"

    def __init__(
        self,
        api_key: str,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        custom_headers: Optional[Dict[str, str]] = None,
        **kwargs
    ):
        headers = custom_headers or {}
        # Sarvam accepts api-subscription-key
        headers.setdefault("api-subscription-key", api_key)

        super().__init__(
            api_key=api_key,
            model=model or self.DEFAULT_MODEL,
            base_url=base_url or self.DEFAULT_BASE_URL,
            custom_headers=headers,
            **kwargs
        )
