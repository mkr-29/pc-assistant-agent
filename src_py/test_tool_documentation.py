"""
Tests for Tool Registry catalog generation and documentation completeness.
"""
import pytest
import os
import inspect
import tools
from tools.registry import tool_registry

def test_tool_catalog_generation():
    """Verify tool_registry.generate_markdown_catalog includes all registered tools and categories"""
    catalog = tool_registry.generate_markdown_catalog()

    assert "# PC Assistant Agent - Tool Catalog" in catalog
    assert "Total Tools Registered:" in catalog
    assert "## Table of Categories" in catalog

    all_registered = tool_registry.list_tools()
    assert len(all_registered) >= 30

    # Ensure every single registered tool is documented in the markdown catalog
    for tool_name in all_registered:
        assert f"`{tool_name}`" in catalog, f"Tool {tool_name} is missing from markdown catalog"

    # Ensure categories are present
    categories = tool_registry.list_tools_by_category()
    for cat in categories.keys():
        assert f"## {cat.capitalize()} Tools" in catalog

def test_all_tools_have_docstrings():
    """Verify every registered tool has a non-empty docstring for LLM schema & docs"""
    for tool_name in tool_registry.list_tools():
        func = tool_registry.get_tool(tool_name)
        assert func is not None
        assert func.__doc__ is not None, f"Tool {tool_name} is missing a docstring!"
        assert len(func.__doc__.strip()) > 0, f"Tool {tool_name} has an empty docstring!"

def test_tool_metrics_recorded_on_execution():
    """Verify executing a tool records metrics in the metrics collector"""
    from monitoring.metrics import metrics_collector
    initial_count = metrics_collector.tool_calls.get("get_current_directory", {}).get("total", 0)

    # Execute get_current_directory through registry
    import asyncio
    res = asyncio.run(tool_registry.execute_tool("get_current_directory"))
    assert res is not None

    after_count = metrics_collector.tool_calls.get("get_current_directory", {}).get("total", 0)
    assert after_count == initial_count + 1
