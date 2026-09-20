"""
Health checks and lightweight HTTP monitoring server for PC Assistant Agent.
Serves /health, /metrics, and /status endpoints.
"""
import asyncio
import os
import shutil
import time
from pathlib import Path
from typing import Any, Dict, Optional

from aiohttp import web
from config.env import load_config
from monitoring.metrics import metrics_collector
from utils.logger import get_logger

logger = get_logger("monitoring.health")

class HealthChecker:
    """Performs deep health and operational diagnostic checks across system components."""

    def __init__(self, data_dir: str = ".data"):
        self.data_dir = Path(data_dir)

    def check_disk(self) -> Dict[str, Any]:
        """Check filesystem storage capacity for the data directory."""
        try:
            total, used, free = shutil.disk_usage(self.data_dir if self.data_dir.exists() else Path("."))
            free_mb = round(free / (1024 * 1024), 2)
            total_mb = round(total / (1024 * 1024), 2)
            percent_free = round((free / total) * 100, 1)

            is_healthy = free_mb > 100  # At least 100MB free
            return {
                "status": "HEALTHY" if is_healthy else "WARNING",
                "free_mb": free_mb,
                "total_mb": total_mb,
                "percent_free": percent_free,
                "detail": "Sufficient disk space" if is_healthy else "Low disk space (<100MB)"
            }
        except Exception as e:
            return {"status": "ERROR", "detail": f"Failed to check disk: {str(e)}"}

    def check_data_directory(self) -> Dict[str, Any]:
        """Verify that the persistent storage directory is writeable."""
        try:
            self.data_dir.mkdir(parents=True, exist_ok=True)
            test_file = self.data_dir / ".health_probe"
            test_file.write_text("ok", encoding="utf-8")
            test_file.unlink(missing_ok=True)
            return {
                "status": "HEALTHY",
                "path": str(self.data_dir.resolve()),
                "writable": True
            }
        except Exception as e:
            return {
                "status": "UNHEALTHY",
                "path": str(self.data_dir),
                "writable": False,
                "error": str(e)
            }

    def check_llm_providers(self) -> Dict[str, Any]:
        """Verify active and configured LLM providers."""
        try:
            config = load_config()
            configured = []
            for key, name in [
                ('geminiApiKey', 'Gemini'),
                ('groqApiKey', 'Groq'),
                ('inceptionApiKey', 'Inception'),
                ('sarvamApiKey', 'Sarvam'),
                ('arceeApiKey', 'Arcee'),
                ('longcatApiKey', 'LongCat'),
                ('thinkingMachineApiKey', 'Thinking Machine'),
                ('azureOpenAIApiKey', 'Azure OpenAI')
            ]:
                if config.get(key):
                    configured.append(name)

            return {
                "status": "HEALTHY" if configured else "UNHEALTHY",
                "configured_providers": configured,
                "count": len(configured),
                "detail": f"{len(configured)} provider(s) active" if configured else "No LLM provider configured"
            }
        except Exception as e:
            return {"status": "ERROR", "detail": f"Failed to inspect providers: {str(e)}"}

    def check_telegram(self, bot: Optional[Any] = None) -> Dict[str, Any]:
        """Inspect Telegram bot connectivity and readiness."""
        if not bot:
            return {"status": "DISABLED", "detail": "Telegram bot not configured"}

        is_running = getattr(bot, "is_running", False)
        return {
            "status": "HEALTHY" if is_running else "DEGRADED",
            "running": is_running,
            "detail": "Telegram bot active" if is_running else "Telegram bot initialized but not running"
        }

    def get_health_status(self, bot: Optional[Any] = None) -> Dict[str, Any]:
        """Aggregate all component checks into an overall system health assessment."""
        disk_check = self.check_disk()
        data_check = self.check_data_directory()
        llm_check = self.check_llm_providers()
        tg_check = self.check_telegram(bot)

        checks = {
            "storage_capacity": disk_check,
            "data_directory": data_check,
            "llm_providers": llm_check,
            "telegram_bot": tg_check
        }

        # Calculate overall status
        if data_check.get("status") == "UNHEALTHY" or llm_check.get("status") == "UNHEALTHY":
            overall_status = "UNHEALTHY"
        elif (disk_check.get("status") in ("WARNING", "ERROR") or
              tg_check.get("status") in ("DEGRADED", "ERROR")):
            overall_status = "DEGRADED"
        else:
            overall_status = "HEALTHY"

        return {
            "status": overall_status,
            "timestamp": time.time(),
            "uptime_seconds": metrics_collector.uptime_seconds,
            "checks": checks
        }

