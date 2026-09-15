import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def load_config():
    """Load configuration from environment variables"""
    config = {
        # Telegram configuration
        'telegramBotToken': os.getenv('TELEGRAM_BOT_TOKEN'),
        'myTelegramChatId': os.getenv('MY_TELEGRAM_CHAT_ID'),

        # LLM API keys
        'geminiApiKey': os.getenv('GEMINI_API_KEY'),
        'groqApiKey': os.getenv('GROQ_API_KEY'),
        'inceptionApiKey': os.getenv('INCEPTION_API_KEY'),
        'sarvamApiKey': os.getenv('SARVAM_API_KEY'),
        'arceeApiKey': os.getenv('ARCEE_API_KEY'),
        'longcatApiKey': os.getenv('LONGCAT_API_KEY'),
        'thinkingMachineApiKey': os.getenv('THINKING_MACHINE_API_KEY'),
        'azureOpenAIApiKey': os.getenv('AZURE_OPENAI_API_KEY'),
        'azureOpenAIEndpoint': os.getenv('AZURE_OPENAI_ENDPOINT'),
        'azureOpenAIDeployment': os.getenv('AZURE_OPENAI_DEPLOYMENT', 'gpt-5.5'),

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
            'model': os.getenv('SARVAM_MODEL', 'sarvam-105b')
        },
        'arcee': {
            'apiKey': os.getenv('ARCEE_API_KEY'),
            'model': os.getenv('ARCEE_MODEL', 'zai-org/glm-5.2')
        },
        'longcat': {
            'apiKey': os.getenv('LONGCAT_API_KEY'),
            'model': os.getenv('LONGCAT_MODEL', 'LongCat-2.0')
        },
        'thinkingMachine': {
            'apiKey': os.getenv('THINKING_MACHINE_API_KEY'),
            'model': os.getenv('THINKING_MACHINE_MODEL', 'inkling')
        },
        'azureOpenAI': {
            'apiKey': os.getenv('AZURE_OPENAI_API_KEY'),
            'endpoint': os.getenv('AZURE_OPENAI_ENDPOINT'),
            'deployment': os.getenv('AZURE_OPENAI_DEPLOYMENT', 'gpt-5.5')
        },

        # Optional settings
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

        # Firecrawl settings
        'firecrawlApiKey': os.getenv('FIRECRAWL_API_KEY'),

        # Target project path for relative paths
        'targetProjectPath': os.getenv('TARGET_PROJECT_PATH', ''),

        # Port for HTTP server
        'port': int(os.getenv('PORT', '8080'))
    }

    return config

def validate_config(config):
    """Validate that required configuration is present"""
    required_fields = [
        'telegramBotToken',
        'myTelegramChatId',
        'geminiApiKey'  # At least one LLM provider should be configured
    ]

    missing_fields = []
    for field in required_fields:
        if not config.get(field):
            missing_fields.append(field)

    if missing_fields:
        raise ValueError(f"Missing required configuration fields: {', '.join(missing_fields)}")

    # Check if at least one LLM provider is configured
    llm_providers = [
        config.get('geminiApiKey'),
        config.get('groqApiKey'),
        config.get('inceptionApiKey'),
        config.get('sarvamApiKey'),
        config.get('arceeApiKey'),
        config.get('longcatApiKey'),
        config.get('thinkingMachineApiKey'),
        config.get('azureOpenAIApiKey')
    ]

    if not any(llm_providers):
        raise ValueError("At least one LLM provider API key must be configured")

    return True