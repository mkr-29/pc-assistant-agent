"""
Security validation utilities: path traversal prevention, sensitive file guarding,
dangerous shell command detection, and SSRF prevention.
"""
import os
import re
import shlex
import urllib.parse
import ipaddress
from typing import Dict, Any, List, Optional
from pathlib import Path

try:
    from utils.paths import resolve_path, resolve_base_path
except ImportError:
    try:
        from src_py.utils.paths import resolve_path, resolve_base_path
    except ImportError:
        def resolve_path(p: str, b: Optional[str] = None) -> str:
            return os.path.abspath(os.path.expanduser(p)) if p else os.getcwd()
        def resolve_base_path(b: Optional[str] = None) -> str:
            return os.getcwd()

# Sensitive patterns that should not be exposed or blindly modified
SENSITIVE_FILE_PATTERNS = [
    r'(^|/)(\.env|\.env\.[a-zA-Z0-9_-]+)$',
    r'(^|/)id_rsa(\.pub)?$',
    r'(^|/)id_ed25519(\.pub)?$',
    r'(^|/)(credentials|secrets)\.(json|yaml|yml)$',
    r'\.(pem|key|p12|pfx|crt|cert)$',
    r'(^|/)\.git/(config|HEAD|objects)',
    r'(^|/)\.ssh/(authorized_keys|known_hosts|config)',
    r'/etc/(passwd|shadow|sudoers)',
]

# Dangerous destructive commands
DANGEROUS_COMMAND_PATTERNS = [
    (r'\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*)\s+(/|/\*|~|~\*|\.\.|\./\.\.)', "Destructive recursive file deletion targeting root or home"),
    (r'\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+(/|/\*|~|~\*)', "Recursive deletion targeting root or user directory"),
    (r'\b(mkfs|dd\s+if=.*of=/dev/|fdisk|parted)\b', "Direct disk formatting or overwriting"),
    (r':\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:', "Fork bomb detected"),
    (r'\bgit\s+reset\s+--hard\b', "Hard git reset can permanently discard all uncommitted changes"),
    (r'\bgit\s+clean\s+(-[a-zA-Z]*f[a-zA-Z]*x[a-zA-Z]*|-[a-zA-Z]*x[a-zA-Z]*f[a-zA-Z]*)\b', "git clean -fx permanently removes untracked and ignored files"),
    (r'\bsudo\b', "Privilege escalation with sudo is prohibited for security"),
    (r'\bchmod\s+(-R\s+)?777\s+(/|/\*|~)', "Overly permissive permission modification on critical directories"),
    (r'\bkill\s+-9\s+1\b', "Attempting to terminate init process"),
    (r'>\s*(/dev/sda|/dev/nvme|/dev/disk)', "Direct write redirection to raw block device"),
    (r'\b(shutdown|reboot|halt|init\s+0|poweroff)\b', "System shutdown or reboot command"),
]

def is_sensitive_path(file_path: str) -> bool:
    """Check whether a file path matches known sensitive secrets or keys"""
    clean = str(file_path).strip().replace('\\', '/')
    for pattern in SENSITIVE_FILE_PATTERNS:
        if re.search(pattern, clean, re.IGNORECASE):
            return True
    return False

def validate_path(
    file_path: str,
    allow_sensitive: bool = False,
    base_dir: Optional[str] = None
) -> Dict[str, Any]:
    """
    Validate a filesystem path for safety, path traversal, and sensitive secrets.

    Args:
        file_path: Target path to validate
        allow_sensitive: Whether accessing sensitive secret files is allowed
        base_dir: Optional boundary directory to restrict access within

    Returns:
        Dictionary with is_safe, resolved_path, is_sensitive, and reason
    """
    if not file_path or not str(file_path).strip():
        return {
            "is_safe": False,
            "resolved_path": "",
            "is_sensitive": False,
            "reason": "Empty path provided."
        }

    clean_path = str(file_path).strip()

    # Reject null bytes
    if '\x00' in clean_path:
        return {
            "is_safe": False,
            "resolved_path": "",
            "is_sensitive": False,
            "reason": "Path contains invalid null byte."
        }

    resolved = resolve_path(clean_path, base_dir)
    sensitive = is_sensitive_path(clean_path) or is_sensitive_path(resolved)

    if sensitive and not allow_sensitive:
        return {
            "is_safe": False,
            "resolved_path": resolved,
            "is_sensitive": True,
            "reason": f"Access to sensitive secret file '{os.path.basename(resolved)}' is blocked."
        }

    # If base directory boundary is specified, check boundary containment
    if base_dir:
        resolved_base = os.path.abspath(os.path.expanduser(base_dir))
        try:
            rel = os.path.relpath(resolved, resolved_base)
            if rel == '..' or rel.startswith(f'..{os.sep}') or os.path.isabs(rel):
                return {
                    "is_safe": False,
                    "resolved_path": resolved,
                    "is_sensitive": sensitive,
                    "reason": f"Path '{clean_path}' escapes base boundary '{resolved_base}'."
                }
        except ValueError:
            # Different drive letters on Windows
            return {
                "is_safe": False,
                "resolved_path": resolved,
                "is_sensitive": sensitive,
                "reason": "Path is on a different drive than base directory."
            }

    return {
        "is_safe": True,
        "resolved_path": resolved,
        "is_sensitive": sensitive,
        "reason": ""
    }

