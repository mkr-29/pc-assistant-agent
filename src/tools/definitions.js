export const fileReaderTool = {
    name: 'readFile',
    description: 'Reads the contents of a text-based file inside the laptop filesystem.',
    parameters: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'The absolute path, project-relative path, or tilde path (e.g. ~/Desktop/todo.txt).'
            }
        },
        required: ['filePath']
    }
};

export const fileWriterTool = {
    name: 'writeFile',
    description: 'Creates or updates a file on the laptop with new text content.',
    parameters: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'The absolute, project-relative, or tilde path where the file will be saved.'
            },
            content: {
                type: 'string',
                description: 'The full text content to write into the file.'
            }
        },
        required: ['filePath', 'content']
    }
};

export const listDirectoryTool = {
    name: 'listDirectory',
    description: 'Lists all files and directories inside a specified path on the laptop.',
    parameters: {
        type: 'object',
        properties: {
            directoryPath: {
                type: 'string',
                description: 'The absolute, project-relative, or tilde path of the directory to list.'
            }
        },
        required: ['directoryPath']
    }
};

export const searchFilesTool = {
    name: 'searchFiles',
    description: 'Searches file and directory names recursively under the target project path.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Text to match against file or directory names and project-relative paths.'
            },
            directoryPath: {
                type: 'string',
                description: 'Optional absolute, project-relative, or tilde directory path to search. Defaults to TARGET_PROJECT_PATH.'
            },
            maxResults: {
                type: 'number',
                description: 'Optional maximum number of results to return. Defaults to 50.'
            },
            extensions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional file extensions to include, such as [".js", ".md"].'
            },
            includeDirectories: {
                type: 'boolean',
                description: 'Whether to include matching directories. Defaults to false.'
            }
        },
        required: ['query']
    }
};

export const searchTextTool = {
    name: 'searchText',
    description: 'Searches text content recursively in files under the target project path.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Plain text to search for inside files.'
            },
            directoryPath: {
                type: 'string',
                description: 'Optional absolute, project-relative, or tilde directory path to search. Defaults to TARGET_PROJECT_PATH.'
            },
            maxResults: {
                type: 'number',
                description: 'Optional maximum number of matches to return. Defaults to 50.'
            },
            maxMatchesPerFile: {
                type: 'number',
                description: 'Optional maximum matches returned per file. Defaults to 5.'
            },
            extensions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional file extensions to include, such as [".js", ".md"].'
            },
            caseSensitive: {
                type: 'boolean',
                description: 'Whether the text search should be case-sensitive. Defaults to false.'
            }
        },
        required: ['query']
    }
};

export const findRecentFilesTool = {
    name: 'findRecentFiles',
    description: 'Finds recently modified files recursively under the target project path.',
    parameters: {
        type: 'object',
        properties: {
            directoryPath: {
                type: 'string',
                description: 'Optional absolute, project-relative, or tilde directory path to search. Defaults to TARGET_PROJECT_PATH.'
            },
            maxResults: {
                type: 'number',
                description: 'Optional maximum number of files to return. Defaults to 50.'
            },
            extensions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional file extensions to include, such as [".js", ".md"].'
            },
            sinceHours: {
                type: 'number',
                description: 'Optional lookback window. Only files modified within this many hours are returned.'
            }
        }
    }
};

export const executeTerminalCommandTool = {
    name: 'executeCommand',
    description: 'Runs a terminal command (like npm install, git clone, or scripts) in a specified directory in the background.',
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The terminal command to run.'
            },
            cwd: {
                type: 'string',
                description: 'Optional. The absolute, tilde, or project-relative directory path to run the command in.'
            }
        },
        required: ['command']
    }
};

export const openTerminalTool = {
    name: 'openTerminal',
    description: 'Opens a visible macOS Terminal window in a directory and optionally executes a command inside it upon user approval.',
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'Optional command string to execute in the opened terminal window.'
            },
            cwd: {
                type: 'string',
                description: 'Optional absolute, project-relative, or tilde directory path to open the terminal in.'
            }
        }
    }
};

export const openLocalTargetTool = {
    name: 'openLocalTarget',
    description: 'Opens a macOS app, local file, or folder, or reveals a local file/folder in Finder.',
    parameters: {
        type: 'object',
        properties: {
            appName: {
                type: 'string',
                description: 'Optional app name to launch or use, such as Chrome, VS Code, Finder, Terminal, or a full macOS app name.'
            },
            targetPath: {
                type: 'string',
                description: 'Optional absolute, project-relative, or tilde path to a local file or folder.'
            },
            revealInFinder: {
                type: 'boolean',
                description: 'Whether to reveal targetPath in Finder instead of opening it. Requires targetPath.'
            }
        }
    }
};

export const controlDesktopBrowserTool = {
    name: 'controlDesktopBrowser',
    description: 'Controls open desktop browsers on macOS (Brave Browser, Google Chrome, Safari, Edge) to search tabs by title or URL, focus them, play/pause media playback, reload, or run custom JS.',
    parameters: {
        type: 'object',
        properties: {
            browserName: {
                type: 'string',
                description: 'Optional browser app name, such as "Brave Browser", "Google Chrome", "Safari", or "Edge". Defaults to checking Brave Browser then Google Chrome.'
            },
            tabQuery: {
                type: 'string',
                description: 'Optional search term to find open tabs by title or URL, e.g. "YouTube Music", "Spotify", "music.youtube.com".'
            },
            action: {
                type: 'string',
                description: 'Action to perform: playpause (toggle media playback), focus (bring window/tab to front), play, pause, next, previous, reload, or executeJS.'
            },
            jsScript: {
                type: 'string',
                description: 'Optional custom JavaScript string to execute inside matching browser tab when action is executeJS.'
            }
        }
    }
};

export const controlMediaPlaybackTool = {
    name: 'controlMediaPlayback',
    description: 'Controls system audio volume (set volume 0-100, mute, unmute) and system or desktop application media playback (play, pause, toggle play/pause, next track, previous track) on macOS.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'Media control action: playpause, play, pause, next, previous, volume, setvolume, mute, or unmute.'
            },
            volume: {
                type: 'number',
                description: 'Optional volume percentage level (0 to 100) when setting volume.'
            },
            appName: {
                type: 'string',
                description: 'Optional target app name such as "Brave Browser", "Google Chrome", or "Spotify".'
            }
        },
        required: ['action']
    }
};

export const inspectProjectTool = {
    name: 'inspectProject',
    description: 'Detects project type, package scripts, and git availability for a codebase directory.',
    parameters: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'Optional. The absolute, tilde, or project-relative directory to inspect. Defaults to TARGET_PROJECT_PATH.'
            }
        }
    }
};

export const runProjectTestsTool = {
    name: 'runProjectTests',
    description: 'Runs the project test script when configured and returns structured pass/fail output.',
    parameters: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'Optional. The absolute, tilde, or project-relative project directory. Defaults to TARGET_PROJECT_PATH.'
            },
            commandOverride: {
                type: 'string',
                description: 'Optional explicit test command to run instead of the detected project test script.'
            },
            timeoutMs: {
                type: 'number',
                description: 'Optional timeout in milliseconds. Defaults to a conservative limit.'
            },
            maxOutputChars: {
                type: 'number',
                description: 'Optional maximum stdout/stderr characters returned per stream.'
            }
        }
    }
};

export const runProjectLintTool = {
    name: 'runProjectLint',
    description: 'Runs the project lint script when configured, or reports that lint is not configured.',
    parameters: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'Optional. The absolute, tilde, or project-relative project directory. Defaults to TARGET_PROJECT_PATH.'
            },
            commandOverride: {
                type: 'string',
                description: 'Optional explicit lint command to run instead of the detected project lint script.'
            },
            timeoutMs: {
                type: 'number',
                description: 'Optional timeout in milliseconds. Defaults to a conservative limit.'
            },
            maxOutputChars: {
                type: 'number',
                description: 'Optional maximum stdout/stderr characters returned per stream.'
            }
        }
    }
};

export const getGitStatusTool = {
    name: 'getGitStatus',
    description: 'Returns read-only git status details for a project, including branch, changed files, and diff stats.',
    parameters: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'Optional. The absolute, tilde, or project-relative project directory. Defaults to TARGET_PROJECT_PATH.'
            }
        }
    }
};

export const summarizeGitDiffTool = {
    name: 'summarizeGitDiff',
    description: 'Returns bounded git diff data for staged, unstaged, or all local changes so the assistant can summarize it.',
    parameters: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'Optional. The absolute, tilde, or project-relative project directory. Defaults to TARGET_PROJECT_PATH.'
            },
            scope: {
                type: 'string',
                description: 'Optional diff scope: unstaged, staged, or both. Defaults to both.'
            },
            maxDiffChars: {
                type: 'number',
                description: 'Optional maximum diff characters returned. Defaults to a bounded limit.'
            }
        }
    }
};

export const createGitCommitTool = {
    name: 'createGitCommit',
    description: 'Creates a local git commit only after explicit user confirmation. It never pushes or amends commits.',
    parameters: {
        type: 'object',
        properties: {
            projectPath: {
                type: 'string',
                description: 'Optional. The absolute, tilde, or project-relative project directory. Defaults to TARGET_PROJECT_PATH.'
            },
            message: {
                type: 'string',
                description: 'The commit message to use.'
            },
            files: {
                type: 'array',
                description: 'Optional explicit file paths to stage before committing. If omitted, only already staged changes are committed.',
                items: {
                    type: 'string'
                }
            },
            confirmed: {
                type: 'boolean',
                description: 'Must be true only after the user explicitly confirms creating the commit.'
            }
        },
        required: ['message', 'confirmed']
    }
};

