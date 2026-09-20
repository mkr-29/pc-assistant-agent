"""
OpenAI-compatible LLM provider implementation for providers like Groq, Inception,
Sarvam, Arcee, LongCat, Thinking Machine, etc.
"""
import json
import logging
import re
from typing import List, Dict, Any, Optional
import httpx

from .base import LLMProvider

logger = logging.getLogger(__name__)

class OpenAICompatibleProvider(LLMProvider):
    """Generic LLM provider for any OpenAI-compatible API endpoint"""

    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str,
        auth_header: str = "Authorization",
        auth_prefix: str = "Bearer ",
        custom_headers: Optional[Dict[str, str]] = None,
        fallback_models: Optional[List[str]] = None,
        timeout_seconds: float = 60.0,
        **kwargs
    ):
        super().__init__(api_key, model, **kwargs)
        self.base_url = base_url.rstrip('/')
        self.auth_header = auth_header
        self.auth_prefix = auth_prefix
        self.custom_headers = custom_headers or {}
        self.fallback_models = fallback_models or []
        self.timeout_seconds = timeout_seconds

    @property
    def chat_url(self) -> str:
        """Return the chat completions endpoint URL"""
        if self.base_url.endswith('/chat/completions'):
            return self.base_url
        return f"{self.base_url}/chat/completions"

    def _get_headers(self) -> Dict[str, str]:
        """Construct request headers"""
        headers = {
            "Content-Type": "application/json",
            **self.custom_headers
        }
        if self.auth_header and self.api_key:
            headers[self.auth_header] = f"{self.auth_prefix}{self.api_key}".strip()
        return headers

    def _format_tools(self, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Ensure tools conform to OpenAI tools format"""
        formatted = []
        for t in tools:
            if "type" in t and "function" in t:
                formatted.append(t)
            elif "name" in t:
                # Wrap tool definition
                formatted.append({
                    "type": "function",
                    "function": {
                        "name": t.get("name"),
                        "description": t.get("description", ""),
                        "parameters": t.get("parameters", {"type": "object", "properties": {}})
                    }
                })
            else:
                formatted.append(t)
        return formatted

    async def _post_chat(self, body: Dict[str, Any]) -> Dict[str, Any]:
        """Send chat request with error handling and model fallback on rate limit"""
        models_to_try = [self.model] + [m for m in self.fallback_models if m != self.model]
        last_error = None

        headers = self._get_headers()

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            for current_model in models_to_try:
                request_body = {**body, "model": current_model}
                try:
                    logger.debug(f"[{self.__class__.__name__}] Sending request to {self.chat_url} (model: {current_model})")
                    response = await client.post(self.chat_url, headers=headers, json=request_body)

                    if response.status_code == 200:
                        return response.json()

                    err_text = response.text
                    is_rate_limit = (
                        response.status_code in (413, 429)
                        or "rate_limit" in err_text.lower()
                        or "quota" in err_text.lower()
                    )

                    if is_rate_limit and len(models_to_try) > 1 and current_model != models_to_try[-1]:
                        logger.warning(
                            f"[{self.__class__.__name__}] Rate limit hit on {current_model}. "
                            f"Trying fallback model..."
                        )
                        continue

                    response.raise_for_status()

                except Exception as e:
                    last_error = e
                    logger.warning(f"[{self.__class__.__name__}] Request failed for model {current_model}: {e}")
                    if current_model == models_to_try[-1]:
                        raise

        raise RuntimeError(f"All models failed for {self.__class__.__name__}: {last_error}")

    async def generate_text(
        self,
        prompt: str,
        system_instruction: str = "",
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> str:
        """Generate text using OpenAI-compatible chat completions"""
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
            raise ValueError(f"No choices returned from {self.__class__.__name__}")

        message = choices[0].get("message", {})
        return message.get("content", "").strip()

    async def generate_text_with_tools(
        self,
        prompt: str,
        tools: List[Dict],
        system_instruction: str = "",
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        """Generate text with tool calls using OpenAI tools format"""
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        body: Dict[str, Any] = {
            "messages": messages,
            "temperature": temperature,
            "tools": self._format_tools(tools)
        }
        if max_tokens:
            body["max_tokens"] = max_tokens

        data = await self._post_chat(body)
        choices = data.get("choices", [])
        if not choices:
            raise ValueError(f"No choices returned from {self.__class__.__name__}")

        message = choices[0].get("message", {})
        content = message.get("content") or ""
        raw_tool_calls = message.get("tool_calls", [])

        parsed_tool_calls = []
        for call in raw_tool_calls:
            fn = call.get("function", {})
            name = fn.get("name", "")
            raw_args = fn.get("arguments", "{}")
            if isinstance(raw_args, str):
                try:
                    args = json.loads(raw_args)
                except Exception:
                    args = {}
            else:
                args = raw_args or {}

            parsed_tool_calls.append({
                "id": call.get("id", f"call_{len(parsed_tool_calls)}"),
                "name": name,
                "arguments": args
            })

        # Recovery pattern: if no native tool calls returned, check if model wrote tool call in content
        if not parsed_tool_calls and content:
            xml_match = re.search(r'<function=([a-zA-Z0-9_]+)>([\s\S]*?)</function>', content)
            if xml_match:
                name, raw_args = xml_match.groups()
                try:
                    args = json.loads(raw_args.strip())
                except Exception:
                    args = {}
                parsed_tool_calls.append({
                    "id": f"recovered_{name}",
                    "name": name,
                    "arguments": args
                })

        return {
            "text": content,
            "tool_calls": parsed_tool_calls
        }

    async def check_connectivity(self) -> bool:
        """Verify endpoint connectivity and API key validity"""
        try:
            res = await self.generate_text("Hi", max_tokens=5)
            return bool(res)
        except Exception as e:
            logger.warning(f"Connectivity check failed for {self.__class__.__name__}: {e}")
            return False

    def is_available(self) -> bool:
        """Check if provider has API key and base URL configured"""
        return bool(self.api_key and self.base_url)
