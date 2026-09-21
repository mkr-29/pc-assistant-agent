"""
Main entry point for the PC Assistant Agent (Python/LangGraph implementation)
"""
import argparse
import asyncio
import logging
import os
import signal
import sys
import time
from typing import Dict, Any, Optional

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

try:
    from config.env import load_config, validate_config, validate_config_detailed, format_validation_report
    from memory.stores import ConversationHistoryStore, KnowledgeMemoryStore, UserProfileStore
    from agent.graph import agent_graph
    from telegram_integration.bot import TelegramBot
    from monitoring.metrics import metrics_collector
    from monitoring.health import HealthChecker, HealthServer
    from utils.logger import setup_logging, get_logger
    from utils.cache import global_cache
    from utils.multimedia import process_image, process_document, process_voice_metadata
    import tools
    from tools.registry import tool_registry
except ImportError:
    from src_py.config.env import load_config, validate_config, validate_config_detailed, format_validation_report
    from src_py.memory.stores import ConversationHistoryStore, KnowledgeMemoryStore, UserProfileStore
    from src_py.agent.graph import agent_graph
    from src_py.telegram_integration.bot import TelegramBot
    from src_py.monitoring.metrics import metrics_collector
    from src_py.monitoring.health import HealthChecker, HealthServer
    from src_py.utils.logger import setup_logging, get_logger
    from src_py.utils.cache import global_cache
    from src_py.utils.multimedia import process_image, process_document, process_voice_metadata
    import src_py.tools as tools
    from src_py.tools.registry import tool_registry

# Configure centralized structured logging (console + rotating file)
setup_logging()
logger = get_logger("main")

# Global instances
conversation_history_store = ConversationHistoryStore()
knowledge_memory_store = KnowledgeMemoryStore()
user_profile_store = UserProfileStore()