export const sendTelegramFileTool = {
    name: 'sendTelegramFile',
    description: 'Sends a local file (like an image, screenshot, PDF, or document) from the laptop back to the user on Telegram.',
    parameters: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'The absolute, project-relative, or tilde path of the file to send.'
            },
            caption: {
                type: 'string',
                description: 'Optional message or description to send with the file.'
            }
        },
        required: ['filePath']
    }
};

export const readClipboardTool = {
    name: 'readClipboard',
    description: 'Reads the current text content from the macOS clipboard when the user explicitly asks to use clipboard content.',
    parameters: {
        type: 'object',
        properties: {}
    }
};

export const writeClipboardTool = {
    name: 'writeClipboard',
    description: 'Copies text into the macOS clipboard for quick snippets, messages, commands, or generated output.',
    parameters: {
        type: 'object',
        properties: {
            content: {
                type: 'string',
                description: 'The exact text to copy into the clipboard.'
            }
        },
        required: ['content']
    }
};

export const takeScreenshotTool = {
    name: 'takeScreenshot',
    description: 'Captures the current macOS screen as a local PNG file on the laptop.',
    parameters: {
        type: 'object',
        properties: {
            fileName: {
                type: 'string',
                description: 'Optional safe file name for the screenshot. The tool will save it as a PNG under .data/screenshots/.'
            }
        }
    }
};

export const describeScreenTool = {
    name: 'describeScreen',
    description: 'Captures the current macOS screen and uses vision analysis to describe what is visible.',
    parameters: {
        type: 'object',
        properties: {
            question: {
                type: 'string',
                description: 'Optional specific question to answer about the current screen, such as reading an error or suggesting next steps.'
            },
            fileName: {
                type: 'string',
                description: 'Optional safe file name for the screenshot. The tool will save it as a PNG under .data/screenshots/.'
            }
        }
    }
};

export const browserNavigateTool = {
    name: 'browserNavigate',
    description: 'Opens or reuses the managed browser page and navigates to a URL.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The full URL to navigate to, including http:// or https://.'
            },
            takeScreenshot: {
                type: 'boolean',
                description: 'Optional boolean. When true, automatically captures a PNG screenshot of the browser page state after navigating.'
            }
        },
        required: ['url']
    }
};

export const browserSnapshotTool = {
    name: 'browserSnapshot',
    description: 'Returns the managed browser page URL, title, visible text, a limited list of interactive elements, and an optional PNG screenshot path when takeScreenshot is true.',
    parameters: {
        type: 'object',
        properties: {
            maxTextLength: {
                type: 'number',
                description: 'Optional maximum number of visible text characters to return.'
            },
            maxElements: {
                type: 'number',
                description: 'Optional maximum number of interactive elements to return.'
            },
            takeScreenshot: {
                type: 'boolean',
                description: 'Optional boolean. Set to true during web scraping or multi-step browsing to capture a PNG screenshot of the rendered page for visual inspection.'
            }
        }
    }
};

export const browserExtractPageSemanticsTool = {
    name: 'browserExtractPageSemantics',
    description: 'Extracts deep semantic page data (metadata, main article body, heading outline, landmarks, forms, and data tables) from a URL or active page in the managed browser.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'Optional target web URL. If provided, navigates to the URL before extraction.'
            },
            maxContentLength: {
                type: 'number',
                description: 'Optional maximum character length for extracted main body content. Defaults to 5000.'
            },
            includeTables: {
                type: 'boolean',
                description: 'Whether to extract and format HTML data tables as Markdown. Defaults to true.'
            },
            includeForms: {
                type: 'boolean',
                description: 'Whether to extract form fields and input structures. Defaults to true.'
            },
            includeOutline: {
                type: 'boolean',
                description: 'Whether to extract heading outline tree (h1-h6). Defaults to true.'
            },
            takeScreenshot: {
                type: 'boolean',
                description: 'Optional boolean. When true, captures a PNG screenshot after extraction.'
            }
        }
    }
};

export const browserClickTool = {
    name: 'browserClick',
    description: 'Clicks an element in the managed browser by CSS selector or visible text.',
    parameters: {
        type: 'object',
        properties: {
            selector: {
                type: 'string',
                description: 'Optional CSS selector for the element to click.'
            },
            text: {
                type: 'string',
                description: 'Optional visible text of the element to click when a selector is not provided.'
            },
            takeScreenshot: {
                type: 'boolean',
                description: 'Optional boolean. When true, captures a PNG screenshot of the page after clicking.'
            }
        }
    }
};

export const browserTypeTool = {
    name: 'browserType',
    description: 'Types text into an input in the managed browser by CSS selector or visible label/text.',
    parameters: {
        type: 'object',
        properties: {
            selector: {
                type: 'string',
                description: 'Optional CSS selector for the input or editable element.'
            },
            text: {
                type: 'string',
                description: 'Optional visible label, placeholder, or text near the input when a selector is not provided.'
            },
            value: {
                type: 'string',
                description: 'The text to type.'
            },
            clearFirst: {
                type: 'boolean',
                description: 'Whether to clear the field before typing. Defaults to true.'
            },
            takeScreenshot: {
                type: 'boolean',
                description: 'Optional boolean. When true, captures a PNG screenshot of the page after typing.'
            }
        },
        required: ['value']
    }
};

export const browserPressKeyTool = {
    name: 'browserPressKey',
    description: 'Presses a keyboard key in the managed browser, such as Enter, Escape, or Tab.',
    parameters: {
        type: 'object',
        properties: {
            key: {
                type: 'string',
                description: 'The Playwright key name to press, such as Enter, Escape, Tab, ArrowDown, or Control+A.'
            },
            takeScreenshot: {
                type: 'boolean',
                description: 'Optional boolean. When true, captures a PNG screenshot of the page after pressing the key.'
            }
        },
        required: ['key']
    }
};

export const browserScreenshotTool = {
    name: 'browserScreenshot',
    description: 'Captures the managed browser page as a PNG file.',
    parameters: {
        type: 'object',
        properties: {
            fileName: {
                type: 'string',
                description: 'Optional safe file name for the screenshot. The tool will save it as a PNG under the configured browser screenshot directory.'
            },
            fullPage: {
                type: 'boolean',
                description: 'Whether to capture the full scrollable page instead of the viewport. Defaults to false.'
            }
        }
    }
};

export const browserCloseTool = {
    name: 'browserClose',
    description: 'Closes the managed browser session and clears its page state.',
    parameters: {
        type: 'object',
        properties: {}
    }
};

export const scheduleReminderTool = {
    name: 'scheduleReminder',
    description: 'Schedules a one-time Telegram reminder for the current authorized chat. Use this when the user asks to be reminded at a clear future time. Convert relative times to an absolute ISO timestamp using the current local time from context; ask a follow-up if the time is ambiguous.',
    parameters: {
        type: 'object',
        properties: {
            message: {
                type: 'string',
                description: 'The reminder text to send when the reminder is due.'
            },
            nextRunAt: {
                type: 'string',
                description: 'Future run time as an ISO date/time string.'
            },
            title: {
                type: 'string',
                description: 'Optional short title for the reminder.'
            }
        },
        required: ['message', 'nextRunAt']
    }
};

export const scheduleAgentTaskTool = {
    name: 'scheduleAgentTask',
    description: 'Schedules a future or recurring agent task for the current authorized chat. Use this for requests like recurring checks or future task execution. Ask a follow-up when the exact time is ambiguous, such as "every morning" without a specific hour.',
    parameters: {
        type: 'object',
        properties: {
            prompt: {
                type: 'string',
                description: 'The exact agent prompt to run at the scheduled time.'
            },
            nextRunAt: {
                type: 'string',
                description: 'The first future run time as an ISO date/time string.'
            },
            title: {
                type: 'string',
                description: 'Optional short title for this scheduled task.'
            },
            recurrence: {
                type: 'object',
                description: 'Optional recurrence. Omit for one-time scheduled agent tasks.',
                properties: {
                    frequency: {
                        type: 'string',
                        description: 'daily, weekly, or interval.'
                    },
                    intervalMinutes: {
                        type: 'number',
                        description: 'Required only when frequency is interval.'
                    }
                }
            }
        },
        required: ['prompt', 'nextRunAt']
    }
};

export const listScheduledTasksTool = {
    name: 'listScheduledTasks',
    description: 'Lists scheduled reminders and agent tasks for the current authorized chat.',
    parameters: {
        type: 'object',
        properties: {
            includeInactive: {
                type: 'boolean',
                description: 'Whether to include completed, cancelled, or failed one-time tasks. Defaults to false.'
            }
        }
    }
};

export const cancelScheduledTaskTool = {
    name: 'cancelScheduledTask',
    description: 'Cancels a scheduled reminder or agent task for the current authorized chat by task ID.',
    parameters: {
        type: 'object',
        properties: {
            taskId: {
                type: 'string',
                description: 'The scheduled task ID returned when the task was created or listed.'
            }
        },
        required: ['taskId']
    }
};

export const extensionListTabsTool = {
    name: 'extensionListTabs',
    description: 'Lists all open tabs in the user\'s real desktop browser (Chrome/Brave/Edge) via the PC Assistant Chrome Extension.',
    parameters: {
        type: 'object',
        properties: {}
    }
};

export const extensionGetActiveTabTool = {
    name: 'extensionGetActiveTab',
    description: 'Gets details (URL, title, media playback, audio state) of the currently active/focused tab in the user\'s real browser via Chrome Extension.',
    parameters: {
        type: 'object',
        properties: {}
    }
};

