import { customTools } from '../definitions.js';

export const openAICompatibleTools = customTools.map(tool => ({
    type: 'function',
    function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
    }
}));

export const azureTools = openAICompatibleTools;

const categoryKeywords = {
    media: [
        'download', 'media', 'video', 'audio', 'mp3', 'mp4', 'm4a', 'wav', 'aac', 'flac', 'opus',
        'youtube', 'youtu.be', 'song', 'music', 'sound', 'clip', 'convert', 'extract', 'stream',
        'http', 'https', 'url', 'transcode', 'gif', 'compress', 'duration', 'bitrate'
    ],
    image: [
        'image', 'photo', 'picture', 'draw', 'generate', 'crop', 'background', 'png', 'jpg', 'jpeg',
        'webp', 'resize', 'rotate', 'filter', 'contrast', 'brightness', 'nobg', 'watermark', 'composite',
        'qr', 'barcode'
    ],
    browser: [
        'browser', 'navigate', 'webpage', 'click', 'playwright', 'scrape', 'crawl', 'site', 'page', 'html',
        'stagehand', 'agent', 'cdp', 'netflix', 'spotify', 'youtube', 'extract', 'observe', 'act'
    ],
    extension: [
        'chrome', 'tab', 'brave', 'safari', 'extension', 'play', 'pause', 'volume', 'mute'
    ],
    coding: [
        'code', 'test', 'lint', 'git', 'commit', 'diff', 'repo', 'search', 'project', 'bug', 'fix', 'script'
    ],
    scheduling: [
        'remind', 'reminder', 'schedule', 'timer', 'alarm', 'recurring', 'task', 'later', 'tomorrow', 'cron',
        'calendar', 'event', 'meeting', 'appointment'
    ],
    search: [
        'search', 'brave', 'google', 'lookup', 'find', 'fetch', 'url', 'web', 'website', 'page', 'doc',
        'docs', 'documentation', 'latest', 'news', 'query', 'article', 'online', 'http', 'https',
        'pdf', 'pandoc', 'convert', 'sitemap', 'crawl', 'ocr', 'chart', 'plot', 'graph', 'youtube', 'transcript',
        'note', 'notes'
    ],
    finance: [
        'stock', 'stocks', 'share', 'shares', 'price', 'quote', 'market', 'nasdaq', 'nyse',
        'crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'coin', 'token',
        'currency', 'exchange', 'forex', 'convert', 'usd', 'eur', 'inr', 'gbp', 'jpy'
    ],
    system: [
        'screen', 'screenshot', 'clipboard', 'copy', 'paste', 'terminal', 'history', 'maccy',
        'shortcut', 'shortcuts', 'voice', 'speak', 'say', 'tts', 'transcribe', 'audio',
        'window', 'windows', 'focus', 'tile', 'minimize', 'bluetooth', 'airpods', 'brightness', 'display'
    ]
};

