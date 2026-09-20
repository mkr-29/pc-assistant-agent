# PC Assistant Agent - Deployment Guide

This guide covers production deployment strategies, configuration practices, service management, and operational maintenance for the PC Assistant Agent.

---

## Table of Contents
1. [Overview & Architecture](#overview--architecture)
2. [Prerequisites](#prerequisites)
3. [Configuration & Environment Setup](#configuration--environment-setup)
4. [Deployment Option A: Docker & Docker Compose (Recommended for Servers)](#deployment-option-a-docker--docker-compose-recommended-for-servers)
5. [Deployment Option B: Bare-Metal / Local Virtualenv (macOS / Desktop)](#deployment-option-b-bare-metal--local-virtualenv-macos--desktop)
6. [Service Automation & Auto-Start](#service-automation--auto-start)
   - [Linux: Systemd Service](#linux-systemd-service)
   - [macOS: Launchd Agent (For AppleScript / UI Access)](#macos-launchd-agent-for-applescript--ui-access)
7. [Health Checks & Observability](#health-checks--observability)
8. [Data Backup & Maintenance](#data-backup--maintenance)
9. [Security Best Practices](#security-best-practices)

---

## Overview & Architecture

The PC Assistant Agent operates as an autonomous agent runtime built on Python and LangGraph. It runs concurrently with:
- A **Telegram Bot Long-Polling Loop** that receives user commands and sends agent responses.
- A **LangGraph Execution Engine** that breaks down tasks, executes filesystem/terminal/web/system tools, and synthesizes answers.
- A **Memory Store** maintaining conversation turns, user profile attributes, and indexed knowledge memories under `./.data/`.
- A **Monitoring & Health HTTP Server** serving live health status (`/health`), system telemetry (`/metrics`), and status summaries (`/status`) on the configured port (default: `8080`).

---

## Prerequisites

- **Python**: Version 3.10+ (tested through Python 3.14).
- **Docker**: Version 20.10+ (if deploying via container).
- **Telegram Bot Token**: Created via [@BotFather](https://t.me/botfather).
- **Telegram Chat ID**: Your personal Telegram ID obtained via [@userinfobot](https://t.me/userinfobot) or similar.
- **LLM API Key**: At least one valid API key for an LLM provider:
  - Google Gemini ([Google AI Studio](https://aistudio.google.com/app/apikey))
  - Groq ([Groq Cloud Console](https://console.groq.com/keys))
  - Inception Labs, Sarvam, Arcee, LongCat, Thinking Machine, or Azure OpenAI

---

## Configuration & Environment Setup

1. Copy the example configuration template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your preferred credentials:
   ```bash
   # Telegram credentials
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
   MY_TELEGRAM_CHAT_ID=987654321

   # Active LLM Provider (example: Gemini and Groq fallback)
   GEMINI_API_KEY=AIzaSyD-YourGeminiKeyHere
   GROQ_API_KEY=gsk_YourGroqKeyHere

   # Server and Security settings
   PORT=8080
   SAFER_COMMAND_APPROVALS_ENABLED=true
   LOG_LEVEL=INFO
   ```

3. Validate your configuration before starting:
   ```bash
   python src_py/main.py --check-config
   ```

---

## Deployment Option A: Docker & Docker Compose (Recommended for Servers)

Docker deployment is ideal for server hosting, VPS instances (AWS, GCP, DigitalOcean, Hetzner), or headless Linux environments.

### 1. Build and Start using Docker Compose
```bash
# Build the container image and launch in the background
docker compose up -d --build
```

### 2. Verify Container Status
```bash
docker compose ps
docker compose logs -f pc-assistant
```

### 3. Check Health Probe
```bash
curl http://localhost:8080/health
```

### 4. Stopping or Restarting
```bash
# Graceful stop
docker compose down

# Restart
docker compose restart
```

### Persistent Data Volumes
The compose setup maps two host directories into the container:
- `./.data:/app/.data`: Retains user conversation history and knowledge memories across container updates.
- `./logs:/app/logs`: Stores rotating application log files (`agent.log`).

---

## Deployment Option B: Bare-Metal / Local Virtualenv (macOS / Desktop)

If you plan to use macOS system tools (AppleScript automation, application launching, media controls, notification center), run the agent locally on the host machine where accessibility permissions can be granted.

### 1. Setup Virtual Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Convenience Script
Alternatively, launch using the automated startup script:
```bash
chmod +x run.sh
./run.sh
```

---

## Service Automation & Auto-Start

### Linux: Systemd Service
Create a persistent daemon that boots on system startup and restarts on unexpected crashes.

1. Create a service file `/etc/systemd/system/pc-assistant.service`:
   ```ini
   [Unit]
   Description=PC Assistant Agent
   After=network.target

   [Service]
   Type=simple
   User=your_linux_user
   WorkingDirectory=/opt/pc-assistant-agent
   EnvironmentFile=/opt/pc-assistant-agent/.env
   ExecStart=/opt/pc-assistant-agent/.venv/bin/python src_py/main.py
   Restart=always
   RestartSec=10
   StandardOutput=journal
   StandardError=journal

   # Sandboxing & security
   NoNewPrivileges=true
   PrivateTmp=true

   [Install]
   WantedBy=multi-user.target
   ```

2. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable pc-assistant
   sudo systemctl start pc-assistant
   sudo systemctl status pc-assistant
   ```

3. View live logs:
   ```bash
   journalctl -u pc-assistant -f
   ```

---

### macOS: Launchd Agent (For AppleScript / UI Access)

On macOS, system-level system daemons cannot interact with the desktop or run GUI AppleScripts. Use a **User LaunchAgent** instead.

1. Create `~/Library/LaunchAgents/com.pcassistant.agent.plist`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>Label</key>
       <string>com.pcassistant.agent</string>
       <key>ProgramArguments</key>
       <array>
           <string>/Users/YOUR_USERNAME/pc-assistant-agent/.venv/bin/python</string>
           <string>/Users/YOUR_USERNAME/pc-assistant-agent/src_py/main.py</string>
       </array>
       <key>WorkingDirectory</key>
       <string>/Users/YOUR_USERNAME/pc-assistant-agent</string>
       <key>RunAtLoad</key>
       <true/>
       <key>KeepAlive</key>
       <true/>
       <key>StandardOutPath</key>
       <string>/Users/YOUR_USERNAME/pc-assistant-agent/logs/launchd.stdout.log</string>
       <key>StandardErrorPath</key>
       <string>/Users/YOUR_USERNAME/pc-assistant-agent/logs/launchd.stderr.log</string>
   </dict>
   </plist>
   ```

2. Load and start the LaunchAgent:
   ```bash
   launchctl load ~/Library/LaunchAgents/com.pcassistant.agent.plist
   launchctl start com.pcassistant.agent
   ```

3. Grant Accessibility Permissions:
   - Open **System Settings > Privacy & Security > Accessibility**.
   - Ensure Terminal, Python, or the IDE running the agent is granted permission to control the computer.

---

## Health Checks & Observability

The agent includes a built-in HTTP server listening on the configured `PORT` (default `8080`).

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/health` | `GET` | JSON status (`HEALTHY`, `DEGRADED`, `UNHEALTHY`), uptime, component checks. |
| `/metrics` | `GET` | Performance counters: total agent executions, latency stats, tool call counts, memory/CPU usage. |
| `/status` | `GET` | Formatted human-readable status overview. |

### Telegram In-Chat Diagnostics
You can query the agent's health and metrics directly through Telegram:
- `/health` - Displays live status, uptime, disk availability, and memory stats.
- `/status` - Displays execution counts, tool usages, and LLM fallback state.

---

## Data Backup & Maintenance

All persistent memory and configuration state is isolated within the `.data/` directory:
- `conversation_history.json`: Recorded conversation context per chat.
- `knowledge_memory.json`: Indexed knowledge memories with UUIDs, metadata, and tags.
- `user_profile.json`: Structured user preferences and identity data.

### Automated Backup Script
```bash
#!/bin/bash
BACKUP_DIR="/backups/pc-assistant/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r .data "$BACKUP_DIR/"
echo "Backup created at $BACKUP_DIR"
```

To schedule daily backups at 02:00 via cron:
```bash
0 2 * * * /opt/pc-assistant-agent/scripts/backup.sh
```

---

## Security Best Practices

1. **Keep Secrets Out of Version Control**:
   - Never commit `.env` or files under `.data/`.
   - The `.gitignore` and `.dockerignore` files are pre-configured to exclude sensitive paths.
2. **Restrict Telegram Access**:
   - Always ensure `MY_TELEGRAM_CHAT_ID` is set to your personal ID.
   - The bot will strictly reject any messages or commands originating from any other user or chat.
3. **Execution Sandboxing**:
   - All filesystem operations are filtered by the built-in security validator to prevent path traversal and sensitive credential file leakage.
   - Destructive terminal commands (`rm -rf /`, `mkfs`, fork bombs) are intercepted and prevented.
4. **Network Exposure**:
   - Only expose the monitoring port (`8080`) to trusted networks or bind to `127.0.0.1` if you use an NGINX reverse proxy with basic authentication.
