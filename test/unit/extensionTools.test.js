import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createExtensionTools } from '../../src/tools/implementations/extensionTools.js';

describe('extensionTools', () => {
    it('returns ExtensionNotConnected when extension bridge is not connected', async () => {
        const tools = createExtensionTools();

        const tabRes = await tools.extensionListTabs();
        assert.equal(tabRes.status, 'ExtensionNotConnected');
        assert.match(tabRes.message, /PC Assistant Chrome Extension is not connected/);

        const activeRes = await tools.extensionGetActiveTab();
        assert.equal(activeRes.status, 'ExtensionNotConnected');

        const openRes = await tools.extensionOpenUrl({ url: 'https://example.com' });
        assert.equal(openRes.status, 'Success');
        assert.equal(openRes.url, 'https://example.com');
        assert.match(openRes.message, /Opened https:\/\/example.com/);

        const closeRes = await tools.extensionCloseTab({ tabQuery: 'example' });
        assert.equal(closeRes.status, 'ExtensionNotConnected');

        const reloadRes = await tools.extensionReloadTab({ tabQuery: 'example' });
        assert.equal(reloadRes.status, 'ExtensionNotConnected');

        const mediaRes = await tools.extensionMediaControl({ action: 'playpause' });
        assert.equal(mediaRes.status, 'ExtensionNotConnected');

        const snapshotRes = await tools.extensionDomSnapshot();
        assert.equal(snapshotRes.status, 'ExtensionNotConnected');

        const semanticsRes = await tools.extensionExtractPageSemantics();
        assert.equal(semanticsRes.status, 'ExtensionNotConnected');

        const clickRes = await tools.extensionClick({ selector: 'button' });
        assert.equal(clickRes.status, 'ExtensionNotConnected');

        const typeRes = await tools.extensionType({ selector: 'input', value: 'hello' });
        assert.equal(typeRes.status, 'ExtensionNotConnected');

        const scrollRes = await tools.extensionScroll({ direction: 'down' });
        assert.equal(scrollRes.status, 'ExtensionNotConnected');

        const keyRes = await tools.extensionPressKey({ key: 'Enter' });
        assert.equal(keyRes.status, 'ExtensionNotConnected');

        const jsRes = await tools.extensionExecuteJs({ jsCode: 'document.title' });
        assert.equal(jsRes.status, 'ExtensionNotConnected');

        const shotRes = await tools.extensionTakeScreenshot();
        assert.equal(shotRes.status, 'ExtensionNotConnected');
    });
});