export const extensionActivateTabTool = {
    name: 'extensionActivateTab',
    description: 'Activates and focuses a target browser tab by title, URL query, or tab ID via the Chrome Extension.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search string to match open tab title or URL (e.g. "YouTube Music").'
            },
            tabId: {
                type: 'number',
                description: 'Optional numeric Chrome tab ID.'
            }
        }
    }
};

export const extensionOpenUrlTool = {
    name: 'extensionOpenUrl',
    description: 'Navigates the active tab or opens a new tab with the given URL in the user\'s real browser via Chrome Extension.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The web URL to open or navigate to.'
            },
            tabQuery: {
                type: 'string',
                description: 'Optional search string to navigate a specific open tab instead of active tab.'
            },
            tabId: {
                type: 'number',
                description: 'Optional numeric Chrome tab ID.'
            },
            createNewTab: {
                type: 'boolean',
                description: 'Whether to open in a new tab. Defaults to false.'
            },
            active: {
                type: 'boolean',
                description: 'Whether the opened tab should become active/focused. Defaults to true.'
            }
        },
        required: ['url']
    }
};

export const extensionCloseTabTool = {
    name: 'extensionCloseTab',
    description: 'Closes a browser tab by title, URL query, or tab ID via Chrome Extension.',
    parameters: {
        type: 'object',
        properties: {
            tabQuery: {
                type: 'string',
                description: 'Optional search query to match tab title or URL to close.'
            },
            tabId: {
                type: 'number',
                description: 'Optional numeric Chrome tab ID.'
            }
        }
    }
};

export const extensionReloadTabTool = {
    name: 'extensionReloadTab',
    description: 'Reloads/refreshes a browser tab via Chrome Extension.',
    parameters: {
        type: 'object',
        properties: {
            tabQuery: {
                type: 'string',
                description: 'Optional search query to match tab title or URL.'
            },
            tabId: {
                type: 'number',
                description: 'Optional numeric Chrome tab ID.'
            }
        }
    }
};

export const extensionMediaControlTool = {
    name: 'extensionMediaControl',
    description: 'Controls media playback (play, pause, next track, previous track, seek, set volume, toggle captions, toggle like, get media info) inside real desktop browser tabs (YouTube, YouTube Music, Spotify, Netflix, etc.) via Chrome Extension.',
    parameters: {
        type: 'object',
        properties: {
            tabQuery: {
                type: 'string',
                description: 'Optional tab search query, such as "YouTube Music" or "Spotify".'
            },
            tabId: {
                type: 'number',
                description: 'Optional numeric Chrome tab ID.'
            },
            action: {
                type: 'string',
                description: 'Media action: playpause, play, pause, next, previous, seek, setvolume, togglecaptions, togglelike, or getmediainfo.'
            },
            seekSeconds: {
                type: 'number',
                description: 'Optional timestamp in seconds when action is "seek".'
            },
            volumePercent: {
                type: 'number',
                description: 'Optional volume level (0 to 100) when action is "setvolume".'
            }
        }
    }
};

export const extensionDomSnapshotTool = {
    name: 'extensionDomSnapshot',
    description: 'Extracts real-time URL, title, visible text, and interactive element selectors from a real browser tab via Chrome Extension.',
    parameters: {
        type: 'object',
        properties: {
            tabQuery: {
                type: 'string',
                description: 'Optional tab search query, e.g. "YouTube Music".'
            },
            tabId: {
                type: 'number',
                description: 'Optional numeric Chrome tab ID.'
            },
            maxTextLength: {
                type: 'number',
                description: 'Optional maximum text length.'
            },
            maxElements: {
                type: 'number',
                description: 'Optional maximum interactive elements limit.'
            }
        }
    }
};

export const extensionExtractPageSemanticsTool = {
    name: 'extensionExtractPageSemantics',
    description: 'Extracts deep semantic page data (metadata, main article body, heading outline, landmarks, forms, and data tables) from a real browser tab via Chrome Extension.',
    parameters: {
        type: 'object',
        properties: {
            tabQuery: {
                type: 'string',
                description: 'Optional tab search query, e.g. "YouTube Music" or "GitHub".'
            },
            tabId: {
                type: 'number',
                description: 'Optional numeric Chrome tab ID.'
            },
            maxContentLength: {
                type: 'number',
                description: 'Optional maximum content length for main text extraction. Defaults to 5000.'
            },
            includeTables: {
                type: 'boolean',
                description: 'Whether to extract and format HTML data tables as Markdown. Defaults to true.'
            },
            includeForms: {
                type: 'boolean',
                description: 'Whether to extract form fields and input structures. Defaults to true.'
            },
            includeOutline: {
                type: 'boolean',
                description: 'Whether to extract heading outline tree (h1-h6). Defaults to true.'
            }
        }
    }
};

export const extensionClickTool = {
    name: 'extensionClick',
    description: 'Clicks an element natively inside a real browser tab by index/elementId from accessibility tree, CSS selector, or visible text via Chrome Extension.',
    parameters: {
        type: 'object',
        properties: {
            tabQuery: {
                type: 'string',
                description: 'Optional tab search query.'
            },
            tabId: {
                type: 'number',
                description: 'Optional numeric Chrome tab ID.'
            },
            elementId: {
                type: 'number',
                description: 'Numeric index/id of the interactive element from extensionDomSnapshot accessibility tree (e.g. 1, 2, 3).'
            },
            selector: {
                type: 'string',
                description: 'Optional CSS selector of the element to click.'
            },
            text: {
                type: 'string',
                description: 'Optional visible text of the button or element.'
            }
        }
    }
};

export const extensionTypeTool = {
    name: 'extensionType',
    description: 'Fills text into an input field or contenteditable element (including WhatsApp Web, Lexical, React, Draft.js) inside a real browser tab via Chrome Extension.',
    parameters: {
        type: 'object',
        properties: {
            tabQuery: {
                type: 'string',
                description: 'Optional tab search query.'
            },
            tabId: {
                type: 'number',
                description: 'Optional numeric Chrome tab ID.'
            },
            elementId: {
                type: 'number',
                description: 'Numeric index/id of the input/contenteditable element from extensionDomSnapshot accessibility tree (e.g. 1, 2, 3).'
            },
            selector: {
                type: 'string',
                description: 'Optional CSS selector of the input element.'
            },
            text: {
                type: 'string',
                description: 'Optional visible label/placeholder text.'
            },
            value: {
                type: 'string',
                description: 'Text string to type.'
            },
            clearFirst: {
                type: 'boolean',
                description: 'Whether to clear field first. Defaults to true.'
            },
            pressEnter: {
                type: 'boolean',
                description: 'Whether to dispatch Enter key after typing (useful for chat forms like WhatsApp Web). Defaults to false.'
            }
        },
        required: ['value']
    }
};

export const extensionScrollTool = {
    name: 'extensionScroll',
    description: 'Scrolls a real browser tab (up, down, top, bottom, or to element) via Chrome Extension.',
    parameters: {
        type: 'object',
        properties: {
            tabQuery: {
                type: 'string',
                description: 'Optional tab search query.'
            },
            tabId: {
                type: 'number',
                description: 'Optional numeric Chrome tab ID.'
            },
            direction: {
                type: 'string',
                description: 'Direction to scroll: "down", "up", "top", or "bottom". Defaults to "down".'
            },
            amount: {
                type: 'number',
                description: 'Amount in pixels to scroll when direction is up or down. Defaults to 500.'
            },
            elementId: {
                type: 'number',
                description: 'Numeric index/id of an element to scroll directly into view.'
            },
            selector: {
                type: 'string',
                description: 'Optional CSS selector of an element to scroll directly into view.'
            }
        }
    }
};

export const extensionPressKeyTool = {
    name: 'extensionPressKey',
    description: 'Dispatches keyboard key presses (Enter, Escape, Tab, Arrow keys, etc.) to the active or targeted element in a real browser tab via Chrome Extension.',
    parameters: {
        type: 'object',
        properties: {
            tabQuery: {
                type: 'string',
                description: 'Optional tab search query.'
            },
            tabId: {
                type: 'number',
                description: 'Optional numeric Chrome tab ID.'
            },
            key: {
                type: 'string',
                description: 'Name of the key to press (e.g. "Enter", "Escape", "Tab", "ArrowDown", "Backspace"). Defaults to "Enter".'
            },
            code: {
                type: 'string',
                description: 'Optional KeyboardEvent code (e.g. "Enter", "Space").'
            },
            elementId: {
                type: 'number',
                description: 'Numeric index/id of target element from accessibility tree.'
            },
            selector: {
                type: 'string',
                description: 'Optional CSS selector of target element.'
            }
        }
    }
};

export const extensionExecuteJsTool = {
    name: 'extensionExecuteJs',
    description: 'Evaluates JavaScript inside a real browser tab via Chrome Extension.',
    parameters: {
        type: 'object',
        properties: {
            tabQuery: {
                type: 'string',
                description: 'Optional tab search query.'
            },
            tabId: {
                type: 'number',
                description: 'Optional numeric Chrome tab ID.'
            },
            jsCode: {
                type: 'string',
                description: 'JavaScript code snippet to execute inside the tab.'
            }
        },
        required: ['jsCode']
    }
};

export const extensionTakeScreenshotTool = {
    name: 'extensionTakeScreenshot',
    description: 'Captures a live PNG screenshot of a real desktop browser tab natively via Chrome Extension.',
    parameters: {
        type: 'object',
        properties: {
            tabQuery: {
                type: 'string',
                description: 'Optional tab search query.'
            },
            tabId: {
                type: 'number',
                description: 'Optional numeric Chrome tab ID.'
            }
        }
    }
};

export const generateImageTool = {
    name: 'generateImage',
    description: 'Generates a new AI image from a text prompt (using Imagen 3 or high-quality AI image generation) and saves it to disk.',
    parameters: {
        type: 'object',
        properties: {
            prompt: {
                type: 'string',
                description: 'Detailed description of the image to generate.'
            },
            outputPath: {
                type: 'string',
                description: 'Optional path where the generated image will be saved. Defaults to .data/generated_images/generated-<timestamp>.png.'
            },
            aspectRatio: {
                type: 'string',
                enum: ['1:1', '16:9', '4:3', '3:4', '9:16'],
                description: 'Desired aspect ratio (default "1:1").'
            },
            width: {
                type: 'number',
                description: 'Optional custom width in pixels.'
            },
            height: {
                type: 'number',
                description: 'Optional custom height in pixels.'
            },
            format: {
                type: 'string',
                enum: ['png', 'jpeg', 'jpg', 'webp'],
                description: 'Output format (default "png").'
            }
        },
        required: ['prompt']
    }
};

export const getImageInfoTool = {
    name: 'getImageInfo',
    description: 'Inspects image dimensions, format, color space, channels, aspect ratio, transparency (hasAlpha), and file size.',
    parameters: {
        type: 'object',
        properties: {
            inputPath: {
                type: 'string',
                description: 'The absolute, project-relative, or tilde path of the image file.'
            }
        },
        required: ['inputPath']
    }
};

export const removeImageBackgroundTool = {
    name: 'removeImageBackground',
    description: 'Removes the background from an image locally using AI, producing a transparent PNG or optional colored backdrop.',
    parameters: {
        type: 'object',
        properties: {
            inputPath: {
                type: 'string',
                description: 'Path of the source image to process.'
            },
            outputPath: {
                type: 'string',
                description: 'Optional path where the output image should be saved. Defaults to <dirname>/<basename>-nobg-<timestamp>.png.'
            },
            backgroundColor: {
                type: 'string',
                description: 'Optional replacement solid background color (e.g. "#ffffff", "white", "black"). If omitted, background is transparent.'
            }
        },
        required: ['inputPath']
    }
};

export const cropImageTool = {
    name: 'cropImage',
    description: 'Crops an image to a specified rectangular region [left, top, width, height] in pixels.',
    parameters: {
        type: 'object',
        properties: {
            inputPath: {
                type: 'string',
                description: 'Path of the image to crop.'
            },
            outputPath: {
                type: 'string',
                description: 'Optional output path. Defaults to <dirname>/<basename>-cropped-<timestamp>.ext.'
            },
            left: {
                type: 'number',
                description: 'X coordinate of the top-left corner of the crop region (default 0).'
            },
            top: {
                type: 'number',
                description: 'Y coordinate of the top-left corner of the crop region (default 0).'
            },
            width: {
                type: 'number',
                description: 'Width in pixels of the crop region.'
            },
            height: {
                type: 'number',
                description: 'Height in pixels of the crop region.'
            }
        },
        required: ['inputPath', 'width', 'height']
    }
};

export const resizeImageTool = {
    name: 'resizeImage',
    description: 'Resizes an image with high-quality resampling and configurable fit modes (cover, contain, fill, inside, outside).',
    parameters: {
        type: 'object',
        properties: {
            inputPath: {
                type: 'string',
                description: 'Path of the source image to resize.'
            },
            outputPath: {
                type: 'string',
                description: 'Optional output path.'
            },
            width: {
                type: 'number',
                description: 'Target width in pixels.'
            },
            height: {
                type: 'number',
                description: 'Target height in pixels.'
            },
            fit: {
                type: 'string',
                enum: ['cover', 'contain', 'fill', 'inside', 'outside'],
                description: 'How the image should fit into the dimensions (default "cover").'
            },
            position: {
                type: 'string',
                description: 'Position when fit is cover/contain ("center", "top", "bottom", "left", "right", "entropy", "attention").'
            },
            background: {
                type: 'string',
                description: 'Background color when fitting with letterboxing (contain), e.g. "#ffffff" or "#00000000".'
            },
            withoutEnlargement: {
                type: 'boolean',
                description: 'Do not enlarge if image is already smaller than target dimensions.'
            }
        },
        required: ['inputPath']
    }
};

export const rotateImageTool = {
    name: 'rotateImage',
    description: 'Rotates an image by specified degrees (e.g. 90, 180, 270) and/or flips vertically/horizontally.',
    parameters: {
        type: 'object',
        properties: {
            inputPath: {
                type: 'string',
                description: 'Path of the image to rotate.'
            },
            outputPath: {
                type: 'string',
                description: 'Optional output path.'
            },
            angle: {
                type: 'number',
                description: 'Angle of rotation in degrees (e.g. 90, 180, 270, 45). Default 0.'
            },
            flip: {
                type: 'boolean',
                description: 'Flip image vertically (default false).'
            },
            flop: {
                type: 'boolean',
                description: 'Flip image horizontally (default false).'
            },
            background: {
                type: 'string',
                description: 'Background color for non-perpendicular rotations (default transparent "#00000000").'
            }
        },
        required: ['inputPath']
    }
};

export const adjustImageTool = {
    name: 'adjustImage',
    description: 'Adjusts image colors, brightness, contrast, saturation, hue, sharpness, blur, gamma, grayscale, or invert.',
    parameters: {
        type: 'object',
        properties: {
            inputPath: {
                type: 'string',
                description: 'Path of the source image.'
            },
            outputPath: {
                type: 'string',
                description: 'Optional output path.'
            },
            brightness: {
                type: 'number',
                description: 'Brightness multiplier (e.g. 1.2 for +20% brightness, 0.8 for darker).'
            },
            contrast: {
                type: 'number',
                description: 'Contrast multiplier (e.g. 1.3 for increased contrast, 0.8 for decreased).'
            },
            saturation: {
                type: 'number',
                description: 'Saturation multiplier (e.g. 1.5 for vibrant, 0 for black & white).'
            },
            hue: {
                type: 'number',
                description: 'Hue rotation in degrees (e.g. 90, 180).'
            },
            grayscale: {
                type: 'boolean',
                description: 'Convert to 8-bit grayscale (black and white).'
            },
            invert: {
                type: 'boolean',
                description: 'Invert colors / negative.'
            },
            blur: {
                type: 'number',
                description: 'Blur sigma (e.g. 2 for light blur, 5 for heavy blur).'
            },
            sharpen: {
                type: 'number',
                description: 'Sharpen sigma (e.g. 1 for light sharpen, 3 for strong sharpen).'
            },
            tint: {
                type: 'string',
                description: 'Tint color to apply, e.g. "#ffaa00" for sepia/warm tone.'
            }
        },
        required: ['inputPath']
    }
};

export const convertImageTool = {
    name: 'convertImage',
    description: 'Converts an image between formats (PNG, JPEG, WebP, AVIF, TIFF, GIF) with quality/compression control.',
    parameters: {
        type: 'object',
        properties: {
            inputPath: {
                type: 'string',
                description: 'Path of the source image.'
            },
            outputPath: {
                type: 'string',
                description: 'Optional output path. If omitted, uses format extension.'
            },
            format: {
                type: 'string',
                enum: ['png', 'jpeg', 'jpg', 'webp', 'avif', 'tiff', 'gif'],
                description: 'Target format.'
            },
            quality: {
                type: 'number',
                description: 'Quality level from 1 to 100 (default 90).'
            },
            lossless: {
                type: 'boolean',
                description: 'Lossless compression (for webp / avif).'
            }
        },
        required: ['inputPath', 'format']
    }
};

export const compositeImagesTool = {
    name: 'compositeImages',
    description: 'Composites / overlays one or more images onto a base image (e.g. watermarking, layering, collage).',
    parameters: {
        type: 'object',
        properties: {
            baseImagePath: {
                type: 'string',
                description: 'Path to base/background image.'
            },
            overlays: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        imagePath: { type: 'string', description: 'Path to overlay image.' },
                        left: { type: 'number', description: 'Left pixel offset.' },
                        top: { type: 'number', description: 'Top pixel offset.' },
                        gravity: { type: 'string', description: 'Gravity placement (center, northwest, northeast, southeast, southwest).' },
                        blend: { type: 'string', description: 'Blend mode (over, multiply, screen, overlay, darken, lighten, etc.).' }
                    },
                    required: ['imagePath']
                },
                description: 'Array of overlay layers to composite on top.'
            },
            outputPath: {
                type: 'string',
                description: 'Optional output path.'
            }
        },
        required: ['baseImagePath', 'overlays']
    }
};

export const manipulateImageTool = {
    name: 'manipulateImage',
    description: 'Comprehensive multi-step image pipeline combining background removal, crop, resize, rotate, adjustments, trim, and format conversion in a single call.',
    parameters: {
        type: 'object',
        properties: {
            inputPath: {
                type: 'string',
                description: 'Path to the source image.'
            },
            outputPath: {
                type: 'string',
                description: 'Optional destination path.'
            },
            removeBackground: {
                type: 'boolean',
                description: 'Remove background using AI before other operations.'
            },
            backgroundColor: {
                type: 'string',
                description: 'Optional solid background color replacement.'
            },
            crop: {
                type: 'object',
                properties: {
                    left: { type: 'number' },
                    top: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' }
                },
                description: 'Crop bounding box.'
            },
            resize: {
                type: 'object',
                properties: {
                    width: { type: 'number' },
                    height: { type: 'number' },
                    fit: { type: 'string', enum: ['cover', 'contain', 'fill', 'inside', 'outside'] },
                    position: { type: 'string' },
                    background: { type: 'string' }
                },
                description: 'Resize options.'
            },
            rotate: {
                type: 'object',
                properties: {
                    angle: { type: 'number' },
                    flip: { type: 'boolean' },
                    flop: { type: 'boolean' }
                },
                description: 'Rotation and flipping.'
            },
            adjust: {
                type: 'object',
                properties: {
                    brightness: { type: 'number' },
                    contrast: { type: 'number' },
                    saturation: { type: 'number' },
                    hue: { type: 'number' },
                    grayscale: { type: 'boolean' },
                    invert: { type: 'boolean' },
                    blur: { type: 'number' },
                    sharpen: { type: 'number' }
                },
                description: 'Color and filter adjustments.'
            },
            trim: {
                type: 'boolean',
                description: 'Automatically trim background edges.'
            },
            format: {
                type: 'string',
                enum: ['png', 'jpeg', 'jpg', 'webp', 'avif', 'tiff', 'gif'],
                description: 'Target format conversion.'
            },
            quality: {
                type: 'number',
                description: 'Output quality (1-100).'
            }
        },
        required: ['inputPath']
    }
};

export const downloadFileTool = {
    name: 'downloadFile',
    description: 'Downloads any file from a direct HTTP/HTTPS URL and saves it to the laptop disk.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The direct HTTP or HTTPS URL of the file to download.'
            },
            outputPath: {
                type: 'string',
                description: 'Optional path or directory where the file should be saved. Defaults to .data/downloads/<filename>.'
            },
            filename: {
                type: 'string',
                description: 'Optional custom filename to save as.'
            },
            timeoutMs: {
                type: 'number',
                description: 'Optional download timeout in milliseconds (default 60000).'
            }
        },
        required: ['url']
    }
};

export const downloadMediaTool = {
    name: 'downloadMedia',
    description: 'Downloads videos or audio from web URLs (YouTube, Twitter/X, Instagram, TikTok, Reddit, Vimeo, SoundCloud, podcasts, or direct media streams) using yt-dlp.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The web page or video URL to download.'
            },
            outputPath: {
                type: 'string',
                description: 'Optional output path or destination directory. Defaults to .data/downloads/%(title)s.%(ext)s.'
            },
            extractAudio: {
                type: 'boolean',
                description: 'If true, extracts and saves only the audio stream (e.g. converting video to MP3 directly on download).'
            },
            audioFormat: {
                type: 'string',
                enum: ['mp3', 'm4a', 'wav', 'aac', 'flac', 'opus'],
                description: 'Audio format when extractAudio is true (default "mp3").'
            },
            videoQuality: {
                type: 'string',
                description: 'Desired video quality ("best", "1080p", "720p", "480p"). Default "best".'
            }
        },
        required: ['url']
    }
};

export const convertVideoToAudioTool = {
    name: 'convertVideoToAudio',
    description: 'Extracts audio from a video file and converts it to audio formats like MP3, M4A, WAV, AAC, FLAC, OGG, or OPUS.',
    parameters: {
        type: 'object',
        properties: {
            inputPath: {
                type: 'string',
                description: 'Path of the video file (e.g. mp4, mkv, mov, webm, avi).'
            },
            outputPath: {
                type: 'string',
                description: 'Optional output audio path. Defaults to <dirname>/<basename>-audio-<timestamp>.<format>.'
            },
            format: {
                type: 'string',
                enum: ['mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'opus'],
                description: 'Target audio format (default "mp3").'
            },
            audioBitrate: {
                type: 'string',
                description: 'Audio bitrate (e.g. "128k", "192k", "256k", "320k"). Default "192k".'
            },
            sampleRate: {
                type: 'number',
                description: 'Optional audio sample rate in Hz (e.g. 44100, 48000).'
            }
        },
        required: ['inputPath']
    }
};

export const convertMediaTool = {
    name: 'convertMedia',
    description: 'Transcodes, converts, rescales, or changes codecs/bitrates for video and audio files using FFmpeg.',
    parameters: {
        type: 'object',
        properties: {
            inputPath: {
                type: 'string',
                description: 'Path of the source media file.'
            },
            outputPath: {
                type: 'string',
                description: 'Optional output file path.'
            },
            format: {
                type: 'string',
                description: 'Target container format/extension (e.g. mp4, webm, mkv, mov, mp3, wav, m4a, flac, gif).'
            },
            videoCodec: {
                type: 'string',
                description: 'Optional video codec (e.g. "libx264", "libvpx-vp9", "copy").'
            },
            audioCodec: {
                type: 'string',
                description: 'Optional audio codec (e.g. "libmp3lame", "aac", "copy").'
            },
            videoBitrate: {
                type: 'string',
                description: 'Optional target video bitrate (e.g. "2M", "1500k").'
            },
            audioBitrate: {
                type: 'string',
                description: 'Optional target audio bitrate (e.g. "192k", "320k").'
            },
            resolution: {
                type: 'string',
                description: 'Optional target resolution (e.g. "1920x1080", "1280x720", "854x480", "1280:-1").'
            },
            fps: {
                type: 'number',
                description: 'Optional target frames per second (e.g. 30, 60).'
            },
            startTime: {
                type: 'string',
                description: 'Optional start time offset (e.g. "00:01:30" or "90").'
            },
            duration: {
                type: 'string',
                description: 'Optional duration limit in seconds or "HH:MM:SS".'
            }
        },
        required: ['inputPath']
    }
};

export const trimMediaTool = {
    name: 'trimMedia',
    description: 'Quickly trims / cuts a segment from a video or audio file with start and end/duration boundaries.',
    parameters: {
        type: 'object',
        properties: {
            inputPath: {
                type: 'string',
                description: 'Path of the media file to trim.'
            },
            outputPath: {
                type: 'string',
                description: 'Optional output path.'
            },
            startTime: {
                type: 'string',
                description: 'Start time timestamp (e.g. "00:00:15" or "15"). Default "0".'
            },
            endTime: {
                type: 'string',
                description: 'End time timestamp (e.g. "00:01:45" or "105").'
            },
            duration: {
                type: 'string',
                description: 'Duration in seconds or timestamp from startTime (e.g. "30" or "00:00:30").'
            }
        },
        required: ['inputPath']
    }
};

export const getMediaInfoTool = {
    name: 'getMediaInfo',
    description: 'Inspects detailed audio and video metadata (duration, format, resolution, fps, codecs, bitrates, audio channels) using ffprobe.',
    parameters: {
        type: 'object',
        properties: {
            inputPath: {
                type: 'string',
                description: 'Path of the video or audio file to inspect.'
            }
        },
        required: ['inputPath']
    }
};

export const compressMediaTool = {
    name: 'compressMedia',
    description: 'Compresses a video file to significantly reduce file size while maintaining good visual quality (great for Telegram limits).',
    parameters: {
        type: 'object',
        properties: {
            inputPath: {
                type: 'string',
                description: 'Path of the video file to compress.'
            },
            outputPath: {
                type: 'string',
                description: 'Optional output path.'
            },
            crf: {
                type: 'number',
                description: 'Constant Rate Factor quality (default 28; higher = smaller file size, e.g. 26-32).'
            },
            preset: {
                type: 'string',
                enum: ['ultrafast', 'fast', 'medium', 'slow'],
                description: 'Encoding speed preset (default "medium").'
            }
        },
        required: ['inputPath']
    }
};

export const videoToGifTool = {
    name: 'videoToGif',
    description: 'Converts a video clip into a high-quality animated GIF with custom resolution, framerate, and start/duration.',
    parameters: {
        type: 'object',
        properties: {
            inputPath: {
                type: 'string',
                description: 'Path of the video file.'
            },
            outputPath: {
                type: 'string',
                description: 'Optional output GIF path.'
            },
            fps: {
                type: 'number',
                description: 'Frame rate for the GIF (default 15).'
            },
            width: {
                type: 'number',
                description: 'Width in pixels, height scales automatically (default 480).'
            },
            startTime: {
                type: 'string',
                description: 'Optional start time in video (e.g. "00:00:05" or "5").'
            },
            duration: {
                type: 'string',
                description: 'Optional duration in seconds (e.g. "5" or "10").'
            }
        },
        required: ['inputPath']
    }
};

export const braveWebSearchTool = {
    name: 'braveWebSearch',
    description: 'Searches the web in real-time using Brave Search MCP / API, returning titles, URLs, descriptions, and snippets of top search results.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query or keywords to look up on the web.'
            },
            count: {
                type: 'number',
                description: 'Number of search results to return (1-20, default 10).'
            },
            country: {
                type: 'string',
                description: 'Optional 2-letter country code for localized search results (e.g. "US", "IN", "GB").'
            },
            searchLang: {
                type: 'string',
                description: 'Optional language code for search results (e.g. "en", "es").'
            }
        },
        required: ['query']
    }
};

export const braveLocalSearchTool = {
    name: 'braveLocalSearch',
    description: 'Searches for local businesses, places, addresses, and venues using Brave Local Search MCP / API.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Local query, such as "coffee shops in San Francisco" or "pizza near me".'
            },
            count: {
                type: 'number',
                description: 'Number of local results to return (default 5).'
            }
        },
        required: ['query']
    }
};

