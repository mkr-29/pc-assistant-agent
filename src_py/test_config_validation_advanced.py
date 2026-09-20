"""
Tests for advanced configuration validation, placeholder checks, typo detection, and actionable error messages.
"""
import pytest
import os
from config.env import validate_config_detailed, format_validation_report

def test_config_detailed_valid():
    """Verify clean configuration returns is_valid True"""
    mock_config = {
        "geminiApiKey": "AIzaSyFakeKey123456",
        "port": 8080
    }
    report = validate_config_detailed(config=mock_config)
    assert report["is_valid"] is True
    assert "Gemini" in report["active_providers"]
    assert len(report["errors"]) == 0

def test_config_detailed_no_providers():
    """Verify error when no LLM providers are configured"""
    mock_config = {
        "geminiApiKey": None,
        "groqApiKey": None,
        "azureOpenAIApiKey": None,
        "port": 8080
    }
    report = validate_config_detailed(config=mock_config)
    assert report["is_valid"] is False
    assert any("No active LLM provider" in err for err in report["errors"])
    assert any("aistudio.google.com" in rem for rem in report["remediations"])

def test_config_detailed_detects_placeholder(monkeypatch):
    """Verify placeholder values are detected and warned about"""
    monkeypatch.setenv("GEMINI_API_KEY", "your_gemini_api_key_here")
    mock_config = {
        "geminiApiKey": "your_gemini_api_key_here",
        "port": 8080
    }
    report = validate_config_detailed(config=mock_config)
    assert any("placeholder" in w for w in report["warnings"])
    assert any("Replace placeholder" in rem for rem in report["remediations"])

def test_config_detailed_detects_typos(monkeypatch):
    """Verify common typos in environment variable names are flagged"""
    monkeypatch.setenv("GEMINI_KEY", "some-key")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    mock_config = {"port": 8080}

    report = validate_config_detailed(config=mock_config)
    assert any("looks like a typo for 'GEMINI_API_KEY'" in w for w in report["warnings"])

def test_config_detailed_invalid_port():
    """Verify port range validation"""
    mock_config = {
        "geminiApiKey": "AIzaSyValidKey",
        "port": 99999
    }
    report = validate_config_detailed(config=mock_config)
    assert report["is_valid"] is False
    assert any("Invalid PORT" in err for err in report["errors"])

def test_config_detailed_azure_consistency():
    """Verify Azure consistency checks and actionable fix"""
    mock_config = {
        "azureOpenAIApiKey": "fake-azure-key",
        "azureOpenAIEndpoint": None,
        "port": 8080
    }
    report = validate_config_detailed(config=mock_config)
    assert report["is_valid"] is False
    assert any("AZURE_OPENAI_ENDPOINT is missing" in err for err in report["errors"])

def test_format_validation_report():
    """Verify formatting generates clean report"""
    mock_report = {
        "is_valid": False,
        "errors": ["Missing Gemini API key."],
        "warnings": ["Telegram bot disabled."],
        "remediations": ["Add GEMINI_API_KEY to .env"],
        "active_providers": []
    }
    text = format_validation_report(mock_report)
    assert "Configuration Check [FAILED]" in text
    assert "[X] Missing Gemini API key." in text
    assert "[!] Telegram bot disabled." in text
    assert "-> Add GEMINI_API_KEY to .env" in text
