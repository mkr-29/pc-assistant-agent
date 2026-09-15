"""
Filesystem tools for the PC Assistant Agent
"""
import os
import glob
from pathlib import Path
from typing import List, Optional, Dict, Any
from tools.registry import register_tool

@register_tool("read_file", "filesystem")
def read_file(file_path: str, offset: int = 0, limit: Optional[int] = None) -> Dict[str, Any]:
    """
    Read a file from the local filesystem.

    Args:
        file_path: Absolute path to the file to read
        offset: Line number to start reading from (0-indexed)
        limit: Number of lines to read (None for all lines from offset)

    Returns:
        Dictionary with 'content' (string) and 'total_lines' (int)
    """
    try:
        # Ensure we're working with an absolute path
        if not os.path.isabs(file_path):
            # In a real implementation, we would resolve relative to target project path
            file_path = os.path.abspath(file_path)

        # Check if file exists
        if not os.path.exists(file_path):
            return {
                "error": f"File not found: {file_path}",
                "content": "",
                "total_lines": 0
            }

        # Read the file
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        total_lines = len(lines)

        # Apply offset and limit
        if offset < 0:
            offset = 0
        if offset >= total_lines:
            return {
                "content": "",
                "total_lines": total_lines
            }

        end_line = offset + limit if limit is not None else total_lines
        selected_lines = lines[offset:end_line]
        content = ''.join(selected_lines)

        return {
            "content": content,
            "total_lines": total_lines,
            "lines_returned": len(selected_lines)
        }

    except Exception as e:
        return {
            "error": f"Error reading file: {str(e)}",
            "content": "",
            "total_lines": 0
        }

@register_tool("write_file", "filesystem")
def write_file(file_path: str, content: str) -> Dict[str, Any]:
    """
    Write content to a file, overwriting if it exists.

    Args:
        file_path: Absolute path to the file to write
        content: Content to write to the file

    Returns:
        Dictionary with success status
    """
    try:
        # Ensure we're working with an absolute path
        if not os.path.isabs(file_path):
            file_path = os.path.abspath(file_path)

        # Create directory if it doesn't exist
        directory = os.path.dirname(file_path)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)

        # Write the file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return {
            "success": True,
            "message": f"Successfully wrote to {file_path}",
            "file_path": file_path,
            "bytes_written": len(content.encode('utf-8'))
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Error writing file: {str(e)}",
            "file_path": file_path
        }

@register_tool("list_directory", "filesystem")
def list_directory(directory_path: str) -> Dict[str, Any]:
    """
    List contents of a directory.

    Args:
        directory_path: Absolute path to the directory to list

    Returns:
        Dictionary with 'files' and 'directories' lists
    """
    try:
        # Ensure we're working with an absolute path
        if not os.path.isabs(directory_path):
            directory_path = os.path.abspath(directory_path)

        # Check if directory exists
        if not os.path.exists(directory_path):
            return {
                "error": f"Directory not found: {directory_path}",
                "files": [],
                "directories": []
            }

        if not os.path.isdir(directory_path):
            return {
                "error": f"Path is not a directory: {directory_path}",
                "files": [],
                "directories": []
            }

        # List contents
        files = []
        directories = []

        for item in os.listdir(directory_path):
            full_path = os.path.join(directory_path, item)
            if os.path.isfile(full_path):
                files.append(item)
            elif os.path.isdir(full_path):
                directories.append(item)

        return {
            "files": sorted(files),
            "directories": sorted(directories),
            "path": directory_path
        }

    except Exception as e:
        return {
            "error": f"Error listing directory: {str(e)}",
            "files": [],
            "directories": []
        }

@register_tool("glob_search", "filesystem")
def glob_search(pattern: str, root_dir: str = ".") -> Dict[str, Any]:
    """
    Search for files using glob patterns.

    Args:
        pattern: Glob pattern to match (e.g., "*.py", "**/*.js")
        root_dir: Root directory to search in (default: current directory)

    Returns:
        Dictionary with matching file paths
    """
    try:
        # Ensure we're working with an absolute path for root
        if not os.path.isabs(root_dir):
            root_dir = os.path.abspath(root_dir)

        # Check if root directory exists
        if not os.path.exists(root_dir):
            return {
                "error": f"Root directory not found: {root_dir}",
                "matches": []
            }

        # Construct the full pattern
        full_pattern = os.path.join(root_dir, pattern)

        # Perform glob search
        matches = glob.glob(full_pattern, recursive=True)

        # Convert to relative paths for cleaner output
        relative_matches = []
        for match in matches:
            if os.path.commonpath([match, root_dir]) == root_dir:
                # Make relative to root_dir
                relative_path = os.path.relpath(match, root_dir)
                relative_matches.append(relative_path)
            else:
                relative_matches.append(match)

        return {
            "matches": sorted(relative_matches),
            "pattern": pattern,
            "root_dir": root_dir,
            "count": len(relative_matches)
        }

    except Exception as e:
        return {
            "error": f"Error performing glob search: {str(e)}",
            "matches": []
        }

@register_tool("file_exists", "filesystem")
def file_exists(file_path: str) -> Dict[str, Any]:
    """
    Check if a file exists.

    Args:
        file_path: Absolute path to the file to check

    Returns:
        Dictionary with existence status
    """
    try:
        # Ensure we're working with an absolute path
        if not os.path.isabs(file_path):
            file_path = os.path.abspath(file_path)

        exists = os.path.isfile(file_path)

        return {
            "exists": exists,
            "file_path": file_path,
            "type": "file" if exists else "none"
        }

    except Exception as e:
        return {
            "error": f"Error checking file existence: {str(e)}",
            "exists": False,
            "file_path": file_path
        }

@register_tool("directory_exists", "filesystem")
def directory_exists(directory_path: str) -> Dict[str, Any]:
    """
    Check if a directory exists.

    Args:
        directory_path: Absolute path to the directory to check

    Returns:
        Dictionary with existence status
    """
    try:
        # Ensure we're working with an absolute path
        if not os.path.isabs(directory_path):
            directory_path = os.path.abspath(directory_path)

        exists = os.path.isdir(directory_path)

        return {
            "exists": exists,
            "directory_path": directory_path,
            "type": "directory" if exists else "none"
        }

    except Exception as e:
        return {
            "error": f"Error checking directory existence: {str(e)}",
            "exists": False,
            "directory_path": directory_path
        }