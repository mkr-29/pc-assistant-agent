"""
Centralized logging utility for PC Assistant Agent.
"""
import logging
import os
import sys

LOG_FORMAT = '%(asctime)s - %(name)s - [%(levelname)s] - %(message)s'
DEFAULT_LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()

def setup_logging(level: str = DEFAULT_LOG_LEVEL) -> None:
    """Configure root logger with consistent formatting and stream handler"""
    numeric_level = getattr(logging, level, logging.INFO)
    logging.basicConfig(
        level=numeric_level,
        format=LOG_FORMAT,
        handlers=[logging.StreamHandler(sys.stdout)]
    )

def get_logger(name: str) -> logging.Logger:
    """Retrieve a configured logger for a module"""
    return logging.getLogger(name)
