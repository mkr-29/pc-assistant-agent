"""
Unit tests for LLM providers and fallback factory.
"""
import pytest
import sys
import os
from unittest.mock import AsyncMock, patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from llm.openai_compatible import OpenAICompatibleProvider
from llm.groq import GroqProvider
from llm.inception import InceptionProvider
from llm.sarvam import SarvamProvider
from llm.arcee import ArceeProvider
from llm.longcat import LongCatProvider
from llm.thinking_machine import ThinkingMachineProvider
from llm.azure import AzureOpenAIProvider
from llm.factory import LLMFallbackFactory

@pytest.mark.asyncio
async def test_openai_compatible_provider_initialization():
    """Test OpenAICompatibleProvider setup and headers"""
    provider = OpenAICompatibleProvider(
        api_key="test-key",
        model="test-model",
        base_url="https://api.example.com/v1",
        custom_headers={"X-Custom": "Val"}
    )
    assert provider.api_key == "test-key"
    assert provider.model == "test-model"
    assert provider.chat_url == "https://api.example.com/v1/chat/completions"
    assert provider.is_available() is True

    headers = provider._get_headers()
    assert headers["Authorization"] == "Bearer test-key"
    assert headers["X-Custom"] == "Val"
    assert headers["Content-Type"] == "application/json"

@pytest.mark.asyncio
async def test_provider_subclasses_defaults():
    """Test default URLs and models for provider subclasses"""
    groq = GroqProvider(api_key="groq-key")
    assert "groq.com" in groq.base_url
    assert groq.model == "llama-3.3-70b-versatile"

    inception = InceptionProvider(api_key="inc-key")
    assert "inceptionlabs.ai" in inception.base_url
    assert inception.model == "mercury-2"

    sarvam = SarvamProvider(api_key="sarvam-key")
    assert "sarvam.ai" in sarvam.base_url
    assert sarvam.model == "sarvam-105b"
    assert sarvam._get_headers()["api-subscription-key"] == "sarvam-key"

    arcee = ArceeProvider(api_key="arcee-key")
    assert "arcee.ai" in arcee.base_url
    assert arcee.model == "zai-org/glm-5.2"

    longcat = LongCatProvider(api_key="longcat-key")
    assert "longcat.chat" in longcat.base_url
    assert longcat.model == "LongCat-2.0"

    tm = ThinkingMachineProvider(api_key="tm-key")
    assert "thinkingmachines.ai" in tm.base_url
    assert tm.model == "inkling"

    azure = AzureOpenAIProvider(
        api_key="az-key",
        endpoint="https://myresource.openai.azure.com",
        deployment="gpt-5.5"
    )
    assert azure.is_available() is True
    assert "myresource.openai.azure.com" in azure.chat_url
    assert azure._get_headers()["api-key"] == "az-key"

@pytest.mark.asyncio
async def test_openai_compatible_text_generation():
    """Test text generation with mocked HTTP response"""
    provider = OpenAICompatibleProvider(
        api_key="test-key",
        model="mock-model",
        base_url="https://api.test.com/v1"
    )

    mock_response = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "Hello! I am an AI assistant."
                }
            }
        ]
    }

    with patch.object(provider, "_post_chat", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        text = await provider.generate_text(
            prompt="Hello",
            system_instruction="Be polite"
        )
        assert text == "Hello! I am an AI assistant."
        mock_post.assert_called_once()
        call_args = mock_post.call_args[0][0]
        assert call_args["messages"][0]["role"] == "system"
        assert call_args["messages"][0]["content"] == "Be polite"
        assert call_args["messages"][1]["role"] == "user"
        assert call_args["messages"][1]["content"] == "Hello"

@pytest.mark.asyncio
async def test_openai_compatible_tool_calling():
    """Test tool calling and function call extraction"""
    provider = OpenAICompatibleProvider(
        api_key="test-key",
        model="mock-model",
        base_url="https://api.test.com/v1"
    )

    mock_response = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "I will read the file.",
                    "tool_calls": [
                        {
                            "id": "call_123",
                            "type": "function",
                            "function": {
                                "name": "read_file",
                                "arguments": '{"file_path": "README.md"}'
                            }
                        }
                    ]
                }
            }
        ]
    }

    with patch.object(provider, "_post_chat", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        tools = [{
            "name": "read_file",
            "description": "Read a file",
            "parameters": {"type": "object", "properties": {"file_path": {"type": "string"}}}
        }]

        result = await provider.generate_text_with_tools("Read README.md", tools=tools)
        assert result["text"] == "I will read the file."
        assert len(result["tool_calls"]) == 1
        assert result["tool_calls"][0]["name"] == "read_file"
        assert result["tool_calls"][0]["arguments"] == {"file_path": "README.md"}

@pytest.mark.asyncio
async def test_fallback_factory():
    """Test factory initialization and fallback when first provider fails"""
    config = {
        "groq": {"apiKey": "g-key", "model": "llama-3.3-70b-versatile"},
        "inception": {"apiKey": "i-key", "model": "mercury-2"}
    }

    factory = LLMFallbackFactory(config)
    summary = factory.get_provider_summary()
    assert len(summary) >= 2
    assert summary[0]["name"] == "GroqProvider"
    assert summary[1]["name"] == "InceptionProvider"

    # Mock first provider failing, second succeeding
    provider1 = factory.providers[0]
    provider2 = factory.providers[1]

    provider1.generate_text = AsyncMock(side_effect=RuntimeError("Groq 429 Rate Limit"))
    provider2.generate_text = AsyncMock(return_value="Success from Inception fallback!")

    result = await factory.generate_text_with_fallback("Test prompt")
    assert result == "Success from Inception fallback!"
    provider1.generate_text.assert_called_once()
    provider2.generate_text.assert_called_once()
