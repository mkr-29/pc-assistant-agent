"""
Tests for MetricsCollector, HealthChecker, and HealthServer HTTP endpoints.
"""
import pytest
import time
from aiohttp import web
from monitoring.metrics import MetricsCollector
from monitoring.health import HealthChecker, HealthServer

@pytest.fixture
def clean_metrics():
    return MetricsCollector()

def test_metrics_collector_execution_tracking(clean_metrics):
    collector = clean_metrics

    collector.record_execution(success=True, latency_ms=120.5)
    collector.record_execution(success=True, latency_ms=80.0)
    collector.record_execution(success=False, latency_ms=200.0)

    m = collector.get_metrics()
    assert m["executions"]["total"] == 3
    assert m["executions"]["successful"] == 2
    assert m["executions"]["failed"] == 1
    assert m["executions"]["success_rate_percent"] == 66.7
    assert m["executions"]["latency_ms"]["last"] == 200.0
    assert m["executions"]["latency_ms"]["min"] == 80.0
    assert m["executions"]["latency_ms"]["max"] == 200.0
    assert m["executions"]["latency_ms"]["avg"] == round((120.5 + 80.0 + 200.0) / 3, 2)

def test_metrics_collector_tool_and_llm_calls(clean_metrics):
    collector = clean_metrics

    collector.record_tool_call("read_file", success=True)
    collector.record_tool_call("read_file", success=True)
    collector.record_tool_call("read_file", success=False)
    collector.record_tool_call("run_command", success=True)

    collector.record_llm_call("Groq", success=True)
    collector.record_llm_call("Gemini", success=False, fallback_used=True)

    m = collector.get_metrics()
    assert m["tool_calls"]["read_file"]["total"] == 3
    assert m["tool_calls"]["read_file"]["success"] == 2
    assert m["tool_calls"]["read_file"]["failed"] == 1
    assert m["tool_calls"]["run_command"]["total"] == 1

    assert m["llm_calls"]["Groq"]["success"] == 1
    assert m["llm_calls"]["Gemini"]["fallback_used"] == 1

    # Check prometheus export
    prom = collector.get_prometheus_metrics()
    assert "pc_assistant_uptime_seconds" in prom
    assert 'pc_assistant_tool_calls_total{tool="read_file",status="success"} 2' in prom
    assert 'pc_assistant_tool_calls_total{tool="read_file",status="failed"} 1' in prom

def test_health_checker_probes():
    checker = HealthChecker(data_dir=".data")
    status = checker.get_health_status()

    assert "status" in status
    assert status["status"] in ("HEALTHY", "DEGRADED", "UNHEALTHY")
    assert "uptime_seconds" in status

    checks = status["checks"]
    assert "storage_capacity" in checks
    assert checks["storage_capacity"]["status"] in ("HEALTHY", "WARNING")
    assert "data_directory" in checks
    assert checks["data_directory"]["writable"] is True
    assert "llm_providers" in checks

from aiohttp.test_utils import TestServer, TestClient

@pytest.mark.asyncio
async def test_health_server_endpoints():
    server = HealthServer(host="127.0.0.1", port=0)
    test_server = TestServer(server.app)
    client = TestClient(test_server)
    await client.start_server()
    try:
        # 1. Test /health endpoint
        resp_health = await client.get("/health")
        assert resp_health.status in (200, 503)
        data_health = await resp_health.json()
        assert "status" in data_health
        assert "checks" in data_health

        # 2. Test /metrics JSON endpoint
        resp_metrics = await client.get("/metrics")
        assert resp_metrics.status == 200
        data_metrics = await resp_metrics.json()
        assert "executions" in data_metrics
        assert "uptime_seconds" in data_metrics

        # 3. Test /metrics Prometheus format
        resp_prom = await client.get("/metrics?format=prometheus")
        assert resp_prom.status == 200
        prom_text = await resp_prom.text()
        assert "pc_assistant_uptime_seconds" in prom_text

        # 4. Test /status plain text endpoint
        resp_status = await client.get("/status")
        assert resp_status.status == 200
        status_text = await resp_status.text()
        assert "PC Assistant Agent Status" in status_text
    finally:
        await client.close()
