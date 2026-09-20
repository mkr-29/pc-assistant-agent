"""
Filesystem tools for the PC Assistant Agent with safe path resolution,
sensitive file protection, and standardized responses.
"""
import os
import glob
from pathlib import Path
from typing import List, Optional, Dict, Any

try:
    from utils.paths import resolve_path
    from utils.response import success_response, error_response
    from security.validator import validate_path
    from tools.registry import register_tool
    from utils.cache import global_cache
except ImportError:
    from src_py.utils.paths import resolve_path
    from src_py.utils.response import success_response, error_response
    from src_py.security.validator import validate_path
    from src_py.tools.registry import register_tool
    from src_py.utils.cache import global_cache

@register_tool("read_file", "filesystem")
def read_file(file_path: str, offset: int = 0, limit: Optional[int] = None) -> Dict[str, Any]:
    """
    Read a file from the local filesystem.

    Args:
        file_path: Path to the file to read (supports ~, absolute, or relative paths)
        offset: Line number to start reading from (0-indexed)
        limit: Number of lines to read (None for all lines from offset)

    Returns:
        Standardized dictionary with content, total_lines, and success status
    """
    try:
        # Validate path
        val = validate_path(file_path, allow_sensitive=False)
        if not val["is_safe"]:
            return error_response(val["reason"], code="SECURITY_VIOLATION", file_path=file_path)

        resolved_path = val["resolved_path"]

        if not os.path.exists(resolved_path):
            return error_response(f"File not found: {resolved_path}", code="FILE_NOT_FOUND", file_path=resolved_path)

        if os.path.isdir(resolved_path):
            return error_response(f"Path is a directory, not a file: {resolved_path}", code="IS_DIRECTORY", file_path=resolved_path)

        cache_key = f"read_file:{resolved_path}:{offset}:{limit}"
        cached = global_cache.get(cache_key)
        if cached is not None:
            return cached

        with open(resolved_path, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()

        total_lines = len(lines)
        if offset < 0:
            offset = 0
        if offset >= total_lines:
            res = success_response(data={
                "content": "",
                "total_lines": total_lines,
                "lines_returned": 0,
                "file_path": resolved_path
            })
            global_cache.set(cache_key, res, ttl=120.0)
            return res

        end_line = offset + limit if limit is not None else total_lines
        selected_lines = lines[offset:end_line]
        content = ''.join(selected_lines)

        res = success_response(data={
            "content": content,
            "total_lines": total_lines,
            "lines_returned": len(selected_lines),
            "file_path": resolved_path
        })
        global_cache.set(cache_key, res, ttl=120.0)
        return res

    except Exception as e:
        return error_response(f"Error reading file: {str(e)}", code="READ_ERROR", file_path=file_path)

@register_tool("write_file", "filesystem")
def write_file(file_path: str, content: str) -> Dict[str, Any]:
    """
    Write content to a file, overwriting if it exists.

    Args:
        file_path: Path to the file to write (supports ~, absolute, or relative paths)
        content: Content to write to the file

    Returns:
        Standardized dictionary with success status
    """
    try:
        # Validate path: block writing to sensitive secret files
        val = validate_path(file_path, allow_sensitive=False)
        if not val["is_safe"]:
            return error_response(val["reason"], code="SECURITY_VIOLATION", file_path=file_path)

        resolved_path = val["resolved_path"]

        directory = os.path.dirname(resolved_path)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)

        with open(resolved_path, 'w', encoding='utf-8') as f:
            f.write(content)

        # Invalidate cached file reads for this file and file existence
        global_cache.invalidate(f"read_file:{resolved_path}")
        global_cache.invalidate(f"file_exists:{resolved_path}")

        return success_response(
            message=f"Successfully wrote to {resolved_path}",
            data={
                "file_path": resolved_path,
                "bytes_written": len(content.encode('utf-8'))
            }
        )

    except Exception as e:
        return error_response(f"Error writing file: {str(e)}", code="WRITE_ERROR", file_path=file_path)

