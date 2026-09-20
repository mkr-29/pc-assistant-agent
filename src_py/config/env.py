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

def validate_config_detailed(
    config: Optional[Dict[str, Any]] = None,
    env_path: str = ".env",
    example_path: str = ".env.example",
    require_telegram: bool = False
) -> Dict[str, Any]:
    """
    Perform a comprehensive validation of configuration and environment variables.
    Identifies missing variables, placeholders, typos, and format errors with actionable fixes.

    Returns:
        Dictionary containing:
          - is_valid: bool
          - errors: List[str]
          - warnings: List[str]
          - remediations: List[str]
          - active_providers: List[str]
    """
    if config is None:
        config = load_config()

    errors: List[str] = []
    warnings: List[str] = []
    remediations: List[str] = []
    active_providers: List[str] = []

    # 1. Inspect .env file vs .env.example
    env_file = Path(env_path)
    example_file = Path(example_path)

    raw_env_vars: Dict[str, str] = {}
    if env_file.exists():
        try:
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        raw_env_vars[k.strip()] = v.strip()
        except Exception as e:
            warnings.append(f"Could not parse {env_path}: {e}")
    else:
        warnings.append(f"Environment file '{env_path}' not found. Using system environment variables.")
        remediations.append(f"Create a '{env_path}' file by copying '{example_path}': cp {example_path} {env_path}")

    # 2. Check for unmodified placeholder values
    placeholders = {
        "your_gemini_api_key_here": "GEMINI_API_KEY",
        "your_groq_api_key_here": "GROQ_API_KEY",
        "your_telegram_bot_token_here": "TELEGRAM_BOT_TOKEN",
        "your_telegram_chat_id_here": "MY_TELEGRAM_CHAT_ID",
        "your_azure_openai_endpoint_here": "AZURE_OPENAI_ENDPOINT",
        "your_azure_openai_api_key_here": "AZURE_OPENAI_API_KEY",
        "your_inception_api_key_here": "INCEPTION_API_KEY",
        "your_sarvam_api_key_here": "SARVAM_API_KEY"
    }

    for placeholder, var_name in placeholders.items():
        val = os.getenv(var_name, '')
        if placeholder in val:
            warnings.append(f"Variable '{var_name}' still contains placeholder text '{placeholder}'.")
            remediations.append(f"Replace placeholder in {var_name} with your real API credential.")

    # 3. Detect common typos in variable names
    common_typos = {
        "GEMINI_KEY": "GEMINI_API_KEY",
        "GROQ_KEY": "GROQ_API_KEY",
        "TELEGRAM_TOKEN": "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_API_TOKEN": "TELEGRAM_BOT_TOKEN",
        "CHAT_ID": "MY_TELEGRAM_CHAT_ID",
        "TELEGRAM_CHAT_ID": "MY_TELEGRAM_CHAT_ID",
        "AZURE_KEY": "AZURE_OPENAI_API_KEY",
        "AZURE_ENDPOINT": "AZURE_OPENAI_ENDPOINT"
    }
    for typo, correct in common_typos.items():
        if os.getenv(typo) and not os.getenv(correct):
            warnings.append(f"Found '{typo}' which looks like a typo for '{correct}'.")
            remediations.append(f"Rename '{typo}' to '{correct}' in your {env_path} file.")

    # 4. Check LLM Provider status
    provider_checks = [
        ('geminiApiKey', 'Gemini', 'https://aistudio.google.com/app/apikey'),
        ('groqApiKey', 'Groq', 'https://console.groq.com/keys'),
        ('inceptionApiKey', 'Inception', 'https://inceptionlabs.ai'),
        ('sarvamApiKey', 'Sarvam', 'https://sarvam.ai'),
        ('arceeApiKey', 'Arcee', 'https://arcee.ai'),
        ('longcatApiKey', 'LongCat', 'https://longcat.chat'),
        ('thinkingMachineApiKey', 'Thinking Machine', 'https://thinkingmachines.ai'),
        ('azureOpenAIApiKey', 'Azure OpenAI', 'https://portal.azure.com')
    ]
    for key, name, portal_url in provider_checks:
        val = config.get(key)
        if val and not any(p in str(val) for p in placeholders):
            active_providers.append(name)

    if not active_providers:
        errors.append("No active LLM provider configured. The agent cannot reason or generate plans.")
        remediations.append(
            "Configure at least one LLM provider in .env. Recommended: Get a Gemini key from "
            "https://aistudio.google.com/app/apikey or a Groq key from https://console.groq.com/keys"
        )

    # 5. Azure OpenAI Consistency
    azure_key = config.get('azureOpenAIApiKey')
    azure_endpoint = config.get('azureOpenAIEndpoint')
    if azure_key and not azure_endpoint:
        errors.append("Azure OpenAI API key is set, but AZURE_OPENAI_ENDPOINT is missing.")
        remediations.append("Add AZURE_OPENAI_ENDPOINT=https://<your-resource-name>.openai.azure.com/ in your .env")

    # 6. Telegram Verification
    if require_telegram:
        if not config.get('telegramBotToken'):
            errors.append("TELEGRAM_BOT_TOKEN is missing.")
            remediations.append("Obtain a Telegram Bot token from @BotFather (https://t.me/botfather) and add to .env")
        if not config.get('myTelegramChatId'):
            errors.append("MY_TELEGRAM_CHAT_ID is missing.")
            remediations.append("Obtain your personal Telegram user ID from @userinfobot and add to .env")
    else:
        if not config.get('telegramBotToken'):
            warnings.append("TELEGRAM_BOT_TOKEN not provided (Telegram interface disabled; agent running in CLI/headless mode).")

    # 7. Format Validations
    port = config.get('port')
    if port is not None:
        try:
            p_val = int(port)
            if p_val < 1 or p_val > 65535:
                errors.append(f"Invalid PORT value '{port}'. Must be an integer between 1 and 65535.")
                remediations.append("Set PORT to a standard port number such as 8080 in .env.")
        except (ValueError, TypeError):
            errors.append(f"PORT must be a valid integer, got '{port}'.")

    # Check URL formats
    for url_key, var_name in [
        ('azureOpenAIEndpoint', 'AZURE_OPENAI_ENDPOINT'),
    ]:
        url_val = config.get(url_key)
        if url_val and not str(url_val).startswith(('http://', 'https://')):
            errors.append(f"'{var_name}' must be an HTTP or HTTPS URL, got '{url_val}'.")
            remediations.append(f"Ensure {var_name} starts with 'https://' or 'http://'")

    is_valid = len(errors) == 0

    return {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "remediations": remediations,
        "active_providers": active_providers
    }

