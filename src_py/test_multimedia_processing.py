"""
Unit tests for Multimedia Processing (Images, Documents, Voice Notes)
"""
import io
import os
import shutil
import tempfile
import pytest
from PIL import Image

from utils.multimedia import process_image, process_document, process_voice_metadata
from main import PCAssistantAgent

@pytest.fixture
def temp_media_dir():
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)

def test_process_image_metadata_and_dimensions(temp_media_dir):
    # Generate test image using Pillow
    img = Image.new("RGB", (320, 240), color=(73, 109, 137))
    img_path = os.path.join(temp_media_dir, "sample.png")
    img.save(img_path, format="PNG")

    result = process_image(img_path)
    assert result["success"] is True
    assert result["dimensions"]["width"] == 320
    assert result["dimensions"]["height"] == 240
    assert result["format"] == "PNG"
    assert result["mode"] == "RGB"
    assert "320x240" in result["analysis"]

def test_process_document_text(temp_media_dir):
    doc_path = os.path.join(temp_media_dir, "notes.txt")
    sample_text = "Project Architecture: LangGraph + Python 3.14 + Telegram Bot.\nSecond line of document."
    with open(doc_path, "w", encoding="utf-8") as f:
        f.write(sample_text)

    result = process_document(doc_path, mime_type="text/plain")
    assert result["success"] is True
    assert result["file_name"] == "notes.txt"
    assert "LangGraph" in result["extracted_text"]
    assert result["char_count"] == len(sample_text)

def test_process_voice_metadata():
    meta = process_voice_metadata(duration=135, mime_type="audio/ogg", file_size=45000)
    assert meta["success"] is True
    assert meta["duration_seconds"] == 135
    assert meta["formatted_duration"] == "02:15"
    assert meta["mime_type"] == "audio/ogg"
    assert "02:15" in meta["summary"]

@pytest.mark.asyncio
async def test_agent_multimedia_message_handling(temp_media_dir):
    # Test main agent process_telegram_message with photo, voice, and document
    agent = PCAssistantAgent(disable_health_server=True)
    agent.config = {"telegramBotToken": "dummy_token", "myTelegramChatId": "12345"}

    # 1. Test photo payload
    photo_msg = {
        "message": {
            "chat": {"id": 12345},
            "from": {"id": 12345, "username": "testuser"},
            "photo": [
                {"file_id": "p1", "width": 100, "height": 100, "file_size": 1200},
                {"file_id": "p2", "width": 800, "height": 600, "file_size": 45000}
            ],
            "caption": "Check this screenshot"
        }
    }
    res_photo = await agent.process_telegram_message(photo_msg)
    assert res_photo["success"] is True
    assert "Photo Received & Processed" in res_photo["response_text"]
    assert "800x600" in res_photo["response_text"]
    assert "Check this screenshot" in res_photo["response_text"]

    # 2. Test voice payload
    voice_msg = {
        "message": {
            "chat": {"id": 12345},
            "from": {"id": 12345, "username": "testuser"},
            "voice": {
                "file_id": "v1",
                "duration": 45,
                "mime_type": "audio/ogg",
                "file_size": 18500
            }
        }
    }
    res_voice = await agent.process_telegram_message(voice_msg)
    assert res_voice["success"] is True
    assert "Voice Note Received" in res_voice["response_text"]
    assert "00:45" in res_voice["response_text"]

    # 3. Test document payload
    doc_msg = {
        "message": {
            "chat": {"id": 12345},
            "from": {"id": 12345, "username": "testuser"},
            "document": {
                "file_id": "d1",
                "file_name": "report.pdf",
                "mime_type": "application/pdf",
                "file_size": 128000
            },
            "caption": "Quarterly audit report"
        }
    }
    res_doc = await agent.process_telegram_message(doc_msg)
    assert res_doc["success"] is True
    assert "Document Received: report.pdf" in res_doc["response_text"]
    assert "Quarterly audit report" in res_doc["response_text"]
