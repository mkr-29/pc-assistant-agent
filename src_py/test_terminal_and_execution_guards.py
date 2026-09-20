"""
Integration tests for terminal tools, filesystem tools, and web tools with security guards.
"""
import pytest
import os
import sys
import tempfile
import shutil

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from tools.terminal import execute_command, change_directory, get_current_directory
from tools.filesystem import read_file, write_file, list_directory
from tools.web import fetch_web_page

def test_terminal_safe_command_execution():
    """Verify safe terminal commands succeed with standardized envelope"""
    res = execute_command("echo hello_agent")
    assert res["success"] is True
    assert res["error"] is None
    assert "hello_agent" in res["stdout"]
    assert res["return_code"] == 0

def test_terminal_blocked_dangerous_command():
    """Verify dangerous deletion is blocked before process execution"""
    res = execute_command("rm -rf /")
    assert res["success"] is False
    assert res["error_code"] == "SECURITY_VIOLATION"
    assert "Security Guard" in res["error"]

    res_sudo = execute_command("sudo cat /etc/shadow")
    assert res_sudo["success"] is False
    assert res_sudo["error_code"] == "SECURITY_VIOLATION"

def test_terminal_timeout():
    """Verify long-running commands timeout gracefully"""
    res = execute_command("sleep 5", timeout=1)
    assert res["success"] is False
    assert res["error_code"] == "TIMEOUT"
    assert res["return_code"] == -1

def test_change_and_get_current_directory():
    """Verify directory changing and retrieval"""
    orig_cwd = os.getcwd()
    test_dir = tempfile.mkdtemp()
    try:
        change_res = change_directory(test_dir)
        assert change_res["success"] is True
        assert change_res["new_cwd"] == os.path.realpath(test_dir)

        get_res = get_current_directory()
        assert get_res["success"] is True
        assert get_res["current_directory"] == os.path.realpath(test_dir)
    finally:
        os.chdir(orig_cwd)
        shutil.rmtree(test_dir)

def test_filesystem_sensitive_path_blocking():
    """Verify read_file and write_file block accessing or overwriting .env"""
    # Block writing to .env
    write_res = write_file(".env", "LEAKED_KEY=12345")
    assert write_res["success"] is False
    assert write_res["error_code"] == "SECURITY_VIOLATION"
    assert "sensitive secret file" in write_res["error"]

    # Block reading from .env
    read_res = read_file(".env")
    assert read_res["success"] is False
    assert read_res["error_code"] == "SECURITY_VIOLATION"

    # Safe file writing and reading works
    test_dir = tempfile.mkdtemp()
    try:
        safe_file = os.path.join(test_dir, "output.txt")
        w_res = write_file(safe_file, "Processed report")
        assert w_res["success"] is True

        r_res = read_file(safe_file)
        assert r_res["success"] is True
        assert r_res["content"] == "Processed report"
    finally:
        shutil.rmtree(test_dir)

@pytest.mark.asyncio
async def test_web_ssrf_blocking():
    """Verify web fetching blocks metadata and localhost SSRF"""
    res_meta = await fetch_web_page("http://169.254.169.254/latest/meta-data")
    assert res_meta["success"] is False
    assert res_meta["error_code"] == "SSRF_SECURITY_BLOCK"

    res_local = await fetch_web_page("http://127.0.0.1:8080/admin")
    assert res_local["success"] is False
    assert res_local["error_code"] == "SSRF_SECURITY_BLOCK"
