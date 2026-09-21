"""
macOS System Integration and Hardware Management tools.
"""
import asyncio
import os
import platform
import subprocess
from typing import Dict, Any, List, Optional
import psutil

try:
    from utils.paths import resolve_path
except ImportError:
    try:
        from src_py.utils.paths import resolve_path
    except ImportError:
        def resolve_path(p: str, b: Optional[str] = None) -> str:
            return os.path.abspath(os.path.expanduser(p)) if p else os.getcwd()

try:
    from tools.registry import register_tool
except ImportError:
    from src_py.tools.registry import register_tool

IS_MACOS = platform.system().lower() == "darwin"

def _unsupported_platform() -> Dict[str, Any]:
    return {
        "success": False,
        "error": f"This tool requires macOS (darwin). Current system: {platform.system()}",
        "platform": platform.system()
    }

@register_tool("run_applescript", "system")
async def run_applescript(script: str) -> Dict[str, Any]:
    """
    Execute an AppleScript snippet on macOS.

    Args:
        script: AppleScript code to execute

    Returns:
        Dictionary with execution output or error message
    """
    if not IS_MACOS:
        return _unsupported_platform()

    clean_script = script.strip()
    if not clean_script:
        return {"success": False, "error": "AppleScript cannot be empty"}

    try:
        proc = await asyncio.create_subprocess_exec(
            "osascript", "-e", clean_script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)

        out_text = stdout.decode("utf-8", errors="replace").strip()
        err_text = stderr.decode("utf-8", errors="replace").strip()

        if proc.returncode != 0:
            return {
                "success": False,
                "error": err_text or f"Process exited with code {proc.returncode}",
                "output": out_text
            }

        return {
            "success": True,
            "output": out_text
        }

    except asyncio.TimeoutError:
        return {"success": False, "error": "AppleScript execution timed out after 30 seconds."}
    except Exception as e:
        return {"success": False, "error": f"Failed to execute AppleScript: {str(e)}"}

@register_tool("open_target", "system")
async def open_target(target: str = "", app_name: str = "", reveal_in_finder: bool = False) -> Dict[str, Any]:
    """
    Open a file, URL, or application using the macOS 'open' command.

    Args:
        target: File path or URL to open
        app_name: Name of the application to open with or launch (e.g. 'Finder', 'Google Chrome')
        reveal_in_finder: If True, reveals the target file in Finder instead of opening it

    Returns:
        Dictionary with status of the open operation
    """
    if not IS_MACOS:
        return _unsupported_platform()

    args = ["open"]

    if reveal_in_finder and target:
        resolved = resolve_path(target)
        args.extend(["-R", resolved])
    else:
        if app_name:
            args.extend(["-a", app_name.strip()])
        if target:
            if target.startswith(("http://", "https://")):
                args.append(target)
            else:
                args.append(resolve_path(target))

    if len(args) == 1:
        return {"success": False, "error": "Provide either target or app_name."}

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15.0)

        if proc.returncode != 0:
            err_text = stderr.decode("utf-8", errors="replace").strip()
            return {"success": False, "error": err_text, "command": " ".join(args)}

        return {
            "success": True,
            "message": f"Successfully opened {' '.join(args[1:])}",
            "command": " ".join(args)
        }

    except Exception as e:
        return {"success": False, "error": str(e)}

@register_tool("quit_application", "system")
async def quit_application(app_name: str) -> Dict[str, Any]:
    """
    Quit a running macOS application cleanly.

    Args:
        app_name: Name of the application to quit (e.g. 'Calculator')

    Returns:
        Dictionary with status of quit operation
    """
    if not IS_MACOS:
        return _unsupported_platform()

    safe_name = app_name.replace('"', '\\"')
    script = f'tell application "{safe_name}" to quit'
    return await run_applescript(script)

@register_tool("list_running_applications", "system")
def list_running_applications() -> Dict[str, Any]:
    """
    List currently running desktop applications and system processes.

    Returns:
        Dictionary with count and list of application names
    """
    apps = set()
    for proc in psutil.process_iter(['name']):
        try:
            name = proc.info.get('name')
            if name and not name.startswith(("[", "systemd", "kworker")):
                apps.add(name)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    sorted_apps = sorted(list(apps))
    return {
        "success": True,
        "total_running": len(sorted_apps),
        "applications": sorted_apps[:60]
    }

@register_tool("get_system_info", "system")
def get_system_info() -> Dict[str, Any]:
    """
    Retrieve hardware performance metrics (CPU, RAM, disk, battery).

    Returns:
        Dictionary with system health and resource consumption
    """
    try:
        # CPU
        cpu_percent = psutil.cpu_percent(interval=0.1)
        cpu_count = psutil.cpu_count(logical=True)

        # Memory
        mem = psutil.virtual_memory()
        mem_info = {
            "total_gb": round(mem.total / (1024 ** 3), 2),
            "used_gb": round(mem.used / (1024 ** 3), 2),
            "available_gb": round(mem.available / (1024 ** 3), 2),
            "percent": mem.percent
        }

        # Disk
        disk = psutil.disk_usage('/')
        disk_info = {
            "total_gb": round(disk.total / (1024 ** 3), 2),
            "free_gb": round(disk.free / (1024 ** 3), 2),
            "used_gb": round(disk.used / (1024 ** 3), 2),
            "percent": disk.percent
        }

        # Battery
        battery = psutil.sensors_battery()
        battery_info = None
        if battery:
            battery_info = {
                "percent": battery.percent,
                "power_plugged": battery.power_plugged
            }

        return {
            "success": True,
            "platform": platform.platform(),
            "cpu": {
                "usage_percent": cpu_percent,
                "cores": cpu_count
            },
            "memory": mem_info,
            "disk": disk_info,
            "battery": battery_info
        }

    except Exception as e:
        return {"success": False, "error": f"Failed to retrieve system info: {str(e)}"}