const toolCategories = {
    playwrightSearchWeb: 'browser',
    playwrightYoutubeControl: 'browser',
    playwrightExtractArticle: 'browser',
    aiWebAgentAct: 'browser',
    aiWebAgentExtract: 'browser',
    aiWebAgentObserve: 'browser',
    cdpConnectChrome: 'browser',
    cdpListTabs: 'browser',
    cdpControlMedia: 'browser',
    cdpExecuteAction: 'browser',
    cdpLaunchDebugChrome: 'browser',
    listOpenWindows: 'system',
    focusWindow: 'system',
    tileWindows: 'system',
    minimizeAllWindows: 'system',
    generateQrCode: 'image',
    connectBluetoothDevice: 'system',
    setDisplayBrightness: 'system',
    getCalendarEvents: 'scheduling',
    createCalendarEvent: 'scheduling',
    createAppleReminder: 'scheduling',
    searchAppleNotes: 'search',
    readAppleNote: 'search',
    createAppleNote: 'search',
    appendAppleNote: 'search',
    listAppleShortcuts: 'system',
    runAppleShortcut: 'system',
    sendVoiceNoteResponse: 'system',
    speakText: 'system',
    transcribeAudioFile: 'media',
    getStockPrice: 'finance',
    getCryptoPrice: 'finance',
    convertCurrency: 'finance',
    braveWebSearch: 'search',
    braveLocalSearch: 'search',
    fetchUrl: 'search',
    extractPdfText: 'search',
    extractPdfMetadata: 'search',
    convertDocumentWithPandoc: 'search',
    parseSitemap: 'search',
    crawlWebDocumentation: 'search',
    getYoutubeTranscript: 'media',
    generateChartImage: 'image',
    performVisionOcr: 'image',
    getMacClipboardHistory: 'system',
    searchClipboardHistory: 'system',
    downloadFile: 'media',
    downloadMedia: 'media',
    convertVideoToAudio: 'media',
    convertMedia: 'media',
    trimMedia: 'media',
    getMediaInfo: 'media',
    compressMedia: 'media',
    videoToGif: 'media',
    generateImage: 'image',
    getImageInfo: 'image',
    removeImageBackground: 'image',
    cropImage: 'image',
    resizeImage: 'image',
    rotateImage: 'image',
    adjustImage: 'image',
    convertImage: 'image',
    compositeImages: 'image',
    manipulateImage: 'image',
    browserNavigate: 'browser',
    browserSnapshot: 'browser',
    browserExtractPageSemantics: 'browser',
    browserClick: 'browser',
    browserType: 'browser',
    browserPressKey: 'browser',
    browserScreenshot: 'browser',
    browserClose: 'browser',
    extensionListTabs: 'extension',
    extensionGetActiveTab: 'extension',
    extensionActivateTab: 'extension',
    extensionOpenUrl: 'extension',
    extensionCloseTab: 'extension',
    extensionReloadTab: 'extension',
    extensionMediaControl: 'extension',
    extensionDomSnapshot: 'extension',
    extensionExtractPageSemantics: 'extension',
    extensionClick: 'extension',
    extensionType: 'extension',
    extensionScroll: 'extension',
    extensionPressKey: 'extension',
    extensionExecuteJs: 'extension',
    extensionTakeScreenshot: 'extension',
    controlDesktopBrowser: 'extension',
    controlMediaPlayback: 'extension',
    inspectProject: 'coding',
    runProjectTests: 'coding',
    runProjectLint: 'coding',
    getGitStatus: 'coding',
    summarizeGitDiff: 'coding',
    createGitCommit: 'coding',
    searchFiles: 'coding',
    searchText: 'coding',
    findRecentFiles: 'coding',
    scheduleReminder: 'scheduling',
    scheduleAgentTask: 'scheduling',
    listScheduledTasks: 'scheduling',
    cancelScheduledTask: 'scheduling',
    takeScreenshot: 'system',
    describeScreen: 'system',
    readClipboard: 'system',
    writeClipboard: 'system',
    openTerminal: 'system'
};

const CORE_TOOL_NAMES = new Set([
    'executeCommand',
    'readFile',
    'writeFile',
    'listDirectory',
    'sendTelegramFile',
    'openLocalTarget'
]);

export function selectRelevantOpenAITools(userPrompt = '', allTools = openAICompatibleTools, maxTools = 20) {
    if (!userPrompt || typeof userPrompt !== 'string') {
        return allTools;
    }

    const prompt = userPrompt.toLowerCase();
    const matchedCategories = new Set();

    for (const [cat, words] of Object.entries(categoryKeywords)) {
        if (words.some(w => prompt.includes(w))) {
            matchedCategories.add(cat);
        }
    }

    const selected = allTools.filter(tool => {
        const name = tool.function?.name || tool.name;
        if (CORE_TOOL_NAMES.has(name)) return true;
        const cat = toolCategories[name];
        return cat && matchedCategories.has(cat);
    });

    if (selected.length >= 4) {
        return selected;
    }

    return allTools.slice(0, maxTools);
}
