"""
Main entry point for the PC Assistant Agent (Python/LangGraph implementation)
"""
import asyncio
import logging
import os
import signal
import sys
from typing import Dict, Any

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Import our modules
from config.env import load_config, validate_config
from memory.stores import ConversationHistoryStore, KnowledgeMemoryStore, UserProfileStore
from agent.graph import agent_graph
from telegram_integration.bot import TelegramBot
import tools

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global instances
conversation_history_store = ConversationHistoryStore()
knowledge_memory_store = KnowledgeMemoryStore()
user_profile_store = UserProfileStore()

class PCAssistantAgent:
    """Main PC Assistant Agent class"""

    def __init__(self):
        self.config = None
        self.agent_app = None
        self.telegram_bot = None
        self.running = False

    async def initialize(self):
        """Initialize the agent"""
        logger.info("Initializing PC Assistant Agent")

        try:
            # Load and validate configuration
            self.config = load_config()
            validate_config(self.config)
            logger.info("Configuration loaded and validated")

            # Initialize agent graph
            self.agent_app = agent_graph
            logger.info("Agent graph initialized")

            # Initialize Telegram bot
            telegram_token = self.config.get('telegramBotToken')
            allowed_chat_id = self.config.get('myTelegramChatId')

            if telegram_token:
                self.telegram_bot = TelegramBot(token=telegram_token, allowed_chat_id=allowed_chat_id)
                self.telegram_bot.set_message_handler(self.process_telegram_message)
                await self.telegram_bot.initialize()
                logger.info("Telegram bot initialized")
            else:
                logger.warning("No Telegram bot token provided - Telegram functionality disabled")

            self.running = True
            logger.info("PC Assistant Agent initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize agent: {e}")
            raise

    async def process_telegram_message(self, telegram_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process an incoming Telegram message and generate a response.

        Args:
            telegram_data: Dictionary containing Telegram message data

        Returns:
            Dictionary with response data to send back to Telegram
        """
        try:
            # Extract message data
            message = telegram_data.get("message", {})
            chat_id = str(message.get("chat", {}).get("id"))
            user_id = str(message.get("from", {}).get("id"))
            username = message.get("from", {}).get("username", "unknown")
            text = message.get("text", "")

            # Handle special commands
            if text.startswith("/new_convo"):
                conversation_history_store.clearHistory(chat_id)
                return {
                    "success": True,
                    "response_text": "Conversation history cleared. Starting fresh!",
                    "chat_id": chat_id
                }

            elif text.startswith("/remember "):
                fact = text[10:].strip()  # Remove "/remember "
                if fact:
                    knowledge_memory_store.addMemory(fact)
                    return {
                        "success": True,
                        "response_text": f"I'll remember that: {fact}",
                        "chat_id": chat_id
                    }
                else:
                    return {
                        "success": False,
                        "response_text": "Please specify what you'd like me to remember.",
                        "chat_id": chat_id
                    }

            elif text.startswith("/memories"):
                memories = knowledge_memory_store.listMemories()
                if memories:
                    memories_text = "\n".join([f"• {m['fact']}" for m in memories])
                    response_text = f"I remember the following facts:\n\n{memories_text}"
                else:
                    response_text = "I don't have any memories saved yet."
                return {
                    "success": True,
                    "response_text": response_text,
                    "chat_id": chat_id
                }

            elif text.startswith("/forget_memory "):
                memory_id_str = text[15:].strip()
                if not memory_id_str:
                    return {
                        "success": False,
                        "response_text": "Please provide a valid memory ID to forget.",
                        "chat_id": chat_id
                    }
                deleted = knowledge_memory_store.deleteMemory(memory_id_str)
                if deleted:
                    return {
                        "success": True,
                        "response_text": f"Memory '{memory_id_str}' has been forgotten.",
                        "chat_id": chat_id
                    }
                else:
                    return {
                        "success": False,
                        "response_text": f"Memory '{memory_id_str}' not found.",
                        "chat_id": chat_id
                    }

            elif text.startswith("/search_memories ") or text.startswith("/search "):
                prefix_len = 17 if text.startswith("/search_memories ") else 8
                query = text[prefix_len:].strip()
                if not query:
                    return {
                        "success": False,
                        "response_text": "Please specify a search query.",
                        "chat_id": chat_id
                    }
                matches = knowledge_memory_store.searchMemories(query)
                if matches:
                    text_matches = "\n".join([f"• [{m.get('id', '')}] {m['fact']} (score: {m.get('relevance_score', 0):.2f})" for m in matches])
                    response_text = f"Memories matching '{query}':\n\n{text_matches}"
                else:
                    response_text = f"No memories found matching '{query}'."
                return {
                    "success": True,
                    "response_text": response_text,
                    "chat_id": chat_id
                }

            elif text.startswith("/profile") or text.startswith("/whoami"):
                profile = user_profile_store.getUserProfile()
                if profile:
                    profile_text = "\n".join([f"{k}: {v}" for k, v in profile.items()])
                    response_text = f"Here's what I know about you:\n\n{profile_text}"
                else:
                    response_text = "I don't have any information about you yet. Use /remember <fact> to teach me things!"
                return {
                    "success": True,
                    "response_text": response_text,
                    "chat_id": chat_id
                }

            # Handle multimedia messages (simplified)
            elif "photo" in message and message["photo"]:
                # In a full implementation, we would download and process the photo
                return {
                    "success": True,
                    "response_text": "I can see you've sent a photo! Photo processing is coming soon.",
                    "chat_id": chat_id
                }

            elif "voice" in message and message["voice"]:
                # In a full implementation, we would transcribe the voice message
                return {
                    "success": True,
                    "response_text": "I can see you've sent a voice message! Voice transcription is coming soon.",
                    "chat_id": chat_id
                }

            # Process regular text message with the agent
            elif text:
                logger.info(f"Processing message from {username} ({user_id}): {text[:50]}...")

                # Prepare initial state for the agent
                initial_state = {
                    "user_prompt": text,
                    "chat_id": chat_id,
                    "conversation_history": conversation_history_store.getHistory(chat_id),
                    "knowledge_memory": knowledge_memory_store.listMemories(),
                    "user_profile": user_profile_store.getUserProfile(),
                    "current_plan": "",
                    "plan_step": 0,
                    "execution_results": [],
                    "tools_used": [],
                    "needs_more_steps": True,
                    "is_complete": False,
                    "error": None,
                    "reflection": "",
                    "model_used": "",
                    "timestamp": ""
                }

                # Run the agent
                logger.info("Running agent graph...")
                final_state = await self.agent_app.ainvoke(initial_state)

                # Extract results
                agent_response = final_state.get("reflection",
                    final_state.get("error",
                    "I've processed your request, but didn't generate a specific response."))

                # Update conversation history
                conversation_history_store.appendTurn(chat_id, text, agent_response)

                return {
                    "success": True,
                    "response_text": agent_response,
                    "chat_id": chat_id,
                    "execution_details": {
                        "plan": final_state.get("current_plan", ""),
                        "steps_executed": final_state.get("plan_step", 0),
                        "tools_used": final_state.get("tools_used", [])
                    }
                }

            else:
                return {
                    "success": False,
                    "response_text": "I didn't receive a message to process.",
                    "chat_id": chat_id
                }

        except Exception as e:
            logger.error(f"Error processing Telegram message: {e}")
            return {
                "success": False,
                "response_text": f"I encountered an error while processing your message: {str(e)}",
                "chat_id": telegram_data.get("message", {}).get("chat", {}).get("id", "unknown")
            }

    async def run(self):
        """Run the agent"""
        logger.info("Starting PC Assistant Agent")

        # Start Telegram bot if available
        if self.telegram_bot:
            started = await self.telegram_bot.start()
            if started:
                logger.info("Telegram bot started successfully")
            else:
                logger.warning("Failed to start Telegram bot")

        self.running = True
        logger.info("PC Assistant Agent is running")

        # Keep the agent running
        while self.running:
            await asyncio.sleep(1)

    def stop(self):
        """Stop the agent"""
        logger.info("Stopping PC Assistant Agent")
        self.running = False

        # Stop Telegram bot if it exists
        if self.telegram_bot:
            # Create a task to stop the bot asynchronously
            asyncio.create_task(self.telegram_bot.stop())

# Global agent instance
agent_instance = PCAssistantAgent()

async def main():
    """Main entry point"""
    try:
        # Initialize the agent
        await agent_instance.initialize()

        # Run the agent
        await agent_instance.run()

    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt")
    except Exception as e:
        logger.error(f"Error in main: {e}")
    finally:
        agent_instance.stop()

if __name__ == "__main__":
    # Handle graceful shutdown
    def signal_handler(sig, frame):
        logger.info("Received shutdown signal")
        agent_instance.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Run the main function
    asyncio.run(main())