"""
Environment and configuration loading with validation and secret masking.
"""
import os
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

def load_config() -> Dict[str, Any]:
    """Load configuration from environment variables"""
    config = {
        # Telegram configuration
        'telegramBotToken': os.getenv('TELEGRAM_BOT_TOKEN'),
        'myTelegramChatId': os.getenv('MY_TELEGRAM_CHAT_ID'),

        # LLM API keys
        'geminiApiKey': os.getenv('GEMINI_API_KEY'),
        'geminiModel': os.getenv('GEMINI_MODEL', 'gemini-2.5-flash'),
        'groqApiKey': os.getenv('GROQ_API_KEY'),
        'inceptionApiKey': os.getenv('INCEPTION_API_KEY'),
        'sarvamApiKey': os.getenv('SARVAM_API_KEY'),
        'arceeApiKey': os.getenv('ARCEE_API_KEY'),
        'longcatApiKey': os.getenv('LONGCAT_API_KEY'),
        'thinkingMachineApiKey': os.getenv('THINKING_MACHINE_API_KEY'),
        'azureOpenAIApiKey': os.getenv('AZURE_OPENAI_API_KEY'),
        'azureOpenAIEndpoint': os.getenv('AZURE_OPENAI_ENDPOINT'),
        'azureOpenAIDeployment': os.getenv('AZURE_OPENAI_DEPLOYMENT', 'gpt-5.5'),
        'azureOpenAIApiVersion': os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview'),

        # Fallback model configurations
        'groq': {
            'apiKey': os.getenv('GROQ_API_KEY'),
            'model': os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile'),
            'baseUrl': os.getenv('GROQ_BASE_URL', 'https://api.groq.com/openai/v1')
        },
        'inception': {
            'apiKey': os.getenv('INCEPTION_API_KEY'),
            'model': os.getenv('INCEPTION_MODEL', 'mercury-2'),
            'baseUrl': os.getenv('INCEPTION_BASE_URL', 'https://api.inceptionlabs.ai/v1')
        },
        'sarvam': {
            'apiKey': os.getenv('SARVAM_API_KEY'),
            'model': os.getenv('SARVAM_MODEL', 'sarvam-105b'),
            'baseUrl': os.getenv('SARVAM_BASE_URL', 'https://api.sarvam.ai/v1')
        },
        'arcee': {
            'apiKey': os.getenv('ARCEE_API_KEY'),
            'model': os.getenv('ARCEE_MODEL', 'zai-org/glm-5.2'),
            'baseUrl': os.getenv('ARCEE_BASE_URL', 'https://api.arcee.ai/v1')
        },
        'longcat': {
            'apiKey': os.getenv('LONGCAT_API_KEY'),
            'model': os.getenv('LONGCAT_MODEL', 'LongCat-2.0'),
            'baseUrl': os.getenv('LONGCAT_BASE_URL', 'https://api.longcat.chat/openai/v1')
        },
        'thinkingMachine': {
            'apiKey': os.getenv('THINKING_MACHINE_API_KEY'),
            'model': os.getenv('THINKING_MACHINE_MODEL', 'inkling'),
            'baseUrl': os.getenv('THINKING_MACHINE_BASE_URL', 'https://api.thinkingmachines.ai/v1')
        },
        'azureOpenAI': {
            'apiKey': os.getenv('AZURE_OPENAI_API_KEY'),
            'endpoint': os.getenv('AZURE_OPENAI_ENDPOINT'),
            'deployment': os.getenv('AZURE_OPENAI_DEPLOYMENT', 'gpt-5.5'),
            'apiVersion': os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview')
        },

        # Security & approval settings
        'saferCommandApprovals': {
            'enabled': os.getenv('SAFER_COMMAND_APPROVALS_ENABLED', 'true').lower() == 'true',
            'timeoutMs': int(os.getenv('APPROVAL_TIMEOUT_MS', '300000')),
            'manyFileWriteApprovalThreshold': int(os.getenv('MANY_FILE_WRITE_APPROVAL_THRESHOLD', '5'))
        },

        # Browser automation settings
        'browser': {
            'headless': os.getenv('BROWSER_HEADLESS', 'true').lower() == 'true',
            'timeoutMs': int(os.getenv('BROWSER_TIMEOUT_MS', '30000')),
            'screenshotDirectory': os.getenv('BROWSER_SCREENSHOT_DIR', '.data/browser-screenshots')
        },

        # Voice note settings
        'voiceNote': {
            'transcriptionModel': os.getenv('VOICE_TRANSCRIPTION_MODEL', 'gemini-2.5-flash'),
            'maxBytes': int(os.getenv('VOICE_NOTE_MAX_BYTES', '18000000'))
        },

        # Web & search settings
        'firecrawlApiKey': os.getenv('FIRECRAWL_API_KEY'),

        # Target project path for relative paths
        'targetProjectPath': os.getenv('TARGET_PROJECT_PATH', ''),

        # Port for HTTP server
        'port': int(os.getenv('PORT', '8080'))
    }

    return config

