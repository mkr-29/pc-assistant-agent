"""
Unit tests for configuration loading, validation, secret masking, and path resolution.
"""
import pytest
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from config.env import load_config, validate_config, get_masked_config
from utils.paths import resolve_path, resolve_base_path

def test_validate_config_no_providers():
    """Validation must fail with descriptive message if no LLM provider is configured"""
    empty_config = {
        "geminiApiKey": None,
        "groqApiKey": None,
        "groq": {},
        "inception": {},
        "sarvam": {},
        "arcee": {},
        "longcat": {},
        "thinkingMachine": {},
        "azureOpenAI": {}
    }

    with pytest.raises(ValueError) as excinfo:
        validate_config(empty_config)

    assert "No LLM provider configured" in str(excinfo.value)

def test_validate_config_with_groq_only():
    """Validation must succeed if only Groq is configured (decoupled from Gemini)"""
    groq_only_config = {
        "geminiApiKey": None,
        "groqApiKey": "gsk_test123",
        "groq": {"apiKey": "gsk_test123"},
        "inception": {},
        "sarvam": {},
        "arcee": {},
        "longcat": {},
        "thinkingMachine": {},
        "azureOpenAI": {}
    }

    assert validate_config(groq_only_config) is True

def test_validate_azure_openai_consistency():
    """Azure OpenAI must fail if apiKey is set but endpoint is missing"""
    azure_missing_endpoint = {
        "azureOpenAIApiKey": "az-key-123",
        "azureOpenAIEndpoint": None,
        "geminiApiKey": "gemini-key"
    }

    with pytest.raises(ValueError) as excinfo:
        validate_config(azure_missing_endpoint)

    assert "AZURE_OPENAI_ENDPOINT is missing" in str(excinfo.value)

def test_masked_config_masks_secrets():
    """Test get_masked_config hides actual keys from output"""
    sensitive_config = {
        "geminiApiKey": "AIzaSySecretLongKey123456",
        "telegramBotToken": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
        "port": 8080,
        "groq": {
            "apiKey": "gsk_supersecretkey1234",
            "model": "llama-3.3-70b-versatile"
        }
    }

    masked = get_masked_config(sensitive_config)

    assert "SecretLongKey" not in str(masked)
    assert "gsk_supersecretkey" not in str(masked)
    assert masked["port"] == 8080
    assert masked["groq"]["model"] == "llama-3.3-70b-versatile"
    assert "..." in masked["geminiApiKey"]

def test_resolve_path():
    """Test path resolution for home directory, relative, and absolute paths"""
    home = str(Path.home())
    assert resolve_path("~") == home
    assert resolve_path("~/myfolder") == os.path.join(home, "myfolder")

    # Absolute path remains unchanged
    assert resolve_path("/tmp/test") == "/tmp/test"

    # Relative path is resolved against cwd or base
    resolved_rel = resolve_path("sub/file.txt", base_path="/var/log")
    assert resolved_rel == "/var/log/sub/file.txt"
