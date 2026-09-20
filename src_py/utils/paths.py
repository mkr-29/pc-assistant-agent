"""
Path utilities for resolving relative paths and home directory references safely.
"""
import os
from pathlib import Path
from typing import Optional

def resolve_base_path(base_path: Optional[str] = None) -> str:
    """
    Resolve base directory. Defaults to current working directory or TARGET_PROJECT_PATH.
    """
    if base_path:
        target = os.path.expanduser(base_path)
        if os.path.isabs(target):
            return os.path.abspath(target)
        return os.path.abspath(os.path.join(os.getcwd(), target))

    target_env = os.getenv("TARGET_PROJECT_PATH", "").strip()
    if target_env:
        expanded = os.path.expanduser(target_env)
        if os.path.isabs(expanded):
            return os.path.abspath(expanded)
        return os.path.abspath(os.path.join(os.getcwd(), expanded))

    return os.getcwd()

def resolve_path(file_path: Optional[str], base_path: Optional[str] = None) -> str:
    """
    Resolve any file or directory path.
    - Handles home directory '~'
    - Resolves relative paths against base_path or TARGET_PROJECT_PATH or cwd
    - Returns normalized absolute path
    """
    resolved_base = resolve_base_path(base_path)

    if not file_path:
        return resolved_base

    clean_path = str(file_path).strip()

    if clean_path.startswith("~"):
        return os.path.abspath(os.path.expanduser(clean_path))

    if os.path.isabs(clean_path):
        return os.path.abspath(clean_path)

    return os.path.abspath(os.path.join(resolved_base, clean_path))