export const fetchUrlTool = {
    name: 'fetchUrl',
    description: 'Fetches webpage content and converts it to clean, readable Markdown text via Fetch MCP. Useful for reading web articles, documentation, or API specifications.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The full URL to fetch (e.g. "https://docs.docker.com/get-started/").'
            },
            maxLength: {
                type: 'number',
                description: 'Maximum number of characters to return (default 8000).'
            },
            startIndex: {
                type: 'number',
                description: 'Character index to start from for reading long documents (default 0).'
            },
            raw: {
                type: 'boolean',
                description: 'Whether to return the raw body without converting to Markdown (default false).'
            }
        },
        required: ['url']
    }
};

export const extractPdfTextTool = {
    name: 'extractPdfText',
    description: 'Extracts full text and page count from a local PDF file.',
    parameters: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Path of the PDF file to read.'
            },
            maxPages: {
                type: 'number',
                description: 'Optional maximum number of pages to parse.'
            }
        },
        required: ['filePath']
    }
};

export const extractPdfMetadataTool = {
    name: 'extractPdfMetadata',
    description: 'Extracts document metadata (author, title, creation date, producer, page count) from a PDF file.',
    parameters: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Path of the PDF file.'
            }
        },
        required: ['filePath']
    }
};

export const convertDocumentWithPandocTool = {
    name: 'convertDocumentWithPandoc',
    description: 'Converts documents between formats (Markdown, HTML, PDF, DOCX, LaTeX, RTF, TXT) using Pandoc or built-in conversion engines.',
    parameters: {
        type: 'object',
        properties: {
            inputPath: {
                type: 'string',
                description: 'Path of the source document.'
            },
            toFormat: {
                type: 'string',
                description: 'Target format extension, e.g. "html", "markdown", "pdf", "docx", "txt".'
            },
            outputPath: {
                type: 'string',
                description: 'Optional output destination path.'
            },
            fromFormat: {
                type: 'string',
                description: 'Optional source format override.'
            },
            extraArgs: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional additional CLI arguments to pass to Pandoc.'
            }
        },
        required: ['inputPath', 'toFormat']
    }
};

export const performVisionOcrTool = {
    name: 'performVisionOcr',
    description: 'Performs high-accuracy Optical Character Recognition (OCR) on an image file using native macOS Apple Vision framework or multimodal AI.',
    parameters: {
        type: 'object',
        properties: {
            imagePath: {
                type: 'string',
                description: 'Path of the image or screenshot to extract text from.'
            },
            recognitionLevel: {
                type: 'string',
                enum: ['accurate', 'fast'],
                description: 'Vision OCR recognition accuracy level (default "accurate").'
            }
        },
        required: ['imagePath']
    }
};

export const generateChartImageTool = {
    name: 'generateChartImage',
    description: 'Generates professional visual charts (bar, line, pie, doughnut, radar, scatter) from data or Vega-Lite specs and saves the rendered image to disk ready for Telegram delivery.',
    parameters: {
        type: 'object',
        properties: {
            chartType: {
                type: 'string',
                enum: ['bar', 'line', 'pie', 'doughnut', 'radar', 'scatter', 'bubble'],
                description: 'Type of chart to render (default "bar").'
            },
            title: {
                type: 'string',
                description: 'Chart header title.'
            },
            labels: {
                type: 'array',
                items: { type: 'string' },
                description: 'X-axis or category labels (e.g. ["Q1", "Q2", "Q3", "Q4"]).'
            },
            datasets: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        label: { type: 'string' },
                        data: { type: 'array', items: { type: 'number' } },
                        backgroundColor: { type: 'string' },
                        borderColor: { type: 'string' }
                    },
                    required: ['data']
                },
                description: 'Data series arrays and styling.'
            },
            chartConfig: {
                type: 'object',
                description: 'Optional full Chart.js configuration object.'
            },
            vegaLiteSpec: {
                type: 'object',
                description: 'Optional Vega-Lite specification object.'
            },
            width: {
                type: 'number',
                description: 'Image width in pixels (default 600).'
            },
            height: {
                type: 'number',
                description: 'Image height in pixels (default 400).'
            },
            outputPath: {
                type: 'string',
                description: 'Optional output PNG file path.'
            }
        }
    }
};

export const getYoutubeTranscriptTool = {
    name: 'getYoutubeTranscript',
    description: 'Fetches the complete text transcript, timestamps, durations, and chapters for a YouTube video URL or ID without downloading video/audio.',
    parameters: {
        type: 'object',
        properties: {
            videoUrl: {
                type: 'string',
                description: 'YouTube video URL or 11-character video ID.'
            },
            lang: {
                type: 'string',
                description: 'Preferred subtitle language code (default "en").'
            },
            includeChapters: {
                type: 'boolean',
                description: 'Whether to include video chapters in the output (default true).'
            }
        },
        required: ['videoUrl']
    }
};

export const parseSitemapTool = {
    name: 'parseSitemap',
    description: 'Fetches and parses a website sitemap (sitemap.xml or sitemap index), returning all indexed page URLs and last-modified dates.',
    parameters: {
        type: 'object',
        properties: {
            sitemapUrl: {
                type: 'string',
                description: 'URL of the sitemap.xml file or website domain.'
            }
        },
        required: ['sitemapUrl']
    }
};

export const crawlWebDocumentationTool = {
    name: 'crawlWebDocumentation',
    description: 'Crawls a documentation site recursively starting from a root URL up to maxPages, extracting clean Markdown for each page and optionally saving them locally.',
    parameters: {
        type: 'object',
        properties: {
            startUrl: {
                type: 'string',
                description: 'Starting documentation URL to crawl.'
            },
            maxPages: {
                type: 'number',
                description: 'Maximum number of pages to crawl (1-50, default 10).'
            },
            urlFilter: {
                type: 'string',
                description: 'Optional regex pattern to only crawl URLs matching specific paths (e.g. "/docs/" or "/guide/").'
            },
            saveToDirectory: {
                type: 'string',
                description: 'Optional local directory to save crawled Markdown files.'
            }
        },
        required: ['startUrl']
    }
};

export const getMacClipboardHistoryTool = {
    name: 'getMacClipboardHistory',
    description: 'Retrieves recent clipboard history items on macOS (integrating with Maccy or local assistant clipboard history).',
    parameters: {
        type: 'object',
        properties: {
            limit: {
                type: 'number',
                description: 'Number of recent clipboard entries to retrieve (default 10).'
            }
        }
    }
};

export const searchClipboardHistoryTool = {
    name: 'searchClipboardHistory',
    description: 'Searches through macOS clipboard history (Maccy / local history) for matching text, URLs, or code snippets.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search keyword to filter clipboard history.'
            },
            limit: {
                type: 'number',
                description: 'Maximum number of matches to return (default 10).'
            }
        },
        required: ['query']
    }
};

export const getCalendarEventsTool = {
    name: 'getCalendarEvents',
    description: 'Queries events from Apple Calendar within a date range.',
    parameters: {
        type: 'object',
        properties: {
            startDate: {
                type: 'string',
                description: 'Optional start date/time ISO string (defaults to start of today).'
            },
            endDate: {
                type: 'string',
                description: 'Optional end date/time ISO string (defaults to end of today).'
            },
            calendarName: {
                type: 'string',
                description: 'Optional calendar name filter (e.g. "Work", "Home").'
            }
        }
    }
};

export const createCalendarEventTool = {
    name: 'createCalendarEvent',
    description: 'Creates a new event in macOS Apple Calendar.',
    parameters: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: 'Title of the event.'
            },
            startDate: {
                type: 'string',
                description: 'Start date and time (ISO format or parseable date string).'
            },
            endDate: {
                type: 'string',
                description: 'Optional end date and time (defaults to 1 hour after start).'
            },
            location: {
                type: 'string',
                description: 'Optional location address or room.'
            },
            notes: {
                type: 'string',
                description: 'Optional description or meeting notes.'
            },
            calendarName: {
                type: 'string',
                description: 'Optional target calendar name.'
            }
        },
        required: ['title', 'startDate']
    }
};

export const createAppleReminderTool = {
    name: 'createAppleReminder',
    description: 'Creates a new task in macOS Apple Reminders with optional due date, priority, and list.',
    parameters: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: 'Reminder title.'
            },
            dueDate: {
                type: 'string',
                description: 'Optional due date/time (ISO format or date string).'
            },
            listName: {
                type: 'string',
                description: 'Optional target list name in Reminders.'
            },
            notes: {
                type: 'string',
                description: 'Optional reminder description.'
            },
            priority: {
                type: 'number',
                description: 'Priority level (0 = None, 1 = High, 5 = Medium, 9 = Low).'
            }
        },
        required: ['title']
    }
};

export const searchAppleNotesTool = {
    name: 'searchAppleNotes',
    description: 'Searches for notes in the macOS Apple Notes app by title or body content.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Text query to search for.'
            },
            limit: {
                type: 'number',
                description: 'Maximum number of notes to return (default 10).'
            }
        },
        required: ['query']
    }
};

export const readAppleNoteTool = {
    name: 'readAppleNote',
    description: 'Reads the full content of an Apple Note by title or ID.',
    parameters: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Title of the note to read.'
            },
            id: {
                type: 'string',
                description: 'Unique Apple Notes note ID.'
            }
        }
    }
};

export const createAppleNoteTool = {
    name: 'createAppleNote',
    description: 'Creates a new note in Apple Notes with title and body content.',
    parameters: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: 'Note title.'
            },
            body: {
                type: 'string',
                description: 'Note body content.'
            },
            folderName: {
                type: 'string',
                description: 'Optional folder name (e.g. "Notes", "Work").'
            }
        },
        required: ['title']
    }
};

