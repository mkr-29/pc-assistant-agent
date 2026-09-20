# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

# Install runtime system dependencies for psutil, system monitoring, and health probes
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    procps \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create a non-root application user
RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g appuser -m -s /bin/bash appuser

# Copy dependency specifications first to leverage Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy source code and configuration files
COPY src_py/ ./src_py/
COPY pytest.ini .

# Create directories for persistent memory stores and log files, set ownership
RUN mkdir -p /app/.data /app/logs && \
    chown -R appuser:appuser /app

# Declare volumes for persistent state and log files
VOLUME ["/app/.data", "/app/logs"]

# Expose HTTP health and metrics port
EXPOSE 8080

# Health check probe against the built-in HTTP health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Switch to non-root user
USER appuser

# Start the PC Assistant Agent
CMD ["python", "src_py/main.py"]
