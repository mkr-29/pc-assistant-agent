"""
Registry for agent tools with schema generation and async execution support.
"""
import asyncio
import inspect
import logging
from typing import Dict, Any, Callable, List, Optional, get_type_hints

logger = logging.getLogger(__name__)

ToolFunction = Callable[..., Any]

class ToolRegistry:
    """Registry for agent tools"""

    def __init__(self):
        self.tools: Dict[str, ToolFunction] = {}
        self._tool_categories: Dict[str, List[str]] = {}

    def register_tool(self, name: str, func: ToolFunction, category: str = "general"):
        """Register a tool function"""
        if name in self.tools:
            logger.debug(f"Tool '{name}' is already registered. Overwriting.")

        self.tools[name] = func

        if category not in self._tool_categories:
            self._tool_categories[category] = []
        if name not in self._tool_categories[category]:
            self._tool_categories[category].append(name)

        logger.debug(f"Registered tool '{name}' in category '{category}'")

    def get_tool(self, name: str) -> Optional[ToolFunction]:
        """Get a tool function by name"""
        return self.tools.get(name)

    async def execute_tool(self, name: str, **kwargs) -> Any:
        """Execute a tool function handling both sync and async functions"""
        func = self.get_tool(name)
        if not func:
            raise KeyError(f"Tool '{name}' is not registered.")

        if asyncio.iscoroutinefunction(func):
            return await func(**kwargs)
        else:
            return func(**kwargs)

    def list_tools(self) -> List[str]:
        """List all registered tool names"""
        return list(self.tools.keys())

    def list_tools_by_category(self) -> Dict[str, List[str]]:
        """List tools grouped by category"""
        return {k: list(v) for k, v in self._tool_categories.items()}

    def get_tool_description(self, name: str) -> str:
        """Get the description of a tool from its docstring"""
        func = self.get_tool(name)
        if func and func.__doc__:
            return func.__doc__.strip()
        return "No description available"

    def get_tools_schema(self) -> List[Dict[str, Any]]:
        """
        Generate OpenAI-compatible tool definitions for all registered tools.
        Uses function inspection, docstrings, and typing annotations.
        """
        schemas = []
        for name, func in self.tools.items():
            doc = (func.__doc__ or "").strip()
            first_line = doc.split("\n")[0].strip() if doc else f"Tool {name}"

            sig = inspect.signature(func)
            properties: Dict[str, Any] = {}
            required: List[str] = []

            for param_name, param in sig.parameters.items():
                if param.default is inspect.Parameter.empty:
                    required.append(param_name)

                # Determine JSON type from annotation
                param_type = "string"
                if param.annotation is int:
                    param_type = "integer"
                elif param.annotation is float:
                    param_type = "number"
                elif param.annotation is bool:
                    param_type = "boolean"
                elif param.annotation in (list, List):
                    param_type = "array"
                elif param.annotation in (dict, Dict):
                    param_type = "object"

                prop_def = {"type": param_type, "description": f"Parameter {param_name}"}
                properties[param_name] = prop_def

            schemas.append({
                "type": "function",
                "function": {
                    "name": name,
                    "description": first_line,
                    "parameters": {
                        "type": "object",
                        "properties": properties,
                        "required": required
                    }
                }
            })

        return schemas

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