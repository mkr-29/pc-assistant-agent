import os
from typing import List, Dict, Any
from .base import LLMProvider
import logging

logger = logging.getLogger(__name__)

try:
    from google import genai
    from google.genai import types
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

        # Configure the Gemini client
        self.client = genai.Client(api_key=api_key)

    async def generate_text(self, prompt: str, system_instruction: str = "",
                          temperature: float = 0.7, max_tokens: Optional[int] = None) -> str:
        """Generate text using Gemini"""
        try:
            # Construct the full prompt with system instruction
            full_prompt = prompt
            if system_instruction:
                full_prompt = f"{system_instruction}\n\n{prompt}"

            # Configure generation parameters
            config = types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens or 8192,
            )

            # Generate content
            response = self.client.models.generate_content(
                model=self.model,
                contents=full_prompt,
                config=config
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