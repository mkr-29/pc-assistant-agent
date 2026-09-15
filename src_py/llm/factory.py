from typing import List, Dict, Any, Optional
import logging
from .base import LLMProvider
from .gemini import GeminiProvider
# Import other providers as they are implemented
# from .groq import GroqProvider
# from .inception import InceptionProvider

logger = logging.getLogger(__name__)

class LLMFallbackFactory:
    """Factory for creating LLM providers with fallback capability"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.providers: List[LLMProvider] = []
        self._initialize_providers()

    def _initialize_providers(self):
        """Initialize available LLM providers in order of preference"""
        # Try to initialize providers in order: Gemini, Groq, Inception, etc.

        # 1. Gemini (primary)
        gemini_api_key = self.config.get('geminiApiKey')
        if gemini_api_key:
            try:
                provider = GeminiProvider(
                    api_key=gemini_api_key,
                    model=self.config.get('geminiModel', 'gemini-2.5-flash')
                )
                if provider.is_available():
                    self.providers.append(provider)
                    logger.info("Initialized Gemini provider")
                else:
                    logger.warning("Gemini provider initialized but not available")
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini provider: {e}")

        # 2. Groq
        groq_config = self.config.get('groq')
        if groq_config and groq_config.get('apiKey'):
            try:
                # Provider implementation would go here
                # provider = GroqProvider(...)
                # if provider.is_available():
                #     self.providers.append(provider)
                #     logger.info("Initialized Groq provider")
                logger.info("Groq provider configuration found (implementation pending)")
            except Exception as e:
                logger.warning(f"Failed to initialize Groq provider: {e}")

        # 3. Inception Labs
        inception_config = self.config.get('inception')
        if inception_config and inception_config.get('apiKey'):
            try:
                # Provider implementation would go here
                # provider = InceptionProvider(...)
                # if provider.is_available():
                #     self.providers.append(provider)
                #     logger.info("Initialized Inception provider")
                logger.info("Inception provider configuration found (implementation pending)")
            except Exception as e:
                logger.warning(f"Failed to initialize Inception provider: {e}")

        # 4. Sarvam
        sarvam_config = self.config.get('sarvam')
        if sarvam_config and sarvam_config.get('apiKey'):
            try:
                # Provider implementation would go here
                logger.info("Sarvam provider configuration found (implementation pending)")
            except Exception as e:
                logger.warning(f"Failed to initialize Sarvam provider: {e}")

        # 5. Arcee
        arcee_config = self.config.get('arcee')
        if arcee_config and arcee_config.get('apiKey'):
            try:
                # Provider implementation would go here
                logger.info("Arcee provider configuration found (implementation pending)")
            except Exception as e:
                logger.warning(f"Failed to initialize Arcee provider: {e}")

        # 6. LongCat
        longcat_config = self.config.get('longcat')
        if longcat_config and longcat_config.get('apiKey'):
            try:
                # Provider implementation would go here
                logger.info("LongCat provider configuration found (implementation pending)")
            except Exception as e:
                logger.warning(f"Failed to initialize LongCat provider: {e}")

        # 7. Thinking Machine
        thinking_machine_config = self.config.get('thinkingMachine')
        if thinking_machine_config and thinking_machine_config.get('apiKey'):
            try:
                # Provider implementation would go here
                logger.info("Thinking Machine provider configuration found (implementation pending)")
            except Exception as e:
                logger.warning(f"Failed to initialize Thinking Machine provider: {e}")

        # 8. Azure OpenAI
        azure_config = self.config.get('azureOpenAI')
        if azure_config and azure_config.get('apiKey') and azure_config.get('endpoint'):
            try:
                # Provider implementation would go here
                logger.info("Azure OpenAI provider configuration found (implementation pending)")
            except Exception as e:
                logger.warning(f"Failed to initialize Azure OpenAI provider: {e}")

        if not self.providers:
            logger.error("No LLM providers could be initialized")
        else:
            logger.info(f"Initialized {len(self.providers)} LLM provider(s)")

    def get_primary_provider(self) -> Optional[LLMProvider]:
        """Get the primary (first available) provider"""
        return self.providers[0] if self.providers else None

    def get_provider_with_fallback(self, operation: str = "generate_text"):
        """
        Get a provider that can perform the specified operation with fallback logic
        Returns a generator that yields providers in order
        """
        for provider in self.providers:
            if provider.is_available():
                yield provider

    async def generate_text_with_fallback(self, prompt: str, system_instruction: str = "",
                                        temperature: float = 0.7, max_tokens: Optional[int] = None) -> str:
        """Generate text using the first available provider, falling back if needed"""
        last_error = None

        for provider in self.get_provider_with_fallback():
            try:
                return await provider.generate_text(
                    prompt, system_instruction, temperature, max_tokens
                )
            except Exception as e:
                last_error = e
                logger.warning(f"Provider {provider.__class__.__name__} failed: {e}")
                continue

        # If all providers failed
        error_msg = f"All LLM providers failed. Last error: {last_error}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)

    async def generate_text_with_tools_fallback(self, prompt: str, tools: List[Dict],
                                              system_instruction: str = "",
                                              temperature: float = 0.7, max_tokens: Optional[int] = None) -> Dict:
        """Generate text with tools using the first available provider, falling back if needed"""
        last_error = None

        for provider in self.get_provider_with_fallback():
            try:
                return await provider.generate_text_with_tools(
                    prompt, tools, system_instruction, temperature, max_tokens
                )
            except Exception as e:
                last_error = e
                logger.warning(f"Provider {provider.__class__.__name__} failed: {e}")
                continue

        # If all providers failed
        error_msg = f"All LLM providers failed. Last error: {last_error}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)