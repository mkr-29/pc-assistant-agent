"""
High-performance in-memory TTL/LRU cache for tools, web fetching, and file reads.
Tracks cache hit/miss statistics and supports prefix-based invalidation on write events.
"""
import functools
import inspect
import time
from typing import Any, Callable, Dict, Optional, Tuple
from utils.logger import get_logger

logger = get_logger("utils.cache")

class TTLCache:
    """
    In-memory cache with Time-To-Live expiration and capacity eviction.
    """

    def __init__(self, max_size: int = 500, default_ttl_seconds: float = 300.0):
        self.max_size = max_size
        self.default_ttl = default_ttl_seconds
        self._store: Dict[str, Tuple[Any, float]] = {}  # key -> (value, expire_at)
        self.hits = 0
        self.misses = 0
        self.evictions = 0

    def get(self, key: str) -> Optional[Any]:
        """Retrieve an item from cache if not expired."""
        if key in self._store:
            val, expire_at = self._store[key]
            if time.time() < expire_at:
                self.hits += 1
                return val
            else:
                # Expired
                del self._store[key]

        self.misses += 1
        return None

    def set(self, key: str, value: Any, ttl: Optional[float] = None) -> None:
        """Store an item with expiration timestamp."""
        # Evict oldest entry if at capacity
        if len(self._store) >= self.max_size and key not in self._store:
            oldest_key = next(iter(self._store))
            del self._store[oldest_key]
            self.evictions += 1

        expire_at = time.time() + (ttl if ttl is not None else self.default_ttl)
        self._store[key] = (value, expire_at)

    def invalidate(self, prefix_or_key: str) -> int:
        """
        Invalidate all keys matching the given prefix or key.
        Useful when modifying/deleting files or updating resources.
        """
        removed = 0
        keys_to_remove = [k for k in self._store if k == prefix_or_key or k.startswith(prefix_or_key)]
        for k in keys_to_remove:
            del self._store[k]
            removed += 1
        return removed

    def clear(self) -> None:
        """Purge all cached values."""
        self._store.clear()

    def get_stats(self) -> Dict[str, Any]:
        """Return cache hit/miss and efficiency statistics."""
        total = self.hits + self.misses
        hit_ratio = round((self.hits / total) * 100, 1) if total > 0 else 0.0
        return {
            "cached_entries": len(self._store),
            "hits": self.hits,
            "misses": self.misses,
            "evictions": self.evictions,
            "hit_ratio_percent": hit_ratio
        }

# Global cache instance
global_cache = TTLCache()

def cached_operation(prefix: str, ttl: float = 300.0):
    """
    Decorator for caching synchronous or asynchronous tool operations.
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            key = f"{prefix}:{args}:{sorted(kwargs.items())}"
            cached_val = global_cache.get(key)
            if cached_val is not None:
                return cached_val

            if inspect.iscoroutinefunction(func):
                val = await func(*args, **kwargs)
            else:
                val = func(*args, **kwargs)

            # Only cache successful responses
            if isinstance(val, dict) and val.get("success", True):
                global_cache.set(key, val, ttl=ttl)
            return val

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            key = f"{prefix}:{args}:{sorted(kwargs.items())}"
            cached_val = global_cache.get(key)
            if cached_val is not None:
                return cached_val

            val = func(*args, **kwargs)
            if isinstance(val, dict) and val.get("success", True):
                global_cache.set(key, val, ttl=ttl)
            return val

        if inspect.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator
