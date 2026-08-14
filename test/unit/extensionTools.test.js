import assert from 'node:assert/strict';
import test from 'node:test';
import { createExtensionTools } from '../../src/tools/implementations/extensionTools.js';

test('createExtensionTools returns ExtensionNotConnected when bridge is not connected', async () => {
    const tools = createExtensionTools();

    const result = await tools.extensionExtractPageSemantics({ tabQuery: 'test' });
    assert.equal(result.status, 'ExtensionNotConnected');
    assert.match(result.message, /PC Assistant Chrome Extension is not connected/);
});
