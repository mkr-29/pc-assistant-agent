import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createWindowTools } from '../../src/tools/implementations/windowTools.js';

describe('windowTools', () => {
    it('returns error on non-macOS platforms', async () => {
        const tools = createWindowTools({ platform: 'linux' });
        const res = await tools.listOpenWindows();
        assert.equal(res.status, 'Error');
        assert.match(res.message, /only supported on macOS/i);
    });

    it('lists open application windows', async () => {
        const mockExec = (cmd, args, opts, cb) => {
            const callback = typeof opts === 'function' ? opts : cb;
            callback(null, 'Code|index.js - pc-assistant-agent\nGoogle Chrome|GitHub', '');
        };

        const tools = createWindowTools({ platform: 'darwin', execFileImpl: mockExec });
        const res = await tools.listOpenWindows();

        assert.equal(res.status, 'Success');
        assert.equal(res.totalWindows, 2);
        assert.equal(res.windows[0].application, 'Code');
        assert.equal(res.windows[0].title, 'index.js - pc-assistant-agent');
        assert.equal(res.windows[1].application, 'Google Chrome');
    });

    it('focuses an application window', async () => {
        const mockExec = (cmd, args, opts, cb) => {
            const callback = typeof opts === 'function' ? opts : cb;
            callback(null, '', '');
        };

        const tools = createWindowTools({ platform: 'darwin', execFileImpl: mockExec });
        const res = await tools.focusWindow({ appName: 'Visual Studio Code' });

        assert.equal(res.status, 'Success');
        assert.equal(res.application, 'Visual Studio Code');
    });

    it('tiles two application windows side by side', async () => {
        const mockExec = (cmd, args, opts, cb) => {
            const callback = typeof opts === 'function' ? opts : cb;
            callback(null, '', '');
        };

        const tools = createWindowTools({ platform: 'darwin', execFileImpl: mockExec });
        const res = await tools.tileWindows({ leftApp: 'Code', rightApp: 'Google Chrome' });

        assert.equal(res.status, 'Success');
        assert.equal(res.leftApp, 'Code');
        assert.equal(res.rightApp, 'Google Chrome');
    });

    it('minimizes all application windows', async () => {
        const mockExec = (cmd, args, opts, cb) => {
            const callback = typeof opts === 'function' ? opts : cb;
            callback(null, '', '');
        };

        const tools = createWindowTools({ platform: 'darwin', execFileImpl: mockExec });
        const res = await tools.minimizeAllWindows();

        assert.equal(res.status, 'Success');
    });
});
