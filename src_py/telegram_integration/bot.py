"""
Telegram bot integration for the PC Assistant Agent
"""
import asyncio
import logging
import os
from typing import Dict, Any, Optional, Callable
from datetime import datetime

logger = logging.getLogger(__name__)

class TelegramBot:
    """Handles Telegram bot integration"""

    def __init__(self, token: str, allowed_chat_id: Optional[str] = None):
        self.token = token
        self.allowed_chat_id = allowed_chat_id
        self.application = None
        self.message_handler: Optional[Callable] = None
        self.running = False

        # Try to import python-telegram-bot
        try:
            from telegram import Update
            from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
            self.TelegramAvailable = True
            self.Update = Update
            self.Application = Application
            self.CommandHandler = CommandHandler
            self.MessageHandler = MessageHandler
            self.filters = filters
            self.ContextTypes = ContextTypes
            logger.info("python-telegram-bot imported successfully")
        except ImportError:
            self.TelegramAvailable = False
            logger.warning("python-telegram-bot not installed. Telegram functionality will be limited.")

    def set_message_handler(self, handler: Callable[[Dict[str, Any]], Any]):
        """Set the function to handle incoming messages"""
        self.message_handler = handler

    async def initialize(self):
        """Initialize the Telegram bot"""
        if not self.TelegramAvailable:
            logger.warning("Telegram bot not available due to missing dependencies")
            return False

        try:
            # Create the application
            self.application = self.Application.builder().token(self.token).build()

            # Add handlers
            # Command handlers
            self.application.add_handler(self.CommandHandler("start", self._start_command))
            self.application.add_handler(self.CommandHandler("help", self._help_command))

            # Message handler for text, voice, photos, documents, etc.
            self.application.add_handler(self.MessageHandler(
                self.filters.TEXT | self.filters.VOICE | self.filters.PHOTO | self.filters.Document.ALL,
                self._handle_message
            ))

            # Error handler
            self.application.add_error_handler(self._error_handler)

            logger.info("Telegram bot initialized")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize Telegram bot: {e}")
            return False

    async def start(self):
        """Start the Telegram bot"""
        if not self.TelegramAvailable or not self.application:
            logger.error("Cannot start Telegram bot: not initialized or not available")
            return False

        try:
            self.running = True
            logger.info("Starting Telegram bot...")
            await self.application.initialize()
            await self.application.start()
            await self.application.updater.start_polling()
            logger.info("Telegram bot started successfully")
            return True
        except Exception as e:
            logger.error(f"Error starting Telegram bot: {e}")
            self.running = False
            return False

    async def stop(self):
        """Stop the Telegram bot"""
        if not self.running or not self.application:
            return

        try:
            logger.info("Stopping Telegram bot...")
            await self.application.updater.stop()
            await self.application.stop()
            await self.application.shutdown()
            self.running = False
            logger.info("Telegram bot stopped")
        except Exception as e:
            logger.error(f"Error stopping Telegram bot: {e}")

    async def _start_command(self, update: "Update", context: "ContextTypes.DEFAULT_TYPE"):
        """Handle /start command"""
        chat_id = str(update.effective_chat.id)
        user = update.effective_user

        # Check if user is allowed
        if self.allowed_chat_id and chat_id != self.allowed_chat_id:
            await update.message.reply_text("Sorry, you're not authorized to use this bot.")
            return

        await update.message.reply_text(
            f"Hello {user.first_name}! I'm your PC Assistant Agent. "
            "I can help you with file operations, web searches, automation, and more. "
            "Send me a message to get started!"
        )

    async def _help_command(self, update: "Update", context: "ContextTypes.DEFAULT_TYPE"):
        """Handle /help command"""
        help_text = """
        Available commands:
        /start - Start the bot
        /help - Show this help message
        /new_convo - Clear conversation history
        /remember <fact> - Save a fact to memory
        /memories - List saved memories
        /forget_memory <id> - Forget a specific memory
        /profile - Show what I know about you
        /whoami - Same as /profile

        You can also send me:
        - Text messages for general assistance
        - Voice messages (I'll transcribe them)
        - Photos (I can analyze them)
        """
        await update.message.reply_text(help_text)

    async def _handle_message(self, update: "Update", context: "ContextTypes.DEFAULT_TYPE"):
        """Handle incoming messages"""
        if not self.message_handler:
            logger.warning("No message handler set")
            return

        # Extract message data
        message = update.effective_message
        chat_id = str(message.chat.id)

        # Check if user is allowed
        if self.allowed_chat_id and chat_id != self.allowed_chat_id:
            await message.reply_text("Sorry, you're not authorized to use this bot.")
            return

        # Prepare telegram data structure
        telegram_data = {
            "message": {
                "message_id": message.message_id,
                "date": message.date.timestamp() if message.date else None,
                "chat": {
                    "id": message.chat.id,
                    "type": message.chat.type,
                    "title": getattr(message.chat, 'title', None),
                    "username": getattr(message.chat, 'username', None),
                    "first_name": getattr(message.chat, 'first_name', None),
                    "last_name": getattr(message.chat, 'last_name', None)
                },
                "from": {
                    "id": message.from_user.id if message.from_user else None,
                    "is_bot": message.from_user.is_bot if message.from_user else None,
                    "first_name": message.from_user.first_name if message.from_user else None,
                    "last_name": message.from_user.last_name if message.from_user else None,
                    "username": message.from_user.username if message.from_user else None,
                    "language_code": getattr(message.from_user, 'language_code', None)
                },
                "text": message.text if message.text else None,
                "voice": {
                    "file_id": message.voice.file_id if message.voice else None,
                    "file_unique_id": message.voice.file_unique_id if message.voice else None,
                    "duration": message.voice.duration if message.voice else None,
                    "mime_type": getattr(message.voice, 'mime_type', None),
                    "file_size": getattr(message.voice, 'file_size', None)
                } if message.voice else None,
                "photo": [
                    {
                        "file_id": photo.file_id,
                        "file_unique_id": photo.file_unique_id,
                        "file_size": photo.file_size,
                        "width": photo.width,
                        "height": photo.height
                    } for photo in message.photo
                ] if message.photo else None,
                "document": {
                    "file_id": message.document.file_id,
                    "file_name": message.document.file_name,
                    "mime_type": message.document.mime_type,
                    "file_size": message.document.file_size
                } if message.document else None,
                "caption": message.caption if message.caption else None
            }
        }

        # Process the message using the handler
        try:
            result = await self.message_handler(telegram_data)

            # Send response back to user
            photo_path = result.get("photo_path")
            doc_path = result.get("document_path")
            response_text = result.get("response_text", "I've processed your request.")

            if photo_path and os.path.exists(photo_path):
                with open(photo_path, 'rb') as photo_file:
                    caption = response_text[:1024] if response_text else None
                    await message.reply_photo(photo=photo_file, caption=caption)
            elif doc_path and os.path.exists(doc_path):
                with open(doc_path, 'rb') as doc_file:
                    caption = response_text[:1024] if response_text else None
                    await message.reply_document(document=doc_file, caption=caption)
            elif result.get("success"):
                await message.reply_text(response_text)
            else:
                error_text = result.get("response_text", "I encountered an error.")
                await message.reply_text(f"Error: {error_text}")

        except Exception as e:
            logger.error(f"Error in message handler: {e}")
            await message.reply_text(f"Sorry, I encountered an error while processing your message: {str(e)}")

    async def download_telegram_file(self, file_id: str, dest_path: str) -> bool:
        """Download file by file_id to a local destination path"""
        if not self.application:
            return False
        try:
            tg_file = await self.application.bot.get_file(file_id)
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            await tg_file.download_to_drive(custom_path=dest_path)
            return True
        except Exception as e:
            logger.error(f"Failed to download telegram file {file_id}: {e}")
            return False

    async def _error_handler(self, update: object, context: "ContextTypes.DEFAULT_TYPE"):
        """Handle errors"""
        logger.error(f"Exception while handling an update: {context.error}")

    async def send_message(self, chat_id: str, text: str) -> bool:
        """Send a message to a chat"""
        if not self.TelegramAvailable or not self.application:
            logger.warning("Cannot send message: Telegram bot not available")
            return False

        try:
            await self.application.bot.send_message(chat_id=chat_id, text=text)
            return True
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            return False

    async def send_document(self, chat_id: str, document_path: str, caption: Optional[str] = None) -> bool:
        """Send a document to a chat"""
        if not self.TelegramAvailable or not self.application:
            logger.warning("Cannot send document: Telegram bot not available")
            return False

        try:
            with open(document_path, 'rb') as doc:
                await self.application.bot.send_document(
                    chat_id=chat_id,
                    document=doc,
                    caption=caption
                )
            return True
        except Exception as e:
            logger.error(f"Error sending document: {e}")
            return False

    async def send_photo(self, chat_id: str, photo_path: str, caption: Optional[str] = None) -> bool:
        """Send a photo to a chat"""
        if not self.TelegramAvailable or not self.application:
            logger.warning("Cannot send photo: Telegram bot not available")
            return False

        try:
            with open(photo_path, 'rb') as photo:
                await self.application.bot.send_photo(
                    chat_id=chat_id,
                    photo=photo,
                    caption=caption
                )
            return True
        except Exception as e:
            logger.error(f"Error sending photo: {e}")
            return False

    def is_running(self) -> bool:
        """Check if the bot is running"""
        return self.running