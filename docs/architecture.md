# Architecture

The assistant is organized around four runtime boundaries:

1. Telegram receives a user message through polling or the webhook route.
2. The agent runner selects the configured provider and prepares tool access for the chat.
3. The LLM client executes a provider-specific tool loop.
4. Tool implementations perform local filesystem, project workflow, scheduling, terminal, managed browser, or Telegram file-send side effects.
5. The reminder scheduler restores local scheduled tasks on startup and sends due Telegram notifications or scheduled agent results.

```mermaid
flowchart TD
  main["src/main.js"] --> app["src/app.js"]
  main --> telegramBot["telegram/botClient.js"]
  main --> reminderScheduler["reminders/reminderScheduler.js"]
  app --> routes["server/routes.js"]
  routes --> messageHandler["telegram/messageHandler.js"]
  telegramBot --> messageHandler
  messageHandler --> agentRunner["agent/runAgent.js"]
  reminderScheduler --> agentRunner
  reminderScheduler --> telegramBot
  reminderScheduler --> reminderStore["reminders/reminderStore.js"]
  agentRunner --> modelRouter["llm/modelRouter.js"]
  agentRunner --> toolRegistry["tools/registry.js"]
  modelRouter --> geminiClient["llm/geminiClient.js"]
  modelRouter --> azureClient["llm/azureOpenAIClient.js"]
  toolRegistry --> browserTools["tools/implementations/browserTools.js"]
  toolRegistry --> fileTools["tools/implementations/filesystemTools.js"]
  toolRegistry --> projectTools["tools/implementations/projectTools.js"]
  toolRegistry --> reminderTools["tools/implementations/reminderTools.js"]
  toolRegistry --> terminalTools["tools/implementations/terminalTools.js"]
  toolRegistry --> telegramFileTools["tools/implementations/telegramFileTools.js"]
```

The tool registry is the main safety boundary. Any new capability that touches the local machine should be added under `src/tools/implementations/` and exposed through `src/tools/registry.js`.

Scheduled reminders and agent tasks are stored in `.data/scheduled-tasks.json`. The scheduler uses this local store to recover pending tasks after restart, but tasks can only run while the Node process is active.
