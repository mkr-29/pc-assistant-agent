"""
Telegram tools for the PC Assistant Agent with standardized responses.
"""
import os
from typing import Dict, Any, Optional

try:
    from tools.registry import register_tool
    from utils.response import success_response, error_response
except ImportError:
    from src_py.tools.registry import register_tool
    from src_py.utils.response import success_response, error_response

# Try to import python-telegram-bot
try:
    from telegram import Bot
    from telegram.error import TelegramError
    TELEGRAM_AVAILABLE = True
except ImportError:
    TELEGRAM_AVAILABLE = False
    class Bot:
        def __init__(self, token):
            self.token = token
        async def send_message(self, chat_id, text, **kwargs):
            return {"message_id": 12345}
        async def send_document(self, chat_id, document, **kwargs):
            return {"message_id": 12346}
        async def send_photo(self, chat_id, photo, **kwargs):
            return {"message_id": 12347}

    class TelegramError(Exception):
        pass

def _resolve_bot_token(provided_token: Optional[str] = None) -> Optional[str]:
    if provided_token and str(provided_token).strip():
        return str(provided_token).strip()
    return os.getenv("TELEGRAM_BOT_TOKEN")

def _resolve_chat_id(provided_chat_id: Optional[str] = None) -> Optional[str]:
    if provided_chat_id and str(provided_chat_id).strip():
        return str(provided_chat_id).strip()
    return os.getenv("MY_TELEGRAM_CHAT_ID")

@register_tool("send_telegram_message", "telegram")
async def send_telegram_message(
    message: str,
    bot_token: Optional[str] = None,
    chat_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send a text message via Telegram.

    Args:
        message: Message text to send
        bot_token: Optional Telegram bot token (defaults to configured TELEGRAM_BOT_TOKEN)
        chat_id: Optional Telegram chat ID (defaults to configured MY_TELEGRAM_CHAT_ID)

    Returns:
        Standardized dictionary with send status
    """
    if not TELEGRAM_AVAILABLE:
        return error_response("python-telegram-bot package not installed", code="PKG_NOT_FOUND")

    effective_token = _resolve_bot_token(bot_token)
    if not effective_token:
        return error_response("Telegram bot token is required (not provided and not configured in environment)", code="MISSING_TOKEN")

    effective_chat_id = _resolve_chat_id(chat_id)
    if not effective_chat_id:
        return error_response("Telegram chat ID is required (not provided and not configured in environment)", code="MISSING_CHAT_ID")

    if not message or not str(message).strip():
        return error_response("Message cannot be empty", code="EMPTY_MESSAGE")

    try:
        bot = Bot(token=effective_token)
        result = await bot.send_message(chat_id=effective_chat_id, text=message)
        msg_id = getattr(result, "message_id", 12345)

        return success_response(
            message="Telegram message sent successfully",
            data={
                "message_id": msg_id,
                "chat_id": effective_chat_id,
                "message_preview": message[:100] + ("..." if len(message) > 100 else "")
            }
        )
    except TelegramError as e:
        return error_response(f"Telegram API error: {str(e)}", code="TELEGRAM_API_ERROR")
    except Exception as e:
        return error_response(f"Error sending Telegram message: {str(e)}", code="SEND_FAILED")

@register_tool("send_telegram_document", "telegram")
async def send_telegram_document(
    document_path: str,
    caption: Optional[str] = None,
    bot_token: Optional[str] = None,
    chat_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send a document via Telegram.

    Args:
        document_path: Path to the document file
        caption: Optional caption for the document
        bot_token: Optional Telegram bot token (defaults to configured TELEGRAM_BOT_TOKEN)
        chat_id: Optional Telegram chat ID (defaults to configured MY_TELEGRAM_CHAT_ID)

    Returns:
        Standardized dictionary with send status
    """
    if not TELEGRAM_AVAILABLE:
        return error_response("python-telegram-bot package not installed", code="PKG_NOT_FOUND")

    effective_token = _resolve_bot_token(bot_token)
    if not effective_token:
        return error_response("Telegram bot token is required (not provided and not configured in environment)", code="MISSING_TOKEN")

    effective_chat_id = _resolve_chat_id(chat_id)
    if not effective_chat_id:
        return error_response("Telegram chat ID is required (not provided and not configured in environment)", code="MISSING_CHAT_ID")

    if not document_path or not os.path.exists(document_path):
        return error_response(f"Document file not found: {document_path}", code="FILE_NOT_FOUND")

    try:
        bot = Bot(token=effective_token)
        with open(document_path, 'rb') as doc_file:
            result = await bot.send_document(chat_id=effective_chat_id, document=doc_file, caption=caption)
            msg_id = getattr(result, "message_id", 12346)

        return success_response(
            message="Document sent successfully",
            data={
                "message_id": msg_id,
                "chat_id": effective_chat_id,
                "document_path": document_path,
                "caption": caption
            }
        )
    except TelegramError as e:
        return error_response(f"Telegram API error: {str(e)}", code="TELEGRAM_API_ERROR")
    except Exception as e:
        return error_response(f"Error sending Telegram document: {str(e)}", code="SEND_FAILED")

@register_tool("send_telegram_photo", "telegram")
async def send_telegram_photo(
    photo_path: str,
    caption: Optional[str] = None,
    bot_token: Optional[str] = None,
    chat_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send a photo via Telegram.

    Args:
        photo_path: Path to the photo file
        caption: Optional caption for the photo
        bot_token: Optional Telegram bot token (defaults to configured TELEGRAM_BOT_TOKEN)
        chat_id: Optional Telegram chat ID (defaults to configured MY_TELEGRAM_CHAT_ID)

    Returns:
        Standardized dictionary with send status
    """
    if not TELEGRAM_AVAILABLE:
        return error_response("python-telegram-bot package not installed", code="PKG_NOT_FOUND")

    effective_token = _resolve_bot_token(bot_token)
    if not effective_token:
        return error_response("Telegram bot token is required (not provided and not configured in environment)", code="MISSING_TOKEN")

    effective_chat_id = _resolve_chat_id(chat_id)
    if not effective_chat_id:
        return error_response("Telegram chat ID is required (not provided and not configured in environment)", code="MISSING_CHAT_ID")

    if not photo_path or not os.path.exists(photo_path):
        return error_response(f"Photo file not found: {photo_path}", code="FILE_NOT_FOUND")

    try:
        bot = Bot(token=effective_token)
        with open(photo_path, 'rb') as photo_file:
            result = await bot.send_photo(chat_id=effective_chat_id, photo=photo_file, caption=caption)
            msg_id = getattr(result, "message_id", 12347)

        return success_response(
            message="Photo sent successfully",
            data={
                "message_id": msg_id,
                "chat_id": effective_chat_id,
                "photo_path": photo_path,
                "caption": caption
            }
        )
    except TelegramError as e:
        return error_response(f"Telegram API error: {str(e)}", code="TELEGRAM_API_ERROR")
    except Exception as e:
        return error_response(f"Error sending Telegram photo: {str(e)}", code="SEND_FAILED")