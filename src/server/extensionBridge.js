import { WebSocketServer } from 'ws';

let activeExtensionSocket = null;
const pendingRequests = new Map();
let requestIdCounter = 0;

export function initExtensionBridge(server) {
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
        let pathname = '';
        try {
            const host = request.headers.host || 'localhost';
            const parsedUrl = new URL(request.url, `http://${host}`);
            pathname = parsedUrl.pathname;
        } catch {
            pathname = request.url || '';
        }

        if (pathname === '/agent-bridge' || pathname === '/agent-bridge/' || pathname.startsWith('/agent-bridge')) {
            wss.handleUpgrade(request, socket, head, ws => {
                wss.emit('connection', ws, request);
            });
        }
    });

    wss.on('connection', ws => {
        console.log('[Extension Bridge] Chrome Extension connected.');
        activeExtensionSocket = ws;

        ws.on('message', data => {
            let response = null;
            try {
                response = JSON.parse(data.toString());
            } catch {
                return;
            }

            if (response && response.type === 'PING') {
                try {
                    ws.send(JSON.stringify({ type: 'PONG' }));
                } catch {
                    // ignore send errors
                }
                return;
            }

            const { requestId } = response;
            if (requestId && pendingRequests.has(requestId)) {
                const { resolve } = pendingRequests.get(requestId);
                pendingRequests.delete(requestId);
                resolve(response);
            }
        });

        ws.on('close', () => {
            console.log('[Extension Bridge] Chrome Extension disconnected.');
            if (activeExtensionSocket === ws) {
                activeExtensionSocket = null;
            }
        });
    });
}

export function isExtensionConnected() {
    return Boolean(activeExtensionSocket && activeExtensionSocket.readyState === 1);
}

export function sendCommandToExtension({ action, payload = {}, timeoutMs = 10000 }) {
    return new Promise((resolve, reject) => {
        if (!isExtensionConnected()) {
            reject(new Error('PC Assistant Chrome Extension is not connected. Load unpacked extension from pc-assistant-extension in Chrome/Brave.'));
            return;
        }

        const requestId = `req_${Date.now()}_${++requestIdCounter}`;
        const timeoutTimer = setTimeout(() => {
            if (pendingRequests.has(requestId)) {
                pendingRequests.delete(requestId);
                reject(new Error(`Extension request '${action}' timed out after ${timeoutMs}ms.`));
            }
        }, timeoutMs);

        pendingRequests.set(requestId, {
            resolve: responseData => {
                clearTimeout(timeoutTimer);
                resolve(responseData);
            }
        });

        activeExtensionSocket.send(JSON.stringify({
            requestId,
            action,
            payload
        }));
    });
}
