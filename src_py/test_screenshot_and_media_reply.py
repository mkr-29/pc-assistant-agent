"""
Unit tests for Screenshot Capture and Telegram Photo/Media Reply
"""
import os
import shutil
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from tools.system import take_screenshot
from tools.registry import tool_registry
from tools.telegram import send_telegram_photo, send_telegram_message
from main import PCAssistantAgent
from telegram_integration.bot import TelegramBot

@pytest.fixture
def temp_screenshot_dir():
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)

@pytest.mark.asyncio
async def test_take_screenshot_tool(temp_screenshot_dir):
    dest_file = os.path.join(temp_screenshot_dir, "my_screen.png")
    res = await take_screenshot(file_path=dest_file)

    assert res["success"] is True
    assert "file_path" in res
    assert "photo_path" in res
    assert res["photo_path"] == dest_file
    assert os.path.exists(dest_file)
    assert os.path.getsize(dest_file) > 0
    assert res["width"] > 0
    assert res["height"] > 0

@pytest.mark.asyncio
async def test_take_screenshot_in_registry():
    tool = tool_registry.get_tool("take_screenshot")
    assert tool is not None
    assert callable(tool)
    assert "take_screenshot" in tool_registry.tools

@pytest.mark.asyncio
async def test_send_telegram_photo_auto_config(temp_screenshot_dir):
    sample_photo = os.path.join(temp_screenshot_dir, "test.png")
    with open(sample_photo, "wb") as f:
        f.write(b"fake_png_data")

    # With environment variables set
    with patch.dict(os.environ, {"TELEGRAM_BOT_TOKEN": "mock_token_123", "MY_TELEGRAM_CHAT_ID": "chat_999"}):
        with patch("tools.telegram.Bot") as mock_bot_cls:
            mock_bot_instance = MagicMock()
            mock_bot_instance.send_photo = AsyncMock(return_value=MagicMock(message_id=9999))
            mock_bot_cls.return_value = mock_bot_instance

            res = await send_telegram_photo(photo_path=sample_photo, caption="Test Screen")
            assert res["success"] is True
            assert res["chat_id"] == "chat_999"
            assert res["photo_path"] == sample_photo

@pytest.mark.asyncio
async def test_process_telegram_message_screenshot_command(temp_screenshot_dir):
    agent = PCAssistantAgent(disable_health_server=True)
    agent.config = {"telegramBotToken": "mock_token", "myTelegramChatId": "12345"}

    msg_data = {
        "message": {
            "chat": {"id": 12345},
            "from": {"id": 12345, "username": "testuser"},
            "text": "/screenshot"
        }
    }

    result = await agent.process_telegram_message(msg_data)
    assert result["success"] is True
    assert "photo_path" in result
    assert os.path.exists(result["photo_path"])
    assert "Here is a screenshot" in result["response_text"]

@pytest.mark.asyncio
async def test_process_telegram_message_natural_language_screenshot(temp_screenshot_dir):
    agent = PCAssistantAgent(disable_health_server=True)
    agent.config = {"telegramBotToken": "mock_token", "myTelegramChatId": "12345"}

    msg_data = {
        "message": {
            "chat": {"id": 12345},
            "from": {"id": 12345, "username": "testuser"},
            "text": "Please send me a screenshot of the current screen"
        }
    }

    with patch("tools.telegram.Bot") as mock_bot_cls:
        mock_bot_instance = MagicMock()
        mock_bot_instance.send_photo = AsyncMock(return_value=MagicMock(message_id=9999))
        mock_bot_cls.return_value = mock_bot_instance

        result = await agent.process_telegram_message(msg_data)
        assert result["success"] is True
        assert "photo_path" in result
        assert os.path.exists(result["photo_path"])
        assert any(phrase in result["response_text"].lower() for phrase in ("screenshot", "screen", "captured"))

@pytest.mark.asyncio
async def test_bot_replies_with_photo(temp_screenshot_dir):
    bot = TelegramBot(token="fake_token", allowed_chat_id="12345")
    sample_photo = os.path.join(temp_screenshot_dir, "screen.png")
    with open(sample_photo, "wb") as f:
        f.write(b"fake_image_bytes")

    # Mock handler that returns photo_path
    async def mock_handler(data):
        return {
            "success": True,
            "response_text": "Captured screen",
            "photo_path": sample_photo
        }

    bot.set_message_handler(mock_handler)

    mock_msg = MagicMock()
    mock_msg.chat.id = 12345
    mock_msg.from_user.id = 12345
    mock_msg.from_user.is_bot = False
    mock_msg.from_user.username = "testuser"
    mock_msg.from_user.first_name = "Test"
    mock_msg.from_user.last_name = None
    mock_msg.text = "take a screenshot"
    mock_msg.reply_photo = AsyncMock()
    mock_msg.reply_text = AsyncMock()

    mock_update = MagicMock()
    mock_update.effective_message = mock_msg

    await bot._handle_message(mock_update, MagicMock())

    # Should call reply_photo, not just reply_text
    mock_msg.reply_photo.assert_called_once()
