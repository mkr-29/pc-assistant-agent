"""
Unit tests for Web tools, macOS System tools, and Tool Registry schemas.
"""
import pytest
import sys
import os
import platform
from unittest.mock import AsyncMock, patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from tools.registry import tool_registry
from tools.web import fetch_web_page, search_web, parse_sitemap
from tools.system import get_system_info, get_clipboard, set_clipboard, open_target

def test_tool_registry_schemas():
    """Verify tool_registry generates valid OpenAI function schemas"""
    schemas = tool_registry.get_tools_schema()
    assert len(schemas) >= 30

    # Verify a few known tools have correct schema structure
    read_file_schema = next((s for s in schemas if s["function"]["name"] == "read_file"), None)
    assert read_file_schema is not None
    assert read_file_schema["type"] == "function"
    assert "file_path" in read_file_schema["function"]["parameters"]["properties"]
    assert "file_path" in read_file_schema["function"]["parameters"]["required"]

    web_schema = next((s for s in schemas if s["function"]["name"] == "fetch_web_page"), None)
    assert web_schema is not None
    assert "url" in web_schema["function"]["parameters"]["properties"]

    sys_schema = next((s for s in schemas if s["function"]["name"] == "get_system_info"), None)
    assert sys_schema is not None

@pytest.mark.asyncio
async def test_fetch_web_page():
    """Test fetching and extracting text from HTML"""
    mock_html = """
    <html>
        <head><title>Test Page Title</title></head>
        <body>
            <nav><a href="/home">Home</a></nav>
            <h1>Main Heading</h1>
            <p>This is a test paragraph with valuable content.</p>
            <script>console.log("ignore me");</script>
        </body>
    </html>
    """

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = mock_html
        mock_get.return_value = mock_resp

        result = await fetch_web_page("https://example.com/test")
        assert result["success"] is True
        assert result["title"] == "Test Page Title"
        assert "Main Heading" in result["content"]
        assert "valuable content" in result["content"]
        assert "ignore me" not in result["content"]

@pytest.mark.asyncio
async def test_search_web():
    """Test web search result parsing"""
    mock_ddg_html = """
    <div class="result">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fpython.org">Python Official</a>
        <a class="result__snippet">Python is a high-level programming language.</a>
    </div>
    """

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = mock_ddg_html
        mock_get.return_value = mock_resp

        result = await search_web("Python", max_results=2)
        assert result["success"] is True
        assert len(result["results"]) == 1
        assert result["results"][0]["title"] == "Python Official"
        assert result["results"][0]["url"] == "https://python.org"
        assert "high-level" in result["results"][0]["snippet"]

@pytest.mark.asyncio
async def test_parse_sitemap():
    """Test parsing sitemap XML"""
    mock_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/page1</loc></url>
        <url><loc>https://example.com/page2</loc></url>
    </urlset>"""

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = mock_xml
        mock_get.return_value = mock_resp

        result = await parse_sitemap("https://example.com/sitemap.xml")
        assert result["success"] is True
        assert result["total_urls"] == 2
        assert "https://example.com/page1" in result["urls"]
        assert "https://example.com/page2" in result["urls"]

def test_system_info():
    """Test retrieving system info metrics"""
    info = get_system_info()
    assert info["success"] is True
    assert "cpu" in info
    assert "usage_percent" in info["cpu"]
    assert "memory" in info
    assert "total_gb" in info["memory"]
    assert "disk" in info
    assert "total_gb" in info["disk"]

def test_clipboard_operations():
    """Test clipboard read/write on supported OS or graceful return"""
    if platform.system().lower() == "darwin":
        set_res = set_clipboard("agent_test_clipboard_data")
        assert set_res["success"] is True
        get_res = get_clipboard()
        assert get_res["success"] is True
        assert get_res["content"] == "agent_test_clipboard_data"
    else:
        res = get_clipboard()
        assert res["success"] is False
