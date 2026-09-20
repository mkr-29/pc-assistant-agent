"""
Asynchronous retry utility with exponential backoff, jitter, and selective exception filtering.
"""
import asyncio
import functools
import inspect
import random
import time
from typing import Any, Callable, Sequence, Tuple, Type, Optional
from utils.logger import get_logger

logger = get_logger("utils.retry")

def is_transient_error(error: Exception) -> bool:
    """
    Determine if an exception is likely transient (e.g. rate limits, timeouts, connection drops)
    rather than a permanent fatal error (e.g. authentication, invalid arguments).
    """
    if isinstance(error, (asyncio.TimeoutError, ConnectionError, TimeoutError)):
        return True

    err_str = str(error).lower()
    err_cls = error.__class__.__name__.lower()

    # Never retry client errors, auth, permission, not found, or syntax/validation errors
    non_retryable = (
        "400", "401", "403", "404", "not found", "unauthorized",
        "forbidden", "invalid_api_key", "permission_denied", "permissionerror",
        "filenotfounderror", "syntaxerror", "typeerror", "valueerror"
    )
    if any(c in err_str or c in err_cls for c in non_retryable):
        return False

    # Retry rate limits and transient server errors
    retryable_patterns = (
        "429", "too many requests", "rate limit", "quota",
        "500", "502", "503", "504", "service unavailable",
        "timeout", "timed out", "connection reset", "connection refused",
        "remote end closed", "server disconnected"
    )
    if any(p in err_str for p in retryable_patterns):
        return True

    return False

async def retry_async_call(
    func: Callable[..., Any],
    *args: Any,
    max_retries: int = 3,
    max_attempts: Optional[int] = None,
    initial_delay: float = 0.5,
    backoff_factor: float = 2.0,
    max_delay: float = 10.0,
    retry_check: Callable[[Exception], bool] = is_transient_error,
    **kwargs: Any
) -> Any:
    """
    Execute an async function with exponential backoff and jitter.
    """
    effective_attempts = max_attempts if max_attempts is not None else max_retries
    delay = initial_delay
    last_exception: Optional[Exception] = None

    for attempt in range(1, effective_attempts + 1):
        try:
            if inspect.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
        except Exception as e:
            last_exception = e
            if attempt == effective_attempts or not retry_check(e):
                raise

            # Calculate delay with jitter (+/- 20%)
            jitter = random.uniform(0.8, 1.2)
            sleep_time = min(delay * jitter, max_delay)
            func_name = getattr(func, "__name__", str(func))
            logger.warning(
                f"Transient failure on attempt {attempt}/{effective_attempts} for '{func_name}': {e}. "
                f"Retrying in {sleep_time:.2f}s..."
            )
            await asyncio.sleep(sleep_time)
            delay = min(delay * backoff_factor, max_delay)

    if last_exception:
        raise last_exception
