"""
Terminal tools for the PC Assistant Agent with security command validation
and standardized responses.
"""
import os
import subprocess
import shlex
from typing import Dict, Any, Optional

try:
    from tools.registry import register_tool
    from utils.response import success_response, error_response
    from security.validator import validate_command
except ImportError:
    from src_py.tools.registry import register_tool
    from src_py.utils.response import success_response, error_response
    from src_py.security.validator import validate_command

@register_tool("execute_command", "terminal")
def execute_command(command: str, cwd: Optional[str] = None, timeout: int = 30) -> Dict[str, Any]:
    """
    Execute a terminal command with security validation and timeout enforcement.

    Args:
        command: The command to execute
        cwd: Working directory for the command (optional)
        timeout: Timeout in seconds (default: 30)

    Returns:
        Standardized dictionary with success, stdout, stderr, and return_code
    """
    try:
        # Validate inputs
        if not command or not command.strip():
            return error_response("Empty command provided.", code="EMPTY_COMMAND", return_code=1)

        # Security check: detect destructive or dangerous patterns
        validation = validate_command(command)
        if not validation["is_safe"]:
            return error_response(
                f"Security Guard: {validation['reason']}",
                code="SECURITY_VIOLATION",
                category=validation.get("category"),
                return_code=126
            )

        # Set and validate working directory
        resolved_cwd = os.path.abspath(os.path.expanduser(cwd)) if cwd else os.getcwd()

        if not os.path.exists(resolved_cwd):
            return error_response(
                f"Working directory does not exist: {resolved_cwd}",
                code="DIRECTORY_NOT_FOUND",
                return_code=1
            )

        # Execute command safely
        try:
            tokens = shlex.split(command)
        except ValueError:
            tokens = command.split()

        process = subprocess.Popen(
            tokens,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=resolved_cwd,
            text=True
        )

        try:
            stdout, stderr = process.communicate(timeout=timeout)
            return_code = process.returncode
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
            return error_response(
                f"Command timed out after {timeout} seconds",
                code="TIMEOUT",
                stdout=stdout,
                stderr=stderr,
                return_code=-1
            )

        if return_code != 0:
            return error_response(
                f"Command exited with code {return_code}: {stderr.strip() or stdout.strip()}",
                code="EXECUTION_FAILED",
                stdout=stdout,
                stderr=stderr,
                return_code=return_code,
                command=command,
                cwd=resolved_cwd
            )

        return success_response(
            data={
                "stdout": stdout,
                "stderr": stderr,
                "return_code": 0,
                "command": command,
                "cwd": resolved_cwd
            }
        )

    except FileNotFoundError:
        binary = command.split()[0] if command else ""
        return error_response(f"Command binary not found: {binary}", code="BINARY_NOT_FOUND", return_code=127)
    except Exception as e:
        return error_response(f"Error executing command: {str(e)}", code="SYSTEM_ERROR", return_code=1)

@register_tool("change_directory", "terminal")
def change_directory(directory_path: str) -> Dict[str, Any]:
    """
    Change the current working directory.

    Args:
        directory_path: Path to change to (supports ~, relative, or absolute)

    Returns:
        Standardized dictionary with success status and new directory path
    """
    try:
        if not directory_path or not str(directory_path).strip():
            return error_response("Empty directory path provided.", code="INVALID_PATH")

        resolved_path = os.path.abspath(os.path.expanduser(directory_path))

        if not os.path.exists(resolved_path):
            return error_response(f"Directory does not exist: {resolved_path}", code="NOT_FOUND")

        if not os.path.isdir(resolved_path):
            return error_response(f"Path is not a directory: {resolved_path}", code="NOT_A_DIRECTORY")

        old_cwd = os.getcwd()
        os.chdir(resolved_path)
        new_cwd = os.getcwd()

        return success_response(
            message=f"Changed directory to {new_cwd}",
            data={
                "previous_cwd": old_cwd,
                "new_cwd": new_cwd
            }
        )

    except Exception as e:
        return error_response(f"Error changing directory: {str(e)}", code="CHANGE_DIR_FAILED")

@register_tool("get_current_directory", "terminal")
def get_current_directory() -> Dict[str, Any]:
    """
    Get the current working directory.

    Returns:
        Standardized dictionary with current directory path
    """
    try:
        cwd = os.getcwd()
        return success_response(data={"current_directory": cwd})
    except Exception as e:
        return error_response(f"Error getting current directory: {str(e)}", code="GET_CWD_FAILED")