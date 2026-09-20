"""
Azure OpenAI LLM provider implementation.
"""
import json
import logging
from typing import List, Dict, Any, Optional
import httpx

from .base import LLMProvider

logger = logging.getLogger(__name__)

class AzureOpenAIProvider(LLMProvider):
    """Azure OpenAI Service provider"""

    DEFAULT_DEPLOYMENT = "gpt-5.5"
    DEFAULT_API_VERSION = "2024-02-15-preview"

    def __init__(
        self,
        api_key: str,
        endpoint: str,
        deployment: Optional[str] = None,
        api_version: Optional[str] = None,
        timeout_seconds: float = 60.0,
        **kwargs
    ):
        model = deployment or self.DEFAULT_DEPLOYMENT
        super().__init__(api_key, model, **kwargs)
        self.endpoint = endpoint.rstrip('/') if endpoint else ""
        self.deployment = model
        self.api_version = api_version or self.DEFAULT_API_VERSION
        self.timeout_seconds = timeout_seconds

    @property
    def chat_url(self) -> str:
        """Construct Azure OpenAI chat completions URL"""
        return f"{self.endpoint}/openai/deployments/{self.deployment}/chat/completions?api-version={self.api_version}"

    def _get_headers(self) -> Dict[str, str]:
        """Construct Azure OpenAI request headers"""
        return {
            "Content-Type": "application/json",
            "api-key": self.api_key
        }

    async def _post_chat(self, body: Dict[str, Any]) -> Dict[str, Any]:
        """Send chat completion request to Azure OpenAI"""
        if not self.endpoint or not self.api_key:
            raise ValueError("Azure OpenAI requires both endpoint and api_key")

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(self.chat_url, headers=self._get_headers(), json=body)
            response.raise_for_status()
            return response.json()

    async def generate_text(
        self,
        prompt: str,
        system_instruction: str = "",
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> str:
        """Generate text using Azure OpenAI chat completions"""
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        body: Dict[str, Any] = {
            "messages": messages,
            "temperature": temperature
        }
        if max_tokens:
            body["max_tokens"] = max_tokens

        data = await self._post_chat(body)
        choices = data.get("choices", [])
        if not choices:
            raise ValueError("No choices returned from Azure OpenAI")

        return choices[0].get("message", {}).get("content", "").strip()

    async def generate_text_with_tools(
        self,
        prompt: str,
        tools: List[Dict],
        system_instruction: str = "",
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        """Generate text with tool calls using Azure OpenAI"""
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        formatted_tools = []
        for t in tools:
            if "type" in t and "function" in t:
                formatted_tools.append(t)
            elif "name" in t:
                formatted_tools.append({
                    "type": "function",
                    "function": {
                        "name": t.get("name"),
                        "description": t.get("description", ""),
                        "parameters": t.get("parameters", {"type": "object", "properties": {}})
                    }
                })
            else:
                formatted_tools.append(t)

        body: Dict[str, Any] = {
            "messages": messages,
            "temperature": temperature,
            "tools": formatted_tools
        }
        if max_tokens:
            body["max_tokens"] = max_tokens

        data = await self._post_chat(body)
        choices = data.get("choices", [])
        if not choices:
            raise ValueError("No choices returned from Azure OpenAI")

        message = choices[0].get("message", {})
        content = message.get("content") or ""
        raw_tool_calls = message.get("tool_calls", [])

        parsed_tool_calls = []
        for call in raw_tool_calls:
            fn = call.get("function", {})
            name = fn.get("name", "")
            raw_args = fn.get("arguments", "{}")
            try:
                args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
            except Exception:
                args = {}

            parsed_tool_calls.append({
                "id": call.get("id", f"call_{len(parsed_tool_calls)}"),
                "name": name,
                "arguments": args
            })

        return {
            "text": content,
            "tool_calls": parsed_tool_calls
        }

    def is_available(self) -> bool:
        """Check if Azure provider is configured"""
        return bool(self.api_key and self.endpoint)
