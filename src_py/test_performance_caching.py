"""
Unit tests for Performance Optimizations and In-Memory TTLCache
"""
import os
import shutil
import tempfile
import time
from unittest.mock import patch, MagicMock
import pytest

from utils.cache import TTLCache, cached_operation, global_cache
from tools.filesystem import read_file, write_file, file_exists

@pytest.fixture
def temp_cache_dir():
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)

def test_ttl_cache_basic_and_stats():
    cache = TTLCache(max_size=3, default_ttl_seconds=1.0)
    assert cache.get("non_existent") is None
    assert cache.misses == 1
    assert cache.hits == 0

    cache.set("k1", "val1")
    assert cache.get("k1") == "val1"
    assert cache.hits == 1

    stats = cache.get_stats()
    assert stats["hits"] == 1
    assert stats["misses"] == 1
    assert stats["cached_entries"] == 1
    assert stats["hit_ratio_percent"] == 50.0

def test_ttl_cache_expiration():
    cache = TTLCache(max_size=10, default_ttl_seconds=0.05)
    cache.set("quick", "expires_fast", ttl=0.05)
    assert cache.get("quick") == "expires_fast"

    time.sleep(0.08)
    # Item should have expired
    assert cache.get("quick") is None

def test_ttl_cache_capacity_eviction():
    cache = TTLCache(max_size=2, default_ttl_seconds=10.0)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)  # should evict 'a'

    assert cache.get("a") is None
    assert cache.get("b") == 2
    assert cache.get("c") == 3
    assert cache.evictions == 1

def test_ttl_cache_prefix_invalidation():
    cache = TTLCache()
    cache.set("file:/path/to/a.txt:0:None", "content a")
    cache.set("file:/path/to/a.txt:10:5", "content a offset")
    cache.set("file:/path/to/b.txt:0:None", "content b")

    assert len(cache._store) == 3
    removed = cache.invalidate("file:/path/to/a.txt")
    assert removed == 2
    assert cache.get("file:/path/to/b.txt:0:None") == "content b"

def test_filesystem_read_caching_and_write_invalidation(temp_cache_dir):
    global_cache.clear()
    test_file = os.path.join(temp_cache_dir, "cache_test.txt")

    # Initial write
    res_w1 = write_file(test_file, "Initial content line 1\nLine 2\n")
    assert res_w1["success"] is True

    # First read (Cache Miss)
    res_r1 = read_file(test_file)
    assert res_r1["success"] is True
    assert "Initial content" in res_r1["data"]["content"]

    # Second read (Cache Hit)
    res_r2 = read_file(test_file)
    assert res_r2["success"] is True
    assert res_r2["data"]["content"] == res_r1["data"]["content"]

    # Now write new content to the file
    res_w2 = write_file(test_file, "Updated content line 1\n")
    assert res_w2["success"] is True

    # Next read should reflect the updated content because write invalidated the cache
    res_r3 = read_file(test_file)
    assert res_r3["success"] is True
    assert "Updated content line 1" in res_r3["data"]["content"]

@pytest.mark.asyncio
async def test_cached_operation_decorator():
    call_count = 0

    @cached_operation("calc", ttl=10.0)
    async def expensive_calc(x: int) -> dict:
        nonlocal call_count
        call_count += 1
        return {"success": True, "result": x * 2}

    res1 = await expensive_calc(5)
    assert res1["result"] == 10
    assert call_count == 1

    # Second call with same arguments should hit cache
    res2 = await expensive_calc(5)
    assert res2["result"] == 10
    assert call_count == 1

    # Different argument
    res3 = await expensive_calc(10)
    assert res3["result"] == 20
    assert call_count == 2
