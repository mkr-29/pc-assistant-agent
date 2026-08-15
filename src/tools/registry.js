import { applyToolApprovalGuard } from '../approvals/toolApprovalGuard.js';
import { createBrowserTools } from './implementations/browserTools.js';
import { createAppControlTools } from './implementations/appControlTools.js';
import { createClipboardTools } from './implementations/clipboardTools.js';
import { createDownloadTools } from './implementations/downloadTools.js';
import { createFilesystemTools } from './implementations/filesystemTools.js';
import { createImageTools } from './implementations/imageTools.js';
import { createMediaTools } from './implementations/mediaTools.js';
import { createProjectTools } from './implementations/projectTools.js';
import { createReminderTools } from './implementations/reminderTools.js';
import { createScreenTools } from './implementations/screenTools.js';
import { createTerminalTools } from './implementations/terminalTools.js';
import { createTelegramFileTools } from './implementations/telegramFileTools.js';

import { createExtensionTools } from './implementations/extensionTools.js';
import { createMcpTools } from './implementations/mcpTools.js';
import { createDocumentTools } from './implementations/documentTools.js';
import { createOcrTools } from './implementations/ocrTools.js';
import { createChartTools } from './implementations/chartTools.js';
import { createYoutubeTranscriptTools } from './implementations/youtubeTranscriptTools.js';
import { createCrawlerTools } from './implementations/crawlerTools.js';
import { createAppleTools } from './implementations/appleTools.js';
import { createVoiceResponseTools } from './implementations/voiceResponseTools.js';
import { createFinanceTools } from './implementations/financeTools.js';
import { createWindowTools } from './implementations/windowTools.js';
import { createQrTools } from './implementations/qrTools.js';
import { createHardwareTools } from './implementations/hardwareTools.js';

import { createAiWebAgentTools } from './implementations/aiWebAgentTools.js';
import { createCdpTools } from './implementations/cdpTools.js';
import { createMemoryTools } from './implementations/memoryTools.js';

export function createToolRegistry({
    bot,
    chatId,
    resolveToolPath,
    ai,
    config = {},
    reminderScheduler,
    approvalManager,
    userProfileStore,
    knowledgeMemoryStore,
    conversationHistoryStore
} = {}) {
    const browserTools = createBrowserTools({ config });
    const registry = {
        ...createAppControlTools({ resolveToolPath }),
        ...browserTools,
        ...createAiWebAgentTools({ browserTools, ai, config, resolveToolPath }),
        ...createCdpTools({ screenshotDirectory: config?.browser?.screenshotDirectory }),
        ...createMemoryTools({ userProfileStore, knowledgeMemoryStore, conversationHistoryStore, chatId }),
        ...createExtensionTools(),
        ...createMcpTools({ config }),
        ...createDocumentTools({ resolveToolPath }),
        ...createOcrTools({ resolveToolPath, ai, config }),
        ...createChartTools({ resolveToolPath }),
        ...createYoutubeTranscriptTools(),
        ...createCrawlerTools({ resolveToolPath }),
        ...createAppleTools(),
        ...createVoiceResponseTools({ bot, chatId, resolveToolPath, ai, config }),
        ...createFinanceTools(),
        ...createWindowTools(),
        ...createQrTools({ resolveToolPath }),
        ...createHardwareTools(),
        ...createClipboardTools(),
        ...createDownloadTools({ resolveToolPath }),
        ...createFilesystemTools({ resolveToolPath }),
        ...createImageTools({ resolveToolPath, ai, config }),
        ...createMediaTools({ resolveToolPath }),
        ...createProjectTools({ resolveToolPath }),
        ...createReminderTools({ chatId, reminderScheduler }),
        ...createScreenTools({ ai, config }),
        ...createTerminalTools({ resolveToolPath }),
        ...createTelegramFileTools({ bot, chatId, resolveToolPath })
    };

    return applyToolApprovalGuard({
        registry,
        chatId,
        config,
        resolveToolPath,
        approvalManager
    });
}