@register_tool("control_media", "system")
async def control_media(
    action: str = "playpause",
    volume: Optional[int] = None,
    app_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Control macOS media playback or system audio volume.

    Args:
        action: 'playpause', 'next', 'previous', 'mute', 'unmute', 'setvolume'
        volume: Volume percentage (0-100) if setting volume
        app_name: Optional target application (e.g. 'Spotify', 'Music')

    Returns:
        Dictionary with status of the media action
    """
    if not IS_MACOS:
        return _unsupported_platform()

    clean_action = action.lower().strip()

    if volume is not None or clean_action in ("volume", "setvolume"):
        vol = max(0, min(100, int(volume if volume is not None else 50)))
        script = f"set volume output volume {vol}"
        res = await run_applescript(script)
        res["volume"] = vol
        return res

    if clean_action == "mute":
        return await run_applescript("set volume output muted true")

    if clean_action == "unmute":
        return await run_applescript("set volume output muted false")

    key_codes = {
        "playpause": 16,
        "play": 16,
        "pause": 16,
        "next": 20,
        "previous": 18
    }

    code = key_codes.get(clean_action, 16)
    if app_name:
        safe_app = app_name.replace('"', '\\"')
        script = f'tell application "{safe_app}" to activate\ntell application "System Events" to key code {code}'
    else:
        script = f'tell application "System Events" to key code {code}'

    return await run_applescript(script)

@register_tool("get_clipboard", "system")
def get_clipboard() -> Dict[str, Any]:
    """
    Read text from the macOS system clipboard using pbpaste.

    Returns:
        Dictionary with clipboard text content
    """
    if not IS_MACOS:
        return _unsupported_platform()

    try:
        res = subprocess.run(["pbpaste"], capture_output=True, text=True, timeout=5)
        return {
            "success": True,
            "content": res.stdout,
            "length": len(res.stdout)
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to read clipboard: {str(e)}"}

@register_tool("set_clipboard", "system")
def set_clipboard(text: str) -> Dict[str, Any]:
    """
    Copy text to the macOS system clipboard using pbcopy.

    Args:
        text: Text to place on clipboard

    Returns:
        Dictionary with success status
    """
    if not IS_MACOS:
        return _unsupported_platform()

    try:
        proc = subprocess.Popen(["pbcopy"], stdin=subprocess.PIPE, text=True)
        proc.communicate(input=text, timeout=5)
        return {
            "success": True,
            "message": "Text copied to clipboard",
            "length": len(text)
        }
    except Exception as e:
        return {"success": False, "error": f"Failed to set clipboard: {str(e)}"}

@register_tool("send_notification", "system")
async def send_notification(title: str, message: str) -> Dict[str, Any]:
    """
    Post a desktop alert notification in macOS Notification Center.

    Args:
        title: Notification title
        message: Notification message body

    Returns:
        Dictionary with status of notification
    """
    if not IS_MACOS:
        return _unsupported_platform()

    safe_title = title.replace('"', '\\"')
    safe_msg = message.replace('"', '\\"')
    script = f'display notification "{safe_msg}" with title "{safe_title}"'
    return await run_applescript(script)

@register_tool("take_screenshot", "system")
async def take_screenshot(file_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Capture a screenshot of the current computer screen and save it to disk.

    Args:
        file_path: Optional target file path to save the screenshot (.png). If omitted, a timestamped file in .data/media/screenshots/ is generated.

    Returns:
        Dictionary with success status, file_path, photo_path, dimensions, and file size
    """
    try:
        from datetime import datetime
        from pathlib import Path

        if not file_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            dest_dir = Path(".data/media/screenshots")
            dest_dir.mkdir(parents=True, exist_ok=True)
            target_path = str((dest_dir / f"screenshot_{timestamp}.png").resolve())
        else:
            target_path = resolve_path(file_path)
            Path(target_path).parent.mkdir(parents=True, exist_ok=True)

        captured = False
        width, height = 0, 0

        # Method 1: On macOS, use native silent screencapture
        if IS_MACOS:
            try:
                proc = await asyncio.create_subprocess_exec(
                    "screencapture", "-x", target_path,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await asyncio.wait_for(proc.communicate(), timeout=15.0)
                if proc.returncode == 0 and os.path.exists(target_path) and os.path.getsize(target_path) > 0:
                    captured = True
            except Exception:
                captured = False

        # Method 2: Cross-platform PIL ImageGrab fallback
        if not captured:
            try:
                from PIL import ImageGrab
                img = ImageGrab.grab()
                img.save(target_path, format="PNG")
                width, height = img.size
                captured = True
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Failed to capture screen: {str(e)}",
                    "file_path": target_path
                }

        if captured and (width == 0 or height == 0):
            try:
                from PIL import Image
                with Image.open(target_path) as im:
                    width, height = im.size
            except Exception:
                pass

        file_size_kb = round(os.path.getsize(target_path) / 1024, 2) if os.path.exists(target_path) else 0

        return {
            "success": True,
            "message": f"Screenshot captured successfully ({width}x{height}, {file_size_kb} KB)",
            "file_path": target_path,
            "photo_path": target_path,
            "width": width,
            "height": height,
            "file_size_kb": file_size_kb
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Error taking screenshot: {str(e)}"
        }
