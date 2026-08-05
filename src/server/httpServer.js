import { initExtensionBridge } from './extensionBridge.js';

export function startHttpServer(app, port) {
    const server = app.listen(port, () => {
        console.log(`Local Orchestration Server running on port ${port}`);
    });
    initExtensionBridge(server);
    return server;
}