class HealthServer:
    """Asynchronous HTTP monitoring server for probes and metrics scrapers."""

    def __init__(self, host: str = "0.0.0.0", port: int = 8080, bot_instance: Optional[Any] = None):
        self.host = host
        self.port = port
        self.bot_instance = bot_instance
        self.health_checker = HealthChecker()
        self.app = web.Application()
        self.runner: Optional[web.AppRunner] = None
        self.site: Optional[web.TCPSite] = None

        self._setup_routes()

    def _setup_routes(self) -> None:
        """Register monitoring endpoints."""
        self.app.router.add_get('/health', self._handle_health)
        self.app.router.add_get('/healthz', self._handle_health)
        self.app.router.add_get('/metrics', self._handle_metrics)
        self.app.router.add_get('/status', self._handle_status)

    async def _handle_health(self, request: web.Request) -> web.Response:
        """Return JSON health report."""
        report = self.health_checker.get_health_status(self.bot_instance)
        status_code = 200 if report["status"] in ("HEALTHY", "DEGRADED") else 503
        return web.json_response(report, status=status_code)

    async def _handle_metrics(self, request: web.Request) -> web.Response:
        """Return metrics in JSON or Prometheus format."""
        format_param = request.query.get('format', '').lower()
        accept_header = request.headers.get('Accept', '').lower()

        if format_param == 'prometheus' or 'text/plain' in accept_header:
            return web.Response(
                text=metrics_collector.get_prometheus_metrics(),
                content_type="text/plain",
                charset="utf-8"
            )

        return web.json_response(metrics_collector.get_metrics())

    async def _handle_status(self, request: web.Request) -> web.Response:
        """Return human-readable diagnostic status."""
        health = self.health_checker.get_health_status(self.bot_instance)
        metrics = metrics_collector.get_metrics()

        lines = [
            f"=== PC Assistant Agent Status: {health['status']} ===",
            f"Uptime: {metrics['uptime_seconds']}s",
            f"Executions Total: {metrics['executions']['total']} (Success: {metrics['executions']['successful']}, Failed: {metrics['executions']['failed']})",
            f"Average Latency: {metrics['executions']['latency_ms']['avg']}ms",
            f"Process Memory RSS: {metrics['system'].get('process_memory_rss_mb', 'N/A')} MB",
            f"Process CPU: {metrics['system'].get('process_cpu_percent', 'N/A')}%",
            f"Configured LLMs: {', '.join(health['checks']['llm_providers'].get('configured_providers', []))}",
            f"Data Directory: {health['checks']['data_directory']['status']}"
        ]
        return web.Response(text="\n".join(lines) + "\n", content_type="text/plain")

    async def start(self) -> bool:
        """Start the HTTP monitoring server."""
        try:
            self.runner = web.AppRunner(self.app)
            await self.runner.setup()
            self.site = web.TCPSite(self.runner, self.host, self.port)
            await self.site.start()
            logger.info(f"Health and metrics HTTP server listening on http://{self.host}:{self.port}")
            return True
        except Exception as e:
            logger.warning(f"Could not start health HTTP server on port {self.port}: {e}")
            return False

    async def stop(self) -> None:
        """Gracefully stop the HTTP monitoring server."""
        if self.runner:
            await self.runner.cleanup()
            logger.info("Health and metrics HTTP server stopped")
