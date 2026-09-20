"""
Tools package for the PC Assistant Agent.
Imports all tool submodules to ensure they are registered in the global tool_registry.
"""
from .registry import tool_registry, register_tool, get_tool, list_tools

# Import tool modules to trigger decorators
from . import filesystem
from . import terminal
from . import memory
from . import telegram
from . import web
from . import system

__all__ = [
    "tool_registry",
    "register_tool",
    "get_tool",
    "list_tools",
    "filesystem",
    "terminal",
    "memory",
    "telegram",
    "web",
    "system"
]
