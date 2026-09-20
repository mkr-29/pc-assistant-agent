"""
Unit and integration tests for Telegram bot message processing and command handling.
"""
import pytest
import os
import sys
from unittest.mock import AsyncMock, patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from main import PCAssistantAgent
from telegram_integration.bot import TelegramBot

@pytest.mark.asyncio
async def test_telegram_bot_auth_check():
    """Verify TelegramBot restricts access when chat_id does not match allowed_chat_id"""
    bot = TelegramBot(token="mock_token", allowed_chat_id="123456")

    mock_update = MagicMock()
    mock_update.effective_chat.id = 999999  # Unauthorized chat
    mock_update.effective_message.chat.id = 999999
    mock_update.effective_message.reply_text = AsyncMock()
    mock_update.message.reply_text = AsyncMock()

    mock_context = MagicMock()

    # Test /start command unauthorized
    await bot._start_command(mock_update, mock_context)
    mock_update.message.reply_text.assert_called_with("Sorry, you're not authorized to use this bot.")

    # Test message handler unauthorized
    bot.set_message_handler(AsyncMock())
    await bot._handle_message(mock_update, mock_context)
    mock_update.effective_message.reply_text.assert_called_with("Sorry, you're not authorized to use this bot.")
    bot.message_handler.assert_not_called()

@pytest.mark.asyncio
async def test_process_telegram_commands():
    """Verify built-in commands: /remember, /memories, /search_memories, /forget_memory, /profile, /new_convo"""
    agent = PCAssistantAgent()

    chat_id = "test_user_chat_1"

    def make_msg(text: str) -> dict:
        return {
            "message": {
                "chat": {"id": chat_id},
                "from": {"id": "user_1", "username": "tester"},
                "text": text
            }
        }

    # 1. /remember command
    res_rem = await agent.process_telegram_message(make_msg("/remember User birthday is July 10"))
    assert res_rem["success"] is True
    assert "User birthday is July 10" in res_rem["response_text"]

    # 2. /memories command
    res_mem = await agent.process_telegram_message(make_msg("/memories"))
    assert res_mem["success"] is True
    assert "User birthday is July 10" in res_mem["response_text"]

    # 3. /search_memories command
    res_search = await agent.process_telegram_message(make_msg("/search_memories birthday"))
    assert res_search["success"] is True
    assert "July 10" in res_search["response_text"]

    # 4. /profile command
    res_prof = await agent.process_telegram_message(make_msg("/profile"))
    assert res_prof["success"] is True

    # 5. /new_convo command
    res_clear = await agent.process_telegram_message(make_msg("/new_convo"))
    assert res_clear["success"] is True
    assert "cleared" in res_clear["response_text"]

    # 6. Multimedia message handlers
    photo_msg = {
        "message": {
            "chat": {"id": chat_id},
            "from": {"id": "user_1"},
            "photo": [{"file_id": "p123"}]
        }
    }
    res_photo = await agent.process_telegram_message(photo_msg)
    assert res_photo["success"] is True
    assert "photo" in res_photo["response_text"].lower()

    voice_msg = {
        "message": {
            "chat": {"id": chat_id},
            "from": {"id": "user_1"},
            "voice": {"file_id": "v123"}
        }
    }
    res_voice = await agent.process_telegram_message(voice_msg)
    assert res_voice["success"] is True
    assert "voice" in res_voice["response_text"].lower()

@pytest.mark.asyncio
async def test_process_telegram_message_with_agent():
    """Verify regular message invokes the agent graph and updates history"""
    agent = PCAssistantAgent()
    mock_app = AsyncMock()
    mock_app.ainvoke.return_value = {
        "reflection": "I have successfully analyzed your workspace.",
        "current_plan": "1. Inspect files",
        "plan_step": 1,
        "tools_used": ["list_directory"]
    }
    agent.agent_app = mock_app

    msg_data = {
        "message": {
            "chat": {"id": "chat_agent_test"},
            "from": {"id": "user_2", "username": "agent_user"},
            "text": "Analyze the workspace directory"
        }
    }

    res = await agent.process_telegram_message(msg_data)
    assert res["success"] is True
    assert "analyzed your workspace" in res["response_text"]
    assert res["execution_details"]["tools_used"] == ["list_directory"]
    mock_app.ainvoke.assert_called_once()
