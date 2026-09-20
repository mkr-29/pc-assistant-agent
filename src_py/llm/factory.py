"""
LLM Factory with robust provider cascade and fallback support.
"""
from typing import List, Dict, Any, Optional, Generator
import logging

from .base import LLMProvider
from .gemini import GeminiProvider
from .groq import GroqProvider
from .inception import InceptionProvider
from .sarvam import SarvamProvider
from .arcee import ArceeProvider
from .longcat import LongCatProvider
from .thinking_machine import ThinkingMachineProvider
from .azure import AzureOpenAIProvider

logger = logging.getLogger(__name__)

class LLMFallbackFactory:
    """Factory for creating LLM providers with automatic fallback capability"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.providers: List[LLMProvider] = []
        self._initialize_providers()

    def _initialize_providers(self):
        """Initialize all configured LLM providers in fallback order"""
        # Cascade order: Gemini -> Groq -> Inception -> Sarvam -> Arcee -> LongCat -> Thinking Machine -> Azure OpenAI

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
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini provider: {e}")

        # 2. Groq
        groq_cfg = self.config.get('groq', {})
        groq_key = groq_cfg.get('apiKey') or self.config.get('groqApiKey')
        if groq_key:
            try:
                provider = GroqProvider(
                    api_key=groq_key,
                    model=groq_cfg.get('model'),
                    base_url=groq_cfg.get('baseUrl')
                )
                if provider.is_available():
                    self.providers.append(provider)
                    logger.info("Initialized Groq provider")
            except Exception as e:
                logger.warning(f"Failed to initialize Groq provider: {e}")

        # 3. Inception Labs
        inception_cfg = self.config.get('inception', {})
        inception_key = inception_cfg.get('apiKey') or self.config.get('inceptionApiKey')
        if inception_key:
            try:
                provider = InceptionProvider(
                    api_key=inception_key,
                    model=inception_cfg.get('model'),
                    base_url=inception_cfg.get('baseUrl')
                )
                if provider.is_available():
                    self.providers.append(provider)
                    logger.info("Initialized Inception provider")
            except Exception as e:
                logger.warning(f"Failed to initialize Inception provider: {e}")

        # 4. Sarvam AI
        sarvam_cfg = self.config.get('sarvam', {})
        sarvam_key = sarvam_cfg.get('apiKey') or self.config.get('sarvamApiKey')
        if sarvam_key:
            try:
                provider = SarvamProvider(
                    api_key=sarvam_key,
                    model=sarvam_cfg.get('model'),
                    base_url=sarvam_cfg.get('baseUrl')
                )
                if provider.is_available():
                    self.providers.append(provider)
                    logger.info("Initialized Sarvam provider")
            except Exception as e:
                logger.warning(f"Failed to initialize Sarvam provider: {e}")

        # 5. Arcee AI
        arcee_cfg = self.config.get('arcee', {})
        arcee_key = arcee_cfg.get('apiKey') or self.config.get('arceeApiKey')
        if arcee_key:
            try:
                provider = ArceeProvider(
                    api_key=arcee_key,
                    model=arcee_cfg.get('model'),
                    base_url=arcee_cfg.get('baseUrl')
                )
                if provider.is_available():
                    self.providers.append(provider)
                    logger.info("Initialized Arcee provider")
            except Exception as e:
                logger.warning(f"Failed to initialize Arcee provider: {e}")

        # 6. LongCat
        longcat_cfg = self.config.get('longcat', {})
        longcat_key = longcat_cfg.get('apiKey') or self.config.get('longcatApiKey')
        if longcat_key:
            try:
                provider = LongCatProvider(
                    api_key=longcat_key,
                    model=longcat_cfg.get('model'),
                    base_url=longcat_cfg.get('baseUrl')
                )
                if provider.is_available():
                    self.providers.append(provider)
                    logger.info("Initialized LongCat provider")
            except Exception as e:
                logger.warning(f"Failed to initialize LongCat provider: {e}")

        # 7. Thinking Machine
        thinking_cfg = self.config.get('thinkingMachine', {})
        thinking_key = thinking_cfg.get('apiKey') or self.config.get('thinkingMachineApiKey')
        if thinking_key:
            try:
                provider = ThinkingMachineProvider(
                    api_key=thinking_key,
                    model=thinking_cfg.get('model'),
                    base_url=thinking_cfg.get('baseUrl')
                )
                if provider.is_available():
                    self.providers.append(provider)
                    logger.info("Initialized Thinking Machine provider")
            except Exception as e:
                logger.warning(f"Failed to initialize Thinking Machine provider: {e}")

        # 8. Azure OpenAI
        azure_cfg = self.config.get('azureOpenAI', {})
        azure_key = azure_cfg.get('apiKey') or self.config.get('azureOpenAIApiKey')
        azure_endpoint = azure_cfg.get('endpoint') or self.config.get('azureOpenAIEndpoint')
        if azure_key and azure_endpoint:
            try:
                provider = AzureOpenAIProvider(
                    api_key=azure_key,
                    endpoint=azure_endpoint,
                    deployment=azure_cfg.get('deployment', self.config.get('azureOpenAIDeployment')),
                    api_version=azure_cfg.get('apiVersion', self.config.get('azureOpenAIApiVersion'))
                )
                if provider.is_available():
                    self.providers.append(provider)
                    logger.info("Initialized Azure OpenAI provider")
            except Exception as e:
                logger.warning(f"Failed to initialize Azure OpenAI provider: {e}")

        if not self.providers:
            logger.warning("No LLM providers could be initialized. Agent will operate with mocked/offline capabilities.")
        else:
            provider_names = [f"{p.__class__.__name__}({p.model})" for p in self.providers]
            logger.info(f"Initialized {len(self.providers)} LLM provider(s): {', '.join(provider_names)}")

    def get_primary_provider(self) -> Optional[LLMProvider]:
        """Get the primary (first available) provider"""
        return self.providers[0] if self.providers else None

    def get_provider_with_fallback(self) -> Generator[LLMProvider, None, None]:
        """Yield providers in fallback order"""
        for provider in self.providers:
            if provider.is_available():
                yield provider

    def get_provider_summary(self) -> List[Dict[str, Any]]:
        """Return diagnostic summary of configured providers"""
        return [
            {
                "name": p.__class__.__name__,
                "model": p.model,
                "is_available": p.is_available()
            }
            for p in self.providers
        ]

    async def generate_text_with_fallback(
        self,
        prompt: str,
        system_instruction: str = "",
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> str:
        """Generate text using the first responding provider in the cascade"""
        errors = []

        for provider in self.get_provider_with_fallback():
            try:
                logger.debug(f"Attempting generate_text with {provider.__class__.__name__} ({provider.model})")
                return await provider.generate_text(
                    prompt, system_instruction, temperature, max_tokens
                )
            except Exception as e:
                errors.append(f"{provider.__class__.__name__}: {str(e)}")
                logger.warning(f"Provider {provider.__class__.__name__} failed: {e}. Falling back to next...")

        error_msg = f"All LLM providers failed:\n" + "\n".join(f"  - {err}" for err in errors)
        logger.error(error_msg)
        raise RuntimeError(error_msg)

    async def generate_text_with_tools_fallback(
        self,
        prompt: str,
        tools: List[Dict],
        system_instruction: str = "",
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        """Generate text and tool calls using the first responding provider in the cascade"""
        errors = []

        for provider in self.get_provider_with_fallback():
            try:
                logger.debug(f"Attempting generate_text_with_tools with {provider.__class__.__name__} ({provider.model})")
                return await provider.generate_text_with_tools(
                    prompt, tools, system_instruction, temperature, max_tokens
                )
            except Exception as e:
                errors.append(f"{provider.__class__.__name__}: {str(e)}")
                logger.warning(f"Provider {provider.__class__.__name__} failed tool generation: {e}. Falling back...")

        error_msg = f"All LLM providers failed tool generation:\n" + "\n".join(f"  - {err}" for err in errors)
        logger.error(error_msg)
        raise RuntimeError(error_msg)