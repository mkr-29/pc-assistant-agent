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

export function createToolRegistry({
    bot,
    chatId,
    resolveToolPath,
    ai,
    config,
    reminderScheduler,
    approvalManager
}) {
    const registry = {
        ...createAppControlTools({ resolveToolPath }),
        ...createBrowserTools({ config }),
        ...createExtensionTools(),
        ...createMcpTools({ config }),
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