def validate_config(config: Dict[str, Any], require_telegram: bool = False) -> bool:
    """
    Validate that required configuration is present and logically consistent.

    Args:
        config: Loaded configuration dictionary
        require_telegram: If True, checks for Telegram tokens (defaults to False for headless/CLI usage)

    Returns:
        True if configuration is valid

    Raises:
        ValueError: Detailed message listing all missing or invalid configuration items.
    """
    issues: List[str] = []

    # Check for .env file existence
    env_file = Path(".env")
    if not env_file.exists():
        logger.warning("No .env file found in working directory. Falling back to system environment variables.")

    # 1. LLM Provider verification
    available_providers = []
    if config.get('geminiApiKey'):
        available_providers.append('Gemini')
    if config.get('groqApiKey') or (config.get('groq') and config['groq'].get('apiKey')):
        available_providers.append('Groq')
    if config.get('inceptionApiKey') or (config.get('inception') and config['inception'].get('apiKey')):
        available_providers.append('Inception')
    if config.get('sarvamApiKey') or (config.get('sarvam') and config['sarvam'].get('apiKey')):
        available_providers.append('Sarvam')
    if config.get('arceeApiKey') or (config.get('arcee') and config['arcee'].get('apiKey')):
        available_providers.append('Arcee')
    if config.get('longcatApiKey') or (config.get('longcat') and config['longcat'].get('apiKey')):
        available_providers.append('LongCat')
    if config.get('thinkingMachineApiKey') or (config.get('thinkingMachine') and config['thinkingMachine'].get('apiKey')):
        available_providers.append('Thinking Machine')
    if config.get('azureOpenAIApiKey') or (config.get('azureOpenAI') and config['azureOpenAI'].get('apiKey')):
        available_providers.append('Azure OpenAI')

    if not available_providers:
        issues.append(
            "No LLM provider configured. At least one of GEMINI_API_KEY, GROQ_API_KEY, INCEPTION_API_KEY, "
            "SARVAM_API_KEY, ARCEE_API_KEY, LONGCAT_API_KEY, THINKING_MACHINE_API_KEY, or AZURE_OPENAI_API_KEY must be set."
        )

    # 2. Azure OpenAI consistency check
    azure_key = config.get('azureOpenAIApiKey') or (config.get('azureOpenAI') and config['azureOpenAI'].get('apiKey'))
    azure_endpoint = config.get('azureOpenAIEndpoint') or (config.get('azureOpenAI') and config['azureOpenAI'].get('endpoint'))
    if azure_key and not azure_endpoint:
        issues.append("Azure OpenAI API key is configured, but AZURE_OPENAI_ENDPOINT is missing.")

    # 3. Telegram verification (only when requested)
    if require_telegram:
        if not config.get('telegramBotToken'):
            issues.append("TELEGRAM_BOT_TOKEN is required to run the Telegram bot.")
        if not config.get('myTelegramChatId'):
            issues.append("MY_TELEGRAM_CHAT_ID is required to authorize messages.")

    # 4. Numeric fields validation
    port = config.get('port')
    if port is not None and (not isinstance(port, int) or port < 1 or port > 65535):
        issues.append(f"Invalid PORT: {port}. Must be an integer between 1 and 65535.")

    if issues:
        error_msg = "Configuration validation failed:\n" + "\n".join(f"  - {issue}" for issue in issues)
        logger.error(error_msg)
        raise ValueError(error_msg)

    logger.info(f"Configuration valid. Active LLM provider(s): {', '.join(available_providers)}")
    return True

def mask_secret(secret: Optional[str]) -> str:
    """Mask a secret key showing only prefix and suffix if long enough"""
    if not secret:
        return "<not set>"
    str_val = str(secret).strip()
    if len(str_val) <= 8:
        return "********"
    return f"{str_val[:4]}...{str_val[-4:]}"

def get_masked_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Return a copy of the configuration with all secrets and API keys safely masked.
    Safe for logging or diagnostics.
    """
    masked = {}
    for key, value in config.items():
        if isinstance(value, dict):
            masked[key] = {}
            for sub_k, sub_v in value.items():
                if any(sec in sub_k.lower() for sec in ('key', 'token', 'secret', 'password')):
                    masked[key][sub_k] = mask_secret(sub_v)
                else:
                    masked[key][sub_k] = sub_v
        elif any(sec in key.lower() for sec in ('key', 'token', 'secret', 'password')):
            masked[key] = mask_secret(value)
        else:
            masked[key] = value

    return masked