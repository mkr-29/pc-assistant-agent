"""
Terminal tools for the PC Assistant Agent
"""
import os
import subprocess
import shlex
from typing import Dict, Any, Optional
from tools.registry import register_tool

@register_tool("execute_command", "terminal")
def execute_command(command: str, cwd: Optional[str] = None, timeout: int = 30) -> Dict[str, Any]:
    """
    Execute a terminal command.

    Args:
        command: The command to execute
        cwd: Working directory for the command (optional)
        timeout: Timeout in seconds (default: 30)

    Returns:
        Dictionary with stdout, stderr, and return code
    """
    try:
        # Validate inputs
        if not command or not command.strip():
            return {
                "error": "Empty command provided",
                "stdout": "",
                "stderr": "",
                "return_code": 1
            }

        # Set working directory
        if cwd is None:
            cwd = os.getcwd()
        elif not os.path.isabs(cwd):
            cwd = os.path.abspath(cwd)

        # Check if working directory exists
        if not os.path.exists(cwd):
            return {
                "error": f"Working directory does not exist: {cwd}",
                "stdout": "",
                "stderr": "",
                "return_code": 1
            }

        # Execute the command
        process = subprocess.Popen(
            shlex.split(command),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=cwd,
            text=True
        )

        try:
            stdout, stderr = process.communicate(timeout=timeout)
            return_code = process.returncode
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
            return {
                "error": f"Command timed out after {timeout} seconds",
                "stdout": stdout,
                "stderr": stderr,
                "return_code": -1
            }

        return {
            "stdout": stdout,
            "stderr": stderr,
            "return_code": return_code,
            "command": command,
            "cwd": cwd
        }

    except FileNotFoundError:
        return {
            "error": f"Command not found: {command.split()[0] if command else ''}",
            "stdout": "",
            "stderr": "",
            "return_code": 127
        }
    except Exception as e:
        return {
            "error": f"Error executing command: {str(e)}",
            "stdout": "",
            "stderr": "",
            "return_code": 1
        }

@register_tool("change_directory", "terminal")
def change_directory(directory_path: str) -> Dict[str, Any]:
    """
    Change the current working directory.

    Args:
        directory_path: Path to change to

    Returns:
        Dictionary with success status and new path
    """
    try:
        # Ensure we're working with an absolute path
        if not os.path.isabs(directory_path):
            directory_path = os.path.abspath(directory_path)

        # Check if directory exists
        if not os.path.exists(directory_path):
            return {
                "success": False,
                "error": f"Directory does not exist: {directory_path}"
            }

        if not os.path.isdir(directory_path):
            return {
                "success": False,
                "error": f"Path is not a directory: {directory_path}"
            }

        # Change directory
        os.chdir(directory_path)
        new_cwd = os.getcwd()

        return {
            "success": True,
            "message": f"Changed directory to {new_cwd}",
            "previous_cwd": directory_path,  # This is approximate
            "new_cwd": new_cwd
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Error changing directory: {str(e)}"
        }

@register_tool("get_current_directory", "terminal")
def get_current_directory() -> Dict[str, Any]:
    """
    Get the current working directory.

    Returns:
        Dictionary with current directory path
    """
    try:
        cwd = os.getcwd()
        return {
            "current_directory": cwd
        }
    except Exception as e:
        return {
            "error": f"Error getting current directory: {str(e)}",
            "current_directory": ""
        }