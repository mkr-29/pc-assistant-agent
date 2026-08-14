import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createYoutubeTranscriptTools } from '../../src/tools/implementations/youtubeTranscriptTools.js';

describe('youtubeTranscriptTools', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('returns error when videoUrl is missing', async () => {
        const tools = createYoutubeTranscriptTools();
        const res = await tools.getYoutubeTranscript({});
        assert.equal(res.status, 'Error');
        assert.match(res.message, /video URL or ID is required/i);
    });

    it('returns error for invalid YouTube URLs', async () => {
        const tools = createYoutubeTranscriptTools();
        const res = await tools.getYoutubeTranscript({ videoUrl: 'https://vimeo.com/12345' });
        assert.equal(res.status, 'Error');
        assert.match(res.message, /could not extract a valid youtube video id/i);
    });

    it('parses timedtext transcript from YouTube watch page mock', async () => {
        const sampleXml = `
            <transcript>
                <text start="0.5" dur="2.0">Hello &amp; welcome to the video</text>
                <text start="2.5" dur="3.0">Today we learn about Node.js</text>
            </transcript>
        `;

        globalThis.fetch = async (url) => {
            if (url.includes('youtube.com/watch?v=')) {
                return {
                    ok: true,
                    text: async () => `
                        <html>
                        <head><title>Node.js Tutorial - YouTube</title></head>
                        <body>
                            <script>
                                var ytInitialPlayerResponse = {
                                    "videoDetails": { "title": "Node.js Tutorial", "author": "Code Academy", "lengthSeconds": "120" },
                                    "captions": {
                                        "playerCaptionsTracklistRenderer": {
                                            "captionTracks": [{ "baseUrl": "https://www.youtube.com/api/timedtext?v=test", "languageCode": "en" }]
                                        }
                                    }
                                };
                            </script>
                        </body>
                        </html>
                    `
                };
            }
            if (url.includes('timedtext')) {
                return {
                    ok: true,
                    text: async () => sampleXml
                };
            }
            return { ok: false };
        };

        const tools = createYoutubeTranscriptTools();
        const res = await tools.getYoutubeTranscript({ videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

        assert.equal(res.status, 'Success');
        assert.equal(res.videoId, 'dQw4w9WgXcQ');
        assert.equal(res.itemCount, 2);
        assert.equal(res.transcript[0].text, 'Hello & welcome to the video');
        assert.equal(res.transcript[1].text, 'Today we learn about Node.js');
        assert.ok(res.fullText.includes('Hello & welcome to the video Today we learn about Node.js'));
    });
});
