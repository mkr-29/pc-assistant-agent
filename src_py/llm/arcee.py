"""
Arcee AI LLM provider implementation.
"""
from typing import Optional, List
from .openai_compatible import OpenAICompatibleProvider

class ArceeProvider(OpenAICompatibleProvider):
    """Arcee AI API provider"""

    DEFAULT_BASE_URL = "https://api.arcee.ai/v1"
    DEFAULT_MODEL = "zai-org/glm-5.2"
    FALLBACK_MODELS = ["zai-org/glm-5.2", "trinity-mini"]

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