class PCAssistantAgent:
    """Main PC Assistant Agent class"""

    def __init__(self, port_override: Optional[int] = None, disable_health_server: bool = False):
        self.config = None
        self.agent_app = agent_graph
        self.telegram_bot = None
        self.health_server: Optional[HealthServer] = None
        self.running = False
        self.port_override = port_override
        self.disable_health_server = disable_health_server

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

            # Initialize HTTP Health & Metrics monitoring server
            if not self.disable_health_server:
                listen_port = self.port_override or self.config.get('port', 8080)
                self.health_server = HealthServer(
                    host="0.0.0.0",
                    port=listen_port,
                    bot_instance=self.telegram_bot
                )

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
        start_time = time.time()
        chat_id = "unknown"
        try:
            # Extract message data
            message = telegram_data.get("message", {})
            chat_id = str(message.get("chat", {}).get("id"))
            user_id = str(message.get("from", {}).get("id"))
            username = message.get("from", {}).get("username", "unknown")
            text = message.get("text", "")

            # 1. Health monitoring command
            if text.startswith("/health"):
                checker = HealthChecker()
                h = checker.get_health_status(self.telegram_bot)
                disk = h["checks"]["storage_capacity"]
                lines = [
                    f"🩺 <b>Agent Health: {h['status']}</b>",
                    f"• Uptime: {h['uptime_seconds']}s",
                    f"• Disk Space: {disk.get('detail', 'N/A')} ({disk.get('free_mb', 0)} MB free)",
                    f"• Data Directory: {h['checks']['data_directory']['status']}",
                    f"• Active LLMs: {', '.join(h['checks']['llm_providers'].get('configured_providers', []))}",
                    f"• Telegram Bot: {h['checks']['telegram_bot']['detail']}"
                ]
                metrics_collector.record_execution(True, (time.time() - start_time) * 1000)
                return {
                    "success": True,
                    "response_text": "\n".join(lines),
                    "chat_id": chat_id
                }

            # 2. Telemetry and metrics status command
            elif text.startswith("/status") or text.startswith("/metrics"):
                m = metrics_collector.get_metrics()
                exec_data = m["executions"]
                c_stats = global_cache.get_stats()
                lines = [
                    "📊 <b>Agent Telemetry & Status</b>",
                    f"• Total Executions: {exec_data['total']} (Success: {exec_data['successful']}, Failed: {exec_data['failed']})",
                    f"• Success Rate: {exec_data['success_rate_percent']}%",
                    f"• Latency: avg {exec_data['latency_ms']['avg']} ms (last: {exec_data['latency_ms']['last']} ms)",
                    f"• Cache: {c_stats['cached_entries']} entries, {c_stats['hits']} hits, {c_stats['misses']} misses ({c_stats['hit_ratio_percent']}% hit ratio)",
                    f"• Process Memory RSS: {m['system'].get('process_memory_rss_mb', 'N/A')} MB",
                    f"• Process CPU: {m['system'].get('process_cpu_percent', 'N/A')}%"
                ]
                metrics_collector.record_execution(True, (time.time() - start_time) * 1000)
                return {
                    "success": True,
                    "response_text": "\n".join(lines),
                    "chat_id": chat_id
                }

            # Handle special commands
            elif text.startswith("/new_convo"):
                conversation_history_store.clearHistory(chat_id)
                metrics_collector.record_execution(True, (time.time() - start_time) * 1000)
                return {
                    "success": True,
                    "response_text": "Conversation history cleared. Starting fresh!",
                    "chat_id": chat_id
                }

            elif text.startswith("/remember "):
                fact = text[10:].strip()  # Remove "/remember "
                if fact:
                    knowledge_memory_store.addMemory(fact)
                    metrics_collector.record_execution(True, (time.time() - start_time) * 1000)
                    return {
                        "success": True,
                        "response_text": f"I'll remember that: {fact}",
                        "chat_id": chat_id
                    }
                else:
                    metrics_collector.record_execution(False, (time.time() - start_time) * 1000)
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
                metrics_collector.record_execution(True, (time.time() - start_time) * 1000)
                return {
                    "success": True,
                    "response_text": response_text,
                    "chat_id": chat_id
                }

            elif text.startswith("/forget_memory "):
                memory_id_str = text[15:].strip()
                if not memory_id_str:
                    metrics_collector.record_execution(False, (time.time() - start_time) * 1000)
                    return {
                        "success": False,
                        "response_text": "Please provide a valid memory ID to forget.",
                        "chat_id": chat_id
                    }
                deleted = knowledge_memory_store.deleteMemory(memory_id_str)
                metrics_collector.record_execution(deleted, (time.time() - start_time) * 1000)
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

            elif text.startswith("/search_semantic "):
                query = text[17:].strip()
                if not query:
                    metrics_collector.record_execution(False, (time.time() - start_time) * 1000)
                    return {
                        "success": False,
                        "response_text": "Please specify a query for semantic search.",
                        "chat_id": chat_id
                    }
                matches = knowledge_memory_store.semanticSearchMemories(query)
                metrics_collector.record_execution(True, (time.time() - start_time) * 1000)
                if matches:
                    text_matches = "\n".join([f"• [{m.get('id', '')}] {m['fact']} (similarity: {m.get('similarity_score', 0):.2f})" for m in matches])
                    response_text = f"Semantic search matches for '{query}':\n\n{text_matches}"
                else:
                    response_text = f"No semantic memories found matching '{query}'."
                return {
                    "success": True,
                    "response_text": response_text,
                    "chat_id": chat_id
                }

            elif text.startswith("/search_memories ") or text.startswith("/search "):
                prefix_len = 17 if text.startswith("/search_memories ") else 8
                query = text[prefix_len:].strip()
                if not query:
                    metrics_collector.record_execution(False, (time.time() - start_time) * 1000)
                    return {
                        "success": False,
                        "response_text": "Please specify a search query.",
                        "chat_id": chat_id
                    }
                matches = knowledge_memory_store.searchMemories(query)
                metrics_collector.record_execution(True, (time.time() - start_time) * 1000)
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
                metrics_collector.record_execution(True, (time.time() - start_time) * 1000)
                return {
                    "success": True,
                    "response_text": response_text,
                    "chat_id": chat_id
                }

            elif text.startswith("/screenshot"):
                try:
                    from tools.system import take_screenshot
                except ImportError:
                    from src_py.tools.system import take_screenshot

                shot_res = await take_screenshot()
                metrics_collector.record_execution(shot_res.get("success", False), (time.time() - start_time) * 1000)
                if shot_res.get("success") and shot_res.get("file_path"):
                    return {
                        "success": True,
                        "response_text": "📸 Here is a screenshot of your screen:",
                        "photo_path": shot_res["file_path"],
                        "chat_id": chat_id
                    }
                else:
                    return {
                        "success": False,
                        "response_text": f"Failed to take screenshot: {shot_res.get('error', 'Unknown error')}",
                        "chat_id": chat_id
                    }

            # Handle multimedia messages
            elif "photo" in message and message["photo"]:
                photos = message["photo"]
                largest = photos[-1] if isinstance(photos, list) and photos else {}
                file_id = largest.get("file_id")
                caption = message.get("caption") or ""

                temp_path = f".data/media/photos/{file_id}.jpg" if file_id else None
                image_info = {}
                if self.telegram_bot and file_id and temp_path:
                    try:
                        downloaded = await self.telegram_bot.download_telegram_file(file_id, temp_path)
                        if downloaded and os.path.exists(temp_path):
                            image_info = process_image(temp_path)
                    except Exception as e:
                        logger.warning(f"Failed to download/process photo: {e}")

                if not image_info:
                    w = largest.get("width", "unknown")
                    h = largest.get("height", "unknown")
                    sz = largest.get("file_size", "unknown")
                    image_info = {
                        "success": True,
                        "dimensions": {"width": w, "height": h},
                        "analysis": f"Photo dimensions: {w}x{h}, size: {sz} bytes"
                    }

                lines = [
                    "📷 <b>Photo Received & Processed</b>",
                    f"• Details: {image_info.get('analysis', 'Analysis complete')}"
                ]
                if image_info.get("extracted_text"):
                    lines.append(f"• Extracted Text:\n{image_info['extracted_text']}")
                if caption:
                    lines.append(f"• Caption: {caption}")

                metrics_collector.record_execution(True, (time.time() - start_time) * 1000)
                return {
                    "success": True,
                    "response_text": "\n".join(lines),
                    "chat_id": chat_id,
                    "media_data": image_info
                }

            elif "voice" in message and message["voice"]:
                voice_data = message["voice"]
                file_id = voice_data.get("file_id")
                duration = voice_data.get("duration", 0)
                mime = voice_data.get("mime_type", "audio/ogg")
                file_size = voice_data.get("file_size")

                meta = process_voice_metadata(duration=duration, mime_type=mime, file_size=file_size)

                lines = [
                    "🎤 <b>Voice Note Received</b>",
                    f"• Duration: {meta.get('formatted_duration', f'{duration}s')} ({duration}s)",
                    f"• Format: {mime}",
                    f"• Size: {file_size or 'unknown'} bytes",
                    "• <i>Status: Voice note validated and prepared for speech transcription.</i>"
                ]

                metrics_collector.record_execution(True, (time.time() - start_time) * 1000)
                return {
                    "success": True,
                    "response_text": "\n".join(lines),
                    "chat_id": chat_id,
                    "voice_metadata": meta
                }

            elif "document" in message and message["document"]:
                doc = message["document"]
                file_id = doc.get("file_id")
                file_name = doc.get("file_name", "document")
                mime_type = doc.get("mime_type", "")
                file_size = doc.get("file_size", 0)
                caption = message.get("caption") or ""

                temp_doc_path = f".data/media/documents/{file_name}" if file_name else None
                doc_info = {}
                if self.telegram_bot and file_id and temp_doc_path:
                    try:
                        downloaded = await self.telegram_bot.download_telegram_file(file_id, temp_doc_path)
                        if downloaded and os.path.exists(temp_doc_path):
                            doc_info = process_document(temp_doc_path, mime_type=mime_type)
                    except Exception as e:
                        logger.warning(f"Failed to download/process document: {e}")

                if not doc_info:
                    doc_info = {
                        "success": True,
                        "file_name": file_name,
                        "char_count": 0,
                        "summary": f"Document '{file_name}' ({mime_type or 'unknown format'}, {file_size} bytes)"
                    }

                lines = [
                    f"📄 <b>Document Received: {file_name}</b>",
                    f"• Type: {mime_type or 'unknown'} ({file_size} bytes)"
                ]
                if doc_info.get("page_count"):
                    lines.append(f"• Pages: {doc_info['page_count']}")
                if doc_info.get("extracted_text"):
                    preview = doc_info["extracted_text"][:400]
                    lines.append(f"• Extracted Text ({doc_info.get('char_count', 0)} chars):\n<pre>{preview}</pre>")
                if caption:
                    lines.append(f"• Caption: {caption}")

                metrics_collector.record_execution(True, (time.time() - start_time) * 1000)
                return {
                    "success": True,
                    "response_text": "\n".join(lines),
                    "chat_id": chat_id,
                    "document_data": doc_info
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
                try:
                    final_state = await self.agent_app.ainvoke(initial_state)
                except Exception as g_err:
                    logger.warning(f"Agent graph execution encountered an error: {g_err}")
                    final_state = {"error": str(g_err)}

                # Extract results
                agent_response = final_state.get("reflection",
                    final_state.get("error",
                    "I've processed your request, but didn't generate a specific response."))

                # Update conversation history
                conversation_history_store.appendTurn(chat_id, text, agent_response)

                is_success = not bool(final_state.get("error"))
                metrics_collector.record_execution(is_success, (time.time() - start_time) * 1000)

                # Detect if any step took a screenshot or produced a photo
                detected_photo_path = final_state.get("photo_path")
                if not detected_photo_path:
                    for exec_res in final_state.get("execution_results", []):
                        res_data = exec_res.get("result", {})
                        if isinstance(res_data, dict):
                            p = res_data.get("photo_path") or res_data.get("file_path")
                            if p and isinstance(p, str) and p.lower().endswith((".png", ".jpg", ".jpeg")) and os.path.exists(p):
                                detected_photo_path = p
                                break

                # Safety fallback: if user prompt was asking for a screenshot but model failed to call the tool or gave a refusal:
                if not detected_photo_path and any(w in text.lower() for w in ("screenshot", "screen shot", "capture screen", "capture my screen", "send me a screenshot")):
                    try:
                        from tools.system import take_screenshot
                    except ImportError:
                        from src_py.tools.system import take_screenshot

                    try:
                        shot_res = await take_screenshot()
                        if shot_res.get("success") and os.path.exists(shot_res.get("file_path", "")):
                            detected_photo_path = shot_res["file_path"]
                            agent_response = "📸 Here is a screenshot of your screen:"
                            is_success = True
                    except Exception as s_err:
                        logger.warning(f"Fallback screenshot capture failed: {s_err}")

                if detected_photo_path:
                    is_success = True

                resp_payload = {
                    "success": is_success,
                    "response_text": agent_response,
                    "chat_id": chat_id,
                    "execution_details": {
                        "plan": final_state.get("current_plan", ""),
                        "steps_executed": final_state.get("plan_step", 0),
                        "tools_used": final_state.get("tools_used", [])
                    }
                }
                if detected_photo_path and os.path.exists(detected_photo_path):
                    resp_payload["photo_path"] = detected_photo_path

                return resp_payload

            else:
                metrics_collector.record_execution(False, (time.time() - start_time) * 1000)
                return {
                    "success": False,
                    "response_text": "I didn't receive a message to process.",
                    "chat_id": chat_id
                }

        except Exception as e:
            logger.error(f"Error processing Telegram message: {e}")
            metrics_collector.record_execution(False, (time.time() - start_time) * 1000)
            return {
                "success": False,
                "response_text": f"I encountered an error while processing your message: {str(e)}",
                "chat_id": telegram_data.get("message", {}).get("chat", {}).get("id", chat_id)
            }

    async def run(self):
        """Run the agent"""
        logger.info("Starting PC Assistant Agent")

        # Start health and metrics HTTP server if available
        if self.health_server:
            await self.health_server.start()

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

        # Stop HTTP health server if running
        if self.health_server:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(self.health_server.stop())
            except Exception:
                pass

        # Stop Telegram bot if it exists
        if self.telegram_bot:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(self.telegram_bot.stop())
            except Exception:
                pass

# Global agent instance
agent_instance: Optional[PCAssistantAgent] = None

async def main(args: Optional[argparse.Namespace] = None):
    """Main entry point"""
    global agent_instance
    try:
        # Configuration check flag
        if args and args.check_config:
            cfg = load_config()
            report = validate_config_detailed(cfg, require_telegram=args.require_telegram)
            print(format_validation_report(report))
            sys.exit(0 if report["is_valid"] else 1)

        # Export tools catalog flag
        if args and args.export_tools:
            cat = tool_registry.generate_markdown_catalog()
            print(cat)
            sys.exit(0)

        # Initialize the agent
        agent_instance = PCAssistantAgent(
            port_override=args.port if args else None,
            disable_health_server=args.no_server if args else False
        )
        await agent_instance.initialize()

        # Run the agent
        await agent_instance.run()

    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt")
    except Exception as e:
        logger.error(f"Error in main: {e}")
    finally:
        if agent_instance:
            agent_instance.stop()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PC Assistant Agent Runtime")
    parser.add_argument("--check-config", action="store_true", help="Validate configuration and environment variables, then exit")
    parser.add_argument("--require-telegram", action="store_true", help="Enforce Telegram credentials when checking configuration")
    parser.add_argument("--export-tools", action="store_true", help="Print Markdown catalog of all registered tools and exit")
    parser.add_argument("--port", type=int, default=None, help="HTTP port for health and metrics server (overrides PORT env)")
    parser.add_argument("--no-server", action="store_true", help="Disable the background HTTP health and metrics server")

    cli_args = parser.parse_args()

    # Handle graceful shutdown
    def signal_handler(sig, frame):
        logger.info("Received shutdown signal")
        if agent_instance:
            agent_instance.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Run the main function
    asyncio.run(main(cli_args))