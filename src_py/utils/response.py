"""
Standardized response envelope utilities for agent tools.
Ensures every tool returns a consistent format with success status, error details,
and uniform keys.
"""
from typing import Dict, Any, Optional

def success_response(
    data: Optional[Dict[str, Any]] = None,
    message: str = "",
    **kwargs
) -> Dict[str, Any]:
    """
    Construct a standardized success response dictionary.

    Args:
        data: Optional payload dictionary
        message: Optional user-friendly success message
        **kwargs: Additional key-value pairs to include

    Returns:
        Standardized success dictionary
    """
    res: Dict[str, Any] = {
        "success": True,
        "error": None
    }
    if message:
        res["message"] = message
    if data:
        res.update(data)
    if kwargs:
        res.update(kwargs)
    return res

def error_response(
    error: str,
    code: str = "ERROR",
    data: Optional[Dict[str, Any]] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Construct a standardized error response dictionary.

    Args:
        error: Descriptive error message
        code: Error code identifier
        data: Optional extra payload
        **kwargs: Additional fields

    Returns:
        Standardized error dictionary
    """
    res: Dict[str, Any] = {
        "success": False,
        "error": str(error),
        "error_code": code
    }
    if data:
        res.update(data)
    if kwargs:
        res.update(kwargs)
    return res
