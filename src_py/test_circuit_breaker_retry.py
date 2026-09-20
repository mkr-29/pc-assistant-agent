"""
Unit tests for Exponential Backoff Retry, Jitter, and Provider Circuit Breakers
"""
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock
import pytest

from utils.retry import is_transient_error, retry_async_call
from llm.circuit_breaker import CircuitBreaker, CircuitState
from llm.factory import LLMFallbackFactory

def test_is_transient_error():
    # Transient errors
    assert is_transient_error(RuntimeError("429 Too Many Requests")) is True
    assert is_transient_error(ConnectionError("Connection timed out")) is True
    assert is_transient_error(Exception("503 Service Unavailable")) is True
    assert is_transient_error(Exception("504 Gateway Timeout")) is True
    assert is_transient_error(Exception("Rate limit exceeded")) is True

    # Non-transient errors
    assert is_transient_error(ValueError("401 Unauthorized API key")) is False
    assert is_transient_error(PermissionError("403 Forbidden")) is False
    assert is_transient_error(FileNotFoundError("404 Not Found")) is False
    assert is_transient_error(SyntaxError("invalid syntax")) is False

@pytest.mark.asyncio
async def test_retry_async_call_success_on_retry():
    call_count = 0

    async def flaky_api():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise RuntimeError("503 Service Temporarily Unavailable")
        return "Success!"

    result = await retry_async_call(flaky_api, max_attempts=3, initial_delay=0.01, backoff_factor=1.5)
    assert result == "Success!"
    assert call_count == 2

@pytest.mark.asyncio
async def test_retry_async_call_non_transient_fails_immediately():
    call_count = 0

    async def bad_auth_api():
        nonlocal call_count
        call_count += 1
        raise ValueError("401 Unauthorized: Invalid API Key")

    with pytest.raises(ValueError):
        await retry_async_call(bad_auth_api, max_attempts=3, initial_delay=0.01)

    assert call_count == 1

def test_circuit_breaker_transitions():
    cb = CircuitBreaker("TestProvider", failure_threshold=2, cooldown_seconds=0.1)

    assert cb.state == CircuitState.CLOSED
    assert cb.allow_request() is True

    # First failure
    cb.record_failure(RuntimeError("Connection timeout"))
    assert cb.state == CircuitState.CLOSED
    assert cb.allow_request() is True

    # Second failure triggers OPEN
    cb.record_failure(RuntimeError("Connection timeout"))
    assert cb.state == CircuitState.OPEN
    assert cb.allow_request() is False

    # Wait for cooldown
    time.sleep(0.12)

    # Now state should transition to HALF_OPEN when checked
    assert cb.allow_request() is True
    assert cb.state == CircuitState.HALF_OPEN

    # Success in HALF_OPEN resets to CLOSED
    cb.record_success()
    assert cb.state == CircuitState.CLOSED
    assert cb.consecutive_failures == 0

@pytest.mark.asyncio
async def test_llm_factory_circuit_breaker_skips_open_provider():
    config = {
        "groq": {"apiKey": "g-key", "model": "llama-3.3-70b-versatile"},
        "inception": {"apiKey": "i-key", "model": "mercury-2"}
    }

    factory = LLMFallbackFactory(config)
    assert len(factory.providers) == 2
    prov1, prov2 = factory.providers[0], factory.providers[1]

    # Trip the circuit breaker on prov1
    cb1 = factory.circuit_breakers[prov1.name]
    cb1.record_failure(RuntimeError("429 rate limit"))
    cb1.record_failure(RuntimeError("429 rate limit"))
    cb1.record_failure(RuntimeError("429 rate limit"))
    assert cb1.state == CircuitState.OPEN

    prov1.generate_text = AsyncMock()
    prov2.generate_text = AsyncMock(return_value="Output from prov2")

    res = await factory.generate_text_with_fallback("Hello")
    assert res == "Output from prov2"
    # prov1 should not have been called because its circuit breaker was OPEN
    prov1.generate_text.assert_not_called()
    prov2.generate_text.assert_called_once()
