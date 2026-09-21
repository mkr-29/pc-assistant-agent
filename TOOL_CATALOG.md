# PC Assistant Agent - Comprehensive Tool Catalog

This document provides complete documentation for all **38 tools** available to the PC Assistant Agent runtime. Every tool is categorized, documented with its input parameters, return structure, security guardrails, and usage examples.

---

## Table of Categories
- [1. Filesystem Tools](#1-filesystem-tools) (8 tools)
- [2. Terminal & Shell Tools](#2-terminal--shell-tools) (3 tools)
- [3. Web & Network Tools](#3-web--network-tools) (4 tools)
- [4. macOS System Integration Tools](#4-macos-system-integration-tools) (10 tools)
- [5. Memory & Knowledge Tools](#5-memory--knowledge-tools) (10 tools)
- [6. Telegram Communication Tools](#6-telegram-communication-tools) (3 tools)

---

## 1. Filesystem Tools

Filesystem tools interact with the host storage. All filesystem operations pass through the **Security Validator** (`src_py/security/validator.py`), which blocks path traversal attempts (`../../`), null bytes, and direct access to sensitive credentials (`.env`, `id_rsa`, AWS/GCP keys).

### `read_file`
- **Description**: Safely read the textual content of a file at the specified path.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `file_path` | `str` | Yes | - | Absolute or relative path to the target file. |
  | `encoding` | `str` | No | `"utf-8"` | File text encoding. |
- **Security**: Access to files like `.env`, `id_rsa`, and secrets is blocked.
- **Return Envelope**: `{"success": true, "data": {"content": "...", "file_path": "...", "size_bytes": 1024}}`

### `write_file`
- **Description**: Safely create or overwrite a file with the given content. Automatically creates parent directories.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `file_path` | `str` | Yes | - | Destination file path. |
  | `content` | `str` | Yes | - | Text content to write into the file. |
  | `encoding` | `str` | No | `"utf-8"` | Text encoding. |
- **Security**: Blocks writing directly to sensitive files or escaping safe paths.

### `list_directory`
- **Description**: List files and subdirectories in a directory with file types and sizes.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `dir_path` | `str` | No | `"."` | Directory to inspect. |
- **Return Data**: List of file objects containing `name`, `is_directory`, `size_bytes`.

### `move_file`
- **Description**: Move or rename a file or directory from `source_path` to `dest_path`.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `source_path` | `str` | Yes | - | Path of the file/directory to move. |
  | `dest_path` | `str` | Yes | - | Destination target path. |

### `delete_file`
- **Description**: Safely delete a file from disk.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `file_path` | `str` | Yes | - | Path of the file to delete. |
- **Security**: Sensitive paths and root/system directories cannot be deleted.

### `get_file_info`
- **Description**: Retrieve metadata about a file or directory (size, modified time, permissions).
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `file_path` | `str` | Yes | - | Target file path. |

### `search_files`
- **Description**: Search for files matching a wildcard pattern (e.g. `*.py`, `**/*.md`).
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `pattern` | `str` | Yes | - | Glob search pattern. |
  | `root_dir` | `str` | No | `"."` | Starting directory for search. |

### `batch_file_operation`
- **Description**: Perform operations (copy, move, delete) on multiple files matching a pattern.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `operation` | `str` | Yes | - | One of `"copy"`, `"move"`, `"delete"`. |
  | `files` | `List[str]` | Yes | - | List of file paths to process. |
  | `dest_dir` | `str` | No | `""` | Destination directory if copying/moving. |

---

## 2. Terminal & Shell Tools

Terminal tools run shell commands on the host. Every command is tokenized and screened by `validate_command` before execution.

### `run_command`
- **Description**: Execute a shell command asynchronously with timeout and output capture.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `command` | `str` | Yes | - | Shell command line string. |
  | `timeout` | `int` | No | `60` | Execution timeout in seconds. |
  | `cwd` | `str` | No | `""` | Working directory for the command. |
- **Security Guardrails**:
  - Automatically intercepts destructive commands: `rm -rf /`, `mkfs`, `dd`, fork bombs, unauthorized `sudo`.
- **Return Envelope**:
  ```json
  {
    "success": true,
    "data": {
      "command": "python --version",
      "stdout": "Python 3.14.0\n",
      "stderr": "",
      "return_code": 0
    }
  }
  ```

### `change_directory`
- **Description**: Change the working directory of the agent process safely.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `path` | `str` | Yes | - | Directory path to switch to. |

### `get_current_directory`
- **Description**: Get the current working directory of the agent process.
- **Parameters**: None.

---

## 3. Web & Network Tools

Web tools fetch external internet documentation and search resources. All URLs pass through SSRF prevention checks.

### `fetch_web_page`
- **Description**: Fetch HTML/text from a URL, strip unwanted script tags, and return cleaned Markdown/text.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `url` | `str` | Yes | - | Public HTTP/HTTPS URL. |
  | `timeout` | `int` | No | `15` | Request timeout in seconds. |
- **Security**: Blocks localhost, 127.0.0.1, private RFC1918 subnets, and cloud metadata services.

### `search_web`
- **Description**: Query the web using DuckDuckGo to find documentation, answers, and links.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `query` | `str` | Yes | - | Search term or question. |
  | `max_results` | `int` | No | `5` | Maximum number of search results. |

### `crawl_web`
- **Description**: Crawl same-domain links starting from a seed URL to gather documentation context.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `start_url` | `str` | Yes | - | Seed URL. |
  | `max_pages` | `int` | No | `5` | Page exploration limit. |

### `parse_sitemap`
- **Description**: Parse XML sitemaps to discover available URLs and resources.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `sitemap_url` | `str` | Yes | - | URL of the XML sitemap. |

---

## 4. macOS System Integration Tools

Designed for desktop assistance, window management, and hardware telemetry.

### `run_applescript`
- **Description**: Execute custom AppleScript code via `osascript` on macOS.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `script` | `str` | Yes | - | AppleScript command code. |

### `open_target`
- **Description**: Open an application, URL, or local file using macOS `open`.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `target` | `str` | Yes | - | Application name, URL, or file path. |
  | `reveal_in_finder` | `bool` | No | `False` | Reveal target in Finder. |

### `quit_application`
- **Description**: Gracefully quit a running macOS application.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `app_name` | `str` | Yes | - | Application name (e.g. `"Safari"`). |

### `list_running_applications`
- **Description**: List currently running GUI applications and background services.
- **Parameters**: None.

### `get_system_info`
- **Description**: Retrieve CPU usage, RAM utilization, battery status, and OS version.
- **Parameters**: None.

### `control_media`
- **Description**: Control system volume or media playback (play/pause/next).
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `action` | `str` | Yes | - | `"volume_set"`, `"mute"`, `"unmute"`, `"play_pause"`, `"next"`. |
  | `value` | `int` | No | `0` | Volume level (0-100) when setting volume. |

### `get_clipboard`
- **Description**: Get current clipboard text content.
- **Parameters**: None.

### `set_clipboard`
- **Description**: Copy text into system clipboard.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `text` | `str` | Yes | - | Text string to copy. |

### `send_notification`
- **Description**: Display a desktop alert via macOS Notification Center.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `title` | `str` | Yes | - | Notification title. |
  | `message` | `str` | Yes | - | Notification body. |

### `take_screenshot`
- **Description**: Capture a high-resolution screenshot of the desktop screen using silent native macOS `screencapture` or cross-platform PIL `ImageGrab` fallback.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `file_path` | `str` | No | `None` | Optional destination path. If omitted, generates a timestamped `.png` image under `.data/media/screenshots/`. |
- **Return Envelope**: `{"success": true, "data": {"file_path": "...", "photo_path": "...", "width": 2880, "height": 1800, "size_bytes": 1048576, "method": "screencapture"}}`

---

## 5. Memory & Knowledge Tools

Provides persistence across user chats, facts, and profile settings.

### `search_knowledge_memories`
- **Description**: Search indexed knowledge memories using token relevance scoring.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `query` | `str` | Yes | - | Search keyword or phrase. |
  | `limit` | `int` | No | `5` | Maximum results to return. |
  | `category` | `str` | No | `""` | Optional category filter. |

### `update_knowledge_memory`
- **Description**: Update an existing memory item by its UUID.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `memory_id` | `str` | Yes | - | UUID of the memory item. |
  | `new_fact` | `str` | Yes | - | Updated memory content. |
  | `tags` | `List[str]` | No | `None` | Optional updated tags. |

### `search_conversation_history`
- **Description**: Search past conversation turns by query.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `chat_id` | `str` | Yes | - | Chat ID identifier. |
  | `query` | `str` | Yes | - | Keyword to search for. |

### Additional Memory Tools
- `add_knowledge_memory`: Store a new fact with UUID and tags.
- `get_knowledge_memories`: List all recorded knowledge memories.
- `delete_knowledge_memory`: Delete a memory by UUID.
- `get_conversation_history`: Retrieve recent chat turns.
- `clear_conversation_history`: Reset conversation history.
- `get_user_profile`: Retrieve user profile attributes.
- `update_user_profile`: Update user profile (supports nested dot-notation keys).

---

## 6. Telegram Communication Tools

Allows the agent to send responses, media, and attachments to the authorized user.

### `send_telegram_message`
- **Description**: Send a text message to the authorized user.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `text` | `str` | Yes | - | Text content (supports Markdown). |
  | `chat_id` | `str` | No | `""` | Target chat ID (defaults to authorized chat). |

### `send_telegram_photo`
- **Description**: Send an image file to Telegram.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `photo_path` | `str` | Yes | - | Local path to the image file. |
  | `caption` | `str` | No | `""` | Photo caption. |

### `send_telegram_document`
- **Description**: Send a document or file attachment to Telegram.
- **Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `document_path` | `str` | Yes | - | Local path to the document file. |
  | `caption` | `str` | No | `""` | Document caption. |
