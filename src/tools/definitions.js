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
    description: 'Lists all open tabs in the user\'s real desktop browser via the PC Assistant Chrome Extension.',
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

export const extensionMediaControlTool = {
    name: 'extensionMediaControl',
    description: 'Controls media playback (play, pause, next, previous) inside real desktop browser tabs via the Chrome Extension.',
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
                description: 'Media action: playpause, play, pause, next, or previous.'
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
    description: 'Clicks an element natively inside a real browser tab by CSS selector or visible text via Chrome Extension.',
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
    description: 'Fills text into an input field inside a real browser tab via Chrome Extension.',
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
            }
        },
        required: ['value']
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
    extensionActivateTabTool,
    extensionMediaControlTool,
    extensionDomSnapshotTool,
    extensionExtractPageSemanticsTool,
    extensionClickTool,
    extensionTypeTool,
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
    manipulateImageTool
];
