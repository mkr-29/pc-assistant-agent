import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHardwareTools } from '../../src/tools/implementations/hardwareTools.js';

describe('hardwareTools', () => {
    it('returns error on non-macOS platforms', async () => {
        const tools = createHardwareTools({ platform: 'linux' });
        const res = await tools.connectBluetoothDevice({ name: 'AirPods' });
        assert.equal(res.status, 'Error');
        assert.match(res.message, /only supported on macOS/i);
    });

    describe('connectBluetoothDevice', () => {
        it('returns error when device name is missing', async () => {
            const tools = createHardwareTools({ platform: 'darwin' });
            const res = await tools.connectBluetoothDevice({});
            assert.equal(res.status, 'Error');
            assert.match(res.message, /device name is required/i);
        });

        it('connects to bluetooth device via blueutil', async () => {
            const mockExec = (cmd, args, opts, cb) => {
                const callback = typeof opts === 'function' ? opts : cb;
                assert.equal(cmd, 'blueutil');
                assert.deepEqual(args, ['--connect', 'AirPods Pro']);
                callback(null, '', '');
            };

            const tools = createHardwareTools({ platform: 'darwin', execFileImpl: mockExec });
            const res = await tools.connectBluetoothDevice({ name: 'AirPods Pro' });

            assert.equal(res.status, 'Success');
            assert.equal(res.device, 'AirPods Pro');
            assert.equal(res.action, 'connect');
        });

        it('disconnects bluetooth device via blueutil', async () => {
            const mockExec = (cmd, args, opts, cb) => {
                const callback = typeof opts === 'function' ? opts : cb;
                assert.equal(cmd, 'blueutil');
                assert.deepEqual(args, ['--disconnect', 'AirPods Pro']);
                callback(null, '', '');
            };

            const tools = createHardwareTools({ platform: 'darwin', execFileImpl: mockExec });
            const res = await tools.connectBluetoothDevice({ name: 'AirPods Pro', disconnect: true });

            assert.equal(res.status, 'Success');
            assert.equal(res.action, 'disconnect');
        });
    });

    describe('setDisplayBrightness', () => {
        it('returns error when brightness is missing', async () => {
            const tools = createHardwareTools({ platform: 'darwin' });
            const res = await tools.setDisplayBrightness({});
            assert.equal(res.status, 'Error');
            assert.match(res.message, /brightness.*is required/i);
        });

        it('sets display brightness via brightness cli', async () => {
            const mockExec = (cmd, args, opts, cb) => {
                const callback = typeof opts === 'function' ? opts : cb;
                assert.equal(cmd, 'brightness');
                assert.deepEqual(args, ['0.75']);
                callback(null, '', '');
            };

            const tools = createHardwareTools({ platform: 'darwin', execFileImpl: mockExec });
            const res = await tools.setDisplayBrightness({ brightness: 75 });

            assert.equal(res.status, 'Success');
            assert.equal(res.brightnessPercent, 75);
        });
    });
});
