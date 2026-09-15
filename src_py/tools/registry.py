from typing import Dict, Any, Callable
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

# Tool function type
ToolFunction = Callable[..., Any]

class ToolRegistry:
    """Registry for agent tools"""

    def __init__(self):
        self.tools: Dict[str, ToolFunction] = {}
        self._tool_categories: Dict[str, List[str]] = {}

    def register_tool(self, name: str, func: ToolFunction, category: str = "general"):
        """Register a tool function"""
        if name in self.tools:
            logger.warning(f"Tool '{name}' is already registered. Overwriting.")

        self.tools[name] = func

        # Add to category tracking
        if category not in self._tool_categories:
            self._tool_categories[category] = []
        if name not in self._tool_categories[category]:
            self._tool_categories[category].append(name)

        logger.debug(f"Registered tool '{name}' in category '{category}'")

    def get_tool(self, name: str) -> Optional[ToolFunction]:
        """Get a tool function by name"""
        return self.tools.get(name)

    def list_tools(self) -> List[str]:
        """List all registered tool names"""
        return list(self.tools.keys())

    def list_tools_by_category(self) -> Dict[str, List[str]]:
        """List tools grouped by category"""
        return self._tool_categories.copy()

    def get_tool_description(self, name: str) -> str:
        """Get the description of a tool (from its docstring)"""
        func = self.get_tool(name)
        if func and func.__doc__:
            return func.__doc__.strip()
        return "No description available"

# Global registry instance
tool_registry = ToolRegistry()

def register_tool(name: str, category: str = "general"):
    """Decorator to register a tool function"""
    def decorator(func: ToolFunction) -> ToolFunction:
        tool_registry.register_tool(name, func, category)
        return func
    return decorator

def get_tool(name: str) -> Optional[ToolFunction]:
    """Get a tool function from the global registry"""
    return tool_registry.get_tool(name)

def list_tools() -> List[str]:
    """List all registered tool names from the global registry"""
    return tool_registry.list_tools()