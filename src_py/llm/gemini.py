"""
Gemini LLM provider
"""
import os
from typing import List, Dict, Any, Optional
from .base import LLMProvider
import logging

logger = logging.getLogger(__name__)

try:
    import google.generativeai as genai
    from google.generativeai.types import GenerationConfig
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    logger.warning("Google Generative AI package not installed. Gemini provider will not be available.")

class GeminiProvider(LLMProvider):
    """Gemini LLM provider"""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash", **kwargs):
        super().__init__(api_key, model, **kwargs)
        if not GEMINI_AVAILABLE:
            raise ImportError("Google Generative AI package is required for Gemini provider")

        # Configure the Gemini API key
        genai.configure(api_key=api_key)
        # Store the model name for use in generate_content
        self.model_name = model

    async def generate_text(self, prompt: str, system_instruction: str = "",
                          temperature: float = 0.7, max_tokens: Optional[int] = None) -> str:
        """Generate text using Gemini"""
        try:
            # Construct the full prompt with system instruction
            full_prompt = prompt
            if system_instruction:
                full_prompt = f"{system_instruction}\n\n{prompt}"

            # Configure generation parameters
            config = GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens or 8192,
            )

            # Create the model instance
            model = genai.GenerativeModel(self.model_name)
            # Generate content
            response = model.generate_content(
                full_prompt,
                generation_config=config
            )

            return response.text

        except Exception as e:
            logger.error(f"Error generating text with Gemini: {e}")
            raise

    async def generate_text_with_tools(self, prompt: str, tools: List[Dict],
                                     system_instruction: str = "",
                                     temperature: float = 0.7, max_tokens: Optional[int] = None) -> Dict:
        """Generate text with tool usage (placeholder for future implementation)"""
        # For now, we'll just generate text and return a simple structure
        # In a full implementation, this would handle function calling
        text = await self.generate_text(prompt, system_instruction, temperature, max_tokens)
        return {
            "text": text,
            "tool_calls": []  # No tool calls in this basic implementation
        }

    def is_available(self) -> bool:
        """Check if Gemini provider is available"""
        return GEMINI_AVAILABLE and bool(self.api_key)