def format_validation_report(report: Dict[str, Any]) -> str:
    """Format validation results into a human-readable ASCII report."""
    status_str = "PASSED" if report["is_valid"] else "FAILED"
    lines = [
        f"============================================================",
        f"       PC Assistant Agent - Configuration Check [{status_str}]",
        f"============================================================",
        ""
    ]

    if report["active_providers"]:
        lines.append(f"Active LLM Provider(s): {', '.join(report['active_providers'])}")
    else:
        lines.append("Active LLM Provider(s): NONE")
    lines.append("")

    if report["errors"]:
        lines.append("ERRORS (must be fixed before running):")
        for err in report["errors"]:
            lines.append(f"  [X] {err}")
        lines.append("")

    if report["warnings"]:
        lines.append("WARNINGS:")
        for warn in report["warnings"]:
            lines.append(f"  [!] {warn}")
        lines.append("")

    if report["remediations"]:
        lines.append("ACTIONABLE REMEDIATIONS:")
        for rem in report["remediations"]:
            lines.append(f"  -> {rem}")
        lines.append("")

    lines.append("============================================================")
    return "\n".join(lines)

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

if __name__ == "__main__":
    import sys
    cfg = load_config()
    res = validate_config_detailed(cfg)
    print(format_validation_report(res))
    sys.exit(0 if res["is_valid"] else 1)