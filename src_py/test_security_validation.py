"""
Comprehensive unit tests for security validation:
- Path traversal & sensitive file protection
- Dangerous shell command detection
- SSRF prevention against private and cloud metadata addresses
"""
import pytest
import os
import sys
import tempfile
import shutil

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from security.validator import (
    validate_path,
    validate_command,
    validate_url,
    is_sensitive_path
)

def test_is_sensitive_path():
    """Verify sensitive files are detected"""
    assert is_sensitive_path(".env") is True
    assert is_sensitive_path("/path/to/.env") is True
    assert is_sensitive_path(".env.production") is True
    assert is_sensitive_path("id_rsa") is True
    assert is_sensitive_path("~/.ssh/id_rsa") is True
    assert is_sensitive_path("credentials.json") is True
    assert is_sensitive_path("secrets.yaml") is True
    assert is_sensitive_path("server.key") is True
    assert is_sensitive_path("cert.pem") is True
    assert is_sensitive_path("/etc/passwd") is True

    # Safe paths
    assert is_sensitive_path("README.md") is False
    assert is_sensitive_path("src_py/main.py") is False
    assert is_sensitive_path("notes.txt") is False

def test_validate_path_security():
    """Verify validate_path blocks sensitive paths and directory traversal"""
    # Block null byte
    null_res = validate_path("file\x00.txt")
    assert null_res["is_safe"] is False
    assert "null byte" in null_res["reason"]

    # Block sensitive .env
    env_res = validate_path(".env", allow_sensitive=False)
    assert env_res["is_safe"] is False
    assert env_res["is_sensitive"] is True

    # Allow sensitive when explicitly flagged
    env_allowed = validate_path(".env", allow_sensitive=True)
    assert env_allowed["is_safe"] is True

    # Test boundary restriction
    test_dir = tempfile.mkdtemp()
    try:
        inside_file = os.path.join(test_dir, "inside.txt")
        with open(inside_file, "w") as f:
            f.write("safe")

        res_inside = validate_path("inside.txt", base_dir=test_dir)
        assert res_inside["is_safe"] is True

        # Escaping boundary
        res_outside = validate_path("../../etc/hosts", base_dir=test_dir)
        assert res_outside["is_safe"] is False
        assert "escapes base boundary" in res_outside["reason"]
    finally:
        shutil.rmtree(test_dir)

def test_validate_command_dangerous_detection():
    """Verify dangerous destructive commands are blocked"""
    # Destructive deletions
    res_rm_root = validate_command("rm -rf /")
    assert res_rm_root["is_safe"] is False
    assert "Destructive" in res_rm_root["reason"]

    res_rm_home = validate_command("rm -rf ~")
    assert res_rm_home["is_safe"] is False

    res_git_reset = validate_command("git reset --hard HEAD~1")
    assert res_git_reset["is_safe"] is False
    assert "git reset" in res_git_reset["reason"]

    res_git_clean = validate_command("git clean -fdx")
    assert res_git_clean["is_safe"] is False

    res_fork_bomb = validate_command(":(){ :|:& };:")
    assert res_fork_bomb["is_safe"] is False

    # Sudo privilege escalation
    res_sudo = validate_command("sudo apt update")
    assert res_sudo["is_safe"] is False
    assert "sudo" in res_sudo["reason"]

    # Shutdown
    res_shutdown = validate_command("shutdown -h now")
    assert res_shutdown["is_safe"] is False

def test_validate_command_safe_commands():
    """Verify safe commands are allowed and properly categorized"""
    res_ls = validate_command("ls -la")
    assert res_ls["is_safe"] is True
    assert res_ls["category"] == "safe"

    res_git_status = validate_command("git status")
    assert res_git_status["is_safe"] is True
    assert res_git_status["category"] == "vcs"

    res_pip = validate_command("pip list")
    assert res_pip["is_safe"] is True
    assert res_pip["category"] == "package_manager"

def test_validate_url_ssrf_protection():
    """Verify SSRF protection blocks local and metadata targets while permitting valid URLs"""
    # Prohibited schemes
    assert validate_url("file:///etc/passwd")["is_safe"] is False
    assert validate_url("gopher://localhost:8080")["is_safe"] is False

    # Localhost / Loopback
    res_localhost = validate_url("http://localhost:8080/api")
    assert res_localhost["is_safe"] is False
    assert "SSRF" in res_localhost["reason"]

    res_127 = validate_url("http://127.0.0.1:3000")
    assert res_127["is_safe"] is False

    # Cloud metadata service (AWS/GCP/Azure)
    res_meta = validate_url("http://169.254.169.254/latest/meta-data")
    assert res_meta["is_safe"] is False
    assert "SSRF" in res_meta["reason"]

    res_gcp_meta = validate_url("http://metadata.google.internal/computeMetadata/v1/")
    assert res_gcp_meta["is_safe"] is False

    # Private RFC1918 IPs
    res_private_10 = validate_url("http://10.0.0.1/admin")
    assert res_private_10["is_safe"] is False

    res_private_192 = validate_url("http://192.168.1.1/setup")
    assert res_private_192["is_safe"] is False

    # Safe public URLs
    res_public = validate_url("https://python.org")
    assert res_public["is_safe"] is True
    assert res_public["url"] == "https://python.org"