def validate_command(command: str) -> Dict[str, Any]:
    """
    Validate and classify a shell command for dangerous or destructive patterns.

    Args:
        command: Command string to inspect

    Returns:
        Dictionary with is_safe, category, reason, and tokens
    """
    clean_cmd = str(command or "").strip()
    if not clean_cmd:
        return {
            "is_safe": False,
            "category": "empty",
            "reason": "Empty command provided.",
            "tokens": []
        }

    # Check dangerous regex patterns
    for pattern, description in DANGEROUS_COMMAND_PATTERNS:
        if re.search(pattern, clean_cmd, re.IGNORECASE):
            return {
                "is_safe": False,
                "category": "destructive",
                "reason": f"Dangerous command blocked: {description}",
                "tokens": []
            }

    # Tokenize command
    try:
        tokens = shlex.split(clean_cmd)
    except Exception:
        tokens = clean_cmd.split()

    lower_tokens = [t.lower() for t in tokens]

    # Check for sudo anywhere
    if "sudo" in lower_tokens:
        return {
            "is_safe": False,
            "category": "privilege_escalation",
            "reason": "Privilege escalation with 'sudo' is prohibited.",
            "tokens": tokens
        }

    # Categorize safe vs write/modification
    category = "safe"
    if any(tok in lower_tokens for tok in ("npm", "yarn", "pnpm", "pip", "uv", "brew")):
        category = "package_manager"
    elif any(tok in lower_tokens for tok in ("git", "svn")):
        category = "vcs"
    elif any(tok in lower_tokens for tok in ("curl", "wget", "fetch")):
        category = "network"

    return {
        "is_safe": True,
        "category": category,
        "reason": "",
        "tokens": tokens
    }

def validate_url(url: str, allow_private_networks: bool = False) -> Dict[str, Any]:
    """
    Validate a URL for security and prevent SSRF attacks against internal/metadata IP addresses.

    Args:
        url: URL string to validate
        allow_private_networks: If False, blocks loopback, private RFC1918, and link-local addresses

    Returns:
        Dictionary with is_safe, url, and reason
    """
    clean_url = str(url or "").strip()
    if not clean_url:
        return {"is_safe": False, "url": "", "reason": "Empty URL provided."}

    if "://" in clean_url:
        scheme = clean_url.split("://", 1)[0].lower()
        if scheme not in ("http", "https"):
            return {
                "is_safe": False,
                "url": clean_url,
                "reason": f"Prohibited URL scheme '{scheme}'. Only HTTP and HTTPS are permitted."
            }
    else:
        # Auto-prefix https if missing scheme
        clean_url = f"https://{clean_url}"

    try:
        parsed = urllib.parse.urlparse(clean_url)
    except Exception as e:
        return {"is_safe": False, "url": clean_url, "reason": f"Malformed URL: {str(e)}"}

    if parsed.scheme not in ("http", "https"):
        return {
            "is_safe": False,
            "url": clean_url,
            "reason": f"Prohibited URL scheme '{parsed.scheme}'. Only HTTP and HTTPS are permitted."
        }

    hostname = parsed.hostname
    if not hostname:
        return {"is_safe": False, "url": clean_url, "reason": "URL has no valid hostname."}

    # Block well-known metadata hostnames
    lowered_host = hostname.lower()
    blocked_hostnames = {
        "localhost",
        "metadata.google.internal",
        "instance-data",
        "169.254.169.254"
    }

    if not allow_private_networks and lowered_host in blocked_hostnames:
        return {
            "is_safe": False,
            "url": clean_url,
            "reason": f"SSRF Protection: Access to private/metadata host '{hostname}' is blocked."
        }

    # Check IP address targets
    if not allow_private_networks:
        try:
            ip = ipaddress.ip_address(lowered_host)
            if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved:
                return {
                    "is_safe": False,
                    "url": clean_url,
                    "reason": f"SSRF Protection: Access to internal IP '{ip}' is blocked."
                }
        except ValueError:
            # Host is a domain name, not an IP literal
            pass

    return {
        "is_safe": True,
        "url": clean_url,
        "reason": ""
    }
