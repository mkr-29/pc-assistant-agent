import fs from 'fs';
import path from 'path';

const DEFAULT_CHARTS_DIR = path.resolve(process.cwd(), '.data/charts');

function formatTimestamp(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}

export function createChartTools({ resolveToolPath = p => p, chartDirectory = DEFAULT_CHARTS_DIR } = {}) {
    return {
        generateChartImage: async ({
            chartType = 'bar',
            title = '',
            labels = [],
            datasets = [],
            chartConfig = null,
            vegaLiteSpec = null,
            width = 600,
            height = 400,
            backgroundColor = 'white',
            outputPath = null
        } = {}) => {
            try {
                let finalConfig = chartConfig;

                if (!finalConfig && vegaLiteSpec) {
                    finalConfig = {
                        type: 'vega-lite',
                        data: vegaLiteSpec
                    };
                } else if (!finalConfig) {
                    const formattedDatasets = Array.isArray(datasets)
                        ? datasets.map((ds, idx) => {
                            if (typeof ds === 'object' && ds !== null) {
                                return {
                                    label: ds.label || `Series ${idx + 1}`,
                                    data: Array.isArray(ds.data) ? ds.data : [],
                                    backgroundColor: ds.backgroundColor || undefined,
                                    borderColor: ds.borderColor || undefined,
                                    fill: ds.fill !== undefined ? ds.fill : false
                                };
                            }
                            return { label: `Series ${idx + 1}`, data: [] };
                        })
                        : [];

                    finalConfig = {
                        type: chartType,
                        data: {
                            labels: Array.isArray(labels) ? labels : [],
                            datasets: formattedDatasets
                        },
                        options: {
                            responsive: true,
                            plugins: {
                                title: title ? { display: true, text: title, font: { size: 16 } } : { display: false },
                                legend: { display: formattedDatasets.length > 0 }
                            }
                        }
                    };
                }

                const postBody = {
                    chart: finalConfig,
                    width: Math.max(200, Math.min(Number(width) || 600, 1920)),
                    height: Math.max(150, Math.min(Number(height) || 400, 1080)),
                    backgroundColor: backgroundColor || 'white',
                    format: 'png'
                };

                const response = await fetch('https://quickchart.io/chart', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(postBody)
                });

                if (!response.ok) {
                    const errorMsg = await response.text();
                    return {
                        status: 'Error',
                        statusCode: response.status,
                        message: `QuickChart API error (${response.status}): ${errorMsg}`
                    };
                }

                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                const savePath = outputPath
                    ? resolveToolPath(outputPath)
                    : path.join(chartDirectory, `chart-${chartType}-${formatTimestamp()}.png`);

                fs.mkdirSync(path.dirname(savePath), { recursive: true });
                fs.writeFileSync(savePath, buffer);

                return {
                    status: 'Success',
                    filePath: savePath,
                    chartType,
                    width: postBody.width,
                    height: postBody.height,
                    fileSizeBytes: buffer.length,
                    message: `Chart generated successfully and saved to ${savePath}. Send it to Telegram with sendTelegramFile.`
                };
            } catch (error) {
                return {
                    status: 'Error',
                    message: `Failed to generate chart: ${error.message}`
                };
            }
        }
    };
}
