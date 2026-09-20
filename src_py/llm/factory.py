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
from .circuit_breaker import CircuitBreaker
from utils.retry import retry_async_call

logger = logging.getLogger(__name__)

class LLMFallbackFactory:
    """Factory for creating LLM providers with automatic fallback, retries, and circuit breakers"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.providers: List[LLMProvider] = []
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
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
            for p in self.providers:
                p_name = p.__class__.__name__
                self.circuit_breakers[p_name] = CircuitBreaker(name=p_name, failure_threshold=3, cooldown_seconds=60.0)

            provider_names = [f"{p.__class__.__name__}({p.model})" for p in self.providers]
            logger.info(f"Initialized {len(self.providers)} LLM provider(s) with circuit breakers: {', '.join(provider_names)}")

    def get_primary_provider(self) -> Optional[LLMProvider]:
        """Get the primary (first available) provider"""
        return self.providers[0] if self.providers else None

    def get_provider_with_fallback(self) -> Generator[LLMProvider, None, None]:
        """Yield providers in fallback order, skipping providers whose circuit breaker is OPEN"""
        for provider in self.providers:
            p_name = provider.__class__.__name__
            cb = self.circuit_breakers.get(p_name)
            if provider.is_available():
                if cb and not cb.can_execute():
                    logger.info(f"Circuit breaker for provider '{p_name}' is OPEN. Skipping to fallback.")
                    continue
                yield provider

    def get_provider_summary(self) -> List[Dict[str, Any]]:
        """Return diagnostic summary of configured providers and their circuit breaker states"""
        summary = []
        for p in self.providers:
            p_name = p.__class__.__name__
            cb = self.circuit_breakers.get(p_name)
            summary.append({
                "name": p_name,
                "model": p.model,
                "is_available": p.is_available(),
                "circuit_breaker": cb.get_status() if cb else {"state": "CLOSED"}
            })
        return summary

    async def generate_text_with_fallback(
        self,
        prompt: str,
        system_instruction: str = "",
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> str:
        """Generate text using the first responding provider in the cascade with retry and circuit breaker tracking"""
        errors = []
        attempted_count = 0

        for provider in self.get_provider_with_fallback():
            attempted_count += 1
            p_name = provider.__class__.__name__
            cb = self.circuit_breakers.get(p_name)

            try:
                logger.debug(f"Attempting generate_text with {p_name} ({provider.model})")

                async def _call():
                    return await provider.generate_text(
                        prompt, system_instruction, temperature, max_tokens
                    )

                result = await retry_async_call(_call, max_retries=2, initial_delay=0.3)
                if cb:
                    cb.record_success()

                # Record metrics
                try:
                    from monitoring.metrics import metrics_collector
                    metrics_collector.record_llm_call(p_name, success=True, fallback_used=(attempted_count > 1))
                except Exception:
                    pass

                return result
            except Exception as e:
                if cb:
                    cb.record_failure(e)
                try:
                    from monitoring.metrics import metrics_collector
                    metrics_collector.record_llm_call(p_name, success=False, fallback_used=True)
                except Exception:
                    pass

                errors.append(f"{p_name}: {str(e)}")
                logger.warning(f"Provider {p_name} failed: {e}. Falling back to next...")

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
        """Generate text and tool calls using the first responding provider with retry and circuit breaker tracking"""
        errors = []
        attempted_count = 0

        for provider in self.get_provider_with_fallback():
            attempted_count += 1
            p_name = provider.__class__.__name__
            cb = self.circuit_breakers.get(p_name)

            try:
                logger.debug(f"Attempting generate_text_with_tools with {p_name} ({provider.model})")

                async def _call():
                    return await provider.generate_text_with_tools(
                        prompt, tools, system_instruction, temperature, max_tokens
                    )

                result = await retry_async_call(_call, max_retries=2, initial_delay=0.3)
                if cb:
                    cb.record_success()

                # Record metrics
                try:
                    from monitoring.metrics import metrics_collector
                    metrics_collector.record_llm_call(p_name, success=True, fallback_used=(attempted_count > 1))
                except Exception:
                    pass

                return result
            except Exception as e:
                if cb:
                    cb.record_failure(e)
                try:
                    from monitoring.metrics import metrics_collector
                    metrics_collector.record_llm_call(p_name, success=False, fallback_used=True)
                except Exception:
                    pass

                errors.append(f"{p_name}: {str(e)}")
                logger.warning(f"Provider {p_name} failed tool generation: {e}. Falling back...")

        error_msg = f"All LLM providers failed tool generation:\n" + "\n".join(f"  - {err}" for err in errors)
        logger.error(error_msg)
        raise RuntimeError(error_msg)