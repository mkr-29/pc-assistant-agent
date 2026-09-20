"""
Circuit breaker implementation for LLM providers.
Prevents repetitive latency stalls by fast-failing broken or rate-limited providers.
"""
import time
from enum import Enum
from typing import Dict, Any, Optional
from utils.logger import get_logger

logger = get_logger("llm.circuit_breaker")

class CircuitState(Enum):
    CLOSED = "CLOSED"         # Normal operation
    OPEN = "OPEN"             # Tripped: fast-fail without calling provider
    HALF_OPEN = "HALF_OPEN"   # Probing: testing if provider has recovered

class CircuitBreaker:
    """
    Circuit breaker tracking provider health and managing state transitions.
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 3,
        cooldown_seconds: float = 60.0
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds

        self.state = CircuitState.CLOSED
        self.consecutive_failures = 0
        self.last_failure_time: float = 0.0
        self.total_failures = 0
        self.total_successes = 0

    def can_execute(self) -> bool:
        """
        Check whether requests to this provider should be permitted.
        Returns True if CLOSED or if cooldown period has elapsed (transitions to HALF_OPEN).
        """
        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            elapsed = time.time() - self.last_failure_time
            if elapsed >= self.cooldown_seconds:
                logger.info(
                    f"Circuit breaker for provider '{self.name}' cooldown elapsed ({elapsed:.1f}s >= {self.cooldown_seconds}s). "
                    f"Transitioning to HALF_OPEN to probe health."
                )
                self.state = CircuitState.HALF_OPEN
                return True
            return False

        # If HALF_OPEN, allow a single probe request
        return True

    allow_request = can_execute

    def record_success(self) -> None:
        """Record a successful execution, resetting failure counters."""
        self.total_successes += 1
        self.consecutive_failures = 0
        if self.state != CircuitState.CLOSED:
            logger.info(f"Provider '{self.name}' recovered. Circuit breaker transitioned from {self.state.value} to CLOSED.")
            self.state = CircuitState.CLOSED

    def record_failure(self, error: Optional[Exception] = None) -> None:
        """Record a provider failure, tripping the circuit breaker if threshold is reached."""
        self.total_failures += 1
        self.consecutive_failures += 1
        self.last_failure_time = time.time()

        if self.state == CircuitState.HALF_OPEN or self.consecutive_failures >= self.failure_threshold:
            self.state = CircuitState.OPEN
            logger.warning(
                f"Circuit breaker for provider '{self.name}' TRIPPED to OPEN! "
                f"({self.consecutive_failures} consecutive failures). Cooldown: {self.cooldown_seconds}s. Error: {error}"
            )

    def get_status(self) -> Dict[str, Any]:
        """Return diagnostic state of the circuit breaker."""
        return {
            "name": self.name,
            "state": self.state.value,
            "consecutive_failures": self.consecutive_failures,
            "total_failures": self.total_failures,
            "total_successes": self.total_successes,
            "cooldown_remaining": (
                max(0.0, round(self.cooldown_seconds - (time.time() - self.last_failure_time), 1))
                if self.state == CircuitState.OPEN else 0.0
            )
        }