export const appendAppleNoteTool = {
    name: 'appendAppleNote',
    description: 'Appends text or paragraphs to an existing note in Apple Notes.',
    parameters: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Title of the note to update.'
            },
            id: {
                type: 'string',
                description: 'Unique note ID.'
            },
            textToAppend: {
                type: 'string',
                description: 'Text content to append.'
            }
        },
        required: ['textToAppend']
    }
};

export const listAppleShortcutsTool = {
    name: 'listAppleShortcuts',
    description: 'Lists all user-configured shortcuts in the macOS Shortcuts app.',
    parameters: {
        type: 'object',
        properties: {}
    }
};

export const runAppleShortcutTool = {
    name: 'runAppleShortcut',
    description: 'Runs a native macOS Shortcut by name with optional input.',
    parameters: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Name of the Shortcut to run (e.g. "Morning Routine", "Focus Mode").'
            },
            input: {
                type: 'string',
                description: 'Optional input text passed to the shortcut.'
            }
        },
        required: ['name']
    }
};

export const sendVoiceNoteResponseTool = {
    name: 'sendVoiceNoteResponse',
    description: 'Generates a spoken audio voice note from text and delivers it directly to the user in Telegram.',
    parameters: {
        type: 'object',
        properties: {
            text: {
                type: 'string',
                description: 'Text message to speak and deliver as a voice note.'
            },
            voice: {
                type: 'string',
                description: 'Optional macOS voice name (e.g. "Samantha", "Daniel", "Karen").'
            },
            rate: {
                type: 'number',
                description: 'Speaking rate in words per minute (default 180).'
            }
        },
        required: ['text']
    }
};

export const speakTextTool = {
    name: 'speakText',
    description: 'Speaks text aloud on the Mac laptop speakers.',
    parameters: {
        type: 'object',
        properties: {
            text: {
                type: 'string',
                description: 'Text to speak aloud.'
            },
            voice: {
                type: 'string',
                description: 'Optional macOS voice name (e.g. "Samantha", "Daniel").'
            },
            rate: {
                type: 'number',
                description: 'Speaking rate (default 180).'
            }
        },
        required: ['text']
    }
};

export const transcribeAudioFileTool = {
    name: 'transcribeAudioFile',
    description: 'Transcribes any local audio recording file (MP3, M4A, WAV, OGG, AAC, FLAC) into accurate text transcripts.',
    parameters: {
        type: 'object',
        properties: {
            audioPath: {
                type: 'string',
                description: 'Path of the local audio file to transcribe.'
            },
            model: {
                type: 'string',
                description: 'Optional transcription model override (default gemini-2.5-flash).'
            }
        },
        required: ['audioPath']
    }
};

export const getStockPriceTool = {
    name: 'getStockPrice',
    description: 'Fetches real-time stock quotes, day price changes, percent changes, volume, and 52-week ranges.',
    parameters: {
        type: 'object',
        properties: {
            symbol: {
                type: 'string',
                description: 'Stock ticker symbol (e.g. "NVDA", "AAPL", "TSLA", "MSFT", "GOOGL").'
            }
        },
        required: ['symbol']
    }
};

export const getCryptoPriceTool = {
    name: 'getCryptoPrice',
    description: 'Fetches real-time cryptocurrency prices, 24h price changes, and market caps.',
    parameters: {
        type: 'object',
        properties: {
            symbol: {
                type: 'string',
                description: 'Cryptocurrency symbol or name (e.g. "BTC", "ETH", "SOL", "bitcoin", "dogecoin").'
            },
            vsCurrency: {
                type: 'string',
                description: 'Target fiat currency comparison (default "usd", or "eur", "inr", "gbp").'
            }
        },
        required: ['symbol']
    }
};

export const convertCurrencyTool = {
    name: 'convertCurrency',
    description: 'Converts between world fiat currencies using live foreign exchange rates.',
    parameters: {
        type: 'object',
        properties: {
            amount: {
                type: 'number',
                description: 'Amount of currency to convert (default 1).'
            },
            from: {
                type: 'string',
                description: 'Source 3-letter currency code (e.g. "USD", "EUR", "GBP", "INR").'
            },
            to: {
                type: 'string',
                description: 'Target 3-letter currency code (e.g. "EUR", "INR", "USD", "JPY").'
            }
        },
        required: ['from', 'to']
    }
};

export const listOpenWindowsTool = {
    name: 'listOpenWindows',
    description: 'Lists all open, visible application windows on macOS.',
    parameters: {
        type: 'object',
        properties: {}
    }
};

export const focusWindowTool = {
    name: 'focusWindow',
    description: 'Brings an application and its active window to the front/foreground.',
    parameters: {
        type: 'object',
        properties: {
            appName: {
                type: 'string',
                description: 'Name of the application to activate (e.g. "Code", "Google Chrome", "Terminal", "Slack").'
            }
        },
        required: ['appName']
    }
};

export const tileWindowsTool = {
    name: 'tileWindows',
    description: 'Arranges two application windows side-by-side (left 50% / right 50% split screen).',
    parameters: {
        type: 'object',
        properties: {
            leftApp: {
                type: 'string',
                description: 'Name of the app for the left half.'
            },
            rightApp: {
                type: 'string',
                description: 'Name of the app for the right half.'
            }
        },
        required: ['leftApp', 'rightApp']
    }
};

export const minimizeAllWindowsTool = {
    name: 'minimizeAllWindows',
    description: 'Minimizes/hides all active application windows to reveal the desktop.',
    parameters: {
        type: 'object',
        properties: {}
    }
};

export const generateQrCodeTool = {
    name: 'generateQrCode',
    description: 'Generates a high-resolution QR code PNG image from text, URL, or Wi-Fi credentials, ready to send via sendTelegramFile.',
    parameters: {
        type: 'object',
        properties: {
            text: {
                type: 'string',
                description: 'Text or URL to encode in the QR code.'
            },
            width: {
                type: 'number',
                description: 'Image width in pixels (default 400).'
            },
            margin: {
                type: 'number',
                description: 'White margin border size (default 2).'
            },
            color: {
                type: 'string',
                description: 'Dark module color hex (default "#000000").'
            },
            backgroundColor: {
                type: 'string',
                description: 'Background color hex (default "#ffffff").'
            },
            outputPath: {
                type: 'string',
                description: 'Optional custom PNG output file path.'
            }
        },
        required: ['text']
    }
};

export const connectBluetoothDeviceTool = {
    name: 'connectBluetoothDevice',
    description: 'Connects or disconnects paired Bluetooth devices (AirPods, wireless headphones, keyboard, mouse).',
    parameters: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Name of the Bluetooth device (e.g. "AirPods Pro", "MX Master 3S").'
            },
            disconnect: {
                type: 'boolean',
                description: 'Set to true to disconnect instead of connect (default false).'
            }
        },
        required: ['name']
    }
};

export const setDisplayBrightnessTool = {
    name: 'setDisplayBrightness',
    description: 'Adjusts MacBook screen and external monitor display brightness level (0 to 100%).',
    parameters: {
        type: 'object',
        properties: {
            brightness: {
                type: 'number',
                description: 'Brightness level from 0 to 100 percent.'
            }
        },
        required: ['brightness']
    }
};

export const playwrightSearchWebTool = {
    name: 'playwrightSearchWeb',
    description: 'Fast, deterministic search scraper via Playwright (DuckDuckGo/Google) returning organic search results with titles, links, and snippets.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query string.'
            },
            engine: {
                type: 'string',
                description: 'Search engine to use ("duckduckgo" or "google", default "duckduckgo").'
            },
            limit: {
                type: 'number',
                description: 'Maximum number of results (default 5).'
            },
            takeScreenshot: {
                type: 'boolean',
                description: 'Whether to take a PNG screenshot of the search results page.'
            }
        },
        required: ['query']
    }
};

export const playwrightYoutubeControlTool = {
    name: 'playwrightYoutubeControl',
    description: 'Fast deterministic YouTube interaction: search videos, play video by query or ID, pause/resume, seek, and get video details.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'Action to perform: "search", "play", "pause", "seek", "getVideoDetails".'
            },
            query: {
                type: 'string',
                description: 'Search query or video title.'
            },
            videoId: {
                type: 'string',
                description: 'Optional specific YouTube video ID (e.g. "dQw4w9WgXcQ").'
            },
            seekSeconds: {
                type: 'number',
                description: 'Seconds to seek to (for "seek" action).'
            },
            takeScreenshot: {
                type: 'boolean',
                description: 'Whether to capture a PNG screenshot.'
            }
        },
        required: ['action']
    }
};

export const playwrightExtractArticleTool = {
    name: 'playwrightExtractArticle',
    description: 'Extracts clean reader-mode article content from any webpage (stripping ads, navbars, and headers).',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'Webpage URL to extract article text from.'
            },
            takeScreenshot: {
                type: 'boolean',
                description: 'Whether to capture a screenshot.'
            }
        },
        required: ['url']
    }
};

export const aiWebAgentActTool = {
    name: 'aiWebAgentAct',
    description: 'Autonomous AI Web Agent (Stagehand-style). Solves high-level goals on dynamic/unknown webpages (multi-step navigation, form filling, SPAs, clicking) without predefined selectors.',
    parameters: {
        type: 'object',
        properties: {
            goal: {
                type: 'string',
                description: 'High-level natural language goal to accomplish on the page.'
            },
            url: {
                type: 'string',
                description: 'Optional initial URL to start navigation from.'
            },
            maxSteps: {
                type: 'number',
                description: 'Maximum action steps to execute (default 5, max 15).'
            },
            takeScreenshot: {
                type: 'boolean',
                description: 'Whether to capture screenshots during execution.'
            }
        },
        required: ['goal']
    }
};

