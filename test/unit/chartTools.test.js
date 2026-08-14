import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createChartTools } from '../../src/tools/implementations/chartTools.js';

describe('chartTools', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('generates a bar chart and writes PNG file to chartDirectory', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chart-test-'));

        globalThis.fetch = async (url, options) => {
            assert.equal(url, 'https://quickchart.io/chart');
            const body = JSON.parse(options.body);
            assert.equal(body.chart.type, 'bar');
            assert.deepEqual(body.chart.data.labels, ['Q1', 'Q2', 'Q3']);

            return {
                ok: true,
                status: 200,
                arrayBuffer: async () => Buffer.from('fake-png-chart-data')
            };
        };

        const tools = createChartTools({ chartDirectory: tempDir, resolveToolPath: p => p });
        const res = await tools.generateChartImage({
            chartType: 'bar',
            title: 'Quarterly Revenue',
            labels: ['Q1', 'Q2', 'Q3'],
            datasets: [{ label: 'Revenue', data: [100, 200, 300] }]
        });

        assert.equal(res.status, 'Success');
        assert.equal(res.chartType, 'bar');
        assert.ok(fs.existsSync(res.filePath));

        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('handles QuickChart API error responses gracefully', async () => {
        globalThis.fetch = async () => ({
            ok: false,
            status: 400,
            text: async () => 'Invalid chart configuration'
        });

        const tools = createChartTools();
        const res = await tools.generateChartImage({ chartType: 'pie' });

        assert.equal(res.status, 'Error');
        assert.equal(res.statusCode, 400);
        assert.match(res.message, /Invalid chart configuration/i);
    });
});
