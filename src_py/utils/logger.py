"""
Centralized structured logging utility for PC Assistant Agent.
Supports console output, rotating file logs, and JSON/text formats.
"""
import json
import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Dict, Optional

DEFAULT_LOG_FORMAT = '%(asctime)s - %(name)s - [%(levelname)s] - %(message)s'
DEFAULT_LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()
DEFAULT_LOG_DIR = os.getenv('LOG_DIR', 'logs')
DEFAULT_LOG_FILE = os.getenv('LOG_FILE', 'agent.log')
MAX_LOG_BYTES = int(os.getenv('LOG_MAX_BYTES', str(10 * 1024 * 1024)))  # 10 MB
LOG_BACKUP_COUNT = int(os.getenv('LOG_BACKUP_COUNT', '5'))

class JsonFormatter(logging.Formatter):
    """Formats log records as structured single-line JSON objects"""
    def format(self, record: logging.LogRecord) -> str:
        log_obj: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage()
        }
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        if hasattr(record, "extra_data") and isinstance(record.extra_data, dict):
            log_obj.update(record.extra_data)
        return json.dumps(log_obj)

def setup_logging(
    level: str = DEFAULT_LOG_LEVEL,
    log_dir: str = DEFAULT_LOG_DIR,
    log_file: str = DEFAULT_LOG_FILE,
    enable_file_logging: bool = True,
    format_type: Optional[str] = None
) -> None:
    """
    Configure root and module logging with consistent formatting and rotating file handler.
    """
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # Determine format style
    selected_format = (format_type or os.getenv('LOG_FORMAT', 'text')).lower()
    if selected_format == 'json':
        formatter: logging.Formatter = JsonFormatter()
    else:
        formatter = logging.Formatter(DEFAULT_LOG_FORMAT)

    # Remove existing handlers to prevent duplicate lines
    root_logger.handlers = []

    # 1. Console Stream Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # 2. Rotating File Handler
    if enable_file_logging:
        try:
            log_path = Path(log_dir)
            log_path.mkdir(parents=True, exist_ok=True)
            full_file_path = log_path / log_file

            file_handler = RotatingFileHandler(
                filename=str(full_file_path),
                maxBytes=MAX_LOG_BYTES,
                backupCount=LOG_BACKUP_COUNT,
                encoding='utf-8'
            )
            file_handler.setLevel(numeric_level)
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
        except Exception as e:
            # Fallback to console only if file creation fails (e.g. read-only filesystem)
            root_logger.warning(f"Failed to initialize rotating file logger at {log_dir}/{log_file}: {e}")

def get_logger(name: str) -> logging.Logger:
    """Retrieve a configured logger for a module"""
    return logging.getLogger(name)

def log_event(logger: logging.Logger, level: int, event_name: str, **kwargs: Any) -> None:
    """Log a structured event with key-value metadata"""
    msg = f"EVENT:{event_name} - " + " ".join(f"{k}={v}" for k, v in kwargs.items())
    logger.log(level, msg, extra={"extra_data": {"event": event_name, **kwargs}})