export const aiWebAgentExtractTool = {
    name: 'aiWebAgentExtract',
    description: 'Autonomous AI data extractor (Stagehand-style). Uses LLM vision/semantics to extract structured JSON data from any arbitrary webpage according to instructions or schema.',
    parameters: {
        type: 'object',
        properties: {
            instruction: {
                type: 'string',
                description: 'Extraction instruction describing what data to extract.'
            },
            schema: {
                type: 'object',
                description: 'Optional JSON schema or example structure to match.'
            },
            url: {
                type: 'string',
                description: 'Optional URL to navigate to before extraction.'
            }
        },
        required: ['instruction']
    }
};

export const aiWebAgentObserveTool = {
    name: 'aiWebAgentObserve',
    description: 'Observes an arbitrary webpage and discovers the best actionable UI elements for a given user instruction.',
    parameters: {
        type: 'object',
        properties: {
            instruction: {
                type: 'string',
                description: 'Instruction or intention (e.g. "find sign up button", "locate filter options").'
            },
            url: {
                type: 'string',
                description: 'Optional webpage URL.'
            }
        },
        required: ['instruction']
    }
};

export const cdpConnectChromeTool = {
    name: 'cdpConnectChrome',
    description: 'Connects to your real, running Google Chrome instance via Chrome DevTools Protocol (CDP) on port 9222 to access personal logged-in sessions (Netflix, YouTube Music, Spotify).',
    parameters: {
        type: 'object',
        properties: {
            cdpUrl: {
                type: 'string',
                description: 'CDP endpoint URL (default "http://127.0.0.1:9222").'
            }
        }
    }
};

export const cdpListTabsTool = {
    name: 'cdpListTabs',
    description: 'Lists all open tabs in your real Google Chrome browser over CDP.',
    parameters: {
        type: 'object',
        properties: {
            cdpUrl: {
                type: 'string',
                description: 'CDP endpoint URL (default "http://127.0.0.1:9222").'
            }
        }
    }
};

export const cdpControlMediaTool = {
    name: 'cdpControlMedia',
    description: 'Controls media playback (play/pause, next track, previous, volume) in YouTube Music, Netflix, Spotify, or video tabs in your real Chrome browser without losing login state.',
    parameters: {
        type: 'object',
        properties: {
            tabQuery: {
                type: 'string',
                description: 'Tab search query (e.g. "music.youtube", "netflix", "spotify", "youtube").'
            },
            action: {
                type: 'string',
                description: 'Media action: "playpause", "next", "previous", "volumeUp", "volumeDown", "mute".'
            },
            cdpUrl: {
                type: 'string',
                description: 'CDP endpoint URL (default "http://127.0.0.1:9222").'
            }
        }
    }
};

export const cdpExecuteActionTool = {
    name: 'cdpExecuteAction',
    description: 'Executes actions (click, type, navigate, evaluate JS) directly inside any tab of your real logged-in Google Chrome browser via CDP.',
    parameters: {
        type: 'object',
        properties: {
            tabQuery: {
                type: 'string',
                description: 'Tab title or URL substring to target.'
            },
            action: {
                type: 'string',
                description: 'Action to execute: "click", "type", "navigate", "evaluate".'
            },
            selector: {
                type: 'string',
                description: 'CSS selector.'
            },
            text: {
                type: 'string',
                description: 'Text match.'
            },
            value: {
                type: 'string',
                description: 'Value to type or URL to navigate to.'
            },
            jsCode: {
                type: 'string',
                description: 'JavaScript code to evaluate in tab.'
            },
            takeScreenshot: {
                type: 'boolean',
                description: 'Whether to capture a screenshot of the tab.'
            },
            cdpUrl: {
                type: 'string',
                description: 'CDP endpoint URL.'
            }
        },
        required: ['action']
    }
};

export const cdpLaunchDebugChromeTool = {
    name: 'cdpLaunchDebugChrome',
    description: 'Helper to launch Google Chrome on macOS with remote debugging port 9222 enabled.',
    parameters: {
        type: 'object',
        properties: {
            port: {
                type: 'number',
                description: 'Remote debugging port (default 9222).'
            },
            profilePath: {
                type: 'string',
                description: 'Optional custom Chrome user data profile directory.'
            }
        }
    }
};

export const rememberUserFactTool = {
    name: 'rememberUserFact',
    description: 'Saves a persistent personal fact, preference, habit, or workflow guideline about the user into long-term memory so the agent always remembers it.',
    parameters: {
        type: 'object',
        properties: {
            fact: {
                type: 'string',
                description: 'The personal fact, habit, or preference to remember about the user.'
            },
            category: {
                type: 'string',
                description: 'Optional category for the fact: "identity", "work", "preference", "location", "contact", "guideline", or "general".'
            }
        },
        required: ['fact']
    }
};

export const getUserProfileTool = {
    name: 'getUserProfile',
    description: 'Retrieves the complete structured user profile including identity, preferences, preferred browser, tech stack, and learned personal facts.',
    parameters: {
        type: 'object',
        properties: {}
    }
};

export const updateUserProfileTool = {
    name: 'updateUserProfile',
    description: 'Updates structured profile attributes (name, role, location, email, preferredBrowser, defaultWorkspace, techStack, preferences) about the user.',
    parameters: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'User full name or nickname.' },
            role: { type: 'string', description: 'User job title or role.' },
            location: { type: 'string', description: 'User city/location.' },
            email: { type: 'string', description: 'User email address.' },
            preferredBrowser: { type: 'string', description: 'User preferred desktop browser.' },
            defaultWorkspace: { type: 'string', description: 'Primary project folder path.' },
            techStack: { type: 'array', items: { type: 'string' }, description: 'Technologies/languages used by the user.' }
        }
    }
};

export const searchUserMemoriesTool = {
    name: 'searchUserMemories',
    description: 'Searches across learned user facts, long-term knowledge memories, and past conversation history for specific topics or previous discussions.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search keyword or topic to look up in past conversations and user memories.'
            }
        },
        required: ['query']
    }
};

export const customTools = [
    fileReaderTool,
    fileWriterTool,
    listDirectoryTool,
    searchFilesTool,
    searchTextTool,
    findRecentFilesTool,
    executeTerminalCommandTool,
    openTerminalTool,
    openLocalTargetTool,
    controlDesktopBrowserTool,
    controlMediaPlaybackTool,
    extensionListTabsTool,
    extensionGetActiveTabTool,
    extensionActivateTabTool,
    extensionOpenUrlTool,
    extensionCloseTabTool,
    extensionReloadTabTool,
    extensionMediaControlTool,
    extensionDomSnapshotTool,
    extensionExtractPageSemanticsTool,
    extensionClickTool,
    extensionTypeTool,
    extensionScrollTool,
    extensionPressKeyTool,
    extensionExecuteJsTool,
    extensionTakeScreenshotTool,
    inspectProjectTool,
    runProjectTestsTool,
    runProjectLintTool,
    getGitStatusTool,
    summarizeGitDiffTool,
    createGitCommitTool,
    sendTelegramFileTool,
    readClipboardTool,
    writeClipboardTool,
    takeScreenshotTool,
    describeScreenTool,
    browserNavigateTool,
    browserSnapshotTool,
    browserExtractPageSemanticsTool,
    browserClickTool,
    browserTypeTool,
    browserPressKeyTool,
    browserScreenshotTool,
    browserCloseTool,
    playwrightSearchWebTool,
    playwrightYoutubeControlTool,
    playwrightExtractArticleTool,
    aiWebAgentActTool,
    aiWebAgentExtractTool,
    aiWebAgentObserveTool,
    cdpConnectChromeTool,
    cdpListTabsTool,
    cdpControlMediaTool,
    cdpExecuteActionTool,
    cdpLaunchDebugChromeTool,
    scheduleReminderTool,
    scheduleAgentTaskTool,
    listScheduledTasksTool,
    cancelScheduledTaskTool,
    generateImageTool,
    getImageInfoTool,
    removeImageBackgroundTool,
    cropImageTool,
    resizeImageTool,
    rotateImageTool,
    adjustImageTool,
    convertImageTool,
    compositeImagesTool,
    manipulateImageTool,
    downloadFileTool,
    downloadMediaTool,
    convertVideoToAudioTool,
    convertMediaTool,
    trimMediaTool,
    getMediaInfoTool,
    compressMediaTool,
    videoToGifTool,
    braveWebSearchTool,
    braveLocalSearchTool,
    fetchUrlTool,
    extractPdfTextTool,
    extractPdfMetadataTool,
    convertDocumentWithPandocTool,
    performVisionOcrTool,
    generateChartImageTool,
    getYoutubeTranscriptTool,
    parseSitemapTool,
    crawlWebDocumentationTool,
    getMacClipboardHistoryTool,
    searchClipboardHistoryTool,
    getCalendarEventsTool,
    createCalendarEventTool,
    createAppleReminderTool,
    searchAppleNotesTool,
    readAppleNoteTool,
    createAppleNoteTool,
    appendAppleNoteTool,
    listAppleShortcutsTool,
    runAppleShortcutTool,
    sendVoiceNoteResponseTool,
    speakTextTool,
    transcribeAudioFileTool,
    getStockPriceTool,
    getCryptoPriceTool,
    convertCurrencyTool,
    listOpenWindowsTool,
    focusWindowTool,
    tileWindowsTool,
    minimizeAllWindowsTool,
    generateQrCodeTool,
    connectBluetoothDeviceTool,
    setDisplayBrightnessTool,
    rememberUserFactTool,
    getUserProfileTool,
    updateUserProfileTool,
    searchUserMemoriesTool
];





