"""
Operational metrics and telemetry collection for PC Assistant Agent.
Tracks executions, latencies, tool calls, LLM provider statistics, and system resources.
"""
import time
from collections import deque
from typing import Any, Dict, Optional
import psutil

class MetricsCollector:
    """Collects and aggregates runtime metrics and operational telemetry."""

    def __init__(self, max_latency_samples: int = 100):
        self.start_time = time.time()
        self.total_executions = 0
        self.successful_executions = 0
        self.failed_executions = 0

        self.last_latency_ms: float = 0.0
        self.latencies_ms: deque = deque(maxlen=max_latency_samples)

        self.tool_calls: Dict[str, Dict[str, int]] = {}
        self.llm_calls: Dict[str, Dict[str, int]] = {}

    @property
    def uptime_seconds(self) -> float:
        """Calculate elapsed seconds since initialization."""
        return round(time.time() - self.start_time, 2)

    def record_execution(self, success: bool, latency_ms: float) -> None:
        """Record an end-to-end agent execution."""
        self.total_executions += 1
        if success:
            self.successful_executions += 1
        else:
            self.failed_executions += 1

        self.last_latency_ms = round(latency_ms, 2)
        self.latencies_ms.append(self.last_latency_ms)

    def record_tool_call(self, tool_name: str, success: bool) -> None:
        """Record invocation of an individual tool."""
        if tool_name not in self.tool_calls:
            self.tool_calls[tool_name] = {"total": 0, "success": 0, "failed": 0}

        self.tool_calls[tool_name]["total"] += 1
        if success:
            self.tool_calls[tool_name]["success"] += 1
        else:
            self.tool_calls[tool_name]["failed"] += 1

    def record_llm_call(self, provider: str, success: bool, fallback_used: bool = False) -> None:
        """Record an LLM provider invocation."""
        if provider not in self.llm_calls:
            self.llm_calls[provider] = {"total": 0, "success": 0, "failed": 0, "fallback_used": 0}

        self.llm_calls[provider]["total"] += 1
        if success:
            self.llm_calls[provider]["success"] += 1
        else:
            self.llm_calls[provider]["failed"] += 1

        if fallback_used:
            self.llm_calls[provider]["fallback_used"] += 1

    def get_system_telemetry(self) -> Dict[str, Any]:
        """Collect current memory and CPU telemetry of the running process."""
        try:
            process = psutil.Process()
            mem_info = process.memory_info()
            cpu_pct = process.cpu_percent(interval=None)

            return {
                "process_memory_rss_mb": round(mem_info.rss / (1024 * 1024), 2),
                "process_memory_vms_mb": round(mem_info.vms / (1024 * 1024), 2),
                "process_cpu_percent": cpu_pct,
                "process_threads": process.num_threads(),
                "system_memory_percent": psutil.virtual_memory().percent,
                "system_cpu_percent": psutil.cpu_percent(interval=None)
            }
        except Exception as e:
            return {"error": f"Failed to read system metrics: {str(e)}"}

    def get_metrics(self) -> Dict[str, Any]:
        """Return a complete dictionary of all collected metrics."""
        avg_lat = round(sum(self.latencies_ms) / len(self.latencies_ms), 2) if self.latencies_ms else 0.0
        min_lat = min(self.latencies_ms) if self.latencies_ms else 0.0
        max_lat = max(self.latencies_ms) if self.latencies_ms else 0.0

        success_rate = (
            round((self.successful_executions / self.total_executions) * 100, 1)
            if self.total_executions > 0 else 100.0
        )

        return {
            "uptime_seconds": self.uptime_seconds,
            "executions": {
                "total": self.total_executions,
                "successful": self.successful_executions,
                "failed": self.failed_executions,
                "success_rate_percent": success_rate,
                "latency_ms": {
                    "last": self.last_latency_ms,
                    "avg": avg_lat,
                    "min": min_lat,
                    "max": max_lat,
                    "samples": len(self.latencies_ms)
                }
            },
            "tool_calls": self.tool_calls,
            "llm_calls": self.llm_calls,
            "system": self.get_system_telemetry()
        }

    def get_prometheus_metrics(self) -> str:
        """Export metrics formatted for Prometheus scrapers."""
        metrics = self.get_metrics()
        lines = [
            "# HELP pc_assistant_uptime_seconds Process uptime in seconds",
            "# TYPE pc_assistant_uptime_seconds counter",
            f"pc_assistant_uptime_seconds {metrics['uptime_seconds']}",
            "",
            "# HELP pc_assistant_executions_total Total agent message executions",
            "# TYPE pc_assistant_executions_total counter",
            f'pc_assistant_executions_total{{status="success"}} {self.successful_executions}',
            f'pc_assistant_executions_total{{status="failed"}} {self.failed_executions}',
            "",
            "# HELP pc_assistant_latency_ms Average execution latency in milliseconds",
            "# TYPE pc_assistant_latency_ms gauge",
            f"pc_assistant_latency_ms {metrics['executions']['latency_ms']['avg']}",
            ""
        ]

        # Tool calls
        if self.tool_calls:
            lines.append("# HELP pc_assistant_tool_calls_total Tool execution counts")
            lines.append("# TYPE pc_assistant_tool_calls_total counter")
            for tool_name, stats in self.tool_calls.items():
                lines.append(f'pc_assistant_tool_calls_total{{tool="{tool_name}",status="success"}} {stats["success"]}')
                lines.append(f'pc_assistant_tool_calls_total{{tool="{tool_name}",status="failed"}} {stats["failed"]}')
            lines.append("")

        # System resources
        sys_data = metrics.get("system", {})
        if "process_memory_rss_mb" in sys_data:
            lines.append("# HELP pc_assistant_memory_rss_bytes Process RSS memory in bytes")
            lines.append("# TYPE pc_assistant_memory_rss_bytes gauge")
            lines.append(f"pc_assistant_memory_rss_bytes {int(sys_data['process_memory_rss_mb'] * 1024 * 1024)}")
            lines.append("")

        return "\n".join(lines)

# Global singleton
metrics_collector = MetricsCollector()