@register_tool("list_directory", "filesystem")
def list_directory(directory_path: str = ".") -> Dict[str, Any]:
    """
    List contents of a directory.

    Args:
        directory_path: Path to the directory to list (supports ~, absolute, or relative paths)

    Returns:
        Standardized dictionary with 'files' and 'directories' lists
    """
    try:
        resolved_path = resolve_path(directory_path)

        if not os.path.exists(resolved_path):
            return error_response(f"Directory not found: {resolved_path}", code="DIRECTORY_NOT_FOUND")

        if not os.path.isdir(resolved_path):
            return error_response(f"Path is not a directory: {resolved_path}", code="NOT_A_DIRECTORY")

        files = []
        directories = []

        for item in os.listdir(resolved_path):
            full_path = os.path.join(resolved_path, item)
            if os.path.isfile(full_path):
                files.append(item)
            elif os.path.isdir(full_path):
                directories.append(item)

        return success_response(data={
            "files": sorted(files),
            "directories": sorted(directories),
            "path": resolved_path,
            "total_items": len(files) + len(directories)
        })

    except Exception as e:
        return error_response(f"Error listing directory: {str(e)}", code="LIST_DIR_ERROR")

@register_tool("glob_search", "filesystem")
def glob_search(pattern: str, root_dir: str = ".") -> Dict[str, Any]:
    """
    Search for files using glob patterns.

    Args:
        pattern: Glob pattern to match (e.g., "*.py", "**/*.js")
        root_dir: Root directory to search in (default: current directory)

    Returns:
        Standardized dictionary with matching file paths
    """
    try:
        resolved_root = resolve_path(root_dir)

        if not os.path.exists(resolved_root):
            return error_response(f"Root directory not found: {resolved_root}", code="ROOT_NOT_FOUND")

        full_pattern = os.path.join(resolved_root, pattern)
        matches = glob.glob(full_pattern, recursive=True)

        relative_matches = []
        for match in matches:
            if os.path.commonpath([match, resolved_root]) == resolved_root:
                relative_path = os.path.relpath(match, resolved_root)
                relative_matches.append(relative_path)
            else:
                relative_matches.append(match)

        return success_response(data={
            "matches": sorted(relative_matches),
            "pattern": pattern,
            "root_dir": resolved_root,
            "count": len(relative_matches)
        })

    except Exception as e:
        return error_response(f"Error performing glob search: {str(e)}", code="GLOB_ERROR")

@register_tool("file_exists", "filesystem")
def file_exists(file_path: str) -> Dict[str, Any]:
    """
    Check if a file exists.

    Args:
        file_path: Path to the file to check

    Returns:
        Standardized dictionary with existence status
    """
    try:
        resolved_path = resolve_path(file_path)
        cache_key = f"file_exists:{resolved_path}"
        cached = global_cache.get(cache_key)
        if cached is not None:
            return cached

        exists = os.path.isfile(resolved_path)

        res = success_response(data={
            "exists": exists,
            "file_path": resolved_path,
            "type": "file" if exists else "none"
        })
        global_cache.set(cache_key, res, ttl=60.0)
        return res

    except Exception as e:
        return error_response(f"Error checking file existence: {str(e)}", code="EXISTS_ERROR", file_path=file_path)

@register_tool("directory_exists", "filesystem")
def directory_exists(directory_path: str) -> Dict[str, Any]:
    """
    Check if a directory exists.

    Args:
        directory_path: Path to the directory to check

    Returns:
        Standardized dictionary with existence status
    """
    try:
        resolved_path = resolve_path(directory_path)
        exists = os.path.isdir(resolved_path)

        return success_response(data={
            "exists": exists,
            "directory_path": resolved_path,
            "type": "directory" if exists else "none"
        })

    except Exception as e:
        return error_response(f"Error checking directory existence: {str(e)}", code="DIR_EXISTS_ERROR", directory_path=directory_path)